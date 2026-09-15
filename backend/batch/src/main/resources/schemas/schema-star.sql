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
    ruc VARCHAR(50) NOT NULL UNIQUE,
    razon_social VARCHAR(255) NOT NULL,
    departamento VARCHAR(100),
    ciudad VARCHAR(100),
    distrito VARCHAR(100),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dimensión Producto
CREATE TABLE IF NOT EXISTS dwh.dim_producto (
    producto_id SERIAL PRIMARY KEY,
    numero_articulo VARCHAR(50) NOT NULL UNIQUE,
    descripcion_articulo VARCHAR(255) NOT NULL,
    unidad_medida VARCHAR(50),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Dimensión Vendedor
CREATE TABLE IF NOT EXISTS dwh.dim_vendedor (
    vendedor_id SERIAL PRIMARY KEY,
    empleado_venta VARCHAR(150) NOT NULL UNIQUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Dimensión Tipo de Documento
CREATE TABLE IF NOT EXISTS dwh.dim_tipo_doc (
    tipo_id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL UNIQUE
);

-- 6. Tabla de Hechos: Ventas
CREATE TABLE IF NOT EXISTS dwh.fact_ventas (
    fact_id BIGSERIAL PRIMARY KEY,
    serie VARCHAR(50) NOT NULL,
    numero INT NOT NULL,
    fecha_id INT NOT NULL REFERENCES dwh.dim_tiempo(fecha_id),
    cliente_id INT NOT NULL REFERENCES dwh.dim_cliente(cliente_id),
    producto_id INT NOT NULL REFERENCES dwh.dim_producto(producto_id),
    vendedor_id INT NOT NULL REFERENCES dwh.dim_vendedor(vendedor_id),
    tipo_id INT REFERENCES dwh.dim_tipo_doc(tipo_id),
    cantidad NUMERIC(19, 4) NOT NULL,
    valor_unitario NUMERIC(19, 4) NOT NULL,
    total_venta_me NUMERIC(19, 4) NOT NULL,
    tipo_cambio NUMERIC(19, 4) NOT NULL,
    total_venta_mn NUMERIC(19, 4) NOT NULL,
    fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_fact_ventas_doc UNIQUE (serie, numero, producto_id)
);

-- Índices de optimización para BI y análisis ML
CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha ON dwh.fact_ventas(fecha_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_cliente ON dwh.fact_ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_producto ON dwh.fact_ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_vendedor ON dwh.fact_ventas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_fact_ventas_tipo ON dwh.fact_ventas(tipo_id);

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
        TO_CHAR(fecha_contabilizacion, 'YYYYMMDD')::INT,
        fecha_contabilizacion,
        EXTRACT(YEAR FROM fecha_contabilizacion)::INT,
        EXTRACT(MONTH FROM fecha_contabilizacion)::INT,
        TO_CHAR(fecha_contabilizacion, 'TMMonth'),
        EXTRACT(DAY FROM fecha_contabilizacion)::INT,
        EXTRACT(ISODOW FROM fecha_contabilizacion)::INT,
        TO_CHAR(fecha_contabilizacion, 'TMDay'),
        EXTRACT(QUARTER FROM fecha_contabilizacion)::INT,
        CASE WHEN EXTRACT(ISODOW FROM fecha_contabilizacion) IN (6, 7) THEN TRUE ELSE FALSE END
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND fecha_contabilizacion IS NOT NULL
    ON CONFLICT (fecha) DO NOTHING;

    -- 2. Poblar dim_cliente (SCD Tipo 1: actualiza ubicación si cambia)
    INSERT INTO dwh.dim_cliente (ruc, razon_social, departamento, ciudad, distrito)
    SELECT DISTINCT ON (ruc)
        ruc,
        COALESCE(razon_social, 'SIN RAZON SOCIAL'),
        departamento,
        ciudad,
        distrito
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND ruc IS NOT NULL
    ORDER BY ruc, fecha_carga DESC
    ON CONFLICT (ruc) DO UPDATE SET
        razon_social = EXCLUDED.razon_social,
        departamento = EXCLUDED.departamento,
        ciudad = EXCLUDED.ciudad,
        distrito = EXCLUDED.distrito;

    -- 3. Poblar dim_producto
    INSERT INTO dwh.dim_producto (numero_articulo, descripcion_articulo, unidad_medida)
    SELECT DISTINCT ON (numero_articulo)
        numero_articulo,
        COALESCE(descripcion_articulo, 'SIN DESCRIPCION'),
        unidad_medida
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND numero_articulo IS NOT NULL
    ORDER BY numero_articulo, fecha_carga DESC
    ON CONFLICT (numero_articulo) DO UPDATE SET
        descripcion_articulo = EXCLUDED.descripcion_articulo,
        unidad_medida = EXCLUDED.unidad_medida;

    -- 4. Poblar dim_vendedor
    INSERT INTO dwh.dim_vendedor (empleado_venta)
    SELECT DISTINCT ON (empleado_venta)
        COALESCE(empleado_venta, 'SIN VENDEDOR')
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND empleado_venta IS NOT NULL
    ON CONFLICT (empleado_venta) DO NOTHING;

    -- 5. Poblar dim_tipo_doc
    INSERT INTO dwh.dim_tipo_doc (tipo)
    SELECT DISTINCT tipo
    FROM staging.ventas
    WHERE estado = 'PENDIENTE' AND tipo IS NOT NULL
    ON CONFLICT (tipo) DO NOTHING;

    -- 6. Poblar fact_ventas vinculando con las dimensiones
    INSERT INTO dwh.fact_ventas (
        serie, numero, fecha_id, cliente_id, producto_id, vendedor_id, tipo_id,
        cantidad, valor_unitario, total_venta_me, tipo_cambio, total_venta_mn
    )
    SELECT
        s.serie,
        s.numero,
        t.fecha_id,
        c.cliente_id,
        p.producto_id,
        v.vendedor_id,
        td.tipo_id,
        COALESCE(s.cantidad, 0),
        COALESCE(s.valor_unitario, 0),
        COALESCE(s.total_venta_me, 0),
        COALESCE(s.tipo_cambio, 0),
        COALESCE(s.total_venta_mn, 0)
    FROM staging.ventas s
    INNER JOIN dwh.dim_tiempo t ON s.fecha_contabilizacion = t.fecha
    INNER JOIN dwh.dim_cliente c ON s.ruc = c.ruc
    INNER JOIN dwh.dim_producto p ON s.numero_articulo = p.numero_articulo
    INNER JOIN dwh.dim_vendedor v ON COALESCE(s.empleado_venta, 'SIN VENDEDOR') = v.empleado_venta
    LEFT JOIN dwh.dim_tipo_doc td ON s.tipo = td.tipo
    WHERE s.estado = 'PENDIENTE'
    ON CONFLICT (serie, numero, producto_id) DO UPDATE SET
        cantidad = EXCLUDED.cantidad,
        valor_unitario = EXCLUDED.valor_unitario,
        total_venta_me = EXCLUDED.total_venta_me,
        tipo_cambio = EXCLUDED.tipo_cambio,
        total_venta_mn = EXCLUDED.total_venta_mn,
        fecha_carga = CURRENT_TIMESTAMP;

    -- 7. Marcar registros procesados en staging
    UPDATE staging.ventas
    SET estado = 'PROCESADO'
    WHERE estado = 'PENDIENTE';

END;
$$;
