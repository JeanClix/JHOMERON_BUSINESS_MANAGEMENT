# JHOMERON Business Management — Documentación del Sistema

> Generado a partir de una revisión directa del código fuente del repositorio (backend/admin, backend/batch, backend/intelligence/ai, backend/intelligence/ml, backend/reporting, frontend), no de suposiciones. Cuando algo no está implementado o es simulado, se indica explícitamente. Fecha de revisión: código en la rama `main` al momento de este análisis.

---

## 1. Descripción general del sistema

**Nombre**: JHOMERON Business Management (repositorio `JHOMERON_BUSINESS_MANAGEMENT`).

**Propósito**: plataforma de gestión comercial para Industrias JHOMERON S.A. (fábrica de pinturas, Perú), que lleva los datos de ventas de **SAP Business One / SQL Server** hasta dashboards y un asistente conversacional, para que vendedores y gerencia dejen de depender de reportes manuales en Excel.

**URL de acceso**: **no existe una URL pública desplegada.** Todo el sistema corre en local, por servicio:

| Servicio | Puerto |
|---|---|
| Frontend (Angular) | `http://localhost:4200` |
| Admin Service (Spring Boot) | `http://localhost:8092` |
| AI Service (FastAPI) | `http://localhost:8090` |
| ML Service (FastAPI) | `http://localhost:8091` |
| Reporting Service (FastAPI) | `http://localhost:8093` |
| MLflow UI | `http://localhost:5000` |
| Batch (Spring Batch, no expone API de negocio) | `8081` (docker-compose) |

Existe un `docker-compose.yml` en la raíz que orquesta los 6 servicios, y Dockerfiles de **desarrollo** (ej. `frontend/Dockerfile` corre `ng serve` con hot-reload) — no hay Dockerfile/manifiesto de build de producción, ni configuración de dominio, Nginx de producción, ni CI/CD de despliegue en el repo.

**Roles de usuario** (constantes reales encontradas en `backend/admin/src/main/java/com/jhomeron/admin/model/User.java`, campo `role`: `'ADMIN', 'GERENCIA', 'VENDEDOR'`):

- **ADMIN**: único rol que puede acceder al panel `/api/admin/**` (protegido por `JwtAuthFilter`, que exige `role=ADMIN` exacto). Gestiona usuarios/vendedores (alta, edición, baja lógica, metas).
- **GERENCIA**: accede a `/gerencia/*` en el frontend y a los endpoints `require_gerencia` de `backend/reporting` y `backend/intelligence/ai` (agregados de toda la empresa, sin filtro por vendedor).
- **VENDEDOR**: accede a `/ventas` en el frontend y a los endpoints `require_vendedor` (siempre acotados a sus propias ventas, resueltas desde el claim `vendedorNombreSap` del JWT, nunca de un parámetro que mande el cliente).

El frontend usa roles en minúscula (`'admin'`, `'gerencia'`) en el `roleGuard` de las rutas (`app.routes.ts`), mapeados desde el rol real del backend en `AuthService`.

---

## 2. Módulo 1 — Vendedor

### Funcionalidades implementadas y funcionando (verificado en `ventas.component.ts`, `ventas.component.html` y `backend/reporting/src/routers/vendedores.py`)

- **Login** vía `backend/admin` (`POST /api/auth/login`), devuelve JWT.
- **Dashboard de vendedor** con datos reales de `backend/reporting`:
  - Filtro por mes o por semana ISO (lunes-domingo).
  - % de cumplimiento de cuota (`GET /vendedores/me/cuota`), contra `meta_mensual` o `meta_semanal` configuradas por Admin — si no hay meta configurada, se muestra explícitamente "sin meta configurada" (nunca un 0% engañoso).
  - Gráfico de ventas día a día del período filtrado (`GET /vendedores/me/ventas`).
  - Top de productos más/menos vendidos por cantidad, no por monto (`GET /vendedores/me/productos`) — es un *proxy* de "línea de producto" porque el modelo estrella aún no trae categoría real de SAP (`OITB`).
  - Clientes que compraron más productos distintos en el mes (`GET /vendedores/me/clientes-top-productos`).
