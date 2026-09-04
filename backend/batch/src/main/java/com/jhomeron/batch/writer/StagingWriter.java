package com.jhomeron.batch.writer;

import com.jhomeron.batch.model.PedidoDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.item.database.BeanPropertyItemSqlParameterSourceProvider;
import org.springframework.batch.item.database.JdbcBatchItemWriter;
import org.springframework.batch.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Writer del batch ETL: escribe los pedidos procesados en la tabla staging.
 *
 * FLUJO:
 *   Reader (CSV/SAP) --> Processor (validacion) --> *** WRITER *** --> PostgreSQL/H2
 *
 * TABLA DESTINO:
 *   staging.pedidos
 *   - id, cliente, producto, cantidad, fecha_pedido,
 *     fecha_carga, source, lote, estado
 *
 * COMO FUNCIONA:
 *   1. Recibe un chunk de 100 PedidoDTO procesados
 *   2. Ejecuta INSERT batch contra la tabla staging
 *   3. Usa BeanPropertyItemSqlParameterSourceProvider para mapear
 *      las propiedades del DTO a los parametros SQL (:cliente, :producto, etc.)
 *
 * NOTE: El DataSource se inyecta via constructor (stagingDataSource).
 *       El parametro ignored en stagingWriter() se mantiene por compatibilidad.
 */
@Component
public class StagingWriter {

    private static final Logger log = LoggerFactory.getLogger(StagingWriter.class);

    @Value("${batch.staging.schema:staging}")
    private String schema;

    @Value("${batch.staging.table:pedidos}")
    private String table;

    private final DataSource stagingDataSource;

    public StagingWriter(@Qualifier("stagingDataSource") DataSource stagingDataSource) {
        this.stagingDataSource = stagingDataSource;
    }

    /**
     * Crea un JdbcBatchItemWriter que inserta pedidos en la tabla staging.
     *
     * @param ignored DataSource (no se usa, se usa el inyectado via constructor)
     */
    public JdbcBatchItemWriter<PedidoDTO> stagingWriter(DataSource ignored) {
        String sql = String.format(
                "INSERT INTO %s.%s (cliente, producto, cantidad, fecha_pedido, source, lote, estado) " +
                        "VALUES (:cliente, :producto, :cantidad, :fechaPedido, :source, :lote, :estado)",
                schema, table
        );

        log.info("Configurando writer para tabla {}.{}", schema, table);

        return new JdbcBatchItemWriterBuilder<PedidoDTO>()
                .dataSource(stagingDataSource)
                .sql(sql)
                .beanMapped()
                .build();
    }
}
