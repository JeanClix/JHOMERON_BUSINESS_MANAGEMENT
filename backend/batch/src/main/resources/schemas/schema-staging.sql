-- Schema para staging de datos de SAP/CSV
-- JHOMERON Batch ETL

-- Crear schema si no existe
CREATE SCHEMA IF NOT EXISTS staging;

-- Tabla de pedidos (staging)
DROP TABLE IF EXISTS staging.pedidos;
CREATE TABLE staging.pedidos (
    id SERIAL PRIMARY KEY,
    cliente VARCHAR(150) NOT NULL,
    producto VARCHAR(150) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    fecha_pedido DATE NOT NULL,
    fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(10) NOT NULL CHECK (source IN ('SAP', 'CSV')),
    lote VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESADO', 'ERROR'))
);

-- Indices para consultas frecuentes
CREATE INDEX idx_pedidos_cliente ON staging.pedidos(cliente);
CREATE INDEX idx_pedidos_producto ON staging.pedidos(producto);
CREATE INDEX idx_pedidos_fecha ON staging.pedidos(fecha_pedido);
CREATE INDEX idx_pedidos_estado ON staging.pedidos(estado);
CREATE INDEX idx_pedidos_source ON staging.pedidos(source);
CREATE INDEX idx_pedidos_lote ON staging.pedidos(lote);

-- Comentarios para documentación
COMMENT ON TABLE staging.pedidos IS 'Tabla de staging para pedidos extraidos de SAP/CSV para reentrenamiento ML';
COMMENT ON COLUMN staging.pedidos.cliente IS 'Nombre o codigo del cliente';
COMMENT ON COLUMN staging.pedidos.producto IS 'Nombre o codigo del producto (pintura)';
COMMENT ON COLUMN staging.pedidos.cantidad IS 'Cantidad pedida en unidades';
COMMENT ON COLUMN staging.pedidos.fecha_pedido IS 'Fecha en que se realizo el pedido';
COMMENT ON COLUMN staging.pedidos.source IS 'Origen de los datos: SAP o CSV';
COMMENT ON COLUMN staging.pedidos.lote IS 'Identificador del lote de carga batch';
COMMENT ON COLUMN staging.pedidos.estado IS 'Estado del registro en el pipeline ETL';

-- ============================================================
-- Tabla de ventas (staging extraído de SAP B1 / SQL Server)
-- ============================================================
DROP TABLE IF EXISTS staging.ventas;
CREATE TABLE staging.ventas (
    id SERIAL PRIMARY KEY,
    fecha_contabilizacion DATE,
    fecha_documento DATE,
    fecha_vencimiento DATE,
    tipo VARCHAR(50),
    serie VARCHAR(50),
    numero INTEGER,
    ruc VARCHAR(50),
    razon_social VARCHAR(255),
    empleado_venta VARCHAR(150),
    numero_articulo VARCHAR(50),
    descripcion_articulo VARCHAR(255),
    unidad_medida VARCHAR(50),
    cantidad NUMERIC(19, 4),
    valor_unitario NUMERIC(19, 4),
    total_venta_me NUMERIC(19, 4),
    moneda VARCHAR(20),
    tipo_cambio NUMERIC(19, 4),
    total_venta_mn NUMERIC(19, 4),
    ciudad VARCHAR(100),
    distrito VARCHAR(100),
    departamento VARCHAR(100),
    fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(20) DEFAULT 'SAP',
    lote VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESADO', 'ERROR'))
);

CREATE INDEX idx_ventas_fecha ON staging.ventas(fecha_contabilizacion);
CREATE INDEX idx_ventas_ruc ON staging.ventas(ruc);
CREATE INDEX idx_ventas_producto ON staging.ventas(numero_articulo);
CREATE INDEX idx_ventas_vendedor ON staging.ventas(empleado_venta);
CREATE INDEX idx_ventas_estado ON staging.ventas(estado);

COMMENT ON TABLE staging.ventas IS 'Tabla de staging para ventas extraídas de SAP B1 vía sp_ExtraerVentas';