- **Cartera de Clientes**: listado completo de clientes históricos del vendedor (`GET /vendedores/me/clientes`), con filtros por nombre/RUC/departamento y paginación en el cliente. Reemplaza una versión anterior con datos de ejemplo hardcodeados (línea de crédito, contacto) que **ya no existen** porque no hay ese dato en el modelo estrella.
- **Candidatos a reactivación** (`GET /vendedores/me/clientes-inactivos`): clientes con historial real (mínimo 5 compras, S/ 1,000 histórico) que llevan entre 30 y 50 días sin comprarle a ESE vendedor.
- **Asistente de Ventas IA**: chat conectado de verdad al AI Service (`ventas-ai-chat.component.ts` → `http://localhost:8090/chat`), con chips de preguntas frecuentes y gráficos automáticos cuando la respuesta trae un listado de datos.

**Ya NO existen** (removidas del sidebar según comentario explícito en `ventas.component.ts`): "Línea Marina" y "Generador de Proformas" — eran secciones con datos simulados que se sacaron del producto.

### KPIs y métricas reales del dashboard de vendedor

Provienen de vistas SQL en el schema `bi.*` (`backend/batch/src/main/resources/schemas/schema-bi.sql`), consultadas sin LLM desde `backend/reporting`:

- `bi.v_vendedores` (meta_mensual, meta_semanal por vendedor).
- `bi.v_ventas_vendedor_dia` (ventas día a día).
- `bi.v_vendedor_producto_mes` (top productos por cantidad).
- `bi.v_cliente_frecuencia_vendedor` (cartera y clientes inactivos).
- `bi.v_cliente_productos_mes_vendedor` (clientes con más productos distintos).

### Cómo funciona la predicción ML

- **Qué predice**: el monto total de ventas en soles para los próximos N días (por defecto 30), y el desglose por producto (`GET /predict/proximo-mes` y `GET /predict/productos` en `backend/intelligence/ml/service/main.py`).
- **Modelo usado**: **Random Forest**, registrado como versión `Production` en el Model Registry de MLflow bajo el nombre `jhomeron_ventas_forecast` (ver sección 5 para el detalle de por qué se eligió).
- **Método**: se congela el contexto reciente real de cada producto (ventas últimos 7/30 días, precio promedio, frecuencia de transacciones, calculado en vivo desde `ai.v_ventas`) y solo se varía el calendario (mes, día de semana, trimestre, temporada) para cada uno de los próximos N días — evita un forecast recursivo que acumularía error. La predicción se **calibra con un factor de backtest** (predicho vs. real de un período ya conocido) porque, sin calibrar, la suma se infla sistemáticamente (~3x medido).
- **Ancla temporal**: siempre la última fecha real con datos en `ai.v_ventas`, nunca `date.today()` — para no generar una ventana de contexto con días sin datos si el batch no corrió recientemente.
- El vendedor **no consume esta predicción directamente** en su propio dashboard (no hay endpoint de ML expuesto en `ventas.component.ts`); la predicción global se usa en el dashboard de **Gerencia**.

### Ejemplos reales de consultas en lenguaje natural (vendedor)

De los *preset prompts* reales en `frontend/src/app/core/services/ventas-ai-chat.service.ts`:

- "¿Cuánto llevo vendido este mes?"
- "¿Cuánto llevo vendido este año?"
- "¿Cuáles son mis 5 productos más vendidos por total en soles?"
- "¿Cómo viene mi tendencia de ventas en los últimos 6 meses?"
- "¿Cuáles son mis 5 clientes con mayor monto de compra?"

El `system_prompt_vendedor.md` (prompt real del LLM) restringe explícitamente al vendedor a sus propios datos: no puede pedir datos de otro vendedor ni de la empresa (aunque lo pida, la vista `ai.v_ventas_vendedor` ya viene filtrada por su propio nombre vía variable de sesión de Postgres, no por lo que el LLM escriba).

---

## 3. Módulo 2 — Gerencia

### Funcionalidades implementadas y funcionando

Verificado línea por línea en `gerencia-dashboard.component.ts`, `gerencia-data.service.ts` y `backend/reporting/src/routers/gerencia.py`:

