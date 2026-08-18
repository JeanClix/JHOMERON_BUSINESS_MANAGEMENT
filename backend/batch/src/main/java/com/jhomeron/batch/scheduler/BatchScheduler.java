package com.jhomeron.batch.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.job.Job;
import org.springframework.batch.core.job.parameters.JobParameters;
import org.springframework.batch.core.job.parameters.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Scheduler para ejecucion automatica del batch ETL.
 *
 * COMO FUNCIONA:
 *   - Se activa con: batch.scheduling.enabled=true (en application.yaml)
 *   - Ejecuta el batch segun el cron configurado (default: 2:00 AM diario)
 *   - En perfil dev ejecuta el job CSV, en prod ejecuta el job SAP
 *   - Tambien se puede llamar manualmente via ejecutarManual()
 *
 * CONFIGURACION CRON:
 *   batch.scheduling.cron="0 0 2 * * *"    -> 2:00 AM todos los dias
 *   batch.scheduling.cron="0 30 3 * * *"    -> 3:30 AM todos los dias
 *   batch.scheduling.cron="0 0 0/6 * * *"   -> Cada 6 horas
 *
 * EJECUCION MANUAL:
 *   Se puede llamar desde un endpoint REST, un boton en la UI, etc.
 *   Ejemplo: batchScheduler.ejecutarManual("SAP");
 *
 * NOTA: Cada ejecucion genera un JobParameters con timestamp unico
 *       para evitar conflictos con ejecuciones anteriores.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "batch.scheduling.enabled", havingValue = "true")
public class BatchScheduler {

    private static final Logger log = LoggerFactory.getLogger(BatchScheduler.class);

    private final JobLauncher jobLauncher;
    private final Job pedidoCsvJob;
    private final Job pedidoSapJob;

    public BatchScheduler(JobLauncher jobLauncher,
                          @Qualifier("pedidoCsvJob") Job pedidoCsvJob,
                          @Qualifier("pedidoSapJob") Job pedidoSapJob) {
        this.jobLauncher = jobLauncher;
        this.pedidoCsvJob = pedidoCsvJob;
        this.pedidoSapJob = pedidoSapJob;
    }

    /**
     * Ejecucion programada del batch segun el cron configurado.
     * Detecta automaticamente el perfil activo y ejecuta el job correspondiente.
     */
    @Scheduled(cron = "${batch.scheduling.cron:0 0 2 * * *}")
    public void ejecutarBatchProgramado() {
        log.info("=== Iniciando ejecucion programada del batch ===");
        log.info("Fecha/Hora: {}", LocalDateTime.now().format(
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        try {
            JobParameters params = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .addString("source", "SCHEDULED")
                    .toJobParameters();

            // Seleccionar job segun perfil activo
            var jobName = System.getProperty("spring.profiles.active", "dev");
            Job job = "prod".equals(jobName) ? pedidoSapJob : pedidoCsvJob;

            var execution = jobLauncher.run(job, params);

            log.info("Batch completado con estado: {}", execution.getStatus());

        } catch (Exception e) {
            log.error("Error durante la ejecucion programada del batch: {}",
                    e.getMessage(), e);
        }

        log.info("=== Fin de ejecucion programada del batch ===");
    }

    /**
     * Ejecucion manual del batch.
     * Se puede llamar desde un endpoint REST o desde la UI.
     *
     * @param source "SAP" para usar SAP HANA, cualquier otro valor para CSV
     */
    public void ejecutarManual(String source) {
        log.info("=== Ejecucion manual del batch (source: {}) ===", source);

        try {
            JobParameters params = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .addString("source", source != null ? source : "MANUAL")
                    .toJobParameters();

            Job job = "SAP".equalsIgnoreCase(source) ? pedidoSapJob : pedidoCsvJob;

            var execution = jobLauncher.run(job, params);

            log.info("Batch manual completado con estado: {}", execution.getStatus());

        } catch (Exception e) {
            log.error("Error durante la ejecucion manual del batch: {}",
                    e.getMessage(), e);
        }

        log.info("=== Fin de ejecucion manual del batch ===");
    }
}
