-- ============================================================
-- CAPA DE BI: semantic layer de solo lectura para backend/reporting
-- Esquema: bi (sobre el Data Warehouse dwh.* y usuarios de admin)
-- ============================================================
--
-- POR QUE ESTE ARCHIVO (y por que no reusar ai.*):
--   ai.* es el "surface" que ve el LLM (Text-to-SQL). bi.* es el "surface"
--   que consumen los endpoints REST deterministicos de backend/reporting
--   (dashboards de Vendedores/Gerencia). Se separan a proposito: si mañana
--   se agrega una vista a bi.* para un grafico puntual, no queremos que el
--   LLM la descubra y la use para responder preguntas en lenguaje natural
--   sin que este pensada para eso.
--
--   Mismo patron de gobierno que ai_readonly (ver schema-ai.sql):
--     1. reporting solo consulta vistas de negocio, nunca dwh.*/staging.*
--        directo.
--     2. Se conecta con un rol de solo lectura (bi_readonly) sin permiso de
--        escritura sobre nada.
--     3. bi_readonly NO tiene acceso directo a la tabla usuarios (tiene el
--        hash de password) -- solo a bi.v_vendedores, que expone unicamente
--        las columnas necesarias para cuota/vinculo con dwh.
--
-- DEUDA TECNICA (ver schema-admin.sql / TODO): el vinculo entre un vendedor
-- logueado (usuarios.vendedor_nombre_sap) y sus ventas en
-- dwh.dim_vendedor.empleado_venta es por NOMBRE LIBRE, no por un codigo
-- estable (SAP OSLP.SlpCode) -- eso requiere extender el SP de extraccion
-- del batch (Fase 2, pendiente de que SAP confirme disponibilidad). Hasta
-- entonces, un typo al crear el vendedor en el panel admin rompe el join
-- silenciosamente (el vendedor no vera ninguna venta, no un error).
--
-- REGLA DE NEGOCIO PENDIENTE DE DEFINIR: bi.v_cliente_frecuencia expone los
-- datos crudos (ultima compra, conteos) para detectar clientes inactivos,
-- pero el UMBRAL de "baja frecuencia" (cuantos dias sin comprar, comparado
-- contra que) todavia no esta definido con el area de ventas. El calculo de
-- ese umbral vive en backend/reporting (no aqui) para poder ajustarlo sin
-- tocar el esquema -- ver README de reporting.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS bi;

-- ============================================================
-- 1. Vendedores (área ventas)
-- ============================================================

-- Ventas por vendedor y dia -- base del grafico de barras semanal y de
-- cumplimiento de cuota (se agrega por mes en la app, no aqui, para poder
-- elegir cualquier rango de fechas sin crear una vista por cada corte).
CREATE OR REPLACE VIEW bi.v_ventas_vendedor_dia AS
SELECT
    v.empleado_venta AS vendedor,
    t.fecha,
    t.anio,
    t.mes,
    t.dia_semana,
    t.dia_nombre,
    SUM(f.total_venta_mn) AS total_soles,
    SUM(f.cantidad)       AS cantidad,
    COUNT(*)              AS numero_lineas
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t    ON f.fecha_id = t.fecha_id
JOIN dwh.dim_vendedor v  ON f.vendedor_id = v.vendedor_id
GROUP BY v.empleado_venta, t.fecha, t.anio, t.mes, t.dia_semana, t.dia_nombre;

COMMENT ON VIEW bi.v_ventas_vendedor_dia IS 'Ventas diarias por vendedor. Base del grafico de barras semanal (filtro de semana) y del calculo de cumplimiento de cuota mensual.';

-- Producto que mas/menos vendio cada vendedor por mes. "Linea" hoy es un
-- PROXY por producto individual -- dwh.dim_producto no tiene categoria/linea
-- real (OITB) todavia, ver nota de deuda tecnica arriba y TODO.md. Cuando el
-- batch extraiga categoria, esta vista se re-agrega por categoria en vez de
-- por producto.
CREATE OR REPLACE VIEW bi.v_vendedor_producto_mes AS
SELECT
    v.empleado_venta          AS vendedor,
    t.anio,
    t.mes,
    p.numero_articulo         AS codigo_producto,
    p.descripcion_articulo    AS producto,
    SUM(f.total_venta_mn)     AS total_soles,
    SUM(f.cantidad)           AS cantidad
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t    ON f.fecha_id = t.fecha_id
JOIN dwh.dim_vendedor v  ON f.vendedor_id = v.vendedor_id
JOIN dwh.dim_producto p  ON f.producto_id = p.producto_id
GROUP BY v.empleado_venta, t.anio, t.mes, p.numero_articulo, p.descripcion_articulo;

