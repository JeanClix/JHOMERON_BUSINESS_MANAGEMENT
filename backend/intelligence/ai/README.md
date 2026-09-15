# JHOMERON AI Service

Microservicio FastAPI que responde preguntas en lenguaje natural sobre ventas,
usando **Text-to-SQL + tool-calling** contra el Data Warehouse (`dwh.*`), no
RAG con embeddings — los datos son estructurados/numéricos, no documentos.

## Por qué esta arquitectura

- El LLM nunca inventa cifras: siempre llama a la tool `ejecutar_sql` antes de
  responder algo numérico.
- El LLM solo ve dos vistas de negocio (`ai.v_ventas`,
  `ai.v_ventas_mensual_departamento`), nunca las tablas crudas del modelo
  estrella ni de staging.
- Se conecta con el rol Postgres `ai_readonly`, que a nivel de base de datos
  no puede escribir ni leer nada fuera de esas vistas (ver
  `backend/batch/src/main/resources/schemas/schema-ai.sql`).
- Cada pregunta y su SQL generado quedan en `ai.consulta_log` (trazabilidad:
  "¿de qué datos reales salió esta respuesta?").
- RAG queda reservado para la parte de documentación empresarial (PDFs,
  manuales) que ya existe en el frontend (`document-explorer`), no para
  preguntas de ventas.

## Cómo correr en desarrollo

```bash
cd intelligence/ai
python -m venv .venv
source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # ajustar si tu Postgres/Ollama no son los defaults

# Requiere Ollama corriendo localmente con un modelo que soporte tool-calling
# (ej. llama3.1): ollama pull llama3.1 && ollama serve

uvicorn src.main:app --reload --port 8090
```

Probar:

```bash
curl -X POST http://localhost:8090/chat \
  -H "Content-Type: application/json" \
  -d '{"pregunta": "¿Cuánto vendimos en total?"}'
```

## Estructura

```
intelligence/ai/
├── src/
│   ├── main.py       # FastAPI app, endpoint /chat
│   ├── agent.py      # Orquestación: LLM + tool-calling + auditoría
│   ├── tools.py       # Tool ejecutar_sql (whitelisted, solo SELECT)
│   ├── audit.py       # Registro en ai.consulta_log
│   ├── db.py          # Conexión de solo lectura
│   └── config.py      # Settings desde .env
└── prompts/
    └── system_prompt.md
```
