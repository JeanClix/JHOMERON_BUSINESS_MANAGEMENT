"""ML Service: sirve predicciones del modelo "Production" registrado en MLflow.

Aproximación explícita (documentada, no oculta): para predecir "el próximo
mes" se congela el contexto reciente real de cada producto (ventas de los
últimos 7/30 días, precio promedio, frecuencia de transacciones -- calculado
en vivo desde ai.v_ventas) y se hace variar solo el CALENDARIO (mes, día de
semana, trimestre, temporada) para cada uno de los próximos N días. Esto evita
un forecast recursivo (encadenar predicción tras predicción, que acumula
error) a cambio de asumir que el nivel de actividad reciente de cada producto
se mantiene.

LIMITACIÓN CONOCIDA Y CORREGIDA: al usar el mismo contexto para los 30 días
futuros, cada día "ve" el mismo nivel de actividad reciente sin descontar que
ya fue contado por los días anteriores del mismo pronóstico -- esto infla la
suma sistemáticamente (se midió ~3x sobre el promedio histórico real). Se
corrige con un factor de calibración obtenido de un backtest: se corre el
mismo procedimiento sobre un mes YA CONOCIDO (usando contexto de 60-30 días
atrás para predecir el total real de hace 30-0 días) y se escala la
predicción futura por (real / predicho) de ese backtest. Es una corrección de
un solo punto -- se expone también el detalle del backtest para que quede
claro que es indicativo, no una garantía estadística robusta.

Uso:
    uvicorn service.main:app --port 8091
"""
import os
from datetime import date, timedelta
from pathlib import Path

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL_NAME = "jhomeron_ventas_forecast"
MLFLOW_TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", "sqlite:///mlflow.db")

MESES_TEMPORADA = {
    12: "verano", 1: "verano", 2: "verano",
    3: "otonio", 4: "otonio", 5: "otonio",
    6: "invierno", 7: "invierno", 8: "invierno",
    9: "primavera", 10: "primavera", 11: "primavera",
}

app = FastAPI(title="JHOMERON ML Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)

_cache_modelo: dict = {}


def obtener_ultima_fecha_real() -> date:
    """La fecha del dato más reciente que realmente existe en el Data
    Warehouse -- NUNCA usar date.today()/CURRENT_DATE como ancla del forecast,
    porque el batch puede no haber corrido hoy y generaría una ventana de
    contexto/backtest con días sin datos (o comparaciones contra un "mes
    pasado" que en realidad está incompleto)."""
    database_url = os.environ["DATABASE_URL"]
    query = "SELECT MAX(fecha) FROM ai.v_ventas"
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            resultado = cur.fetchone()[0]
    if resultado is None:
        raise HTTPException(status_code=503, detail="ai.v_ventas no tiene datos.")
    return resultado


def cargar_modelo_produccion():
    if _cache_modelo:
        return _cache_modelo["modelo"], _cache_modelo["version"]

    client = mlflow.tracking.MlflowClient()
    versiones = client.get_latest_versions(MODEL_NAME, stages=["Production"])
    if not versiones:
        raise HTTPException(
            status_code=503,
            detail=f"No hay ningún modelo en stage Production para '{MODEL_NAME}'. "
                   "Corre compare_models.py primero.",
        )
    mv = versiones[0]
    modelo = mlflow.sklearn.load_model(f"models:/{MODEL_NAME}/Production")
    _cache_modelo["modelo"] = modelo
    _cache_modelo["version"] = mv.version
    return modelo, mv.version


def contexto_por_producto(fecha_hasta: date, ventana_dias: int = 30) -> pd.DataFrame:
    """Ventas reales agregadas por producto en [fecha_hasta - ventana_dias, fecha_hasta).

    `producto` (descripción) se trae solo para poder mostrarla en reportes --
    el modelo nunca la usa como feature, solo `codigo_producto` identifica la fila."""
    database_url = os.environ["DATABASE_URL"]
    query = """
        SELECT
            codigo_producto,
            MAX(producto) AS producto,
            SUM(total_soles) FILTER (WHERE fecha > %(hasta)s::date - (7 * INTERVAL '1 day')) AS ventas_ultimos_7_dias,
            SUM(total_soles) AS ventas_ultimos_30_dias,
            AVG(valor_unitario) AS precio_promedio,
            COUNT(*) / 30.0 AS num_transacciones
        FROM ai.v_ventas
        WHERE fecha >= %(hasta)s::date - (%(dias)s * INTERVAL '1 day')
          AND fecha < %(hasta)s::date
        GROUP BY codigo_producto
    """
    with psycopg.connect(database_url) as conn:
        df = pd.read_sql(query, conn, params={"hasta": fecha_hasta, "dias": ventana_dias})
    df["producto"] = df["producto"].fillna(df["codigo_producto"])
    return df.fillna(0)


def ventas_reales_en_ventana(fecha_desde: date, fecha_hasta: date) -> float:
    database_url = os.environ["DATABASE_URL"]
    query = "SELECT COALESCE(SUM(total_soles), 0) AS total FROM ai.v_ventas WHERE fecha >= %(desde)s AND fecha < %(hasta)s"
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query, {"desde": fecha_desde, "hasta": fecha_hasta})
            return float(cur.fetchone()[0])


