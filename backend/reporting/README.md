# JHOMERON Reporting Service

Microservicio FastAPI que expone **endpoints REST deterministicos** (sin
LLM) para los dashboards de **Vendedores** y **Gerencia** del frontend.

## Por que un servicio nuevo y no meterlo en batch/admin/ai/ml

- **`batch`** debe quedar limitado a extraccion (decision explicita del
  equipo): no se le agregan endpoints ni agregaciones de negocio.
- **`admin`** es identidad/config (usuarios, roles, meta de vendedor) — bajo
  trafico, sin logica analitica. Mezclar agregaciones de ventas ahi lo
  convierte en un servicio hibrido que escala mal.
- **`ai`** es un orquestador LLM (Text-to-SQL conversacional). Pasar cada
  carga de un grafico de barras por un LLM es lento, no determinístico y
  quema tokens para algo que es una simple `GROUP BY` — mal uso de la
  arquitectura Text-to-SQL que el propio README raiz justifica para
  preguntas en lenguaje natural, no para endpoints tipados de dashboard.
- **`ml`** es entrenamiento/inferencia de modelos — el unico punto que sí
  encaja ahi es forecast vs. real (ver `backend/intelligence/ml/service/main.py`).

`reporting` reutiliza el mismo stack y patron de gobierno de datos que `ai`
y `ml` (FastAPI + `psycopg` sin ORM + un rol Postgres de solo lectura sobre
vistas de negocio, nunca sobre `dwh.*`/`staging.*` crudo) — ver
`backend/batch/src/main/resources/schemas/schema-bi.sql`.

## Por que un schema `bi.*` separado de `ai.*`

Ambos son de solo lectura sobre el mismo Data Warehouse, pero `ai.*` es el
"surface" que el LLM puede descubrir y usar libremente para responder
preguntas en lenguaje natural. `bi.*` es el "surface" de endpoints tipados
para dashboards. Se separan a proposito: si se agrega una vista a `bi.*`
para un grafico puntual, no se quiere que el LLM la use sin que este
pensada para eso.

## Autenticacion

`reporting` **nunca emite tokens**, solo valida el JWT que emite
`backend/admin` (`POST /api/auth/login`), con el mismo secreto compartido
(`JWT_SECRET`). Cada endpoint de vendedor resuelve el vendedor **desde el
claim `vendedorNombreSap` del token**, nunca de un parametro que mande el
cliente — es lo que garantiza que un vendedor no pueda ver las ventas de
otro.

## Deuda tecnica conocida (ver tambien schema-bi.sql y TODO.md)

1. **Vinculo vendedor <-> ventas por nombre libre, no por codigo estable.**
   `dwh.dim_vendedor` no tiene el `SlpCode` de SAP todavia — el join usa
   `usuarios.vendedor_nombre_sap`, que hay que copiar EXACTO al crear el
   vendedor en el panel admin. Un typo rompe el join silenciosamente (el
   vendedor ve "0 ventas", no un error). Se reemplaza por un codigo real
   cuando el batch extraiga `SlpCode` (Fase 2).
2. **"Cliente del vendedor" = tiene compras historicas con el, no una
   cartera asignada formal.** No existe ese concepto en el modelo estrella
   hoy. Si el area comercial maneja cartera asignada aparte, hay que
   traerla y reemplazar el criterio.
3. **Umbral de "cliente inactivo" sin definir con el area de ventas.**
   `GET /vendedores/me/clientes-inactivos` usa `dias_umbral=45` por
   defecto, ajustable por query param — es un placeholder, no una regla de
   negocio validada.
4. **Margen/EBITDA, margen por linea/SKU y el cruce linea×departamento del
   mapa NO estan implementados.** Bloqueados porque `dwh.dim_producto` no
   tiene categoria (OITB) ni `dwh.fact_ventas` tiene costo — requiere
   extender el SP de extraccion del batch primero (Fase 2, pendiente de
   confirmar con SAP). Ver nota sobre el termino "EBITDA": con costo de
   venta se calcula **margen bruto/margen de contribucion**, no EBITDA real
   (que restaria tambien gastos operativos, depreciacion y amortizacion,
   datos que este pipeline de ventas no va a tener).

## Endpoints (Fase 1)

### Vendedores (requiere JWT con `role=VENDEDOR`)
- `GET /vendedores/me/cuota?modo=mes|semana&anio&mes&anio_iso&semana_iso` — %
  de cumplimiento. `modo=mes` (default) compara contra `meta_mensual`;
  `modo=semana` contra `meta_semanal` -- son dos metas independientes
  configuradas en el panel admin (no se deriva una de la otra).
- `GET /vendedores/me/ventas?modo=mes|semana&anio&mes&anio_iso&semana_iso` —
  ventas dia a dia. `modo=mes` (default) devuelve el mes calendario
  indicado; `modo=semana` devuelve una semana ISO (lunes-domingo). Base del
  grafico de barras con el filtro arriba en la UI.
- `GET /vendedores/me/productos?anio&mes&orden=asc|desc` — producto que
  mas/menos vendio (proxy de "linea", ver deuda tecnica #4).
- `GET /vendedores/me/clientes-inactivos?dias_umbral` — candidatos a
  reactivacion (dato crudo; el texto de la recomendacion lo genera `ai`).
- `GET /vendedores/me/clientes-top-productos?anio&mes` — sus clientes que
  compraron mas productos distintos.

### Gerencia (requiere JWT con `role=GERENCIA` o `ADMIN`)
- `GET /gerencia/top-clientes?anio&mes` — top clientes por productos
  distintos, a nivel empresa.
- `GET /gerencia/tendencia-ventas?anio` — serie mensual de ventas.
- `GET /gerencia/mapa-departamentos?anio&mes` — ventas por departamento
  (sin cruce de linea, ver deuda tecnica #4).

## Como correr en desarrollo

```bash
cd backend/reporting
python -m venv .venv
source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # ajustar si tu Postgres no es el default

uvicorn src.main:app --reload --port 8093
```

Requiere haber aplicado `schema-bi.sql` sobre la misma base que usa `batch`:

```bash
psql -U postgres -d jhomeron_batch -f ../batch/src/main/resources/schemas/schema-bi.sql
```

y que `backend/admin` este corriendo con el mismo `JWT_SECRET` (ver
`backend/admin/src/main/resources/application.yaml`) para poder loguearse y
obtener un token valido.
