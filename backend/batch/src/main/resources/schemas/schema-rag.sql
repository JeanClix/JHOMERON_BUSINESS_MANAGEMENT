-- ============================================================
-- CAPA RAG: documentos institucionales + búsqueda semántica
-- Esquema: rag
-- ============================================================
--
-- POR QUE ESTE ARCHIVO:
--   Complementa a ai.* (Text-to-SQL sobre ventas, datos estructurados) con
--   un segundo modo de respuesta para preguntas sobre documentación NO
--   estructurada (misión/visión, catálogo, políticas, procesos internos):
--   Admin/Gerencia suben documentos (ver backend/intelligence/ai), se
--   trocean y embeben, y el agente los recupera por similitud semántica
--   con una nueva tool `buscar_documentos` (ver src/tools.py).
--
--   Dimensión del vector (2048) confirmada contra la cuenta NVIDIA real en
--   uso (modelo nvidia/nemotron-3-embed-1b vía integrate.api.nvidia.com) --
--   si el proveedor de embeddings cambia, esta columna debe migrarse.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS rag;

-- ============================================================
-- 1. Documentos y sus fragmentos (chunks) embebidos
-- ============================================================

CREATE TABLE IF NOT EXISTS rag.documento (
    id BIGSERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    categoria VARCHAR(30) NOT NULL DEFAULT 'general',
    -- Texto extraído del archivo subido (markdown/plano) -- fuente de verdad
    -- para re-chunking; el archivo original (pdf/docx) no se conserva.
    contenido TEXT NOT NULL,
    formato_original VARCHAR(10) NOT NULL,
    -- Qué roles de usuario pueden ver este documento en la búsqueda del chat.
    -- Ver rag.v_chunk_visible: filtrado por variable de sesión, no por lo
    -- que decida el LLM -- mismo criterio que app.current_vendedor en ai.*.
    roles_visibles TEXT[] NOT NULL DEFAULT ARRAY['VENDEDOR', 'GERENCIA', 'ADMIN'],
    -- Claim `name` del JWT de quien subió/editó -- nunca un campo que mande
    -- el cliente (mismo criterio que vendedorNombreSap en backend/admin).
    subido_por VARCHAR(150),
    -- Soft-delete: nunca se borra físicamente, se oculta de la búsqueda.
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE rag.documento IS 'Documentos institucionales subidos por Admin/Gerencia (políticas, catálogo, procesos) -- fuente para la tool buscar_documentos del chat.';

CREATE TABLE IF NOT EXISTS rag.chunk (
    id BIGSERIAL PRIMARY KEY,
    documento_id BIGINT NOT NULL REFERENCES rag.documento(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    contenido TEXT NOT NULL,
    embedding VECTOR(2048) NOT NULL,
    UNIQUE (documento_id, chunk_index)
);

COMMENT ON TABLE rag.chunk IS 'Fragmentos embebidos de rag.documento. Al editar/re-subir un documento se BORRAN todos sus chunks antes de re-insertar -- nunca se agrega sin borrar, para que una versión vieja no compita en la búsqueda con la nueva.';

-- Sin índice HNSW/IVFFlat a propósito: pgvector limita esos índices a 2000
-- dimensiones y el modelo de embeddings en uso (nvidia/nemotron-3-embed-1b)
-- devuelve 2048 -- no entra. Para el volumen de documentos de esta empresa
-- (decenas/cientos, no millones), un escaneo secuencial exacto en cada
-- búsqueda (ORDER BY embedding <=> :query LIMIT n) es rápido de sobra y da
-- resultados exactos, no aproximados. Si el corpus crece a decenas de miles
-- de chunks, revisar: truncar a <=2000 dims (algunos modelos NVIDIA aceptan
-- un parámetro `dimensions`) o cambiar de modelo de embeddings.

-- ============================================================
-- 2. Vista de recuperación (filtrada por rol de sesión)
-- ============================================================
-- Mismo patrón que ai.v_ventas_vendedor: el filtro depende de una variable
-- de sesión (app.current_role) que el AI Service fija ANTES de ejecutar la
-- búsqueda, a partir del claim `role` del JWT -- nunca de algo que el LLM
-- decida escribir. Fail-closed: sin la variable fijada, current_setting
-- devuelve NULL y no matchea ningún documento.
CREATE OR REPLACE VIEW rag.v_chunk_visible AS
SELECT
    c.id,
    c.documento_id,
    c.chunk_index,
    c.contenido,
    c.embedding,
    d.titulo,
    d.categoria
FROM rag.chunk c
JOIN rag.documento d ON d.id = c.documento_id
WHERE d.activo
  AND current_setting('app.current_role', true) = ANY(d.roles_visibles);

COMMENT ON VIEW rag.v_chunk_visible IS 'Chunks de documentos activos, visibles para el rol fijado en app.current_role (ver tools.py: set_config antes de la búsqueda). Única vista que la tool buscar_documentos puede leer.';

-- ============================================================
-- 3. Permisos -- reutiliza el rol ai_readonly ya existente
-- ============================================================
-- ai_readonly ya es "de solo lectura salvo excepciones explícitas" (ver
-- GRANT INSERT sobre ai.consulta_log en schema-ai.sql): el AI Service es el
-- único servicio que ingiere y consulta documentos, así que reutiliza su
-- rol/credencial en vez de sumar un segundo rol para el mismo servicio.
GRANT USAGE ON SCHEMA rag TO ai_readonly;
GRANT SELECT ON rag.v_chunk_visible TO ai_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON rag.documento, rag.chunk TO ai_readonly;
GRANT USAGE, SELECT ON SEQUENCE rag.documento_id_seq, rag.chunk_id_seq TO ai_readonly;

-- Nota: ai_readonly sigue sin ningún permiso sobre dwh.*/staging.* -- este
-- archivo solo amplía su alcance dentro del nuevo esquema rag.*.
