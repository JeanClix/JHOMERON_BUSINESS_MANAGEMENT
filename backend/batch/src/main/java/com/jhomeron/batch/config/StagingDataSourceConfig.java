package com.jhomeron.batch.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

/**
 * Configuracion del DataSource de staging (donde se escriben los datos extraidos).
 *
 * PERFILES:
 *   - dev:  H2 en memoria (no necesita PostgreSQL)
 *   - prod: PostgreSQL (requiere DB "jhomeron_batch" creada previamente)
 *
 * EL POR QUE DE ESTA CLASE:
 *   Necesitamos un DataSource separado para staging porque:
 *   1. En dev usamos H2 para no depender de PostgreSQL
 *   2. En prod apuntamos a PostgreSQL donde esta la tabla staging.pedidos
 *   3. Permite cambiar la BD sin modificar el codigo del batch
 *
 * NOTA: Este DataSource es @Primary porque es el que usa el Writer.
 */
@Configuration
public class StagingDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(StagingDataSourceConfig.class);

    /**
     * DataSource para perfil DEV: H2 en memoria.
     * No requiere PostgreSQL ni ningun servicio externo.
     */
    @Bean(name = "stagingDataSource")
    @Primary
    @Profile("dev")
    public DataSource stagingDataSourceDev() {
        log.info("Configurando DataSource de staging (H2 en memoria - DEV)");
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:stagingdb;DB_CLOSE_DELAY=-1;MODE=POSTGRESQL");
        config.setDriverClassName("org.h2.Driver");
        config.setUsername("sa");
        config.setPassword("");
        config.setPoolName("Staging-H2-Pool");
        config.setMaximumPoolSize(5);
        return new HikariDataSource(config);
    }

    /**
     * DataSource para perfil PROD: PostgreSQL.
     * Requiere que la DB "jhomeron_batch" exista y el schema este creado.
     */
    @Bean(name = "stagingDataSource")
    @Primary
    @Profile({"prod", "neon"})
    public DataSource stagingDataSourceProd(
            @Value("${spring.datasource.url}") String dbUrl,
            @Value("${spring.datasource.username}") String dbUsername,
            @Value("${spring.datasource.password}") String dbPassword,
            @Value("${spring.datasource.driver-class-name}") String dbDriver) {
        log.info("Configurando DataSource de staging (PostgreSQL - PROD)");
        log.info("URL: {}", dbUrl);

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(dbUrl);
        config.setDriverClassName(dbDriver);
        config.setUsername(dbUsername);
        config.setPassword(dbPassword);
        config.setPoolName("Staging-PG-Pool");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(3);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);

        return new HikariDataSource(config);
    }
}
