package com.jhomeron.batch.reader;

import com.jhomeron.batch.model.VentaDTO;
import org.springframework.batch.item.database.JdbcCursorItemReader;
import org.springframework.batch.item.database.builder.JdbcCursorItemReaderBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.PreparedStatementSetter;

import javax.sql.DataSource;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Qualifier;

@Configuration
public class SqlServerVentaReader {

    @Bean
    public JdbcCursorItemReader<VentaDTO> readerVentasSql(@Qualifier("sqlServerDataSource") DataSource dataSource) {
        // Rango de fechas para extracción histórica (configurable)
        LocalDate fechaDesde = LocalDate.of(2000, 1, 1);
        LocalDate fechaHasta = LocalDate.of(2026, 12, 31);

        return new JdbcCursorItemReaderBuilder<VentaDTO>()
                .name("ventasSqlServerReader")
                .dataSource(dataSource)
                .sql("EXEC dbo.SP_EXTRAER_VENTAS @FechaDesde = ?, @FechaHasta = ?")
                .preparedStatementSetter(new PreparedStatementSetter() {
                    @Override
                    public void setValues(PreparedStatement ps) throws SQLException {
                        ps.setDate(1, Date.valueOf(fechaDesde));
                        ps.setDate(2, Date.valueOf(fechaHasta));
                    }
                })
                .rowMapper((rs, rowNum) -> VentaDTO.builder()
                        .docEntry(rs.getInt("DocEntry"))
                        .docLine(rs.getInt("DocLine"))
                        .fecha(rs.getDate("Fecha") != null ? rs.getDate("Fecha").toLocalDate() : null)
                        .codigoCliente(rs.getString("CodigoCliente"))
                        .cliente(rs.getString("Cliente"))
                        .departamento(rs.getString("Departamento"))
                        .provincia(rs.getString("Provincia"))
                        .distrito(rs.getString("Distrito"))
                        .codigoVendedor(rs.getObject("CodigoVendedor") != null ? rs.getInt("CodigoVendedor") : null)
                        .vendedor(rs.getString("Vendedor"))
                        .codigoProducto(rs.getString("CodigoProducto"))
                        .producto(rs.getString("Producto"))
                        .categoria(rs.getString("Categoria"))
                        .condicionPago(rs.getString("CondicionPago"))
                        .cantidad(rs.getBigDecimal("Cantidad"))
                        .precioUnitario(rs.getBigDecimal("PrecioUnitario"))
                        .baseImponible(rs.getBigDecimal("BaseImponible"))
                        .importeTotal(rs.getBigDecimal("ImporteTotal"))
                        .igv(rs.getBigDecimal("IGV"))
                        .source("SAP")
                        .estado("PENDIENTE")
                        .build())
                .build();
    }
}
