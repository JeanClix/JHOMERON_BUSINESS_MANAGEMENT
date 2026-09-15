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
                .sql("EXEC dbo.sp_ExtraerVentas @FechaInicio = ?, @FechaFin = ?")
                .maxItemCount(5000) // Límite para desarrollo
                .fetchSize(100)     // Para no saturar la memoria de golpe
                .preparedStatementSetter(new PreparedStatementSetter() {
                    @Override
                    public void setValues(PreparedStatement ps) throws SQLException {
                        ps.setDate(1, Date.valueOf(fechaDesde));
                        ps.setDate(2, Date.valueOf(fechaHasta));
                    }
                })
                .rowMapper((rs, rowNum) -> VentaDTO.builder()
                        .fechaContabilizacion(rs.getDate("FECHA DE CONTABILIZACION") != null ? rs.getDate("FECHA DE CONTABILIZACION").toLocalDate() : null)
                        .fechaDocumento(rs.getDate("FECHA DE DOCUMENTO") != null ? rs.getDate("FECHA DE DOCUMENTO").toLocalDate() : null)
                        .fechaVencimiento(rs.getDate("FECHA DE VENCIMIENTO") != null ? rs.getDate("FECHA DE VENCIMIENTO").toLocalDate() : null)
                        .tipo(rs.getString("TIPO"))
                        .serie(rs.getString("SERIE"))
                        .numero(rs.getInt("NUMERO"))
                        .ruc(rs.getString("RUC"))
                        .razonSocial(rs.getString("RAZON SOCIAL"))
                        .empleadoVenta(rs.getString("empleado de venta"))
                        .numeroArticulo(rs.getString("NUMERO DE ARTICULO"))
                        .descripcionArticulo(rs.getString("DESCRIPCION DEL ARTICULO"))
                        .unidadMedida(rs.getString("UNIDAD DE MEDIDA"))
                        .cantidad(rs.getBigDecimal("CANTIDAD"))
                        .valorUnitario(rs.getBigDecimal("VALOR UNITARIO"))
                        .totalVentaMe(rs.getBigDecimal("TOTAL V. VENTA ME"))
                        .moneda(rs.getString("MONEDA"))
                        .tipoCambio(rs.getBigDecimal("T.C."))
                        .totalVentaMn(rs.getBigDecimal("TOTAL V. VENTA MN"))
                        .ciudad(rs.getString("CIUDAD"))
                        .distrito(rs.getString("DISTRITO"))
                        .departamento(rs.getString("DEPARTAMENTO"))
                        .source("SAP")
                        .estado("PENDIENTE")
                        .build())
                .build();
    }
}
