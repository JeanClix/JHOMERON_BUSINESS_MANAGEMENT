-- Schema para la gestión de usuarios y telemetría

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  usuario VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  area VARCHAR(100),
  ubicacion VARCHAR(255),
  rol VARCHAR(50) NOT NULL -- 'ADMIN', 'GERENCIA', 'VENDEDOR'
);

CREATE TABLE IF NOT EXISTS telemetria_ia (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion VARCHAR(255) NOT NULL,
  prompt TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
