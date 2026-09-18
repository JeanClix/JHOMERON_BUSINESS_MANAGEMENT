# JHOMERON Business Management — Propuesta de valor y diferenciales

> Documento de sustento para evaluadores/inversores. Explica **qué resuelve** la
> plataforma, **con qué se compara** en el mercado actual (2026) y **por qué debería
> ser elegida**. Se basa en el estado real e implementado (ver `README.md`), no en
> promesas de arquitectura futura.

---

## 1. El problema

Industrias JHOMERON S.A. (Perú) opera su venta sobre **SAP Business One** sobre SQL
Server. Los datos existen, pero las preguntas de negocio siguen respondiéndose con
reportes estáticos, exportaciones a Excel y consultas manuales a TI:

- "¿Cuánto vendimos este mes por departamento?" → reporte manual.
- "¿Qué producto va a pedir esta semana la zona norte?" → intuición del vendedor.
- "¿De dónde salió esta cifra?" → no hay trazabilidad de la respuesta.

El costo no es solo tiempo: es **decidir a ciegas** sobre inventario, abastecimiento y
cartera, y no poder auditar de dónde sale un número.

## 2. Qué construimos

Una plataforma modular que va **del dato crudo de SAP a la decisión conversacional**,
sin dependencia de un consultor externo en cada paso:

```
SAP B1 / SQL Server
   └─(sp_ExtraerVentas)→ Spring Batch (ETL, watermark idempotente)
        └→ staging.ventas → modelo estrella dwh.*  (525,751 hechos reales)
              ├→ AI Service (FastAPI)  Text-to-SQL + tool-calling → respuesta en español
              ├→ ML (Python + MLflow)  pronóstico de ventas por producto/día
              └→ Frontend Angular      chat de ventas, dashboard de gerencia
```

Cuatro decisiones que definen el producto:

| Decisión | Por qué |
|---|---|
| **Text-to-SQL, no RAG** | Los datos de venta son estructurados y agregables; los embeddings no aportan nada sobre SQL directo. RAG queda reservado a documentación no estructurada. |
| **El LLM como orquestador (tool-calling)** | Una sola regla en el prompt (fecha futura → modelo ML; pasada → SQL) reemplaza un microservicio de orquestación entero. |
| **Idempotencia por watermark de fecha, no por hash** | Se encontraron ventas legítimamente idénticas (mismo producto/cantidad/precio en la misma factura); deduplicar por hash las habría colapsado. |
| **Least-privilege en Postgres** | El LLM solo ejecuta `SELECT` sobre `ai.v_ventas` y `ai.v_ventas_mensual_departamento` con el rol `ai_readonly`; no toca `dwh.*` ni `staging.*`, y cada consulta se audita. |

## 3. Panorama de alternativas en el mercado (2026)

Investigación web de soluciones equivalentes, agrupadas por categoría:

### 3.1 Add-ons sobre SAP Business One (competencia más directa)
- **ECOSIRE — AI Sales Assistant / Natural Language Query over SAP B1** (~US$ 899,
  build-to-order): capa conversacional sobre tablas `OBD`/`OINV`. Resuelve el
  mismo "preguntar en lenguaje natural", pero atado a SAP y sin modelo predictivo.
- **ECOSIRE — Demand Forecasting & Replenishment for SAP B1** (~US$ 999): safety
  stock y puntos de reorden. Pronóstico operativo, no analítica conversacional.
- **Ramo Perú** (socio SAP en Lima, "IA Empresarial"): implementa lenguaje natural,
  cobranzas, stock y rentabilidad sobre SAP B1 (caso Freshmart). Es el competidor
  local más serio: **servicio de consultoría**, no producto autónomo.

### 3.2 Analítica conversacional sobre BI / lakehouse
- **ThoughtSpot**: búsqueda en lenguaje natural sobre modelos BI; requiere
  licencia empresarial y modelado previo.
- **Databricks Genie**: NL sobre un lakehouse gobernado; potente, pero exige
  madurez de plataforma de datos y costos de nube.

### 3.3 Forecasting
- **Nixtla StatsForecast** (open source): alternativa a Prophet para pronóstico a
  escala; es una librería, no una solución integrada al ERP.
- **ECOSIRE Demand Forecasting** (arriba): empaquetado, pero genérico.

### 3.4 Referencia académica que valida nuestro enfoque
- **GROUND (arXiv 2608.26157)**: propone una capa semántica gobernada con
  row-level security y "cero alucinaciones" para NL-to-SQL. Es exactamente el
  patrón que ya implementamos con vistas de negocio + rol de solo lectura.

## 4. Diferenciales reales de JHOMERON

1. **Dato propio, extremo a extremo y en producción.** No es un demo sobre un
   dataset público: son **525,751 hechos reales** extraídos de SAP B1 con un ETL
   idempotente que ya corrió. Ni ECOSIRE ni Ramo entregan el pipeline; venden la
   capa de arriba.
