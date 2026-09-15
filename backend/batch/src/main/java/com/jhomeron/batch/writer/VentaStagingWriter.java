package com.jhomeron.batch.writer;

import com.jhomeron.batch.model.VentaDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.item.database.JdbcBatchItemWriter;
import org.springframework.batch.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.batch.item.file.FlatFileItemWriter;
import org.springframework.batch.item.file.builder.FlatFileItemWriterBuilder;
import org.springframework.batch.item.file.transform.PassThroughLineAggregator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;

import javax.sql.DataSource;
import java.io.File;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Writer para insertar las líneas de venta extraídas de SQL Server en la tabla staging.ventas.
 */
@Configuration
public class VentaStagingWriter {

    private static final Logger log = LoggerFactory.getLogger(VentaStagingWriter.class);

    @Bean
    public JdbcBatchItemWriter<VentaDTO> ventaWriter(@Qualifier("stagingDataSource") DataSource stagingDataSource) {
        String sql = "INSERT INTO staging.ventas (" +
                "fecha_contabilizacion, fecha_documento, fecha_vencimiento, tipo, serie, numero, " +
                "ruc, razon_social, empleado_venta, numero_articulo, descripcion_articulo, unidad_medida, " +
                "cantidad, valor_unitario, total_venta_me, moneda, tipo_cambio, total_venta_mn, " +
                "ciudad, distrito, departamento, source, estado" +
                ") VALUES (" +
                ":fechaContabilizacion, :fechaDocumento, :fechaVencimiento, :tipo, :serie, :numero, " +
                ":ruc, :razonSocial, :empleadoVenta, :numeroArticulo, :descripcionArticulo, :unidadMedida, " +
                ":cantidad, :valorUnitario, :totalVentaMe, :moneda, :tipoCambio, :totalVentaMn, " +
                ":ciudad, :distrito, :departamento, :source, :estado" +
                ")";

        log.info("Configurando JdbcBatchItemWriter para tabla staging.ventas en DataSource destino");

        return new JdbcBatchItemWriterBuilder<VentaDTO>()
                .dataSource(stagingDataSource)
                .sql(sql)
                .beanMapped()
                .build();
    }

    @Bean
    @StepScope
    public FlatFileItemWriter<VentaDTO> logVentaWriter() {
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        File logDir = new File("logs/" + datePath);
        if (!logDir.exists()) {
            logDir.mkdirs();
        }
        
        File logFile = new File(logDir, "extraccion.log");
        log.info("Configurando FlatFileItemWriter para guardar logs en {}", logFile.getAbsolutePath());

        return new FlatFileItemWriterBuilder<VentaDTO>()
                .name("logVentaWriter")
                .resource(new FileSystemResource(logFile))
                .append(true)
                .lineAggregator(new PassThroughLineAggregator<>())
                .build();
    }
}
