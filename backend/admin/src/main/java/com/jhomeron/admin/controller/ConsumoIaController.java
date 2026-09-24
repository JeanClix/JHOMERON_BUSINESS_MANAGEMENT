package com.jhomeron.admin.controller;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Consumo del asistente de IA por empleado: qué preguntó cada vendedor o
 * gerente y cuántos tokens gastó. Lee ai.consulta_log, que escribe el AI
 * Service en cada chat (ver backend/intelligence/ai/src/audit.py) -- este
 * servicio ya se conecta a la misma base, no hace falta pasar por el AI
 * Service. Solo lectura; /api/admin/** exige rol ADMIN (JwtAuthFilter).
 *
 * Quién hizo la pregunta: consulta_log.usuario (claim `sub` del JWT) desde
 * que existe esa columna. Las filas anteriores solo tienen `vendedor`
 * (nombre SAP), así que se atribuyen al usuario con ese vendedor_nombre_sap;
 * las de gerencia/admin anteriores no tienen ningún dato y quedan como
 * "sin identificar".
 */
@RestController
@RequestMapping("/api/admin/consumo-ia")
public class ConsumoIaController {

    static final String SIN_IDENTIFICAR = "sin-identificar";

    /**
     * USD por millón de tokens (entrada, salida), para un costo ESTIMADO. Un
     * modelo que no esté acá (o las filas sin tokens) no suma costo -- se
     * informa aparte en vez de inventar un precio. Actualizar si cambian los
     * precios o el modelo en uso.
     */
    private static final Map<String, double[]> PRECIOS_USD_POR_MILLON = Map.of(
            "claude-haiku-4-5", new double[]{1.00, 5.00},
            "claude-sonnet-5", new double[]{2.00, 10.00},
            "claude-opus-5", new double[]{5.00, 25.00},
            "openai/gpt-oss-120b", new double[]{0.15, 0.60},
            "gpt-5.6-luna", new double[]{0.20, 1.20},
            "grok-4.3", new double[]{1.25, 2.50}
    );

