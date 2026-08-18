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
