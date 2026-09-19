[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/JeanClix/JHOMERON_BUSINESS_MANAGEMENT)

# JHOMERON Business Management

Plataforma de gestión comercial para Industrias JHOMERON S.A. Este README documenta
el **estado real e implementado** del proyecto. El plan de arquitectura original
(visión completa, todas las fases) sigue en [`backend/batch/PROCESO_BATCH.md`](backend/batch/PROCESO_BATCH.md).

## Arquitectura actual

```
Angular (frontend/)
    │
    ├──→ AI Service (backend/intelligence/ai) ──→ PostgreSQL (ai.v_ventas, solo lectura)
    │        Text-to-SQL + tool-calling, NO RAG (datos estructurados)
    │
    ├──→ Admin Service (backend/admin) ──→ PostgreSQL (usuarios)
    │        Identidad/config: login (emite JWT), gestión de usuarios/vendedores
    │        y su meta mensual desde el panel admin.
    │
    └──→ Reporting Service (backend/reporting) ──→ PostgreSQL (bi.*, solo lectura)
             Endpoints REST deterministicos (sin LLM) para los dashboards de
             Vendedores y Gerencia. Valida el JWT emitido por Admin; cada
             vendedor solo ve sus propios datos (nunca por parámetro del
             cliente, siempre por claim del token).

Spring Batch (backend/batch) ──→ SQL Server / SAP B1 ──→ staging ──→ dwh.* (modelo estrella)

Data Warehouse (dwh.*) ──→ intelligence/ml ──→ MLflow (comparación y tracking de modelos)
```

## Módulos

### 1. `backend/batch` — ETL (Spring Batch, Java)

Extrae ventas de SAP Business One / SQL Server (`sp_ExtraerVentas`), las carga a
`staging.ventas` y transforma al modelo estrella `dwh.*` (Postgres).

- **Perfiles**: `local` (Postgres en `localhost:5432`, recomendado para desarrollo),
  `neon` (Postgres en la nube, plan free — cuidado con límites de cómputo/pool),
  `dev` (H2 en memoria, solo para pruebas rápidas).
- **Idempotencia**: watermark en `staging.control_carga` — cada corrida solo extrae
  fechas nuevas desde la última ejecución exitosa.
- **Correr**: `./mvnw spring-boot:run -Dspring-boot.run.profiles=local`
- Estado actual de datos reales: **525,751 filas** cargadas en `dwh.fact_ventas`.

Detalle técnico del Stored Procedure y mapeo de columnas:
[`backend/batch/PROCESO_BATCH.md`](backend/batch/PROCESO_BATCH.md).

### 2. `backend/intelligence/ai` — AI Service (FastAPI, Python)

Asistente conversacional sobre ventas reales, vía **Text-to-SQL + tool-calling**
(no RAG — los datos son estructurados/numéricos, RAG queda reservado para
documentación empresarial no estructurada).

- El LLM solo puede ejecutar `SELECT` sobre dos vistas de negocio
  (`ai.v_ventas`, `ai.v_ventas_mensual_departamento`), con un rol Postgres
  de solo lectura (`ai_readonly`) que no puede tocar `dwh.*`/`staging.*` directo.
- Cada pregunta/respuesta queda auditada en `ai.consulta_log` (trazabilidad).
- LLM configurable vía `.env` (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) — hoy
  apuntando a la API de NVIDIA (`deepseek-ai/deepseek-v4-flash-0731`) en dev.
- **Correr**: `cd backend/intelligence/ai && .venv/Scripts/python.exe -m uvicorn src.main:app --port 8090`
- Colecciones de prueba: `JHOMERON-AI-Service.postman_collection.json` y `bruno-collection/`.

Detalle completo: [`backend/intelligence/ai/README.md`](backend/intelligence/ai/README.md).

### 3. `intelligence/ml` — Entrenamiento de modelos predictivos (Python)

Pipeline de feature engineering + comparación de modelos sobre datos reales
del Data Warehouse, con tracking en MLflow.

- **Extracción**: `python -m src.extraction.extract_ventas` (usa el mismo rol
  `ai_readonly`, sin permisos nuevos) → `data/ventas_raw.parquet`.
- **Features**: `python -m src.features.build_features` → agregado por
  (producto, día) con variables de calendario y rolling 7/30 días →
  `data/ventas_features.parquet`.
- **Comparación de modelos**: `python -m src.training.compare_models --sizes 50000,100000,150000,207000`
  — Regresión Lineal, Random Forest y XGBoost, con split **temporal** (nunca
  aleatorio) y métricas (MAE, RMSE, MAPE) trackeadas en MLflow.
- **Panel de resultados**: `mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000`
  → `http://localhost:5000`, pestaña **Runs** del experimento `jhomeron_ventas_forecast`.
- **Reporte de la última corrida** (cuántos datos, qué significa cada métrica,
  cuál modelo ganó y por qué): [`intelligence/ml/REPORTE_ENTRENAMIENTO.md`](intelligence/ml/REPORTE_ENTRENAMIENTO.md).