- **Dashboard de Gerencia — REAL, no mock** (contradice al README raíz, que a la fecha de esa documentación decía "datos simulados salvo el pronóstico"; el código actual ya reemplazó eso):
  - KPIs: Ventas Mensuales Totales, Ticket Promedio por Cliente, Clientes en Riesgo de Inactividad — todos alimentados por `backend/reporting`.
  - Selector de mes con navegación anterior/siguiente, acotado a los datos reales disponibles.
  - Gráfico de Evolución de Ventas del año, Top Productos por Facturación, Ventas por Departamento (ranking, no mapa geográfico real — ver limitación abajo).
  - Tarjeta de predicción ML del próximo mes (real vs. predicción, modelo Random Forest de MLflow).
  - Productos con caída proyectada (ML) — se muestra solo caída, no crecimiento, porque el ranking de crecimiento del modelo no es confiable para productos de bajo volumen (arrastra líneas que no son productos reales, ej. "VENTA DE CAMIONETA", según comentario del código).
  - Clientes en Riesgo de Inactividad a nivel empresa.
  - "Oportunidades de Mejora Detectadas por IA" (Insights Estratégicos): 3 tarjetas generadas automáticamente, con botón "Actualizar ahora".
- **Página de Insights Estratégicos** (`/gerencia/insights`): lee las mismas oportunidades reales vía `GerenciaDataService.getExecutiveInsights()`.
- **Página de Análisis** (`/gerencia/analisis`): vista donde se despliega la respuesta del chat IA (KPIs/gráfico si la pregunta lo amerita).
- **Chat de Gerencia** (`/gerencia/chat`, componente `AiChatComponent`): **conectado de verdad** al AI Service (mismo endpoint `/chat`, modo GERENCIA/ADMIN sin filtro de vendedor) — antepone un resumen textual del dashboard actual a cada pregunta, para que "explícame esta tarjeta" funcione sin que el usuario repita cifras.

### Lo que SÍ sigue siendo simulado (mock hardcodeado, verificado en `gerencia-data.service.ts`)

- **Página de Documentación / "Base de Conocimiento Empresarial" (`/gerencia/documentacion`)**: sus 4 documentos ("Manual Técnico de Sistemas de Pintado Marino", "Política Comercial de Créditos", "Reporte Financiero H1 2026", "Protocolo de Control de Calidad") están **100% hardcodeados** en `gerencia-data.service.ts` (`documentsData`), con contenido inventado como ejemplo — no vienen de ningún documento real ni de RAG. El README confirma esto: RAG sobre documentación empresarial está reservado para una fase futura, no implementada.
- Los métodos `getExecutiveKpis()`, `getMonthlySalesChart()`, `getCategoryDistributionChart()`, `getTopProductsChart()`, `getZoneComparisonChart()` de `gerencia-data.service.ts` contienen datos mock (ej. "Margen Bruto Operativo: 38.4%", "Ventas Línea Marina: S/ 185,200") que **ya no se usan** en el dashboard actual (fueron reemplazados por `ReportingService`), pero el código mock sigue presente en el archivo — es deuda de limpieza, no una funcionalidad activa.

### KPIs/insights reales del dashboard de gerencia

- `bi.v_cliente_productos_mes` (top clientes empresa).
- `bi.v_producto_mes` (top productos empresa).
- `bi.v_ventas_departamento_mes` (tendencia y mapa por departamento).
- `bi.v_cliente_frecuencia` (clientes en riesgo, versión empresa de la de vendedor).
- Insights generados por `backend/intelligence/ai/src/insights.py` y persistidos en `ai.insight_mensual`.

**Bloqueado (Fase 2, confirmado en `backend/reporting/README.md` y en el propio dashboard con un candado visual)**: Margen Bruto Operativo, margen por línea/SKU, y cruce de línea de producto × departamento — requieren que el SP de extracción del batch traiga categoría de producto (`OITB` de SAP) y costo, que hoy no existen en `dwh.fact_ventas` ni en `dwh.dim_producto`.

### Cómo funciona la consulta conversacional NL2SQL

