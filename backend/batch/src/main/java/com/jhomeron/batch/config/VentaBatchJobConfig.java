package com.jhomeron.batch.config;

import com.jhomeron.batch.model.VentaDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.launch.support.RunIdIncrementer;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.database.JdbcBatchItemWriter;
import org.springframework.batch.item.database.JdbcCursorItemReader;
import org.springframework.batch.item.file.FlatFileItemWriter;
import org.springframework.batch.item.support.CompositeItemWriter;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Optional;

/**
 * Pipeline Batch ETL para Ventas:
 * Step 1: Extraer desde SQL Server (SP_EXTRAER_VENTAS) y guardar en staging.ventas (Neon)
 * Step 2: Transformar y poblar Modelo Estrella (dwh.*) llamando al SP dwh.sp_cargar_modelo_estrella()
 */
@Configuration
public class VentaBatchJobConfig {

    private static final Logger log = LoggerFactory.getLogger(VentaBatchJobConfig.class);

    @Bean
    public Step extraerVentasStep(JobRepository jobRepository,
                                  PlatformTransactionManager transactionManager,
                                  JdbcCursorItemReader<VentaDTO> readerVentasSql,
                                  JdbcBatchItemWriter<VentaDTO> ventaWriter,
                                  FlatFileItemWriter<VentaDTO> logVentaWriter) {
        log.info("Configurando Step 1: extraerVentasStep (SQL Server sp_ExtraerVentas -> Neon staging.ventas + Logging local)");

        CompositeItemWriter<VentaDTO> compositeItemWriter = new CompositeItemWriter<>();
        compositeItemWriter.setDelegates(Arrays.asList(logVentaWriter, ventaWriter));

        return new StepBuilder("extraerVentasStep", jobRepository)
                .<VentaDTO, VentaDTO>chunk(100, transactionManager)
                .reader(readerVentasSql)
                .writer(compositeItemWriter)
                .build();
    }

    @Bean
    public Step cargarModeloEstrellaStep(JobRepository jobRepository,
                                         PlatformTransactionManager transactionManager,
                                         @Qualifier("stagingDataSource") DataSource stagingDataSource) {
        log.info("Configurando Step 2: cargarModeloEstrellaStep (staging.ventas -> dwh.* Modelo Estrella)");

        return new StepBuilder("cargarModeloEstrellaStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    log.info("Ejecutando procedimiento de transformación y carga dwh.sp_cargar_modelo_estrella() en Neon...");
                    JdbcTemplate jdbcTemplate = new JdbcTemplate(stagingDataSource);
                    jdbcTemplate.execute("CALL dwh.sp_cargar_modelo_estrella();");
                    log.info("¡Carga al Modelo Estrella completada exitosamente en Neon!");
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    /**
     * Step 3: Actualiza el watermark (staging.control_carga) con la fecha hasta la
     * cual se extrajo hoy, para que la siguiente corrida del job solo pida a SAP
     * las fechas nuevas y no vuelva a insertar lo que ya está en staging/dwh.
     */
    @Bean
    public Step actualizarWatermarkStep(JobRepository jobRepository,
                                        PlatformTransactionManager transactionManager,
                                        @Qualifier("stagingDataSource") DataSource stagingDataSource) {
        log.info("Configurando Step 3: actualizarWatermarkStep (registra hasta qué fecha se extrajo)");

        return new StepBuilder("actualizarWatermarkStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    JdbcTemplate jdbcTemplate = new JdbcTemplate(stagingDataSource);

                    Optional<StepExecution> extraccion = chunkContext.getStepContext()
                            .getStepExecution().getJobExecution().getStepExecutions().stream()
                            .filter(se -> se.getStepName().equals("extraerVentasStep"))
                            .findFirst();
                    long registrosExtraidos = extraccion.map(StepExecution::getWriteCount).orElse(0L);

                    LocalDate fechaHasta = LocalDate.now();
                    jdbcTemplate.update(
                            "INSERT INTO staging.control_carga (job_name, fecha_hasta_procesada, fecha_ejecucion, registros_extraidos) " +
                            "VALUES (?, ?, CURRENT_TIMESTAMP, ?) " +
                            "ON CONFLICT (job_name) DO UPDATE SET " +
                            "fecha_hasta_procesada = EXCLUDED.fecha_hasta_procesada, " +
                            "fecha_ejecucion = EXCLUDED.fecha_ejecucion, " +
                            "registros_extraidos = EXCLUDED.registros_extraidos",
                            "ventaEtlJob", fechaHasta, registrosExtraidos);

                    log.info("Watermark actualizado: ventaEtlJob procesado hasta {} ({} registros extraídos en esta corrida)",
                            fechaHasta, registrosExtraidos);
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    @Bean
    public Job ventaEtlJob(JobRepository jobRepository,
                           @Qualifier("extraerVentasStep") Step extraerVentasStep,
                           @Qualifier("cargarModeloEstrellaStep") Step cargarModeloEstrellaStep,
                           @Qualifier("actualizarWatermarkStep") Step actualizarWatermarkStep) {
        log.info("Construyendo Job 'ventaEtlJob' (Extracción -> Staging -> Modelo Estrella -> Watermark)");

        return new JobBuilder("ventaEtlJob", jobRepository)
                .incrementer(new RunIdIncrementer())
                .start(extraerVentasStep)
                .next(cargarModeloEstrellaStep)
                .next(actualizarWatermarkStep)
                .build();
    }
}
