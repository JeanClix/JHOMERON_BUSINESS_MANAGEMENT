package com.jhomeron.batch.config;

import com.jhomeron.batch.model.PedidoDTO;
import com.jhomeron.batch.processor.PedidoProcessor;
import com.jhomeron.batch.reader.CsvFileReader;
import com.jhomeron.batch.reader.SapHanaReader;
import com.jhomeron.batch.writer.StagingWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.job.parameters.RunIdIncrementer;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.infrastructure.item.database.JdbcBatchItemWriter;
import org.springframework.batch.infrastructure.item.file.FlatFileItemReader;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;

/**
 * Configuracion del Job de Spring Batch ETL.
 *
 * FLUJO:
 *   Reader (CSV o SAP) --> Processor (validacion/transformacion) --> Writer (PostgreSQL staging)
 *
 * PERFILES:
 *   - dev:  Job "pedidoCsvJob" que lee desde CSV
 *   - prod: Job "pedidoSapJob" que lee desde SAP HANA via JDBC
 *
 * Cada job tiene UN step con chunk processing (lotes de 100 registros).
 */
@Configuration
public class BatchJobConfig {

    private static final Logger log = LoggerFactory.getLogger(BatchJobConfig.class);

    private final CsvFileReader csvFileReader;
    private final SapHanaReader sapHanaReader;
    private final PedidoProcessor processor;
    private final StagingWriter stagingWriter;

    public BatchJobConfig(CsvFileReader csvFileReader, SapHanaReader sapHanaReader,
                          PedidoProcessor processor, StagingWriter stagingWriter) {
        this.csvFileReader = csvFileReader;
        this.sapHanaReader = sapHanaReader;
        this.processor = processor;
        this.stagingWriter = stagingWriter;
    }

    /**
     * Job para perfil DEV: lee pedidos desde CSV y los escribe en H2 (staging).
     * Se ejecuta cuando el perfil activo es "dev".
     */
    @Bean
    @Profile("dev")
    public Job pedidoCsvJob(JobRepository jobRepository,
                            PlatformTransactionManager transactionManager) {
        log.info("Creando job para modo DEV (CSV -> H2 staging)");

        FlatFileItemReader<PedidoDTO> reader = csvFileReader.reader();
        JdbcBatchItemWriter<PedidoDTO> writer = stagingWriter.stagingWriter(null);

        var csvStep = new StepBuilder("csvStep", jobRepository)
                .<PedidoDTO, PedidoDTO>chunk(100, transactionManager)
                .reader(reader)
                .processor(processor)
                .writer(writer)
                .build();

        return new JobBuilder("pedidoCsvJob", jobRepository)
                .incrementer(new RunIdIncrementer())
                .flow(csvStep)
                .end()
                .build();
    }

    /**
     * Job para perfil PROD: lee pedidos desde SAP HANA via JDBC
     * ejecutando un stored procedure, y los escribe en PostgreSQL staging.
     * Se ejecuta cuando el perfil activo es "prod".
     */
    @Bean
    @Profile("prod")
    public Job pedidoSapJob(JobRepository jobRepository,
                            PlatformTransactionManager transactionManager,
                            DataSource sapDataSource) {
        log.info("Creando job para modo PROD (SAP HANA -> PostgreSQL staging)");

        var reader = sapHanaReader.reader(sapDataSource);
        JdbcBatchItemWriter<PedidoDTO> writer = stagingWriter.stagingWriter(null);

        var sapStep = new StepBuilder("sapStep", jobRepository)
                .<PedidoDTO, PedidoDTO>chunk(100, transactionManager)
                .reader(reader)
                .processor(processor)
                .writer(writer)
                .build();

        return new JobBuilder("pedidoSapJob", jobRepository)
                .incrementer(new RunIdIncrementer())
                .flow(sapStep)
                .end()
                .build();
    }
}
