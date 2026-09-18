# Reporte de Entrenamiento — Predicción de Ventas JHOMERON

Última corrida: `python -m src.training.compare_models --sizes 50000,100000,150000,207000`
Experimento MLflow: `jhomeron_ventas_forecast` · Panel en vivo: `mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000` → `http://localhost:5000` (pestaña **Runs**)

---

## 1. Con cuántos datos se está entrenando

```
dwh.fact_ventas (real, vía ai.v_ventas)
        │
        │  525,751 filas  (una fila = una línea de venta)
        ▼
Feature engineering (agregación por producto + día)
        │
        │  207,210 filas  (una fila = un producto que vendió algo ese día)
        ▼
4 tramos progresivos para ver cómo evoluciona el error al crecer el dataset:
        50,000 → 100,000 → 150,000 → 207,000 filas
```

**Por qué bajó de 525,751 a 207,210**: no se perdió información — se *agregó*. Antes había varias filas por producto-factura-línea el mismo día; ahora hay una fila por producto-día (suma de sus ventas de ese día). Además se descartan los primeros días de cada producto que aún no tienen 7/30 días de historial (no se puede calcular `ventas_ultimos_7_dias` sin al menos 7 días previos).

En cada tramo, el split es **80% train / 20% test**, y el corte es **temporal** (las filas más antiguas entrenan, las más recientes prueban) — nunca aleatorio, porque mezclar aleatoriamente el pasado y el futuro haría que el modelo "viera el futuro" durante el entrenamiento, inflando artificialmente su desempeño.

| Tramo | Filas train | Filas test |
|---|---|---|
| 50,000 | 40,000 | 10,000 |
| 100,000 | 80,000 | 20,000 |
| 150,000 | 120,000 | 30,000 |
| 207,000 | 165,600 | 41,400 |

---

## 2. Qué significa cada gráfica / métrica

Se comparan 4 candidatos en cada tramo:

- **`baseline_naive`**: no es un modelo entrenado — simplemente predice `ventas_ultimos_7_dias / 7` (el promedio diario de la última semana de ese producto). Sirve como "piso de referencia": si un modelo de ML no le gana, no vale la pena su complejidad.
- **`linear_regression`**, **`random_forest`**, **`xgboost`**: modelos entrenados sobre las features (calendario, precio promedio, ventas recientes, etc.).

Las 3 métricas graficadas en MLflow son todas **de error** — en las tres, **más bajo es mejor**. Una barra más alta no es "el ganador", es el que más se equivocó:

| Métrica | Qué mide | Unidad |
|---|---|---|
| **MAE** (Mean Absolute Error) | En promedio, ¿cuántos soles se equivoca el modelo por predicción? | Soles (S/) |
| **RMSE** (Root Mean Squared Error) | Como MAE, pero penaliza más fuerte los errores grandes (útil para saber si el modelo falla feo en algunos casos puntuales) | Soles (S/) |
| **MAPE** (Mean Absolute Percentage Error) | El error como porcentaje del valor real — útil para comparar productos de distinta escala | % |

`test_*` = medido sobre datos que el modelo **nunca vio** (lo que realmente importa). `train_*` = medido sobre los mismos datos con los que entrenó (sirve para detectar sobreajuste si train es mucho mejor que test, pero no es el criterio de decisión).

---

## 3. Resultados completos (tramo final, 207,000 filas)

| Modelo | test MAE (S/) | test RMSE (S/) | test MAPE |
|---|---|---|---|
| **Random Forest** | **356.07** ✅ mejor | 1,254.62 | 118.7% |
| XGBoost | 365.71 | 1,275.08 | 120.8% |
| Regresión Lineal | 395.69 | 1,320.32 | 156.5% |
| Baseline naive | 419.10 | 1,395.94 | **108.4%** ✅ mejor en este % |

### Evolución por tramo (MAE de test — más bajo, mejor)

| n_rows | Baseline | Regresión Lineal | Random Forest | XGBoost |
|---|---|---|---|---|
| 50,000 | 288.53 | 279.85 | **241.52** | 246.13 |
| 100,000 | 304.80 | 317.47 | **280.62** | 310.81 |
| 150,000 | 324.94 | 309.74 | **275.29** | 275.66 |
| 207,000 | 419.10 | 395.69 | **356.07** | 365.71 |

**Random Forest tiene el menor MAE en los 4 tramos**, sin excepción.

---

## 4. Cuál modelo es mejor — y con qué criterio se decidió

**Ganador: Random Forest**, entrenado sobre las 207,000 filas disponibles.

**Criterio de selección** (`promover_mejor_modelo` en `compare_models.py`):
1. Se toma el tramo de datos más grande disponible (la evaluación más representativa, no un punto intermedio de la curva).
2. Se ordenan los modelos de ML por **MAE de test**, de menor a mayor.
3. Se compara el mejor contra el baseline naive: **solo se promueve si realmente le gana en MAE**. Si el baseline hubiera tenido menor MAE, no se promueve nada (se prefiere no usar ML antes que usar un modelo peor que "no hacer nada sofisticado").
4. En esta corrida, Random Forest (MAE=356.07) le ganó al baseline (MAE=419.10) → se registró en el **Model Registry de MLflow** como `jhomeron_ventas_forecast`, versión 1, stage **Production**.

### El matiz que hay que tener presente

El baseline gana en **MAPE** (108% vs 118.7% de Random Forest) — su error *relativo* es más estable, aunque su error *absoluto* (soles) sea peor. Esto pasa porque el baseline es "ingenuo pero consistente por construcción" (siempre reacciona a la historia reciente de cada producto puntual), mientras que Random Forest reduce el error en soles a costa de ser menos preciso porcentualmente en productos de bajo movimiento. Para este caso de uso (estimar montos de venta en soles), MAE es el criterio correcto porque es directamente interpretable en la moneda del negocio — pero si el objetivo cambiara a "acertar la magnitud relativa en productos de bajísimo volumen", MAPE sería más relevante y el ganador podría ser distinto.

---

## 5. Próximos pasos

- **AutoGluon** como quinto candidato (ensemble automático) — pendiente, instalación más pesada.
- **Tool `predecir_ventas`** en el AI Service, que cargue el modelo marcado `Production` del Registry y lo expondría al asistente conversacional para preguntas sobre el futuro (vs. `ejecutar_sql` para preguntas sobre el pasado).
- Repetir esta comparación con tramos más grandes cuando el batch acumule más historia (300k+, 400k+ filas de features).
