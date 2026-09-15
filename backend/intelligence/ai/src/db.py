"""Conexion de solo lectura al Data Warehouse (esquema ai.* sobre dwh.*).

IMPORTANTE: esta conexion usa el rol Postgres `ai_readonly`, que a nivel de
base de datos NO tiene permiso de escritura ni de lectura directa sobre
dwh.*/staging.* (ver schema-ai.sql). El filtrado de la sentencia en
tools.py es una segunda capa de defensa, no la unica.
"""
import psycopg
from psycopg.rows import dict_row

from .config import settings


def get_connection() -> psycopg.Connection:
    return psycopg.connect(settings.database_url, row_factory=dict_row)
