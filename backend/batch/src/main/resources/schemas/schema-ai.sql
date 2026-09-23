-- ============================================================
-- CAPA DE IA: semantic layer + auditoria + rol de solo lectura
-- Esquema: ai (sobre el Data Warehouse dwh.*)
-- ============================================================
--
-- POR QUE ESTE ARCHIVO:
--   El AI Service (FastAPI) NO debe consultar las tablas dwh.* crudas
--   directamente. En su lugar:
--     1. Consulta vistas de negocio (mas claras para el LLM, con nombres
--        que coinciden con como el usuario pregunta).
--     2. Se conecta con un rol de solo lectura (ai_readonly), que ni
--        siquiera puede hacer INSERT/UPDATE/DELETE aunque el LLM alucine
--        una consulta destructiva.
--     3. Cada pregunta/respuesta queda auditada en ai.consulta_log.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ai;

-- ============================================================
-- 1. Vistas de negocio (semantic layer)
-- ============================================================

-- Vista plana de ventas con nombres de negocio, para Text-to-SQL
CREATE OR REPLACE VIEW ai.v_ventas AS
SELECT
    f.fact_id,
    t.fecha,
    t.anio,
    t.mes,
    t.mes_nombre,
    t.trimestre,
    c.razon_social AS cliente,
    c.departamento,
    c.ciudad,
    c.distrito,
    p.numero_articulo AS codigo_producto,
    p.descripcion_articulo AS producto,
    v.empleado_venta AS vendedor,
    td.tipo AS tipo_documento,
    f.serie,
    f.numero AS numero_documento,
    f.cantidad,
    f.valor_unitario,
    f.total_venta_mn AS total_soles,
    f.total_venta_me AS total_dolares
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c ON f.cliente_id = c.cliente_id
JOIN dwh.dim_producto p ON f.producto_id = p.producto_id
JOIN dwh.dim_vendedor v ON f.vendedor_id = v.vendedor_id
LEFT JOIN dwh.dim_tipo_doc td ON f.tipo_id = td.tipo_id;

COMMENT ON VIEW ai.v_ventas IS 'Vista de negocio de ventas para consultas de IA (Text-to-SQL). No expone claves surrogate ni tablas internas del modelo estrella.';

-- Resumen mensual por departamento (agregado, listo para "¿cuánto vendimos en X?")
CREATE OR REPLACE VIEW ai.v_ventas_mensual_departamento AS
SELECT
    t.anio,
    t.mes,
    t.mes_nombre,
    c.departamento,
    count(*) AS numero_lineas,
    sum(f.total_venta_mn) AS total_soles
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c ON f.cliente_id = c.cliente_id
GROUP BY t.anio, t.mes, t.mes_nombre, c.departamento;

COMMENT ON VIEW ai.v_ventas_mensual_departamento IS 'Agregado mensual de ventas por departamento, pre-calculado para preguntas frecuentes de gerencia.';

-- Igual que ai.v_ventas, pero pre-filtrada al vendedor autenticado. El
-- filtro NO depende de que el LLM escriba un WHERE correcto (no es
-- confiable: prompt injection o alucinación podrian omitirlo o pedir el
-- vendedor equivocado) -- esta vista lee el vendedor de una variable de
-- sesion de Postgres (`app.current_vendedor`) que el AI Service fija ANTES
-- de correr la consulta del LLM (ver tools.py: set_config(...)), a partir
-- del claim `vendedorNombreSap` del JWT, nunca de un parametro del cliente.
-- Si esa variable no esta fijada, current_setting(..., true) devuelve NULL
-- y el WHERE no matchea nada -- "fail closed", nunca devuelve todo el
-- dataset por accidente.
CREATE OR REPLACE VIEW ai.v_ventas_vendedor AS
SELECT
    f.fact_id,
    t.fecha,
    t.anio,
    t.mes,
    t.mes_nombre,
    t.trimestre,
    c.razon_social AS cliente,
    c.departamento,
    c.ciudad,
    c.distrito,
    p.numero_articulo AS codigo_producto,
    p.descripcion_articulo AS producto,
    v.empleado_venta AS vendedor,
    td.tipo AS tipo_documento,
    f.serie,
    f.numero AS numero_documento,
    f.cantidad,
    f.valor_unitario,
    f.total_venta_mn AS total_soles,
    f.total_venta_me AS total_dolares
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c ON f.cliente_id = c.cliente_id
JOIN dwh.dim_producto p ON f.producto_id = p.producto_id
JOIN dwh.dim_vendedor v ON f.vendedor_id = v.vendedor_id
LEFT JOIN dwh.dim_tipo_doc td ON f.tipo_id = td.tipo_id
WHERE v.empleado_venta = current_setting('app.current_vendedor', true);

COMMENT ON VIEW ai.v_ventas_vendedor IS 'Como ai.v_ventas pero pre-filtrada al vendedor de la sesion (app.current_vendedor, fijada por el AI Service desde el JWT) -- es la unica vista que /chat permite cuando el rol es VENDEDOR, para que no pueda ver ventas de otro vendedor.';

