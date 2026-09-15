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

-- ============================================================
-- 2. Auditoria / trazabilidad de respuestas de IA
-- ============================================================
CREATE TABLE IF NOT EXISTS ai.consulta_log (
    id BIGSERIAL PRIMARY KEY,
    pregunta_usuario TEXT NOT NULL,
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
GRANT SELECT ON ai.v_ventas, ai.v_ventas_mensual_departamento TO ai_readonly;
GRANT INSERT ON ai.consulta_log TO ai_readonly; -- solo para registrar auditoría, no lee ni modifica lo existente
GRANT USAGE, SELECT ON SEQUENCE ai.consulta_log_id_seq TO ai_readonly;

-- Nota: ai_readonly NO tiene ningún permiso sobre staging.* ni sobre las
-- tablas base de dwh.* -- solo ve las vistas explícitas de este archivo.