Arquitectura (`backend/intelligence/ai/src/agent.py`, `tools.py`, `main.py`):

1. La pregunta llega a `POST /chat` con JWT. `resolve_chat_identity` decide el modo (VENDEDOR vs GERENCIA/ADMIN) según el rol del token.
2. El LLM recibe un `system_prompt` (`prompts/system_prompt.md` para GERENCIA/ADMIN) y una única tool: `ejecutar_sql`.
3. El LLM genera SQL, que pasa por varias capas de defensa antes de ejecutarse (`tools.py`):
   - Solo se permite una sentencia `SELECT`.
   - Se bloquean por regex `insert|update|delete|drop|alter|truncate|grant|revoke|create|call|copy`.
   - Debe referenciar una de las vistas permitidas (`ai.v_ventas` / `ai.v_ventas_mensual_departamento` para GERENCIA/ADMIN; `ai.v_ventas_vendedor` para VENDEDOR).
   - Se agrega/recorta automáticamente un `LIMIT` (máx. `SQL_TOOL_MAX_ROWS`, 40 por defecto) para no saturar el contexto del LLM.
   - Se corre con `statement_timeout = 5000ms`.
   - Se ejecuta con el rol Postgres `ai_readonly`, que solo tiene `SELECT` sobre esas vistas y `INSERT` sobre `ai.consulta_log` — nada más.
4. El resultado del SQL vuelve al LLM, que redacta la respuesta final en español. Puede encadenar hasta `MAX_TOOL_ROUNDS = 6` rondas de tool-calling para preguntas que requieren varias consultas (ej. comparar dos meses).
5. Cada pregunta/respuesta se registra en `ai.consulta_log` (pregunta, SQL generado, filas devueltas, éxito/error, duración).

No es RAG con embeddings: al ser datos estructurados y agregables, Text-to-SQL + tool-calling responde mejor que similitud semántica (decisión explícita documentada en el propio README del servicio).

### Ejemplos reales de preguntas de gerencia

De `frontend/src/app/core/services/gerencia-chat.service.ts` (`queryHistory` inicial):

- "¿Cómo están las ventas este mes?"
- "¿Cuáles son los productos más vendidos?"
- "Compara las ventas de este mes con el anterior"
- "Explícame el comportamiento de las ventas"

Y de la colección de pruebas real (Bruno, `backend/intelligence/ai/bruno-collection/`):

- "¿Cuánto vendimos en total en soles?"
- "¿Cuáles fueron las ventas en Lima este año?"
- "¿Cuáles son los 5 productos más vendidos por total en soles?"
- "¿Qué vendedor tuvo mayor monto de ventas?"

---

## 4. Módulo Administrador

Verificado en `backend/admin/src/main/java/com/jhomeron/admin/controller/UserController.java` y `AuthController.java`, y en el frontend (`features/admin/`):

- **Login** (`POST /api/auth/login`): valida contraseña con BCrypt, rechaza usuarios inactivos, emite JWT con claims `role`, `vendedorNombreSap`, etc.
- **CRUD completo de usuarios** (`/api/admin/users`, protegido por `JwtAuthFilter` — exige rol `ADMIN` exacto):
  - Listar, obtener por id, crear, actualizar, eliminar (`user-list.ts`, `user-form.ts`).
  - Contraseñas siempre hasheadas con BCrypt antes de persistir; nunca se devuelven en las respuestas (reemplaza un endpoint auto-generado de Spring Data REST que exponía la contraseña en texto plano, según comentario explícito en el código).
  - Baja lógica: un usuario se marca `activo=false`, nunca se borra físicamente (para no perder su historial de ventas asociado).
- **Meta de vendedores** (`PUT /api/admin/users/meta-vendedores`, componente `meta-vendedores.ts`): actualiza `metaMensual` y/o `metaSemanal` para **todos** los vendedores de una sola vez (son campos independientes, `meta_semanal` no se deriva matemáticamente de `meta_mensual`).
- **Campo `vendedorNombreSap`**: se configura manualmente al crear/editar un vendedor. **Deuda técnica documentada explícitamente en el código** (`User.java`, `UserController.java`): es el único join posible hoy entre un usuario del panel admin y sus ventas reales en `dwh.fact_ventas` (vía `dwh.dim_vendedor.empleado_venta`), porque el batch todavía no extrae un código de vendedor estable (`SlpCode`) de SAP. Un typo al copiarlo rompe el join **silenciosamente** (el vendedor ve "0 ventas", no un error).

