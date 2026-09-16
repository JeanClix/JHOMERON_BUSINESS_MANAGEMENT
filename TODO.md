# TODO — Próxima sesión

Última actualización: 2026-09-16. Datos reales en `dwh` llegan hasta **2026-09-10**
(el batch no ha vuelto a correr desde entonces — si retomas, probablemente
convenga correrlo de nuevo antes de lo demás para tener datos más frescos).

## 1. Backtest multi-mes del modelo (prioridad alta)

Hoy solo validamos con **un backtest de un solo punto** (predecir agosto→septiembre
y comparar). Es indicativo, no una prueba robusta. Lo que hay que hacer:

- [ ] Reentrenar (o simplemente filtrar el dataset de features) usando **solo
      datos hasta 2025-12-31** como corte de entrenamiento.
- [ ] Con ese modelo, generar predicciones mes a mes para **enero, febrero,
      marzo, ..., hasta el mes actual con datos reales (septiembre 2026,
      parcial hasta el día 10)** — un backtest por cada mes, no uno solo.
- [ ] Comparar cada predicción contra la venta real de ese mes (ya tenemos
      `ventas_reales_en_ventana()` en `service/main.py` para esto).
- [ ] Ver si el error es consistente mes a mes o si hay meses donde el modelo
      falla mucho más (estacionalidad no capturada, productos nuevos que
      aparecieron después de 2025-12, etc.) — esto también nos dice si vale
      la pena el enfoque de calibración por un solo factor o si hace falta
      algo más sofisticado (factor de calibración por mes/temporada).

**Nota de diseño**: la lógica de `contexto_por_producto()` / `predecir_ventana()`
que ya existe en `intelligence/ml/service/main.py` es exactamente lo que este
backtest necesita reutilizar (con distinta fecha de corte cada vez) — conviene
extraerla a un módulo compartido (`intelligence/ml/src/inference/predict_utils.py`)
en vez de duplicarla en un script nuevo, para que servicio y backtest nunca
diverjan silenciosamente.

## 2. Completar el dashboard de gerencia con KPIs reales

Hoy en `gerencia-dashboard.component.ts` **todo sigue siendo mock** excepto la
tarjeta de pronóstico ML. Antes de conectar más, hay que separar lo que **ya
se puede sacar de datos reales** de lo que **está bloqueado** porque el batch
no captura ese dato todavía:

### Sí se puede armar ya (con `ai.v_ventas` / `ai.v_ventas_mensual_departamento`)
- [ ] **Ventas Mensuales Totales** (reemplaza el KPI mock "S/ 384,500")
- [ ] **Ventas por Zona/Departamento** (ya existe la vista agregada, falta el
      endpoint + wiring al chart de radar/zona)
- [ ] **Top Productos por Facturación** (ya lo usamos en el chat de ventas,
      falta exponerlo como chart fijo del dashboard, no solo bajo demanda)
- [ ] **Ticket Promedio por Cliente** (agregación nueva: AVG(total_soles) por
      cliente en el periodo — no existe la vista todavía, hay que crearla)

### Bloqueado — falta capturar el dato en el batch primero
- [ ] **Margen Bruto Operativo**: no tenemos costo/COGS en ningún lado del
      pipeline (`VentaDTO` no lo trae, el SP de SQL Server tampoco lo expone).
      No se puede calcular margen sin costo. Requiere: (a) confirmar si SAP
      tiene esa información disponible, (b) agregarla al SP y al reader si
      existe.
- [ ] **Distribución por Categoría de producto**: el documento de arquitectura
      original (`PROCESO_BATCH.md`) menciona `OITB` (categoría) como parte del
      SP ideal, pero el `sp_ExtraerVentas` real que usamos hoy no la trae, y
      ni `VentaDTO` ni `staging.ventas` tienen ese campo. Mismo caso que
      margen: hay que confirmar disponibilidad en SAP y sumarlo al pipeline.

**Antes de escribir código de estos dos últimos**, vale la pena confirmar con
el área correspondiente si SAP realmente tiene esos datos accesibles — no
tiene sentido diseñar el resto del pipeline sobre un supuesto.

## Recordatorio operativo — servicios que quedaron corriendo hoy

Si al retomar mañana los puertos no responden (se caen con cada reinicio de
sesión/entorno), levantarlos de nuevo así:

```bash
# Backend batch (opcional, solo si quieres correr el ETL de nuevo)
cd backend/batch && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# AI Service (puerto 8090)
cd backend/intelligence/ai && ./.venv/Scripts/python.exe -m uvicorn src.main:app --port 8090

# ML Service (puerto 8091)
cd intelligence/ml && export MLFLOW_TRACKING_URI="sqlite:///mlflow.db" && ./.venv/Scripts/python.exe -m uvicorn service.main:app --port 8091

# Frontend (puerto 4200)
cd frontend && npm start

# Panel de MLflow (puerto 5000, opcional)
cd intelligence/ml && ./.venv/Scripts/python.exe -m mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
```
