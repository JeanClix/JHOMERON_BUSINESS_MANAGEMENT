# Cambios realizados — sesión Octubre 2026

Este documento explica, paso a paso, todo lo que se hizo en esta sesión sobre
el sistema JHOMERON_BUSINESS_MANAGEMENT, para que **tu compañero pueda dejar
su PC en el mismo estado** (mismo código, misma base de datos, sin errores).

No es solo código: también se tocó la **base de datos** (Postgres y SQL
Server), así que no basta con hacer `git pull`. Sigue el orden exacto de
abajo.

---

## 0. Resumen de qué cambió y por qué

1. Se fusionó la rama `feature/ModelAPI-JEV` (proveedor Claude, panel de
   consumo de IA, enrutador Jev) a `main`.
2. Se activó **Claude (Anthropic)** como proveedor del chat de IA.
3. Se cargó una **base de conocimiento** nueva (políticas, protocolos) al
   sistema RAG — requirió instalar `pgvector` en Postgres.
4. Se sincronizó la base de datos con un Excel real de ventas
   (`INFORME_JHOMERON.xlsx`): clientes nuevos, ubicaciones reales
   (Departamento/Provincia/Distrito correctos, antes estaban mal), productos
   nuevos, y se **excluyeron del sistema** las ventas que en realidad son
   vehículos/activos de la empresa o servicios financieros (no son ventas de
   pintura).
5. Se corrigió un bug heredado en el stored procedure de extracción
   (`sp_ExtraerVentas`): el campo "departamento" en realidad traía un código
   de 3 letras, no el nombre real.
6. Mejoras de frontend: sidebar de Ventas con secciones separadas, acceso a
   la Base de Conocimiento para vendedores (antes solo Gerencia la veía, por
   un bug de permisos en el backend), mapa de Perú con clientes por
   departamento, lista de clientes top con paginación.

---

## 1. Código (git)

Todo el código ya está commiteado o lo estará en el próximo commit. Tu
compañero debe:

```bash
git pull origin main
```

Si quedó algo sin commitear de esta sesión (revisa con `git status` en esta
PC antes de avisarle), avísame para que lo cierre en un commit antes de que
él haga pull.

---

## 2. Variables de entorno que necesita (`.env` de cada servicio)

Estos archivos **no se suben a git** (por las credenciales), así que hay que
pasárselos aparte (por un canal privado, no por chat público).

### `backend/intelligence/ai/.env`

```env
DATABASE_URL=postgresql://ai_readonly:ai_readonly_local_dev@localhost:5432/jhomeron_batch

# Chat con Claude
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=<pedirle a Jhomeron/al usuario la key real, no la pongas en git>
LLM_MODEL=claude-haiku-4-5
LLM_THINKING_BUDGET=0

# Fallback OpenAI-compatible (Groq) -- queda configurado pero sin usarse
# mientras LLM_PROVIDER=anthropic
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=<key de Groq si la tiene, si no dejar vacío>

SQL_TOOL_MAX_ROWS=40
JWT_SECRET=jhomeron-dev-secret-cambiar-en-produccion-32+chars
JWT_ALGORITHM=HS256
REPORTING_BASE_URL=http://localhost:8093

# Embeddings (RAG / Base de Conocimiento) -- necesita su PROPIA key de NVIDIA
# (build.nvidia.com, gratis con créditos de prueba) o la misma si la comparten
EMBEDDING_BASE_URL=https://integrate.api.nvidia.com/v1
EMBEDDING_API_KEY=<key de NVIDIA -- nvapi-...>
EMBEDDING_MODEL=nvidia/nemotron-3-embed-1b
EMBEDDING_DIMENSIONS=2048
RAG_TOOL_MAX_CHUNKS=6
```

**Importante**: el `JWT_SECRET` debe ser EXACTAMENTE igual en `admin`,
`reporting` y `ai` (los tres servicios validan/emiten el mismo token). Si tu
compañero ya tiene uno distinto, hay que unificarlo en los tres.