---

## 5. Modelo de Machine Learning

Fuente: `backend/intelligence/ml/REPORTE_ENTRENAMIENTO.md` y `backend/intelligence/ml/src/training/compare_models.py`.

**Aclaración importante sobre las métricas pedidas**: este es un problema de **regresión** (predecir un monto de ventas en soles), no de clasificación — por lo tanto **F1-score, AUC-ROC, accuracy, precision y recall no aplican** y no existen en el código. Las métricas reales que sí se calculan y registran en MLflow son **MAE, RMSE y MAPE**.

### Algoritmos evaluados y ganador

Se compararon 4 candidatos, en 4 tramos progresivos de datos (50k / 100k / 150k / 207k filas):

| Modelo | test MAE (S/) | test RMSE (S/) | test MAPE |
|---|---|---|---|
| **Random Forest** ✅ ganador | **356.07** | 1,254.62 | 118.7% |
| XGBoost | 365.71 | 1,275.08 | 120.8% |
| Regresión Lineal | 395.69 | 1,320.32 | 156.5% |
| Baseline naive (promedio últimos 7 días) | 419.10 | 1,395.94 | 108.4% (mejor en este %) |

**Criterio de selección**: se toma el tramo más grande de datos, se ordena por MAE de test, y solo se promueve a producción (Model Registry de MLflow, stage `Production`) si el mejor modelo de ML le gana al baseline naive en MAE. Random Forest ganó los 4 tramos sin excepción y le ganó al baseline (356.07 vs 419.10) → quedó registrado como `jhomeron_ventas_forecast`, versión 1, `Production`.

**Matiz documentado explícitamente**: el baseline naive gana en MAPE (108.4% vs 118.7%) — su error porcentual es más estable aunque su error absoluto en soles sea peor. Para este caso de uso (estimar montos en soles) se prioriza MAE por ser directamente interpretable en la moneda del negocio.

### Datos de entrenamiento

- **Fuente**: `ai.v_ventas` (view sobre `dwh.fact_ventas`, el mismo Data Warehouse real).
- **Volumen inicial**: 525,751 filas (una fila = una línea de venta).
- **Tras feature engineering** (agregación por producto + día, con ventanas de 7/30 días): 207,210 filas (una fila = un producto que vendió algo ese día).
- **Split**: 80% train / 20% test, **temporal** (las filas más antiguas entrenan, las más recientes prueban) — nunca aleatorio, para no filtrar información del futuro al entrenamiento.
- Features usadas: precio promedio, número de transacciones, mes, día de semana, trimestre, fin de semana, temporada, ventas últimos 7/30 días.

### Qué predice exactamente

El monto total de ventas en soles para una ventana futura configurable (1-90 días, por defecto 30), a nivel de producto individual y agregado — ver detalle de método en la sección 2.

---

## 6. Módulo IA Generativa (NL2SQL)

### Motor LLM

Configurado vía `.env` (interfaz OpenAI-compatible, intercambiable), en `backend/intelligence/ai/src/config.py`:

- **Configuración de desarrollo activa** (`.env.local`, no versionado): `LLM_BASE_URL=https://integrate.api.nvidia.com/v1`, `LLM_MODEL=deepseek-ai/deepseek-v4-flash-0731` (API de NVIDIA).
- **Default del código si no hay `.env`**: Ollama local, modelo `llama3.1`.
- El código de `agent.py` también tiene manejo específico de rate limits de **Groq** (`_es_rate_limit`), lo que indica que el proveedor se ha intercambiado más de una vez durante el desarrollo — la arquitectura es agnóstica al proveedor mientras exponga una API compatible con OpenAI y soporte tool-calling.
- **No hay un LLM propio entrenado**: es un modelo de terceros consumido por API, orquestado con tool-calling.