2. **IA que no inventa cifras.** El system prompt obliga a llamar a `ejecutar_sql`
   antes de responder cualquier valor numérico; si no hay filas, lo declara. Esto
   ataca el riesgo #1 de todo asistente de negocio (la alucinación), y es una
   brecha real que el paper GROUND confirma que el mercado aún no resuelve bien.
3. **Gobernanza verificable.** Rol `ai_readonly`, dos vistas de negocio y auditoría
   en `ai.consulta_log`: se puede responder "de dónde salió esta cifra" sin exponer
   el DWH. Frente a un chat que consulta la base completa, esto es una ventaja de
   seguridad y cumplimiento, no un detalle técnico.
4. **Un solo asistente que combina histórico y futuro.** El LLM decide entre SQL
   (pasado) y el modelo ML (futuro) como tools. Los competidores suelen ser o
   analítica conversacional **o** forecasting; aquí conviven y comparten contexto.
5. **Stack abierto, sin lock-in de licencia.** Java/Spring, Python/FastAPI,
   Angular, Postgres/MLflow. No hay cuota por usuario ni por consulta; el costo
   marginal de escalar es de infraestructura, no de licencias (vs. ThoughtSpot o
   Databricks).
6. **Adaptado al contexto peruano.** Soles, RUC, venta por departamento. Los
   add-ons globales asumen otra realidad fiscal y comercial.

## 5. Brechas reales (honestidad de alcance)

Documentarlas evita sobre-prometer y define el roadmap:

| Brecha | Impacto | Estado |
|---|---|---|
| **Spring Boot API de negocio pendiente (HU26)** | El frontend de gerencia aún consume datos simulados salvo el pronóstico. | Pendiente |
| **Pronóstico validado con un solo backtest** | No hay evidencia robusta mes a mes; `TODO.md` lo marca prioridad alta. | Pendiente |
| **Sin margen bruto ni categoría de producto** | El SP actual no trae costo/COGS ni `OITB`; el dashboard de rentabilidad queda bloqueado. | Bloqueado por dato de origen en SAP |
| **Chat de gerencia no conectado al AI Service real** | Duplica esfuerzo; el de ventas sí está conectado. | Pendiente |

## 6. Diferenciador recomendado

**"IA de ventas auditable sobre tus propios datos de SAP: cada número tiene una
consulta SQL detrás, y puedes verla."**

Redacción de posicionamiento:

> Mientras los add-ons de SAP te dan un chatbot o un pronóstico por separado,
> JHOMERON une ambos sobre el dato real de tu ERP y con una garantía que ninguno
> ofrece: **el asistente no puede inventar una cifra** — solo responde cifras que
> provienen de SQL ejecutado sobre vistas de negocio de solo lectura, y deja
> registro de cada consulta.

Por qué es el indicado y no otro:

- Es **defendible**: los competidores pueden copiar "chat sobre SAP", pero copiar
  el control de gobernanza + auditoría + el pipeline propio requiere rehacer la
  base, no una feature.
- Es **verificable en una demo**: se pregunta algo, se muestra la respuesta, se
  muestra el SQL y el log. No es una promesa de roadmap.
- Es **alineado con el riesgo del comprador**: una gerencia que va a decidir
  inventario y abastecimiento con IA necesita confiar en el número más que en la
  interfaz. La confianza es el producto.
- Es **extensible a la brecha pendiente**: cuando la API de negocio (HU26) y el
  backtest multi-mes cierren, el diferenciador se amplía de "no inventa" a "no
  inventa **y** acierta el futuro".

### Mensaje de cierre
La competencia vende acceso a datos (ECOSIRE), potencia de plataforma (ThoughtSpot,
Databricks) o consultoría (Ramo). JHOMERON vende **decisiones confiables y trazables
sobre la venta real de JHOMERON** — y la confianza está implementada, no prometida.

---

## Anexo — Fuentes consultadas (sep-2026)

- ECOSIRE, *AI Sales Assistant / Natural Language Query for SAP B1* (~US$ 899).
- ECOSIRE, *Demand Forecasting & Replenishment for SAP B1* (~US$ 999).
- ThoughtSpot vs. Databricks Genie (comparativas de NL-analytics 2026).
- Ramo Perú, *IA Empresarial* sobre SAP Business One (caso Freshmart).
- Nixtla, *StatsForecast* (forecasting open source).
- *GROUND* — NL-to-SQL con capa semántica gobernada y row-level security, arXiv 2608.26157.
- Evidencia interna: `README.md`, `TODO.md`, `backend/intelligence/ai/README.md`,
  `intelligence/ml/REPORTE_ENTRENAMIENTO.md`.
