"""Tool que el LLM puede invocar: ejecutar SQL de solo lectura sobre ai.v_*.

Defensa en profundidad (además del rol Postgres ai_readonly, que ya impide
escritura y acceso directo a dwh./staging.*):
  1. Solo se permite una única sentencia SELECT (se rechaza cualquier otra
     palabra clave de escritura o múltiples statements separados por ';').
  2. Se agrega LIMIT automáticamente si el LLM no lo puso, y se recorta si el
     LLM puso uno más alto que el máximo configurado -- para no arrastrar el
     dataset completo (525k filas) al contexto del LLM, y para que una sola
     ronda de una pregunta con varios pasos no devuelva un resultado tan
     grande que rompa el presupuesto de tokens del modelo (ver
     _limitar_filas).
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
_LIMIT_PATTERN = re.compile(r"\blimit\s+(\d+)\b", re.IGNORECASE)


def _limitar_filas(sql: str, max_filas: int) -> str:
    """Agrega LIMIT si falta, o lo recorta si el LLM puso uno explícito más
    alto que max_filas -- ver comentario en ejecutar_sql sobre por qué esto
    importa para preguntas de varias rondas (no solo para no cargar el
    dataset completo, también para no romper el presupuesto de tokens del
    LLM con un resultado gigante en una ronda intermedia)."""
    match = _LIMIT_PATTERN.search(sql)
    if match:
        if int(match.group(1)) > max_filas:
            return _LIMIT_PATTERN.sub(f"LIMIT {max_filas}", sql, count=1)
        return sql
    return f"{sql} LIMIT {max_filas}"

# Vistas que el LLM puede referenciar en el SQL que genera, según el modo:
# un vendedor autenticado SOLO puede usar la vista ya pre-filtrada a su
# propio nombre (ver ai.v_ventas_vendedor en schema-ai.sql) -- nunca las
# vistas de toda la empresa, sin importar lo que pida la pregunta original
# (esto es lo que evita que un vendedor vea ventas de otro, incluso si
# intenta pedirlo directamente o via prompt injection).
_VISTAS_VENDEDOR = ("ai.v_ventas_vendedor",)
_VISTAS_EMPRESA = ("ai.v_ventas", "ai.v_ventas_mensual_departamento")


def build_sql_tool_schema(vendedor: str | None) -> dict:
    if vendedor:
        vistas_desc = "ai.v_ventas_vendedor (ya filtrada a tus propias ventas, no la de otros vendedores)"
    else:
        vistas_desc = (
            "ai.v_ventas (detalle) y ai.v_ventas_mensual_departamento "
            "(agregado mensual por departamento)"
        )
    return {
        "type": "function",
        "function": {
            "name": "ejecutar_sql",
            "description": (
                f"Ejecuta una consulta SQL de solo lectura (SELECT) sobre {vistas_desc}. "
                "Usa esto para responder cualquier pregunta sobre ventas, clientes, "
                "productos o periodos. Nunca inventes cifras: siempre consulta primero."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": f"Una única sentencia SELECT sobre {vistas_desc}.",
                    }
                },
                "required": ["sql"],
            },
        },
    }


class SqlToolError(Exception):
    pass


def ejecutar_sql(sql: str, vendedor: str | None = None) -> dict:
    sql_limpio = sql.strip().rstrip(";")

    if not sql_limpio.lower().startswith("select"):
        raise SqlToolError("Solo se permiten consultas SELECT.")
    if ";" in sql_limpio:
        raise SqlToolError("No se permite más de una sentencia por llamada.")
    if _FORBIDDEN.search(sql_limpio):
        raise SqlToolError("La consulta contiene una operación no permitida.")

    vistas_permitidas = _VISTAS_VENDEDOR if vendedor else _VISTAS_EMPRESA
    if not any(v in sql_limpio.lower() for v in vistas_permitidas):
        raise SqlToolError(f"La consulta debe usar {' o '.join(vistas_permitidas)}.")

    sql_limpio = _limitar_filas(sql_limpio, settings.sql_tool_max_rows)

    inicio = time.monotonic()
    with get_connection() as conn:
        if vendedor:
            # Fija el vendedor de la sesion ANTES de correr el SQL del LLM --
            # ai.v_ventas_vendedor filtra por esta variable, no por nada que
            # el LLM haya escrito en su propio WHERE (ver comentario en la
            # vista). set_config con parametro, nunca interpolado en el SQL.
            conn.execute("SELECT set_config('app.current_vendedor', %s, true)", (vendedor,))
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