> Nota de seguridad encontrada durante esta revisión: `backend/intelligence/ai/.env.local` contiene una API key real de NVIDIA. El archivo está correctamente excluido de git (`.gitignore: .env.*`) y no está trackeado en el repositorio, pero como recomendación: si esa key ya fue usada/expuesta fuera de esta máquina, conviene rotarla.

### Ejemplos reales de preguntas/respuestas

Ver ejemplos reales en la sección 2 (vendedor) y sección 3 (gerencia), tomados de los `preset prompts` del frontend y de la colección de pruebas Bruno (`backend/intelligence/ai/bruno-collection/`: health check, total de ventas, ventas por departamento, top productos, mejor vendedor, pregunta libre).

### Precisión o tasa de éxito

`ai.consulta_log` registra un campo booleano `exito` (true/false) y `error` (texto) por cada consulta — la infraestructura para medir una tasa de éxito **existe** a nivel de tabla. Sin embargo, **no se encontró en el código ningún endpoint, reporte o dashboard que calcule y exponga esa tasa de éxito agregada** (ej. "% de preguntas respondidas sin error en los últimos 30 días"). Es decir: el dato crudo se audita, pero no hay una métrica de precisión/tasa de éxito formalmente calculada y reportada en ningún lugar del sistema.

---

## 7. Capturas o evidencia

No se generaron capturas de pantalla del navegador en este análisis (repaso hecho sobre el código, no sobre la aplicación corriendo). Pantallas principales según el routing real (`frontend/src/app/app.routes.ts`):

| Ruta | Componente | Qué muestra |
|---|---|---|
| `/login` | `LoginComponent` | Formulario de autenticación (usuario/contraseña) |
| `/ventas` | `VentasComponent` | Dashboard del vendedor: cuota, ventas por período, top productos, cartera de clientes, asistente IA (sidebar con 3 secciones) |
| `/gerencia/dashboard` | `GerenciaDashboardComponent` | Panel ejecutivo: KPIs reales, predicción ML, gráficos de tendencia/productos/departamentos, clientes en riesgo, insights de IA |
| `/gerencia/analisis` | `GerenciaAnalisisComponent` | Vista de respuesta del chat IA (texto + KPIs/gráfico si aplica) |
| `/gerencia/documentacion` | `GerenciaDocumentacionComponent` | Explorador de "documentos empresariales" — **contenido 100% simulado**, ver sección 3 |
| `/gerencia/chat` | `GerenciaChatPageComponent` (usa `AiChatComponent`) | Chat de mensajes de página completa con el AI Service |
| `/gerencia/insights` | `GerenciaInsightsComponent` | Tarjetas de oportunidades de mejora (reales, filtrables por categoría) |
| `/admin/users` | `UserList` | Tabla de usuarios/vendedores con acciones de editar/eliminar |
| `/admin/users/new`, `/admin/users/edit/:id` | `UserForm` | Alta/edición de usuario |
| `/admin/users/meta` | `MetaVendedores` | Formulario para actualizar meta mensual/semanal de todos los vendedores |

Imágenes ya existentes en el repositorio que podrían servir como evidencia de arquitectura (no capturas de la aplicación en uso):
- `documentacion/arquitectura-jhomeron.png`
- `documentacion/arquitectura-jhomeron.excalidraw.png` / `.svg`
- `documentacion/image.png`, `documentacion/image copy.png` (contenido no verificado en este análisis)

---

## 8. Estado actual

### Completamente implementado y funcionando (verificado en código)

- Autenticación JWT y CRUD de usuarios/vendedores (Admin Service).
- ETL Spring Batch: SAP/SQL Server → staging → modelo estrella (`dwh.*`), con idempotencia por watermark.
- Dashboard de Vendedor completo con datos reales (cuota, ventas, productos, cartera, clientes inactivos).
- Dashboard de Gerencia con datos reales (KPIs, tendencia, top productos/clientes, departamentos, clientes en riesgo) — **esto contradice al README raíz**, que documentaba esta parte como mock; el código ya la conectó a `backend/reporting`.
- Chat de IA de Ventas y de Gerencia, ambos conectados de verdad al AI Service (Text-to-SQL + tool-calling), con scoping por rol a nivel de vista SQL.
- Insights Estratégicos de gerencia: generación automática mensual + botón manual, con separación cálculo (Python/SQL) vs. redacción (LLM).
- Predicción ML de ventas (Random Forest vía MLflow), con calibración por backtest y anclaje a la última fecha real de datos.
- Recomendaciones de reactivación de clientes (cálculo determinístico + redacción LLM).
- Auditoría de cada pregunta al AI Service (`ai.consulta_log`).

