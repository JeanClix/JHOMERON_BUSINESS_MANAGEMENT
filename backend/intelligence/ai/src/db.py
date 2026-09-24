"""Conexion de solo lectura al Data Warehouse (esquema ai.* sobre dwh.*).

IMPORTANTE: esta conexion usa el rol Postgres `ai_readonly`, que a nivel de
base de datos NO tiene permiso de escritura ni de lectura directa sobre
dwh.*/staging.* (ver schema-ai.sql). El filtrado de la sentencia en
tools.py es una segunda capa de defensa, no la unica.
"""
import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row

from .config import settings


def get_connection() -> psycopg.Connection:
    conn = psycopg.connect(settings.database_url, row_factory=dict_row)
    # Permite pasar una lista de floats de Python directo como parámetro de
    # una columna VECTOR (rag.chunk.embedding) -- sin esto, psycopg no sabe
    # adaptar el tipo y falla con "can't adapt type 'list'".
    register_vector(conn)
    return conn