def predecir_ventana_por_producto(modelo, contexto: pd.DataFrame, fecha_inicio: date, dias: int) -> pd.Series:
    """Predicciones diarias del modelo para [fecha_inicio, fecha_inicio+dias),
    usando el mismo contexto (fijo) de productos para todos los días -- sin
    colapsar a un total, para poder ver qué productos empujan la predicción.
    Indexado por codigo_producto."""
    if contexto.empty:
        return pd.Series(dtype=float)

    filas_por_dia = []
    for offset in range(dias):
        fecha = fecha_inicio + timedelta(days=offset)
        tmp = contexto.copy()
        tmp["mes"] = fecha.month
        tmp["dia_semana"] = fecha.weekday()
        tmp["trimestre"] = (fecha.month - 1) // 3 + 1
        tmp["es_fin_semana"] = int(fecha.weekday() in (5, 6))
        tmp["temporada"] = MESES_TEMPORADA[fecha.month]
        filas_por_dia.append(tmp)

    df_infer = pd.concat(filas_por_dia, ignore_index=True)
    X = df_infer[[
        "precio_promedio", "num_transacciones", "mes", "dia_semana",
        "trimestre", "es_fin_semana", "ventas_ultimos_7_dias", "ventas_ultimos_30_dias",
    ]].copy()
    X = pd.concat([X, pd.get_dummies(df_infer["temporada"], prefix="temp")], axis=1)
    X = X.reindex(columns=modelo.feature_names_in_, fill_value=0)

    df_infer["prediccion"] = np.clip(modelo.predict(X), 0, None)
    return df_infer.groupby("codigo_producto")["prediccion"].sum()


def predecir_ventana(modelo, contexto: pd.DataFrame, fecha_inicio: date, dias: int) -> float:
    """Suma total de la ventana -- ver predecir_ventana_por_producto para el detalle."""
    return float(predecir_ventana_por_producto(modelo, contexto, fecha_inicio, dias).sum())


