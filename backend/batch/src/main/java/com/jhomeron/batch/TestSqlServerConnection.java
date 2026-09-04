package com.jhomeron.batch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.List;
import java.util.Map;

/**
 * Runner temporal para probar la conexion y ejecucion del SP de SQL Server.
 * DESACTIVADO: La conexión ya fue verificada exitosamente (100 registros).
 * El Job ventaEtlJob ahora se encarga de la extracción y carga.
 */
// @Component  // Desactivado - prueba completada exitosamente
public class TestSqlServerConnection implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(TestSqlServerConnection.class);

    private final JdbcTemplate jdbcTemplate;

    public TestSqlServerConnection(@Qualifier("sqlServerDataSource") DataSource sqlServerDataSource) {
        this.jdbcTemplate = new JdbcTemplate(sqlServerDataSource);
    }

    @Override
    public void run(String... args) throws Exception {
        log.info("==========================================================");
        log.info("INICIANDO PRUEBA DE CONEXION A SQL SERVER (TAILSCALE)");
        log.info("==========================================================");

        try {
            // Probamos ejecutar el SP con el JdbcTemplate directamente
            String sql = "EXEC dbo.SP_EXTRAER_VENTAS '2000-01-01', '2026-12-31'";
            log.info("Ejecutando: {}", sql);

            List<Map<String, Object>> resultados = jdbcTemplate.queryForList(sql);

            log.info("==========================================================");
            log.info("¡EXITO! Se obtuvieron {} registros de SQL Server.", resultados.size());
            log.info("Mostrando los primeros 3 registros para validar:");

            for (int i = 0; i < Math.min(3, resultados.size()); i++) {
                log.info("Registro {}: {}", i + 1, resultados.get(i));
            }
            log.info("==========================================================");

        } catch (Exception e) {
            log.error("ERROR AL CONECTAR O EJECUTAR EL SP: ", e);
        }
    }
}
