"""Tools que el LLM puede invocar: `ejecutar_sql` (ventas, ai.v_*) y
`buscar_documentos` (documentación institucional, rag.v_chunk_visible).

Defensa en profundidad de ejecutar_sql (además del rol Postgres ai_readonly,
que ya impide escritura y acceso directo a dwh./staging.*):
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

buscar_documentos no necesita esa misma defensa (no ejecuta SQL generado por
el LLM): la seguridad está en que solo puede leer rag.v_chunk_visible, que
ya filtra por rol de sesión (ver schema-rag.sql).
"""
import re
import time

from openai import OpenAI

from .config import settings
from .db import get_connection

# Cliente separado para embeddings: el proveedor de chat (LLM_BASE_URL, hoy
# Groq) puede no ofrecer embeddings -- si no se configuró EMBEDDING_BASE_URL/
# EMBEDDING_APIKEY aparte, se reusa el mismo cliente/credencial de LLM_*.
_embedding_client = OpenAI(
    base_url=settings.embedding_base_url or settings.llm_base_url,
    api_key=settings.embedding_api_key or settings.llm_api_key,
)


def embed_texto(texto: str, input_type: str) -> list[float]:
    """`input_type` distingue 'query' (la pregunta del usuario) de 'passage'
    (un chunk de documento al indexarlo) -- este modelo de NVIDIA es
    asimétrico: usar el tipo equivocado degrada la calidad de la búsqueda."""
    respuesta = _embedding_client.embeddings.create(
        model=settings.embedding_model,
        input=[texto],
        extra_body={"input_type": input_type, "truncate": "END"},
    )
    return respuesta.data[0].embedding

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


def build_rag_tool_schema() -> dict:
    return {
        "type": "function",
        "function": {
            "name": "buscar_documentos",
            "description": (
                "Busca en la documentación institucional de la empresa (misión/visión, "
                "catálogo de productos, políticas, términos y condiciones, procesos internos) "
                "fragmentos relevantes para la pregunta. Úsala para preguntas que NO son sobre "
                "datos de ventas -- disponible para cualquier rol de usuario."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "consulta": {
                        "type": "string",
                        "description": "La pregunta del usuario o los términos de búsqueda.",
                    }
                },
                "required": ["consulta"],
            },
        },
    }


def buscar_documentos(consulta: str, rol: str) -> dict:
    """Recuperación semántica sobre rag.v_chunk_visible -- esa vista ya
    filtra por el rol fijado en app.current_role (fail-closed si no se
    fija), igual criterio que app.current_vendedor para ejecutar_sql."""
    embedding = embed_texto(consulta, input_type="query")

    inicio = time.monotonic()
    with get_connection() as conn:
        conn.execute("SELECT set_config('app.current_role', %s, true)", (rol,))
        conn.execute("SET statement_timeout = '5000ms'")
        cur = conn.execute(
            """
            SELECT titulo, categoria, contenido
            FROM rag.v_chunk_visible
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (embedding, settings.rag_tool_max_chunks),
        )
        filas = cur.fetchall()
    duracion_ms = int((time.monotonic() - inicio) * 1000)

    return {
        "fragmentos": filas,
        "num_fragmentos": len(filas),
        "duracion_ms": duracion_ms,
    }
