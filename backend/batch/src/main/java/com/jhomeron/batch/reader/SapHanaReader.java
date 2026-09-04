package com.jhomeron.batch.reader;

import com.jhomeron.batch.model.PedidoDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.item.database.JdbcCursorItemReader;
import org.springframework.batch.item.database.builder.JdbcCursorItemReaderBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Reader para modo PROD: lee pedidos desde SAP HANA via JDBC.
 *
 * COMO FUNCIONA:
 *   1. Se conecta a SAP HANA usando el driver JDBC (ngdbc)
 *   2. Ejecuta el stored procedure configurado en batch.sap.stored-procedure
 *   3. Mapea cada fila del resultado a un PedidoDTO
 *   4. Spring Batch procesa los registros en chunks
 *
 * CONEXION:
 *   - URL: jdbc:sap://<IP_VM>:30015 (configurable en application-prod.yaml)
 *   - Driver: com.sap.db.jdbc.Driver (descargado via Maven, no se instala en SAP)
 *   - Credenciales: via variables de entorno SAP_USERNAME/SAP_PASSWORD
 *
 * STORED PROCEDURE ESPERADO:
 *   CALL SP_OBTENER_PEDIDOS(?) o CALL SP_OBTENER_PEDIDOS(fecha_desde, fecha_hasta)
 *
 *   Debe retornar las columnas:
 *     - CLIENTE    (VARCHAR)  - Nombre/codigo del cliente
 *     - PRODUCTO   (VARCHAR)  - Nombre/codigo del producto (pintura)
 *     - CANTIDAD   (INTEGER)  - Cantidad pedida en unidades
 *     - FECHA_PEDIDO (DATE)   - Fecha del pedido
 *
 * NOTA: En modo dev se usa CsvFileReader en su lugar.
 */
@Component
public class SapHanaReader {

    private static final Logger log = LoggerFactory.getLogger(SapHanaReader.class);

    @Value("${batch.sap.stored-procedure:CALL SP_OBTENER_PEDIDOS}")
    private String storedProcedure;

    @Value("${batch.sap.fetch-size:1000}")
    private int fetchSize;

    /**
     * Crea un JdbcCursorItemReader que ejecuta el SP en SAP HANA.
     * Se usa internamente por el Job de Spring Batch en perfil prod.
     *
     * @param sapDataSource DataSource configurado para SAP HANA
     */
    public JdbcCursorItemReader<PedidoDTO> reader(DataSource sapDataSource) {
        log.info("Configurando JdbcCursorItemReader para SAP HANA");
        log.info("Stored procedure: {}", storedProcedure);

        return new JdbcCursorItemReaderBuilder<PedidoDTO>()
                .name("sapPedidoReader")
                .dataSource(sapDataSource)
                .sql(storedProcedure)
                .fetchSize(fetchSize)
                .rowMapper(new PedidoRowMapper())
                .build();
    }

    /**
     * RowMapper que convierte cada fila del resultado del SP en PedidoDTO.
     * Los nombres de columna deben coincidir con lo que retorna el SP.
     */
    private static class PedidoRowMapper implements RowMapper<PedidoDTO> {
        @Override
        public PedidoDTO mapRow(ResultSet rs, int rowNum) throws SQLException {
            return PedidoDTO.builder()
                    .cliente(rs.getString("CLIENTE"))
                    .producto(rs.getString("PRODUCTO"))
                    .cantidad(rs.getInt("CANTIDAD"))
                    .fechaPedido(rs.getDate("FECHA_PEDIDO").toLocalDate())
                    .source("SAP") // Marcar origen como SAP
                    .build();
        }
    }
}