### `backend/reporting/.env` y `backend/batch/.env.local`

Deben tener el mismo `JWT_SECRET` de arriba, y apuntar a su propio Postgres
local (ver sección 3).

---

## 3. Base de datos Postgres (el "sistema" en sí)

Esta es la parte más importante: **tu compañero necesita los MISMOS datos**,
no una base vacía con el esquema recreado desde cero (perdería las 531,677
ventas reales, los clientes, etc).

### Opción recomendada: restaurar el backup completo

1. Instala Postgres 18 (o la misma versión que uses tú) si no lo tiene.
2. Crea la base vacía:
   ```sql
   CREATE DATABASE jhomeron_batch;
   ```
3. Pásale el archivo de backup:
   **`Desktop/Trabajo/backups_postgres/jhomeron_batch_FINAL.backup`**
   (~22.8 MB, ya incluye todo: ubicaciones reales, ventas de vehículos
   excluidas, base de conocimiento con pgvector). Restaura con:
   ```bash
   pg_restore -U postgres -d jhomeron_batch --no-owner --no-privileges "jhomeron_batch_FINAL.backup"
   ```
   (Ojo: en esa misma carpeta también hay un `jhomeron_batch_antes_resync.backup`
   -- ese es viejo, de ANTES del Excel. Ignóralo, usa el que dice `FINAL`.)

### Qué necesita instalar aparte: pgvector

Postgres no trae `pgvector` (necesario para la Base de Conocimiento) por
defecto. Si su Postgres tampoco lo tiene:

