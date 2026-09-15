package com.jhomeron.batch.reader;

import com.jhomeron.batch.model.VentaDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.item.database.JdbcCursorItemReader;
import org.springframework.batch.item.database.builder.JdbcCursorItemReaderBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;

import javax.sql.DataSource;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDate;

@Configuration
public class SqlServerVentaReader {

    private static final Logger log = LoggerFactory.getLogger(SqlServerVentaReader.class);

    private static final String JOB_NAME = "ventaEtlJob";
    private static final LocalDate FECHA_MINIMA = LocalDate.of(2000, 1, 1);

    /**
     * Reader @StepScope: el rango de fechas se calcula recién cuando arranca el Step,
     * no cuando arranca la app. Esto permite leer el watermark (staging.control_carga)
     * en cada corrida:
     *   - fechaDesde = fecha_hasta_procesada + 1 día (o FECHA_MINIMA si es la primera corrida)
     *   - fechaHasta = hoy
     * Así, si el batch se vuelve a ejecutar el mismo día sin nuevas ventas, el rango
     * queda vacío y no se reinserta nada en staging (idempotencia por incrementalidad,
     * en vez de deduplicar por contenido de fila, que puede colapsar ventas legítimamente
     * idénticas -- ver README/discusión del modelo estrella).
     */
    @Bean
    @StepScope
    public JdbcCursorItemReader<VentaDTO> readerVentasSql(
            @Qualifier("sqlServerDataSource") DataSource sqlServerDataSource,
            @Qualifier("stagingDataSource") DataSource stagingDataSource) {

        LocalDate fechaDesde = obtenerFechaDesde(stagingDataSource);
        LocalDate fechaHasta = LocalDate.now();

        log.info("Extrayendo ventas de SAP en el rango: {} -> {}", fechaDesde, fechaHasta);

        return new JdbcCursorItemReaderBuilder<VentaDTO>()
                .name("ventasSqlServerReader")
                .dataSource(sqlServerDataSource)
                .sql("EXEC dbo.sp_ExtraerVentas @FechaInicio = ?, @FechaFin = ?")
                .fetchSize(500) // Streaming vía cursor, sin cargar todo en memoria
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

    private LocalDate obtenerFechaDesde(DataSource stagingDataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(stagingDataSource);
        try {
            LocalDate fechaHastaProcesada = jdbcTemplate.queryForObject(
                    "SELECT fecha_hasta_procesada FROM staging.control_carga WHERE job_name = ?",
                    LocalDate.class,
                    JOB_NAME);
            if (fechaHastaProcesada != null) {
                return fechaHastaProcesada.plusDays(1);
            }
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            log.info("No hay watermark previo para '{}' en staging.control_carga; se usará fecha mínima {}", JOB_NAME, FECHA_MINIMA);
        }
        return FECHA_MINIMA;
    }
}