COMMENT ON VIEW bi.v_vendedor_producto_mes IS 'Ventas por vendedor+producto+mes, ordenable ASC/DESC en la app para "que vendio mas/menos". Proxy de "linea" hasta que exista categoria real (Fase 2).';

-- Vendedores dados de alta desde el panel admin, con su meta y el vinculo
-- (fragil, ver deuda tecnica) hacia dwh.dim_vendedor.empleado_venta. NO
-- expone password ni ninguna otra columna de usuarios.
CREATE OR REPLACE VIEW bi.v_vendedores AS
SELECT
    id AS usuario_id,
    nombre,
    vendedor_nombre_sap,
    meta_mensual
FROM usuarios
WHERE rol = 'VENDEDOR';

COMMENT ON VIEW bi.v_vendedores IS 'Vendedores creados desde el panel admin con su meta mensual y el nombre SAP para vincular con dwh.dim_vendedor. No expone password ni otras columnas de usuarios.';

-- ============================================================
-- 2. Clientes (reactivacion, top compradores)
-- ============================================================

-- Datos crudos de frecuencia por cliente. El umbral de "inactivo"/"baja
-- frecuencia" se aplica en backend/reporting sobre esta vista, no aqui.
CREATE OR REPLACE VIEW bi.v_cliente_frecuencia AS
SELECT
    c.cliente_id,
    c.ruc,
    c.razon_social AS cliente,
    c.departamento,
    MAX(t.fecha) AS ultima_compra,
    (CURRENT_DATE - MAX(t.fecha)) AS dias_desde_ultima_compra,
    COUNT(*) FILTER (WHERE t.fecha >= date_trunc('month', CURRENT_DATE)) AS compras_mes_actual,
    COUNT(*) FILTER (WHERE t.fecha >= date_trunc('year', CURRENT_DATE))  AS compras_anio_actual,
    COUNT(DISTINCT t.fecha) AS dias_distintos_compra_historico,
    SUM(f.total_venta_mn)   AS total_soles_historico
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t   ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c  ON f.cliente_id = c.cliente_id
GROUP BY c.cliente_id, c.ruc, c.razon_social, c.departamento;

COMMENT ON VIEW bi.v_cliente_frecuencia IS 'Datos crudos de frecuencia de compra por cliente. El umbral de "cliente inactivo" (pendiente de definir con el area de ventas) se aplica en backend/reporting, no en esta vista.';

-- Frecuencia de compra de cada cliente CON UN VENDEDOR especifico. No existe
-- en el modelo estrella un concepto de "cartera asignada" (cliente <->
-- vendedor titular) distinto de "a quien le compro" -- si el area comercial
-- maneja cartera asignada aparte (Excel, SAP u otro), hay que traerla y esta
-- vista se reemplaza/complementa con eso. Mientras tanto, "cliente del
-- vendedor" = tiene al menos una compra historica registrada con ese
-- vendedor, y la frecuencia se mide sobre ESAS compras (no sobre el total
-- del cliente con todos los vendedores).
CREATE OR REPLACE VIEW bi.v_cliente_frecuencia_vendedor AS
SELECT
    v.empleado_venta AS vendedor,
    c.cliente_id,
    c.ruc,
    c.razon_social AS cliente,
    c.departamento,
    MAX(t.fecha) AS ultima_compra,
    (CURRENT_DATE - MAX(t.fecha)) AS dias_desde_ultima_compra,
    COUNT(*) FILTER (WHERE t.fecha >= date_trunc('month', CURRENT_DATE)) AS compras_mes_actual,
    COUNT(*) FILTER (WHERE t.fecha >= date_trunc('year', CURRENT_DATE))  AS compras_anio_actual,
    SUM(f.total_venta_mn) AS total_soles_historico
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t    ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c   ON f.cliente_id = c.cliente_id
JOIN dwh.dim_vendedor v  ON f.vendedor_id = v.vendedor_id
GROUP BY v.empleado_venta, c.cliente_id, c.ruc, c.razon_social, c.departamento;

