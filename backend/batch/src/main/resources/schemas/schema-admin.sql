-- Schema para la gestión de usuarios y telemetría

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  usuario VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  area VARCHAR(100),
  ubicacion VARCHAR(255),
  rol VARCHAR(50) NOT NULL, -- 'ADMIN', 'GERENCIA', 'VENDEDOR'
  -- Meta de venta mensual y semanal (S/), solo aplica a rol VENDEDOR. Base
  -- del "tachito de pintura" de cumplimiento de cuota en el dashboard del
  -- vendedor -- son dos campos independientes (no se deriva la semanal
  -- dividiendo la mensual entre 4), aunque hoy coincidan (20000 x 4 = 80000).
  meta_mensual NUMERIC(14, 2),
  meta_semanal NUMERIC(14, 2),
  -- DEUDA TECNICA TEMPORAL (ver TODO / Fase 2): dwh.dim_vendedor solo tiene
  -- el nombre libre que llega de SAP (OSLP.SlpName), sin un codigo estable
  -- (SlpCode) todavia extraido por el batch. Mientras eso no se agregue al
  -- SP de extraccion, este campo debe cargarse a mano al crear el vendedor
  -- desde el panel admin, copiando EXACTAMENTE el valor de
  -- dwh.dim_vendedor.empleado_venta para ese vendedor -- es el unico join
  -- posible hoy entre "quien inicio sesion" y "de quien son estas ventas".
  -- Cuando el batch extraiga SlpCode, esto se reemplaza por un codigo real.
  vendedor_nombre_sap VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS telemetria_ia (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion VARCHAR(255) NOT NULL,
  prompt TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