def calibrar_con_backtest(modelo, dias: int, fecha_referencia: date) -> dict:
    """Corre el mismo procedimiento sobre un periodo YA CONOCIDO (los `dias`
    días previos a fecha_referencia), comparando predicho vs. real, para
    derivar un factor de corrección de la predicción futura."""
    inicio_backtest = fecha_referencia - timedelta(days=dias)

    contexto_backtest = contexto_por_producto(fecha_hasta=inicio_backtest, ventana_dias=30)
    predicho_backtest = predecir_ventana(modelo, contexto_backtest, inicio_backtest, dias)
    real_backtest = ventas_reales_en_ventana(inicio_backtest, fecha_referencia)

    if predicho_backtest <= 0:
        factor = 1.0
    else:
        factor = real_backtest / predicho_backtest
        # Clamp defensivo: un solo backtest es indicativo, no lo suficientemente
        # robusto para justificar una corrección extrema en cualquier dirección.
        factor = max(0.2, min(factor, 5.0))

    return {
        "backtest_periodo": f"{inicio_backtest.isoformat()} -> {fecha_referencia.isoformat()}",
        "backtest_real_soles": real_backtest,
        "backtest_predicho_soles": predicho_backtest,
        "factor_calibracion": factor,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/predict/proximo-mes")
def predecir_proximo_mes(dias: int = 30):
    if dias < 1 or dias > 90:
        raise HTTPException(status_code=400, detail="'dias' debe estar entre 1 y 90")

    modelo, version = cargar_modelo_produccion()
    # Ancla del forecast: la última fecha con datos REALES, no el reloj del
    # sistema -- si el batch no corrió hoy, "hoy" según CURRENT_DATE podría
    # estar días o meses adelante de lo que realmente sabemos.
    fecha_datos = obtener_ultima_fecha_real()

    contexto_actual = contexto_por_producto(fecha_hasta=fecha_datos, ventana_dias=30)
    if contexto_actual.empty:
        return {
            "prediccion_total_soles": 0.0,
            "periodo_dias": dias,
            "productos_considerados": 0,
            "modelo_nombre": MODEL_NAME,
            "modelo_version": version,
            "fecha_datos_hasta": fecha_datos.isoformat(),
            "nota": "Sin ventas en los 30 días previos a la última fecha con datos; no hay contexto para proyectar.",
        }

    prediccion_sin_calibrar = predecir_ventana(modelo, contexto_actual, fecha_datos + timedelta(days=1), dias)
    backtest = calibrar_con_backtest(modelo, dias, fecha_referencia=fecha_datos)
    prediccion_calibrada = prediccion_sin_calibrar * backtest["factor_calibracion"]

    return {
        "prediccion_total_soles": round(prediccion_calibrada, 2),
        "prediccion_sin_calibrar_soles": round(prediccion_sin_calibrar, 2),
        "periodo_dias": dias,
        "periodo_prediccion": f"{(fecha_datos + timedelta(days=1)).isoformat()} -> {(fecha_datos + timedelta(days=dias)).isoformat()}",
        "productos_considerados": int(contexto_actual.shape[0]),
        "modelo_nombre": MODEL_NAME,
        "modelo_version": version,
        # Hasta qué fecha REAL llegan los datos usados -- lo que el área de
        # ventas puede usar para validar la predicción a medida que pasen los días.
        "fecha_datos_hasta": fecha_datos.isoformat(),
        "metodo": "suma de predicciones diarias por producto activo (contexto reciente fijo, calendario variable), "
                  "calibrada con backtest sobre el último periodo conocido, anclada a la última fecha real de datos",
        "backtest": backtest,
    }


# Debajo de este piso de ventas (en el equivalente de 30 días) el % de cambio
# es ruido puro (ej. 1 sol -> 5 soles = +400%) -- se excluye del ranking de
# crecimiento/caída, aunque sigue contando en "productos_considerados".
_PISO_VENTAS_RANKING_SOLES = 100.0


@app.get("/predict/productos")
def predecir_productos(dias: int = 30, top: int = 8):
    """Desglosa la predicción de /predict/proximo-mes por producto -- el modelo
    ya la calcula internamente (ver predecir_ventana_por_producto), acá solo se
    expone sin colapsarla a un total. Compara la predicción calibrada contra el
    nivel real de los últimos 30 días (normalizado a `dias`) para identificar
    qué productos empujan el crecimiento o la caída proyectada."""
    if dias < 1 or dias > 90:
        raise HTTPException(status_code=400, detail="'dias' debe estar entre 1 y 90")
    if top < 1 or top > 50:
        raise HTTPException(status_code=400, detail="'top' debe estar entre 1 y 50")

    modelo, version = cargar_modelo_produccion()
    fecha_datos = obtener_ultima_fecha_real()

    contexto_actual = contexto_por_producto(fecha_hasta=fecha_datos, ventana_dias=30)
    if contexto_actual.empty:
        return {
            "periodo_dias": dias,
            "fecha_datos_hasta": fecha_datos.isoformat(),
            "productos_considerados": 0,
            "mayor_crecimiento_proyectado": [],
            "mayor_caida_proyectada": [],
            "nota": "Sin ventas en los 30 días previos a la última fecha con datos; no hay contexto para proyectar.",
        }

    prediccion_por_producto = predecir_ventana_por_producto(
        modelo, contexto_actual, fecha_datos + timedelta(days=1), dias
    )
    backtest = calibrar_con_backtest(modelo, dias, fecha_referencia=fecha_datos)
    factor = backtest["factor_calibracion"]

    contexto_idx = contexto_actual.set_index("codigo_producto")
    filas = []
    for codigo, prediccion in prediccion_por_producto.items():
        fila_contexto = contexto_idx.loc[codigo]
        # Normalizado a la misma cantidad de días que se está prediciendo, para
        # comparar manzanas con manzanas si `dias` != 30.
        actual_equivalente = float(fila_contexto["ventas_ultimos_30_dias"]) / 30.0 * dias
        prediccion_calibrada = float(prediccion) * factor

        cambio_pct = None
        if actual_equivalente >= _PISO_VENTAS_RANKING_SOLES:
            cambio_pct = round(((prediccion_calibrada - actual_equivalente) / actual_equivalente) * 100, 1)

        filas.append({
            "codigo_producto": codigo,
            "producto": fila_contexto["producto"],
            "ventas_actuales_soles": round(actual_equivalente, 2),
            "prediccion_soles": round(prediccion_calibrada, 2),
            "cambio_pct": cambio_pct,
        })

    con_cambio = [f for f in filas if f["cambio_pct"] is not None]
    mayor_crecimiento = sorted(con_cambio, key=lambda f: f["cambio_pct"], reverse=True)[:top]
    mayor_caida = sorted(con_cambio, key=lambda f: f["cambio_pct"])[:top]

    return {
        "periodo_dias": dias,
        "periodo_prediccion": f"{(fecha_datos + timedelta(days=1)).isoformat()} -> {(fecha_datos + timedelta(days=dias)).isoformat()}",
        "fecha_datos_hasta": fecha_datos.isoformat(),
        "modelo_nombre": MODEL_NAME,
        "modelo_version": version,
        "factor_calibracion": factor,
        "productos_considerados": len(filas),
        "productos_evaluados_en_ranking": len(con_cambio),
        "piso_ventas_ranking_soles": _PISO_VENTAS_RANKING_SOLES,
        "mayor_crecimiento_proyectado": mayor_crecimiento,
        "mayor_caida_proyectada": mayor_caida,
    }
