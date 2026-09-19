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
│   ├── main.py       # FastAPI app, endpoints /chat y /recomendaciones/reactivacion
│   ├── agent.py      # Orquestación de /chat: LLM + tool-calling + auditoría
│   ├── tools.py       # Tool ejecutar_sql (whitelisted, solo SELECT)
│   ├── audit.py       # Registro en ai.consulta_log
│   ├── db.py          # Conexión de solo lectura
│   ├── config.py      # Settings desde .env
│   ├── auth.py        # Valida el JWT de admin (solo lo usa /recomendaciones/reactivacion)
│   ├── reporting_client.py  # Trae clientes inactivos desde backend/reporting
│   └── recomendaciones.py   # Redacta la recomendación de reactivación con LLM
└── prompts/
    └── system_prompt.md
```

## `/recomendaciones/reactivacion` (vendedores)

Endpoint separado de `/chat`: no es Text-to-SQL. El **cálculo** de qué
clientes están inactivos (días sin comprarle a este vendedor) viene de
`backend/reporting` (determinístico, auditable, ver
`bi.v_cliente_frecuencia_vendedor`); este servicio solo llama a `reporting`
reenviando el JWT del vendedor y usa el LLM únicamente para **redactar**
1-2 frases accionables por cliente — separar cálculo de redacción es la
decisión explícita de la Fase 1 (ver `backend/reporting/README.md`).

```bash
curl "http://localhost:8090/recomendaciones/reactivacion?dias_umbral=45" \
  -H "Authorization: Bearer <token de un usuario VENDEDOR>"
```

Requiere que `backend/admin` y `backend/reporting` estén corriendo y
compartan el mismo `JWT_SECRET` que este servicio.
