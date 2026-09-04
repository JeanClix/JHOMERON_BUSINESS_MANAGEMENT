package com.jhomeron.batch.writer;

import com.jhomeron.batch.model.VentaDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.item.database.JdbcBatchItemWriter;
import org.springframework.batch.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * Writer para insertar las líneas de venta extraídas de SQL Server en la tabla staging.ventas.
 */
@Configuration
public class VentaStagingWriter {

    private static final Logger log = LoggerFactory.getLogger(VentaStagingWriter.class);

    @Bean
    public JdbcBatchItemWriter<VentaDTO> ventaWriter(@Qualifier("stagingDataSource") DataSource stagingDataSource) {
        String sql = "INSERT INTO staging.ventas (" +
                "doc_entry, doc_line, fecha, codigo_cliente, cliente, departamento, provincia, distrito, " +
                "codigo_vendedor, vendedor, codigo_producto, producto, categoria, condicion_pago, " +
                "cantidad, precio_unitario, base_imponible, importe_total, igv, source, estado" +
                ") VALUES (" +
                ":docEntry, :docLine, :fecha, :codigoCliente, :cliente, :departamento, :provincia, :distrito, " +
                ":codigoVendedor, :vendedor, :codigoProducto, :producto, :categoria, :condicionPago, " +
                ":cantidad, :precioUnitario, :baseImponible, :importeTotal, :igv, :source, :estado" +
                ")";

        log.info("Configurando JdbcBatchItemWriter para tabla staging.ventas en DataSource destino");

        return new JdbcBatchItemWriterBuilder<VentaDTO>()
                .dataSource(stagingDataSource)
                .sql(sql)
                .beanMapped()
                .build();
    }
}
