"""Harness de comparación de modelos con tamaños de dataset progresivos.

Corre Regresión Lineal, Random Forest y XGBoost sobre subconjuntos cada vez
más grandes del dataset real (100k, 200k, ... filas), con split TEMPORAL
(nunca aleatorio -- se entrena con el pasado y se valida con el futuro, como
corresponde a una serie de tiempo), y registra cada corrida en MLflow para
poder comparar cómo mejora (o no) cada modelo al agregar más datos.

Uso:
    python -m src.training.compare_models
    python -m src.training.compare_models --sizes 50000,100000,207000
"""
import argparse
from pathlib import Path

import mlflow
import mlflow.sklearn
import mlflow.xgboost
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
FEATURES_PATH = DATA_DIR / "ventas_features.parquet"

TARGET = "total_soles_dia"
FEATURE_COLS_NUM = [
    "cantidad_dia", "precio_promedio", "num_transacciones",
    "mes", "dia_semana", "trimestre", "es_fin_semana",
    "ventas_ultimos_7_dias", "ventas_ultimos_30_dias",
]
# "cantidad_dia" es información del mismo día que el target (fuga de datos si
# se usara para predecir total_soles_dia del mismo día) -- se excluye del set
# real de entrenamiento y solo se deja como referencia. Ver nota en main().
FEATURE_COLS = [c for c in FEATURE_COLS_NUM if c != "cantidad_dia"]
CAT_COL = "temporada"


def preparar_dataset(n_rows: int) -> pd.DataFrame:
    df = pd.read_parquet(FEATURES_PATH)
    df = df.sort_values("fecha")
    return df.iloc[:n_rows].copy()


def split_temporal(df: pd.DataFrame, test_frac: float = 0.2):
    corte = int(len(df) * (1 - test_frac))
    return df.iloc[:corte], df.iloc[corte:]


def a_matriz(df: pd.DataFrame) -> pd.DataFrame:
    X = df[FEATURE_COLS].copy()
    X = pd.concat([X, pd.get_dummies(df[CAT_COL], prefix="temp")], axis=1)
    return X


def evaluar(y_true, y_pred) -> dict:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    # MAPE explota a valores absurdos si algún día un producto tuvo
    # total_soles_dia == 0 (división por cero). Se calcula solo sobre
    # días con venta real (>0), que es donde el % de error tiene sentido.
    mascara_no_cero = y_true != 0
    mape = (
        float(np.mean(np.abs((y_true[mascara_no_cero] - y_pred[mascara_no_cero]) / y_true[mascara_no_cero])))
        if mascara_no_cero.any()
        else float("nan")
    )

    return {
        "mae": mean_absolute_error(y_true, y_pred),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": mape,
    }


MODELOS = {
    "linear_regression": lambda: LinearRegression(),
    "random_forest": lambda: RandomForestRegressor(n_estimators=150, max_depth=12, random_state=42, n_jobs=-1),
    "xgboost": lambda: XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1),
}

REGISTRY_NAME = "jhomeron_ventas_forecast"


def registrar_baseline_naive(n_rows: int, train_df: pd.DataFrame, test_df: pd.DataFrame) -> dict:
    """Baseline sin entrenamiento: predice el promedio diario de los últimos
    7 días del propio producto (ventas_ultimos_7_dias / 7). Si un modelo de
    ML no le gana a esto, no vale la pena su complejidad."""
    with mlflow.start_run(run_name=f"baseline_naive_n{n_rows}"):
        mlflow.set_tags({"modelo": "baseline_naive", "n_rows": n_rows})
        mlflow.log_param("n_rows", n_rows)
        mlflow.log_param("modelo", "baseline_naive")

        pred_train = train_df["ventas_ultimos_7_dias"] / 7
        pred_test = test_df["ventas_ultimos_7_dias"] / 7

        metricas_train = evaluar(train_df[TARGET], pred_train)
        metricas_test = evaluar(test_df[TARGET], pred_test)

        for k, v in metricas_train.items():
            mlflow.log_metric(f"train_{k}", v)
        for k, v in metricas_test.items():
            mlflow.log_metric(f"test_{k}", v)

        print(f"  {'baseline_naive':20s} n={n_rows:>7,}  test_MAE={metricas_test['mae']:>10,.2f}  "
              f"test_RMSE={metricas_test['rmse']:>10,.2f}  test_MAPE={metricas_test['mape']:.2%}")

        run_id = mlflow.active_run().info.run_id
        return {"modelo": "baseline_naive", "n_rows": n_rows, "run_id": run_id,
                **{f"test_{k}": v for k, v in metricas_test.items()}}


