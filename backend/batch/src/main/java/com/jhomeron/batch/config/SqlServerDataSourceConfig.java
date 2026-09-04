package com.jhomeron.batch.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class SqlServerDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(SqlServerDataSourceConfig.class);

    @Value("${sqlserver.url}")
    private String url;

    @Value("${sqlserver.driver-class-name}")
    private String driverClassName;

    @Value("${sqlserver.username}")
    private String username;

    @Value("${sqlserver.password}")
    private String password;

    @Bean(name = "sqlServerDataSource")
    public DataSource sqlServerDataSource() {
        log.info("Configurando DataSource para SQL Server externo");
        
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setDriverClassName(driverClassName);
        config.setUsername(username);
        config.setPassword(password);
        config.setPoolName("SqlServer-Pool");
        
        return new HikariDataSource(config);
    }
}