- **Pendiente**: baseline naive de referencia, promover el mejor modelo a
  "Production" en el Model Registry, y una tool `predecir_ventas` en el AI
  Service para que el propio LLM decida cuándo consultar SQL (histórico) vs.
  pedir una predicción al modelo ML (futuro) — ver discusión de arquitectura
  más abajo.

### 4. `backend/admin` — Admin Service (Spring Boot, Java)

Identidad y configuración: login (`POST /api/auth/login`, emite un JWT
HS256 además del usuario) y CRUD de usuarios/vendedores (`/api/admin/users`,
protegido por el JWT — requiere rol `ADMIN`).

- Desde acá se crean los vendedores (`rol=VENDEDOR`) y se configuran dos
  campos nuevos: `metaMensual` (meta de venta del mes, base del % de
  cumplimiento de cuota) y `vendedorNombreSap` (deuda técnica temporal: debe
  copiarse exacto desde `dwh.dim_vendedor.empleado_venta` — no hay todavía
  un código de vendedor estable de SAP extraído por el batch, ver más abajo).
- **Correr**: `cd backend/admin && ./mvnw spring-boot:run`.

### 5. `backend/reporting` — Reporting Service (FastAPI, Python)

Endpoints REST deterministicos (sin LLM) para los dashboards de **Vendedores**
y **Gerencia** — a diferencia de `ai`, esto no pasa por un LLM: son
agregaciones SQL directas sobre un schema propio (`bi.*`), con el mismo
patrón de rol de solo lectura que `ai_readonly` (ver
`backend/batch/src/main/resources/schemas/schema-bi.sql`).

- Valida el JWT que emite `admin` (mismo `JWT_SECRET`); cada vendedor ve
  sus propios datos porque el endpoint lee el vendedor del claim del token,
  nunca de un parámetro que mande el cliente.
- **Correr**: `cd backend/reporting && .venv/Scripts/python.exe -m uvicorn src.main:app --port 8093`.
- Detalle completo, endpoints y deuda técnica conocida:
  [`backend/reporting/README.md`](backend/reporting/README.md).

### 6. `frontend` — Angular

- **Área de Gerencia** (`/gerencia`): dashboard, chat IA (hoy con datos simulados,
  pendiente de conectar al AI Service real), documentación, insights.
- **Área de Ventas** (`/ventas`): catálogo, cotizador, cartera de clientes, y el
  **Asistente de Ventas IA** (`Asistente de Ventas IA` en el sidebar) — este sí
  está conectado de verdad al AI Service (`http://localhost:8090/chat`), con
  chips de preguntas frecuentes y gráficos automáticos cuando la respuesta trae
  un listado.
- **Correr**: `npm install && npm start` (Node ≥ 24.15 o ≥ 22.22.3 — Angular CLI 22
  exige esa versión mínima) → `http://localhost:4200`.
- **Docker de desarrollo**: `frontend/Dockerfile` (corre `ng serve` en contenedor).

## Cómo levantar todo en desarrollo

1. PostgreSQL local corriendo, base `jhomeron_batch` con los schemas de
   `backend/batch/src/main/resources/schemas/` aplicados (`schema-staging.sql`,
   `schema-star.sql`, `schema-ai.sql`, `schema-admin.sql`, `schema-bi.sql`).
2. Batch: `cd backend/batch && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local`
3. AI Service: `cd backend/intelligence/ai && .venv/Scripts/python.exe -m uvicorn src.main:app --port 8090`
4. Admin Service: `cd backend/admin && ./mvnw spring-boot:run` (emite el JWT que valida Reporting)
5. Reporting Service: `cd backend/reporting && .venv/Scripts/python.exe -m uvicorn src.main:app --port 8093`
6. Frontend: `cd frontend && npm start`
7. (Opcional) ML: `cd intelligence/ml && .venv/Scripts/python.exe -m src.training.compare_models`

## Decisiones de arquitectura relevantes (por qué, no solo qué)

- **Text-to-SQL en vez de RAG** para preguntas de ventas: los datos son
  estructurados y agregables — RAG con embeddings no aporta sobre SQL directo.
  RAG queda para consultar documentación empresarial no estructurada (fase futura).
- **El LLM como orquestador**: en vez de un servicio de orquestación aparte que
  decida "¿esto es predicción o consulta histórica?", esa decisión vive en el
  propio agente del AI Service (tool-calling) — evita construir un componente
  extra para algo que el LLM ya puede resolver bien con una regla clara en el
  prompt (fecha futura → tool de ML; fecha pasada → tool de SQL).
- **Idempotencia del batch por watermark de fecha**, no por hash de contenido de
  fila: se encontraron ventas legítimamente idénticas (mismo producto, cantidad
  y precio en la misma factura) que un hash de deduplicación habría colapsado
  incorrectamente en una sola.
- **Postgres local para desarrollo del batch**, no Neon: el plan free de Neon
  usa PgBouncer en modo transacción (rompe prepared statements) y autosuspende
  el cómputo — mal fit para cargas batch sostenidas mientras se itera.