-- ============================================================
-- 2. Auditoria / trazabilidad de respuestas de IA
-- ============================================================
CREATE TABLE IF NOT EXISTS ai.consulta_log (
    id BIGSERIAL PRIMARY KEY,
    pregunta_usuario TEXT NOT NULL,
    -- Vendedor autenticado que hizo la pregunta (del JWT), NULL si fue
    -- gerencia/admin (acceso de solo lectura a los agregados de empresa).
    vendedor VARCHAR(150),
    sql_generado TEXT,
    filas_retornadas INT,
    respuesta_llm TEXT,
    modelo VARCHAR(100),
    exito BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duracion_ms INT
);

COMMENT ON TABLE ai.consulta_log IS 'Traza de cada pregunta al asistente de IA: pregunta original, SQL generado, filas devueltas y respuesta final. Permite responder de que dato real provino una respuesta.';

-- Oportunidades de mejora para el dashboard de gerencia (seccion "Insights
-- Estrategicos"). Se generan UNA VEZ por periodo (ver
-- backend/intelligence/ai/src/insights.py: calculo de senales con SQL
-- deterministico + una unica llamada al LLM que elige/redacta, nunca inventa
-- cifras) y el dashboard las LEE de aqui en cada visita en vez de llamar al
-- LLM cada vez -- es la parte que ahorra tokens. widget_payload trae los
-- mismos datos ya calculados en Python, listos para que el frontend los
-- renderice con los componentes que ya existen (KpiCardComponent /
-- BusinessChartComponent), sin que el LLM tenga que producir numeros.
CREATE TABLE IF NOT EXISTS ai.insight_mensual (
    id BIGSERIAL PRIMARY KEY,
    anio INT NOT NULL,
    mes INT NOT NULL,
    orden SMALLINT NOT NULL,
    categoria VARCHAR(30) NOT NULL,
    impacto VARCHAR(20) NOT NULL,
    titulo TEXT NOT NULL,
    resumen TEXT NOT NULL,
    recomendacion TEXT NOT NULL,
    -- Que mini-componente Angular usar para el detalle de esta oportunidad
    -- ('ninguno' si no aplica un widget, ej. una alerta puramente textual).
    widget_tipo VARCHAR(20) NOT NULL DEFAULT 'ninguno',
    widget_payload JSONB,
    generado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (anio, mes, orden)
);

COMMENT ON TABLE ai.insight_mensual IS 'Oportunidades de mejora para gerencia, generadas una vez por periodo -- el dashboard lee de aca, no llama al LLM en cada visita.';

-- Base de conocimiento institucional (Jhomeron como empresa: quien es,
-- vision, mision, objetivos, politicas, testimonios, etc.) -- separada a
-- proposito de ai.v_ventas*: esto NO es Data Warehouse de ventas, es
-- contenido de texto libre que el LLM busca con buscar_base_conocimiento
-- (ver tools.py) cuando la pregunta es sobre la empresa, no sobre cifras.
-- Alta/edicion/baja: panel de Gerencia/Admin (ver
-- backend/intelligence/ai/src/documentos.py). roles_visibles controla quien
-- puede recibir ese documento como contexto en el chat (no quien lo administra
-- -- eso ya requiere GERENCIA o ADMIN en el propio endpoint).
CREATE TABLE IF NOT EXISTS ai.documento_contexto (
    id BIGSERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    categoria VARCHAR(30) NOT NULL DEFAULT 'general',
    contenido TEXT NOT NULL,
    formato_original VARCHAR(10) NOT NULL,
    roles_visibles TEXT[] NOT NULL DEFAULT ARRAY['VENDEDOR', 'GERENCIA', 'ADMIN'],
    subido_por VARCHAR(150),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ai.documento_contexto IS 'Base de conocimiento institucional (no ventas): documentos de texto libre que el chat busca por palabra clave para responder preguntas sobre la empresa.';

-- ============================================================
-- 3. Rol de solo lectura para el AI Service
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_readonly') THEN
        CREATE ROLE ai_readonly WITH LOGIN PASSWORD 'ai_readonly_local_dev';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA ai TO ai_readonly;
GRANT SELECT ON ai.v_ventas, ai.v_ventas_mensual_departamento, ai.v_ventas_vendedor TO ai_readonly;
GRANT INSERT ON ai.consulta_log TO ai_readonly; -- solo para registrar auditoría, no lee ni modifica lo existente
GRANT USAGE, SELECT ON SEQUENCE ai.consulta_log_id_seq TO ai_readonly;
GRANT SELECT, INSERT, DELETE ON ai.insight_mensual TO ai_readonly; -- DELETE solo para reemplazar el periodo al regenerar
GRANT USAGE, SELECT ON SEQUENCE ai.insight_mensual_id_seq TO ai_readonly;
-- Excepcion deliberada a "solo lectura" (mismo criterio que ai.consulta_log):
-- el panel de Gerencia/Admin administra estos documentos a traves de este
-- mismo servicio, no hay otro backend para eso.
GRANT SELECT, INSERT, UPDATE, DELETE ON ai.documento_contexto TO ai_readonly;
GRANT USAGE, SELECT ON SEQUENCE ai.documento_contexto_id_seq TO ai_readonly;

-- Nota: ai_readonly NO tiene ningún permiso sobre staging.* ni sobre las
-- tablas base de dwh.* -- solo ve las vistas explícitas de este archivo.
