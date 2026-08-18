package com.jhomeron.batch.config;

import org.h2.tools.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Configuracion manual de la consola H2 web.
 * Spring Boot 4.x ya no incluye la auto-configuracion de H2 Console.
 * Se registra manualmente como bean.
 */
@Configuration
@Profile("dev")
public class H2ConsoleConfig {

    @Bean(initMethod = "start", destroyMethod = "stop")
    public Server h2WebServer() throws Exception {
        return Server.createWebServer(
                "-webAllowOthers",
                "-webPort", "9091",
                "-webDaemon"
        );
    }
}
