package com.jhomeron.batch.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

/**
 * Configuracion del DataSource para SAP HANA.
 *
 * COMO FUNCIONA:
 *   Este DataSource se usa UNICAMENTE para conectarse a SAP HANA via JDBC.
 *   No se instala nada en la VM de SAP - solo se usa el driver ngdbc
 *   que se descarga via Maven en el pom.xml.
 *
 * PERFILES:
 *   - dev:  H2 mock (para que no falle al arrancar la app)
 *   - prod: SAP HANA real via JDBC
 *
 * CONEXION A SAP HANA:
 *   URL:  jdbc:sap://<IP_VM>:30015
 *   Driver: com.sap.db.jdbc.Driver (ngdbc en pom.xml)
 *   Puerto default: 30015 (interactivo), 30013 (batch)
 *
 * CREDENCIALES:
 *   Se configuran via variables de entorno:
 *     export SAP_USERNAME=JHOMERON
 *     export SAP_PASSWORD=tu_password
 *
 * EL POR QUE DE LA SEPARACION:
 *   Tenemos DOS DataSources:
 *   1. stagingDataSource -> PostgreSQL/H2 (donde se ESCRIBEN los datos)
 *   2. sapDataSource     -> SAP HANA (donde se LEEN los datos)
 *   Esta separacion permite leer de SAP y escribir a PostgreSQL.
 */
@Configuration
public class SapDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(SapDataSourceConfig.class);

    @Value("${batch.sap.url:}")
    private String sapUrl;

    @Value("${batch.sap.driver-class-name:com.sap.db.jdbc.Driver}")
    private String sapDriver;

    @Value("${batch.sap.username:}")
    private String sapUsername;

    @Value("${batch.sap.password:}")
    private String sapPassword;

    /**
     * DataSource para perfil PROD: SAP HANA real via JDBC.
     * Se conecta a la VM de SAP usando el driver ngdbc.
     */
    @Bean(name = "sapDataSource")
    @Profile("prod")
    public DataSource sapDataSource() {
        log.info("Configurando DataSource SAP HANA para perfil PROD");
        log.info("URL: {}", sapUrl);

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(sapUrl);
        config.setDriverClassName(sapDriver);
        config.setUsername(sapUsername);
        config.setPassword(sapPassword);
        config.setPoolName("SAP-HANA-Pool");
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);

        return new HikariDataSource(config);
    }

    /**
     * DataSource mock para perfil DEV: H2 en memoria.
     * Simula SAP HANA para que la app pueda arrancar sin conectar a SAP.
     */
    @Bean(name = "sapDataSource")
    @Profile("dev")
    public DataSource sapDataSourceDev() {
        log.info("Configurando DataSource SAP HANA mock para perfil DEV");
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:sap_mock;DB_CLOSE_DELAY=-1");
        config.setDriverClassName("org.h2.Driver");
        config.setUsername("sa");
        config.setPassword("");
        config.setPoolName("SAP-MOCK-Pool");

        return new HikariDataSource(config);
    }
}
