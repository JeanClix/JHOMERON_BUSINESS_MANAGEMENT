-- ============================================================
-- MODELO ESTRELLA (DATA WAREHOUSE) - JHOMERON BATCH ETL
-- Esquema: dwh
-- ============================================================

CREATE SCHEMA IF NOT EXISTS dwh;

-- 1. Dimensión Tiempo
CREATE TABLE IF NOT EXISTS dwh.dim_tiempo (
    fecha_id INT PRIMARY KEY,               -- Formato YYYYMMDD (ej: 20260309)
    fecha DATE NOT NULL UNIQUE,
    anio INT NOT NULL,
    mes INT NOT NULL,
    mes_nombre VARCHAR(20) NOT NULL,
    dia INT NOT NULL,
    dia_semana INT NOT NULL,
    dia_nombre VARCHAR(20) NOT NULL,
    trimestre INT NOT NULL,
    es_fin_semana BOOLEAN NOT NULL
);

-- 2. Dimensión Cliente
CREATE TABLE IF NOT EXISTS dwh.dim_cliente (
    cliente_id SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(50) NOT NULL UNIQUE,
    nombre_cliente VARCHAR(255) NOT NULL,
    departamento VARCHAR(100),
    provincia VARCHAR(100),
    distrito VARCHAR(100),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dimensión Producto
CREATE TABLE IF NOT EXISTS dwh.dim_producto (
    producto_id SERIAL PRIMARY KEY,
    codigo_producto VARCHAR(50) NOT NULL UNIQUE,
    nombre_producto VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Dimensión Vendedor
CREATE TABLE IF NOT EXISTS dwh.dim_vendedor (
    vendedor_id SERIAL PRIMARY KEY,
    codigo_vendedor INT NOT NULL UNIQUE,
    nombre_vendedor VARCHAR(150) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Dimensión Condición de Pago
CREATE TABLE IF NOT EXISTS dwh.dim_condicion_pago (
    condicion_pago_id SERIAL PRIMARY KEY,
    nombre_condicion VARCHAR(100) NOT NULL UNIQUE
);

-- 6. Tabla de Hechos: Ventas
CREATE TABLE IF NOT EXISTS dwh.fact_ventas (
    fact_id BIGSERIAL PRIMARY KEY,
    doc_entry INT NOT NULL,
    doc_line INT NOT NULL,
    fecha_id INT NOT NULL REFERENCES dwh.dim_tiempo(fecha_id),
    cliente_id INT NOT NULL REFERENCES dwh.dim_cliente(cliente_id),
    producto_id INT NOT NULL REFERENCES dwh.dim_producto(producto_id),
    vendedor_id INT NOT NULL REFERENCES dwh.dim_vendedor(vendedor_id),
    condicion_pago_id INT REFERENCES dwh.dim_condicion_pago(condicion_pago_id),
    cantidad NUMERIC(19, 4) NOT NULL,
    precio_unitario NUMERIC(19, 4) NOT NULL,
    base_imponible NUMERIC(19, 4) NOT NULL,
    igv NUMERIC(19, 4) NOT NULL,
    importe_total NUMERIC(19, 4) NOT NULL,
    fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_fact_ventas_doc_line UNIQUE (doc_entry, doc_line)
);

-- Índices de optimización para BI y análisis ML
CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha ON dwh.fact_ventas(fecha_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_cliente ON dwh.fact_ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_producto ON dwh.fact_ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_vendedor ON dwh.fact_ventas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_condicion ON dwh.fact_ventas(condicion_pago_id);

-- ============================================================
-- PROCEDIMIENTO DE TRANSFORMACIÓN: staging -> modelo estrella
-- ============================================================
CREATE OR REPLACE PROCEDURE dwh.sp_cargar_modelo_estrella()
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Poblar dim_tiempo desde las fechas de staging.ventas
    INSERT INTO dwh.dim_tiempo (fecha_id, fecha, anio, mes, mes_nombre, dia, dia_semana, dia_nombre, trimestre, es_fin_semana)
    SELECT DISTINCT
        TO_CHAR(fecha, 'YYYYMMDD')::INT,
        fecha,
        EXTRACT(YEAR FROM fecha)::INT,
        EXTRACT(MONTH FROM fecha)::INT,
        TO_CHAR(fecha, 'TMMonth'),
        EXTRACT(DAY FROM fecha)::INT,
        EXTRACT(ISODOW FROM fecha)::INT,
        TO_CHAR(fecha, 'TMDay'),
        EXTRACT(QUARTER FROM fecha)::INT,
        CASE WHEN EXTRACT(ISODOW FROM fecha) IN (6, 7) THEN TRUE ELSE FALSE END
    FROM staging.ventas
    WHERE estado = 'PENDIENTE'
    ON CONFLICT (fecha) DO NOTHING;

    -- 2. Poblar dim_cliente (SCD Tipo 1: actualiza ubicación si cambia)
    INSERT INTO dwh.dim_cliente (codigo_cliente, nombre_cliente, departamento, provincia, distrito)
    SELECT DISTINCT ON (codigo_cliente)
        codigo_cliente,
        COALESCE(cliente, 'SIN NOMBRE'),
        departamento,
        provincia,
        distrito
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND codigo_cliente IS NOT NULL
    ORDER BY codigo_cliente, fecha_carga DESC
    ON CONFLICT (codigo_cliente) DO UPDATE SET
        nombre_cliente = EXCLUDED.nombre_cliente,
        departamento = EXCLUDED.departamento,
        provincia = EXCLUDED.provincia,
        distrito = EXCLUDED.distrito;

    -- 3. Poblar dim_producto
    INSERT INTO dwh.dim_producto (codigo_producto, nombre_producto, categoria)
    SELECT DISTINCT ON (codigo_producto)
        codigo_producto,
        COALESCE(producto, 'SIN NOMBRE'),
        categoria
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND codigo_producto IS NOT NULL
    ORDER BY codigo_producto, fecha_carga DESC
    ON CONFLICT (codigo_producto) DO UPDATE SET
        nombre_producto = EXCLUDED.nombre_producto,
        categoria = EXCLUDED.categoria;

    -- 4. Poblar dim_vendedor
    INSERT INTO dwh.dim_vendedor (codigo_vendedor, nombre_vendedor)
    SELECT DISTINCT ON (codigo_vendedor)
        codigo_vendedor,
        COALESCE(vendedor, 'SIN VENDEDOR')
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND codigo_vendedor IS NOT NULL
    ORDER BY codigo_vendedor, fecha_carga DESC
    ON CONFLICT (codigo_vendedor) DO UPDATE SET
        nombre_vendedor = EXCLUDED.nombre_vendedor;

    -- 5. Poblar dim_condicion_pago
    INSERT INTO dwh.dim_condicion_pago (nombre_condicion)
    SELECT DISTINCT condicion_pago
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND condicion_pago IS NOT NULL
    ON CONFLICT (nombre_condicion) DO NOTHING;

    -- 6. Poblar fact_ventas vinculando con las dimensiones
    INSERT INTO dwh.fact_ventas (
        doc_entry, doc_line, fecha_id, cliente_id, producto_id, vendedor_id, condicion_pago_id,
        cantidad, precio_unitario, base_imponible, igv, importe_total
    )
    SELECT
        s.doc_entry,
        s.doc_line,
        t.fecha_id,
        c.cliente_id,
        p.producto_id,
        v.vendedor_id,
        cp.condicion_pago_id,
        COALESCE(s.cantidad, 0),
        COALESCE(s.precio_unitario, 0),
        COALESCE(s.base_imponible, 0),
        COALESCE(s.igv, 0),
        COALESCE(s.importe_total, 0)
    FROM staging.ventas s
    INNER JOIN dwh.dim_tiempo t ON s.fecha = t.fecha
    INNER JOIN dwh.dim_cliente c ON s.codigo_cliente = c.codigo_cliente
    INNER JOIN dwh.dim_producto p ON s.codigo_producto = p.codigo_producto
    INNER JOIN dwh.dim_vendedor v ON s.codigo_vendedor = v.codigo_vendedor
    LEFT JOIN dwh.dim_condicion_pago cp ON s.condicion_pago = cp.nombre_condicion
    WHERE s.estado = 'PENDIENTE'
    ON CONFLICT (doc_entry, doc_line) DO UPDATE SET
        cantidad = EXCLUDED.cantidad,
        precio_unitario = EXCLUDED.precio_unitario,
        base_imponible = EXCLUDED.base_imponible,
        igv = EXCLUDED.igv,
        importe_total = EXCLUDED.importe_total,
        fecha_carga = CURRENT_TIMESTAMP;

    -- 7. Marcar registros procesados en staging
    UPDATE staging.ventas
    SET estado = 'PROCESADO'
    WHERE estado = 'PENDIENTE';

END;
$$;