    private static final String CONSULTAS_CON_AUTOR = """
            SELECT c.id, c.fecha, c.pregunta_usuario, LEFT(c.respuesta_llm, 400) AS respuesta,
                   c.modelo, c.exito, c.duracion_ms, c.tokens_entrada, c.tokens_salida,
                   COALESCE(u.usuario, c.usuario) AS usuario,
                   COALESCE(u.nombre, c.vendedor) AS nombre,
                   COALESCE(c.rol, u.rol, CASE WHEN c.vendedor IS NOT NULL THEN 'VENDEDOR' END) AS rol,
                   COALESCE(u.usuario, c.usuario, c.vendedor, 'sin-identificar') AS clave
            FROM ai.consulta_log c
            LEFT JOIN LATERAL (
                SELECT x.usuario, x.nombre, x.rol
                FROM usuarios x
                WHERE (c.usuario IS NOT NULL AND x.usuario = c.usuario)
                   OR (c.usuario IS NULL AND c.vendedor IS NOT NULL AND x.vendedor_nombre_sap = c.vendedor)
                LIMIT 1
            ) u ON true
            WHERE c.fecha >= :desde
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public ConsumoIaController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * @param dias    ventana hacia atrás desde hoy (1-365, por defecto 30).
     * @param usuario opcional: `clave` de un empleado del resumen, para ver
     *                solo sus chats.
     */
    @GetMapping
    public Map<String, Object> consumo(@RequestParam(defaultValue = "30") int dias,
                                       @RequestParam(required = false) String usuario) {
        int diasAcotados = Math.max(1, Math.min(dias, 365));
        LocalDateTime desde = LocalDateTime.now().minusDays(diasAcotados);
        MapSqlParameterSource params = new MapSqlParameterSource("desde", Timestamp.valueOf(desde));

        List<Map<String, Object>> porUsuario = resumirPorUsuario(params);

        String filtro = "";
        if (usuario != null && !usuario.isBlank()) {
            filtro = " WHERE b.clave = :clave";
            params.addValue("clave", usuario);
        }
        List<Map<String, Object>> chats = jdbc.queryForList(
                "SELECT * FROM (" + CONSULTAS_CON_AUTOR + ") b" + filtro + " ORDER BY b.fecha DESC LIMIT 200", params);

        Map<String, Object> totales = new LinkedHashMap<>();
        totales.put("preguntas", porUsuario.stream().mapToLong(u -> (long) u.get("preguntas")).sum());
        totales.put("tokensEntrada", porUsuario.stream().mapToLong(u -> (long) u.get("tokensEntrada")).sum());
        totales.put("tokensSalida", porUsuario.stream().mapToLong(u -> (long) u.get("tokensSalida")).sum());
        totales.put("costoEstimadoUsd", redondear(porUsuario.stream().mapToDouble(u -> (double) u.get("costoEstimadoUsd")).sum()));
        totales.put("preguntasSinTokens", porUsuario.stream().mapToLong(u -> (long) u.get("preguntasSinTokens")).sum());

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("desde", desde.toLocalDate().toString());
        respuesta.put("dias", diasAcotados);
        respuesta.put("totales", totales);
        respuesta.put("porUsuario", porUsuario);
        respuesta.put("chats", chats.stream().map(this::aChat).toList());
        return respuesta;
    }

    /**
     * Se agrupa por empleado Y modelo en SQL porque el costo depende del
     * precio de cada modelo; acá se juntan los modelos de cada empleado.
     */
    private List<Map<String, Object>> resumirPorUsuario(MapSqlParameterSource params) {
        List<Map<String, Object>> filas = jdbc.queryForList("""
                SELECT b.clave, MAX(b.usuario) AS usuario, MAX(b.nombre) AS nombre, MAX(b.rol) AS rol, b.modelo,
                       COUNT(*) AS preguntas,
                       COUNT(*) FILTER (WHERE NOT b.exito) AS fallidas,
                       COUNT(*) FILTER (WHERE b.tokens_entrada IS NULL) AS sin_tokens,
                       COALESCE(SUM(b.tokens_entrada), 0) AS tokens_entrada,
                       COALESCE(SUM(b.tokens_salida), 0) AS tokens_salida,
                       MAX(b.fecha) AS ultima
                FROM (""" + CONSULTAS_CON_AUTOR + """
                ) b
                GROUP BY b.clave, b.modelo
                """, params);

        Map<String, Map<String, Object>> porClave = new LinkedHashMap<>();
        for (Map<String, Object> f : filas) {
            String clave = (String) f.get("clave");
            Map<String, Object> u = porClave.computeIfAbsent(clave, k -> {
                Map<String, Object> nuevo = new LinkedHashMap<>();
                nuevo.put("clave", k);
                nuevo.put("usuario", f.get("usuario"));
                nuevo.put("nombre", SIN_IDENTIFICAR.equals(k) ? null : f.get("nombre"));
                nuevo.put("rol", f.get("rol"));
                nuevo.put("preguntas", 0L);
                nuevo.put("fallidas", 0L);
                nuevo.put("preguntasSinTokens", 0L);
                nuevo.put("tokensEntrada", 0L);
                nuevo.put("tokensSalida", 0L);
                nuevo.put("costoEstimadoUsd", 0.0);
                nuevo.put("modelos", new ArrayList<String>());
                nuevo.put("ultimaPregunta", null);
                return nuevo;
            });
            long entrada = ((Number) f.get("tokens_entrada")).longValue();
            long salida = ((Number) f.get("tokens_salida")).longValue();
            sumar(u, "preguntas", ((Number) f.get("preguntas")).longValue());
            sumar(u, "fallidas", ((Number) f.get("fallidas")).longValue());
            sumar(u, "preguntasSinTokens", ((Number) f.get("sin_tokens")).longValue());
            sumar(u, "tokensEntrada", entrada);
            sumar(u, "tokensSalida", salida);
            u.put("costoEstimadoUsd", redondear((double) u.get("costoEstimadoUsd") + costo((String) f.get("modelo"), entrada, salida)));
            if (f.get("modelo") != null) {
                @SuppressWarnings("unchecked")
                List<String> modelos = (List<String>) u.get("modelos");
                modelos.add((String) f.get("modelo"));
            }
            Timestamp ultima = (Timestamp) f.get("ultima");
            Timestamp actual = (Timestamp) u.get("ultimaPregunta");
            if (ultima != null && (actual == null || ultima.after(actual))) {
                u.put("ultimaPregunta", ultima);
            }
        }
        porClave.values().forEach(u -> {
            Timestamp ultima = (Timestamp) u.get("ultimaPregunta");
            u.put("ultimaPregunta", ultima == null ? null : ultima.toLocalDateTime().withNano(0).toString());
        });
        return porClave.values().stream()
                .sorted(Comparator.comparingLong((Map<String, Object> u) -> (long) u.get("tokensEntrada") + (long) u.get("tokensSalida")).reversed())
                .toList();
    }

    private Map<String, Object> aChat(Map<String, Object> f) {
        Map<String, Object> chat = new LinkedHashMap<>();
        chat.put("id", f.get("id"));
        chat.put("fecha", f.get("fecha") == null ? null : ((Timestamp) f.get("fecha")).toLocalDateTime().withNano(0).toString());
        chat.put("clave", f.get("clave"));
        chat.put("usuario", f.get("usuario"));
        chat.put("nombre", f.get("nombre"));
        chat.put("rol", f.get("rol"));
        chat.put("pregunta", f.get("pregunta_usuario"));
        chat.put("respuesta", f.get("respuesta"));
        chat.put("modelo", f.get("modelo"));
        chat.put("exito", f.get("exito"));
        chat.put("duracionMs", f.get("duracion_ms"));
        chat.put("tokensEntrada", f.get("tokens_entrada"));
        chat.put("tokensSalida", f.get("tokens_salida"));
        return chat;
    }

    private static void sumar(Map<String, Object> m, String campo, long valor) {
        m.put(campo, (long) m.get(campo) + valor);
    }

    static double costo(String modelo, long tokensEntrada, long tokensSalida) {
        double[] precio = modelo == null ? null : PRECIOS_USD_POR_MILLON.get(modelo);
        if (precio == null) {
            return 0.0;
        }
        return (tokensEntrada * precio[0] + tokensSalida * precio[1]) / 1_000_000.0;
    }

    private static double redondear(double usd) {
        return Math.round(usd * 10_000.0) / 10_000.0;
    }
}