COMMENT ON VIEW bi.v_cliente_frecuencia_vendedor IS 'Como bi.v_cliente_frecuencia pero acotado a las compras que el cliente hizo con UN vendedor especifico -- usado para "mis clientes inactivos" en el dashboard del vendedor. No es una cartera asignada formal, ver comentario arriba.';

-- Clientes que compraron mas productos DISTINTOS por mes (para el top de
-- gerencia, sin distincion de vendedor).
CREATE OR REPLACE VIEW bi.v_cliente_productos_mes AS
SELECT
    c.cliente_id,
    c.razon_social AS cliente,
    c.departamento,
    t.anio,
    t.mes,
    COUNT(DISTINCT f.producto_id) AS productos_distintos,
    SUM(f.total_venta_mn)         AS total_soles
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t   ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c  ON f.cliente_id = c.cliente_id
GROUP BY c.cliente_id, c.razon_social, c.departamento, t.anio, t.mes;

COMMENT ON VIEW bi.v_cliente_productos_mes IS 'Productos distintos comprados por cliente y mes, sin distincion de vendedor. Usado para el top de gerencia.';

-- Igual que la anterior pero acotada a un vendedor (mismo criterio de
-- "cliente del vendedor" que bi.v_cliente_frecuencia_vendedor) -- para el
-- grafico de "clientes que me compraron mas productos" del dashboard del
-- vendedor.
CREATE OR REPLACE VIEW bi.v_cliente_productos_mes_vendedor AS
SELECT
    v.empleado_venta AS vendedor,
    c.cliente_id,
    c.razon_social AS cliente,
    c.departamento,
    t.anio,
    t.mes,
    COUNT(DISTINCT f.producto_id) AS productos_distintos,
    SUM(f.total_venta_mn)         AS total_soles
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t    ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c   ON f.cliente_id = c.cliente_id
JOIN dwh.dim_vendedor v  ON f.vendedor_id = v.vendedor_id
GROUP BY v.empleado_venta, c.cliente_id, c.razon_social, c.departamento, t.anio, t.mes;

COMMENT ON VIEW bi.v_cliente_productos_mes_vendedor IS 'Como bi.v_cliente_productos_mes pero acotada a un vendedor especifico, mismo criterio que bi.v_cliente_frecuencia_vendedor.';

-- ============================================================
-- 3. Gerencia (mapa, tendencia)
-- ============================================================

-- Ventas por departamento y mes -- para el mapa de Peru. El cruce con
-- "linea que mas consume por departamento" queda pendiente de Fase 2 (falta
-- categoria en dim_producto).
CREATE OR REPLACE VIEW bi.v_ventas_departamento_mes AS
SELECT
    c.departamento,
    t.anio,
    t.mes,
    SUM(f.total_venta_mn) AS total_soles,
    COUNT(*)              AS numero_lineas,
    COUNT(DISTINCT c.cliente_id) AS clientes_distintos
FROM dwh.fact_ventas f
JOIN dwh.dim_tiempo t   ON f.fecha_id = t.fecha_id
JOIN dwh.dim_cliente c  ON f.cliente_id = c.cliente_id
GROUP BY c.departamento, t.anio, t.mes;

COMMENT ON VIEW bi.v_ventas_departamento_mes IS 'Ventas por departamento y mes, para el mapa de Peru del dashboard de gerencia. El cruce por linea/categoria consumida queda pendiente de Fase 2.';

-- ============================================================
-- 4. Rol de solo lectura para backend/reporting
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bi_readonly') THEN
        CREATE ROLE bi_readonly WITH LOGIN PASSWORD 'bi_readonly_local_dev';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA bi TO bi_readonly;
GRANT SELECT ON
    bi.v_ventas_vendedor_dia,
    bi.v_vendedor_producto_mes,
    bi.v_vendedores,
    bi.v_cliente_frecuencia,
    bi.v_cliente_frecuencia_vendedor,
    bi.v_cliente_productos_mes,
    bi.v_cliente_productos_mes_vendedor,
    bi.v_ventas_departamento_mes
TO bi_readonly;

-- Nota: bi_readonly NO tiene ningun permiso sobre dwh.*/staging.* ni sobre
-- la tabla usuarios directamente -- solo ve las vistas explicitas de este
-- archivo (usuarios queda cubierta indirectamente via bi.v_vendedores, sin
-- exponer password).
