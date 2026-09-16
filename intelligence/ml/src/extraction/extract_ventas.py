"""Extrae ventas reales desde el Data Warehouse (ai.v_ventas) y las guarda
localmente en Parquet para no golpear la base en cada experimento de entrenamiento.

Usa el mismo rol de solo lectura ai_readonly que ya usa el AI Service
(backend/batch/.../schema-ai.sql) -- no se abre ningún permiso nuevo.

Uso:
    python -m src.extraction.extract_ventas
"""
import os
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
OUTPUT_PATH = DATA_DIR / "ventas_raw.parquet"


def extraer() -> pd.DataFrame:
    database_url = os.environ["DATABASE_URL"]
    query = """
        SELECT fecha, anio, mes, trimestre, departamento, ciudad, distrito,
               codigo_producto, producto, vendedor, tipo_documento,
               cantidad, valor_unitario, total_soles
        FROM ai.v_ventas
        ORDER BY fecha
    """
    with psycopg.connect(database_url) as conn:
        df = pd.read_sql(query, conn)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUTPUT_PATH, index=False)
    print(f"Extraídas {len(df):,} filas -> {OUTPUT_PATH}")
    print(f"Rango de fechas: {df['fecha'].min()} -> {df['fecha'].max()}")
    return df


if __name__ == "__main__":
    extraer()
