# Cómo levantar todos los servicios (dev local)

Requiere Postgres local corriendo (`jhomeron_batch`, puerto 5432) con los schemas de
`backend/batch/src/main/resources/schemas/` ya aplicados.

Cada bloque es una terminal aparte.

## 1. Admin Service (login) — puerto 8092

`JAVA_HOME` ya está configurado en `~/.zshrc` (apunta a `~/.jdks/corretto-17.0.17`, el JDK 17
completo -- el JRE del sistema no trae `javac`), no hace falta exportarlo a mano:

```bash
cd backend/admin
./mvnw spring-boot:run
```

## 2. AI Service (chat + RAG) — puerto 8090

```bash
cd backend/intelligence/ai
source .venv/bin/activate
uvicorn src.main:app --port 8090
```

## 3. Reporting Service (dashboards) — puerto 8093

```bash
cd backend/reporting
source .venv/bin/activate
uvicorn src.main:app --port 8093
```

## 4. ML Service (pronóstico de ventas) — puerto 8091

```bash
cd backend/intelligence/ml
source .venv/bin/activate
export MLFLOW_TRACKING_URI="sqlite:///mlflow.db"
uvicorn service.main:app --port 8091
```

## 5. Frontend (Angular) — puerto 4200

```bash
cd frontend
npm start
```

## 6. Batch (ETL, opcional — solo si quieres correr la extracción de nuevo)

```bash
cd backend/batch
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

## 7. MLflow UI (opcional) — puerto 5000

```bash
cd backend/intelligence/ml
source .venv/bin/activate
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
```

---

Verificar que algo responde: `curl http://localhost:<puerto>/health` (Python) o
`curl http://localhost:8092/api/auth/login` (admin, 405 es respuesta normal a un GET).
