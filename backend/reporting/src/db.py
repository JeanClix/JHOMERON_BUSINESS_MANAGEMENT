"""Conexion de solo lectura al Data Warehouse (esquema bi.* sobre dwh.*).

IMPORTANTE: esta conexion usa el rol Postgres `bi_readonly` (ver
backend/batch/src/main/resources/schemas/schema-bi.sql), que a nivel de
base de datos NO tiene permiso de escritura ni de lectura directa sobre
dwh.*/staging.*/usuarios -- solo ve las vistas explicitas de bi.*.
"""
import psycopg
from psycopg.rows import dict_row

from .config import settings


def get_connection() -> psycopg.Connection:
    return psycopg.connect(settings.database_url, row_factory=dict_row)
