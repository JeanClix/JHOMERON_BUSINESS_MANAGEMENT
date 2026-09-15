"""Tool que el LLM puede invocar: ejecutar SQL de solo lectura sobre ai.v_*.

Defensa en profundidad (además del rol Postgres ai_readonly, que ya impide
escritura y acceso directo a dwh./staging.*):
  1. Solo se permite una única sentencia SELECT (se rechaza cualquier otra
     palabra clave de escritura o múltiples statements separados por ';').
  2. Se agrega LIMIT automáticamente si el LLM no lo puso, para no arrastrar
     el dataset completo (525k filas) al contexto del LLM.
  3. Se corre con un timeout de statement para no colgar el servicio si el
     LLM genera una consulta pesada.
"""
import re
import time

from .config import settings
from .db import get_connection

_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|call|copy)\b",
    re.IGNORECASE,
)

SQL_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "ejecutar_sql",
        "description": (
            "Ejecuta una consulta SQL de solo lectura (SELECT) sobre las vistas de "
            "negocio del Data Warehouse de ventas: ai.v_ventas (detalle) y "
            "ai.v_ventas_mensual_departamento (agregado mensual por departamento). "
            "Usa esto para responder cualquier pregunta sobre ventas, clientes, "
            "productos, vendedores o periodos. Nunca inventes cifras: siempre "
            "consulta primero."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "Una única sentencia SELECT sobre ai.v_ventas o ai.v_ventas_mensual_departamento.",
                }
            },
            "required": ["sql"],
        },
    },
}


class SqlToolError(Exception):
    pass


def ejecutar_sql(sql: str) -> dict:
    sql_limpio = sql.strip().rstrip(";")

    if not sql_limpio.lower().startswith("select"):
        raise SqlToolError("Solo se permiten consultas SELECT.")
    if ";" in sql_limpio:
        raise SqlToolError("No se permite más de una sentencia por llamada.")
    if _FORBIDDEN.search(sql_limpio):
        raise SqlToolError("La consulta contiene una operación no permitida.")
    if "ai.v_" not in sql_limpio.lower():
        raise SqlToolError("La consulta debe usar las vistas ai.v_ventas o ai.v_ventas_mensual_departamento.")

    if "limit" not in sql_limpio.lower():
        sql_limpio = f"{sql_limpio} LIMIT {settings.sql_tool_max_rows}"

    inicio = time.monotonic()
    with get_connection() as conn:
        conn.execute(f"SET statement_timeout = '5000ms'")
        cur = conn.execute(sql_limpio)
        filas = cur.fetchall()
    duracion_ms = int((time.monotonic() - inicio) * 1000)

    return {
        "sql_ejecutado": sql_limpio,
        "filas": filas,
        "num_filas": len(filas),
        "duracion_ms": duracion_ms,
    }