1. Necesita Visual Studio Build Tools (componente "Desktop development with
   C++") instalado.
2. Clonar `https://github.com/pgvector/pgvector` (tag `v0.8.7`, o la versión
   compatible con su Postgres).
3. Desde una terminal con el entorno de VS cargado (`vcvars64.bat`):
   ```
   set PGROOT=C:\Program Files\PostgreSQL\18
   nmake /f Makefile.win
   nmake /f Makefile.win install
   ```
   (el `install` necesita permisos de administrador para copiar a
   `Program Files`).
4. Reiniciar el servicio de Postgres.
5. Correr contra `jhomeron_batch`:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   (si restauras el backup del punto anterior, el esquema `rag` ya viene
   incluido, solo falta la extensión).

---

## 4. SQL Server local — la "BD espejo" de SAP B1

Esta es la base que simula las tablas reales de SAP B1 (`OINV`, `INV1`,
`OCRD`, `CRD1`, `OITM`, etc.), llamada `Jhomeron` en SQL Server Express. Es
de la que el batch extrae los datos hacia Postgres.

1. Tu compañero necesita SQL Server Express (o la edición que use) instalado,
   con una base llamada `Jhomeron`.
2. Le paso el backup de SQL Server:
   **`Desktop/Trabajo/Jhomeron_backup_FINAL.bak`** (~159 MB, ya incluye el
   Excel sincronizado: clientes/ubicaciones/productos nuevos, columna
   `PROVINCIA`, clasificación `TipoItem`, SP v2).
   (El `Jhomeron_backup_antes_excel.bak` en la misma carpeta es el viejo,
   ignóralo.)
3. Restaurar en SQL Server Management Studio: clic derecho en "Databases" →
   Restore Database → seleccionar el archivo `.bak`.
4. Verificar que el login `amigo_etl` exista con permiso `EXECUTE` sobre
   `dbo.sp_ExtraerVentas` (viene en el backup, pero revisa igual):
   ```sql
   GRANT EXECUTE ON dbo.sp_ExtraerVentas TO amigo_etl;
   ```

---

## 5. Cambios de esquema que ya están en el backup (por si acaso)

Si por algún motivo no restauran el backup y prefieren aplicar los `.sql`
manualmente, estos son los archivos que cambiaron (ya en el repo, en
`backend/batch/src/main/resources/schemas/`):

- `schema-staging.sql`: columna `provincia` y `tipo_item` nuevas en
  `staging.ventas`.
- `schema-star.sql`: columna `provincia` en `dwh.dim_cliente`; el
  procedimiento `dwh.sp_cargar_modelo_estrella()` ahora **excluye**
  (`tipo_item <> 'PRODUCTO'`) las ventas de vehículos/servicios al poblar
  `dwh.fact_ventas` (quedan en `staging.ventas` para auditoría, no se
  pierden).
- En SQL Server: tabla `CRD1` tiene columna nueva `PROVINCIA`; tabla `OITM`
  tiene columna nueva `TipoItem` (`PRODUCTO`/`ACTIVO_FIJO`/`SERVICIO`); el
  stored procedure `dbo.sp_ExtraerVentas` fue reemplazado por una v2 que
  corrige el mapeo de Departamento/Provincia/Distrito y expone `TIPO_ITEM`.

---

## 6. Cómo correr el batch apuntando a SU PC local (no al servidor remoto)

Por defecto, `backend/batch/src/main/resources/application.yaml` sigue
apuntando al servidor SQL Server remoto de producción (vía Tailscale). Para
correr contra la base espejo LOCAL, hay que exportar estas variables antes
de levantar el batch (no se tocó el default, para no romper producción):

```bash
# PowerShell
$env:SQLSERVER_URL="jdbc:sqlserver://localhost:1433;databaseName=Jhomeron;encrypt=false;trustServerCertificate=true;"
$env:SQLSERVER_USERNAME="amigo_etl"
$env:SQLSERVER_PASSWORD="nerojp2026"
cd backend/batch
./mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

Esto hace una recarga completa (puede tardar 1-2 minutos). No hace falta
correrlo de nuevo si ya restauró el backup de Postgres con los datos finales
— es solo necesario si quiere repetir la extracción desde SQL Server.

---

## 7. Checklist final para verificar que todo quedó igual

1. `http://localhost:4200` carga el login.
2. Login como admin funciona.
3. El Dashboard de Ventas muestra el mapa de Perú con datos (no vacío).
4. La Base de Conocimiento muestra 8 documentos tanto en Gerencia como en
   Ventas (antes era un bug que la dejaba vacía en Ventas).
5. El chat de IA responde (confirma que usa Claude: la respuesta debe ser
   coherente y rápida; si tarda mucho o da error 401, revisar
   `ANTHROPIC_API_KEY`).
6. Una pregunta sobre políticas (ej. "¿cuándo se considera un cliente en
   riesgo de inactividad?") debe responder citando el documento, no un
   genérico "no pude verificar".

---

## 8. Resumen de qué necesitas pedirle / darle tú

**Archivos que ya están listos para enviarle** (ninguno se sube a git, pásalos
por un medio privado -- Drive, USB, WeTransfer, etc, NUNCA por chat/email sin
cifrar porque los `.env` llevan API keys reales):

| Archivo | Ubicación en tu PC | Tamaño | Qué es |
|---|---|---|---|
| `jhomeron_batch_FINAL.backup` | `Desktop\Trabajo\backups_postgres\` | ~22.8 MB | Backup completo de Postgres (el sistema: ventas, clientes, usuarios, base de conocimiento) |
| `Jhomeron_backup_FINAL.bak` | `Desktop\Trabajo\` | ~159 MB | Backup completo de SQL Server (la BD espejo de SAP B1) |
| Los 4 `.env` de la sección 2 | (dáselos aparte, con las keys reales) | -- | Config de cada servicio |
| Este archivo (`CAMBIOS_SESION_OCT2026.md`) | raíz del proyecto | -- | Esta misma guía |

**Lo que tu compañero necesita conseguir por su cuenta:**
- Su propia API key de NVIDIA (para embeddings) si no van a compartir la
  misma.
- Visual Studio Build Tools (si su Postgres no tiene `pgvector` ya).
- SQL Server Express instalado.