def entrenar_y_registrar(nombre_modelo: str, n_rows: int, X_train, y_train, X_test, y_test):
    with mlflow.start_run(run_name=f"{nombre_modelo}_n{n_rows}"):
        mlflow.set_tags({"modelo": nombre_modelo, "n_rows": n_rows})
        mlflow.log_param("n_rows", n_rows)
        mlflow.log_param("modelo", nombre_modelo)
        mlflow.log_param("n_features", X_train.shape[1])

        modelo = MODELOS[nombre_modelo]()
        modelo.fit(X_train, y_train)

        pred_train = modelo.predict(X_train)
        pred_test = modelo.predict(X_test)

        metricas_train = evaluar(y_train, pred_train)
        metricas_test = evaluar(y_test, pred_test)

        for k, v in metricas_train.items():
            mlflow.log_metric(f"train_{k}", v)
        for k, v in metricas_test.items():
            mlflow.log_metric(f"test_{k}", v)

        if nombre_modelo == "xgboost":
            mlflow.xgboost.log_model(modelo, artifact_path="modelo")
        else:
            mlflow.sklearn.log_model(modelo, artifact_path="modelo")

        print(f"  {nombre_modelo:20s} n={n_rows:>7,}  test_MAE={metricas_test['mae']:>10,.2f}  "
              f"test_RMSE={metricas_test['rmse']:>10,.2f}  test_MAPE={metricas_test['mape']:.2%}")

        run_id = mlflow.active_run().info.run_id
        return {"modelo": nombre_modelo, "n_rows": n_rows, "run_id": run_id,
                **{f"test_{k}": v for k, v in metricas_test.items()}}


def promover_mejor_modelo(resumen: pd.DataFrame, n_rows_final: int) -> None:
    """Registra en el Model Registry de MLflow el modelo (no-baseline) con
    menor MAE de test sobre el tramo de datos más grande, y lo marca
    'Production' -- archivando cualquier versión previa en ese stage."""
    candidatos = resumen[(resumen["n_rows"] == n_rows_final) & (resumen["modelo"] != "baseline_naive")]
    baseline = resumen[(resumen["n_rows"] == n_rows_final) & (resumen["modelo"] == "baseline_naive")]

    if candidatos.empty:
        print("No hay candidatos de ML para promover.")
        return

    mejor = candidatos.sort_values("test_mae").iloc[0]

    if not baseline.empty and mejor["test_mae"] >= baseline.iloc[0]["test_mae"]:
        print(f"\nNINGÚN modelo de ML superó al baseline naive "
              f"(mejor ML MAE={mejor['test_mae']:.2f} vs baseline MAE={baseline.iloc[0]['test_mae']:.2f}). "
              "No se promueve nada a Production -- el baseline es preferible tal como está hoy.")
        return

    client = mlflow.tracking.MlflowClient()
    model_uri = f"runs:/{mejor['run_id']}/modelo"
    mv = mlflow.register_model(model_uri, REGISTRY_NAME)
    client.transition_model_version_stage(
        name=REGISTRY_NAME, version=mv.version, stage="Production", archive_existing_versions=True
    )
    print(f"\nPromovido a Production: {mejor['modelo']} (n_rows={n_rows_final}, "
          f"test_MAE={mejor['test_mae']:.2f}) -> {REGISTRY_NAME} v{mv.version}")


def main(sizes: list[int]):
    mlflow.set_experiment("jhomeron_ventas_forecast")

    total_disponible = len(pd.read_parquet(FEATURES_PATH))
    print(f"Dataset de features disponible: {total_disponible:,} filas")
    print("NOTA: 'cantidad_dia' se excluye de las features por fuga de datos "
          "(es información del mismo día que se intenta predecir).\n")

    resultados = []
    for n_rows in sizes:
        n_rows = min(n_rows, total_disponible)
        df = preparar_dataset(n_rows)
        train_df, test_df = split_temporal(df)

        X_train, y_train = a_matriz(train_df), train_df[TARGET]
        X_test, y_test = a_matriz(test_df), test_df[TARGET]
        # Alinear columnas dummy que pudieran faltar entre train/test
        X_test = X_test.reindex(columns=X_train.columns, fill_value=0)

        print(f"--- n_rows={n_rows:,} (train={len(train_df):,}, test={len(test_df):,}) ---")
        resultados.append(registrar_baseline_naive(n_rows, train_df, test_df))
        for nombre_modelo in MODELOS:
            resultados.append(entrenar_y_registrar(nombre_modelo, n_rows, X_train, y_train, X_test, y_test))

    resumen = pd.DataFrame(resultados)
    print("\n=== Resumen (menor MAE test = mejor) ===")
    print(resumen.drop(columns="run_id").sort_values(["n_rows", "test_mae"]).to_string(index=False))

    promover_mejor_modelo(resumen, n_rows_final=int(resumen["n_rows"].max()))
    return resumen


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sizes",
        type=str,
        default="50000,100000,150000,207000",
        help="Tamaños de dataset a comparar, separados por coma",
    )
    args = parser.parse_args()
    sizes = [int(s) for s in args.sizes.split(",")]
    main(sizes)
