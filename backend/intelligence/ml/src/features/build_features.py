"""Feature engineering sobre las ventas reales extraídas (ai.v_ventas).

Construye un dataset a nivel (producto, día) -- una fila por producto que
tuvo venta ese día, con:
  - Calendario: mes, dia_semana, trimestre, temporada, es_fin_semana
  - Rolling: ventas_ultimos_7_dias, ventas_ultimos_30_dias (del propio producto)
  - Target: total_soles del día (lo que se intenta predecir)

Esto sigue el esquema de variables que ya estaba en PROCESO_BATCH.md
(fecha, producto, dia_semana, mes, temporada, ventas_ultimos_7_dias, ...).

Uso:
    python -m src.features.build_features
"""
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
INPUT_PATH = DATA_DIR / "ventas_raw.parquet"
OUTPUT_PATH = DATA_DIR / "ventas_features.parquet"

MESES_TEMPORADA = {
    12: "verano", 1: "verano", 2: "verano",
    3: "otonio", 4: "otonio", 5: "otonio",
    6: "invierno", 7: "invierno", 8: "invierno",
    9: "primavera", 10: "primavera", 11: "primavera",
}


def construir_features(df_raw: pd.DataFrame | None = None) -> pd.DataFrame:
    df = df_raw if df_raw is not None else pd.read_parquet(INPUT_PATH)
    df = df.copy()
    df["fecha"] = pd.to_datetime(df["fecha"])

    # Agregado diario por producto: una fila = un producto en un día,
    # con cantidad y monto total vendido ese día.
    diario = (
        df.groupby(["codigo_producto", "producto", "fecha"], as_index=False)
        .agg(
            cantidad_dia=("cantidad", "sum"),
            total_soles_dia=("total_soles", "sum"),
            precio_promedio=("valor_unitario", "mean"),
            num_transacciones=("total_soles", "count"),
        )
        .sort_values(["codigo_producto", "fecha"])
    )

    # Calendario
    diario["mes"] = diario["fecha"].dt.month
    diario["dia_semana"] = diario["fecha"].dt.dayofweek  # 0=lunes
    diario["trimestre"] = diario["fecha"].dt.quarter
    diario["es_fin_semana"] = diario["dia_semana"].isin([5, 6]).astype(int)
    diario["temporada"] = diario["mes"].map(MESES_TEMPORADA)

    # Rolling features por producto (ventana temporal, no de filas, para
    # no mezclar productos con distinta frecuencia de venta).
    diario = diario.set_index("fecha")
    grupos = diario.groupby("codigo_producto")["total_soles_dia"]
    diario["ventas_ultimos_7_dias"] = grupos.transform(
        lambda s: s.rolling("7D", closed="left").sum()
    )
    diario["ventas_ultimos_30_dias"] = grupos.transform(
        lambda s: s.rolling("30D", closed="left").sum()
    )
    diario = diario.reset_index()

    # Los primeros días de cada producto no tienen historial -> no son
    # útiles para el modelo (el objetivo es predecir con contexto histórico).
    diario = diario.dropna(subset=["ventas_ultimos_7_dias", "ventas_ultimos_30_dias"])

    diario.to_parquet(OUTPUT_PATH, index=False)
    print(f"Dataset de features: {len(diario):,} filas -> {OUTPUT_PATH}")
    print(f"Columnas: {list(diario.columns)}")
    return diario


if __name__ == "__main__":
    construir_features()