### Parcial / con mock explícito

- **Página de Documentación Empresarial de Gerencia**: interfaz completa y funcional, pero el contenido (4 "documentos") es 100% hardcodeado de ejemplo, no conectado a ningún repositorio real ni a RAG.
- Métodos mock sin uso activo en `gerencia-data.service.ts` (KPIs y gráficos de ejemplo que el dashboard ya no consume, pero siguen en el código).

### Falta implementar (bloqueado o pendiente, según TODO.md y comentarios de código)

- **Margen Bruto Operativo / margen por línea o SKU**: bloqueado porque el SP de extracción de SAP no trae costo (COGS) ni categoría de producto (`OITB`) — requiere confirmar disponibilidad en SAP antes de tocar el pipeline.
- **Cruce de línea de producto × departamento** en el mapa de gerencia: mismo bloqueo de categoría.
- **Código de vendedor estable (`SlpCode`)** desde SAP: hoy el join vendedor↔ventas depende de un nombre libre copiado a mano (`vendedorNombreSap`), frágil ante typos.
- **Backtest multi-mes del modelo ML**: hoy solo hay un backtest de un solo punto (agosto→septiembre); TODO.md lo marca como prioridad alta para validar robustez mes a mes.
- **Tasa de éxito/precisión del AI Service**: se audita cada consulta pero no hay un cálculo agregado de esa métrica en ningún endpoint o dashboard.
- **RAG sobre documentación empresarial real**: mencionado como fase futura en el README, no iniciado (la página de Documentación sigue siendo mock).
- **AutoGluon como quinto candidato de ML**: mencionado como próximo paso en `REPORTE_ENTRENAMIENTO.md`, no implementado.
- **Tool `predecir_ventas` dentro del AI Service** (para que el propio LLM decida cuándo usar SQL vs. el modelo ML dentro de una conversación): mencionado como diseño futuro, no implementado — hoy la predicción ML solo se consume directamente desde el dashboard de Gerencia, no desde el chat.
- No hay evidencia en el repositorio de un despliegue de producción real (dominio, certificados, orquestador de producción, CI/CD): todo lo documentado corre en `localhost`.

---

## 9. Datos reales de prueba

- **Ventas cargadas en `dwh.fact_ventas`**: **525,751 filas** (una fila = una línea de venta), según README.md y confirmado como la base de entrenamiento en `REPORTE_ENTRENAMIENTO.md`.
- **Período de datos**: según `TODO.md` (última actualización registrada, 2026-09-16), los datos reales en el Data Warehouse llegan hasta el **2026-09-10** (el batch no había vuelto a correr desde esa fecha al momento de esa nota). El frontend (`ventas.component.ts`, `gerencia-dashboard.component.ts`) fija el **2024-01-11** como límite inferior de navegación de períodos (`limiteInferiorDatos`), es decir, hay datos reales al menos desde esa fecha.
- **Tras feature engineering para ML**: 207,210 filas (agregado producto-día), en tramos de prueba de 50,000 / 100,000 / 150,000 / 207,000 filas.
- **Clientes, productos y vendedores**: el modelo estrella tiene dimensiones separadas (`dwh.dim_cliente`, `dwh.dim_producto`, `dwh.dim_vendedor`), pero **no se encontró en el código un conteo exacto y actualizado** de cuántos clientes, productos o vendedores distintos hay cargados — no se reporta ese número en ningún README, TODO o script del repositorio. Para obtenerlo con precisión haría falta correr `SELECT COUNT(*) FROM dwh.dim_cliente` (y análogos) contra la base real, algo que no se ejecutó en este análisis (solo revisión de código estático).
