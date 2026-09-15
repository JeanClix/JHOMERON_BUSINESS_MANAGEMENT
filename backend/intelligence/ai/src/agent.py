"""Orquestacion del agente: pregunta -> LLM (con tool ejecutar_sql) -> SQL ->
datos reales -> LLM interpreta -> respuesta. Cada paso queda trazado.

No es RAG: para datos estructurados como ventas, Text-to-SQL vía tool-calling
responde preguntas analíticas mejor que similitud de embeddings.
"""
import json
import time
from pathlib import Path

from openai import OpenAI

from .config import settings
from .tools import SQL_TOOL_SCHEMA, SqlToolError, ejecutar_sql
from .audit import registrar_consulta

_SYSTEM_PROMPT = (Path(__file__).parent.parent / "prompts" / "system_prompt.md").read_text(encoding="utf-8")

_client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

MAX_TOOL_ROUNDS = 3


def responder_pregunta(pregunta: str) -> dict:
    inicio = time.monotonic()
    mensajes = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": pregunta},
    ]

    sql_generado = None
    filas_retornadas = None
    ultimos_datos: list[dict] | None = None

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            respuesta = _client.chat.completions.create(
                model=settings.llm_model,
                messages=mensajes,
                tools=[SQL_TOOL_SCHEMA],
                # Algunos modelos (ej. deepseek con "thinking") consumen parte del
                # presupuesto en razonamiento antes del contenido final; con poco
                # margen la respuesta queda vacía. Se deja margen amplio.
                max_tokens=2048,
            )
            mensaje = respuesta.choices[0].message
            mensajes.append(mensaje.model_dump(exclude_none=True))

            if not mensaje.tool_calls:
                texto_final = mensaje.content or ""
                duracion_ms = int((time.monotonic() - inicio) * 1000)
                registrar_consulta(
                    pregunta_usuario=pregunta,
                    sql_generado=sql_generado,
                    filas_retornadas=filas_retornadas,
                    respuesta_llm=texto_final,
                    modelo=settings.llm_model,
                    exito=True,
                    error=None,
                    duracion_ms=duracion_ms,
                )
                return {
                    "respuesta": texto_final,
                    "sql_generado": sql_generado,
                    "filas_retornadas": filas_retornadas,
                    "datos": ultimos_datos,
                    "duracion_ms": duracion_ms,
                }

            for tool_call in mensaje.tool_calls:
                args = json.loads(tool_call.function.arguments)
                sql_generado = args.get("sql")
                try:
                    resultado = ejecutar_sql(sql_generado)
                    filas_retornadas = resultado["num_filas"]
                    ultimos_datos = resultado["filas"]
                    contenido_tool = json.dumps(resultado, default=str)
                except SqlToolError as e:
                    contenido_tool = json.dumps({"error": str(e)})

                mensajes.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": contenido_tool,
                })

        # Se agotaron los intentos de tool-calling sin respuesta final
        raise RuntimeError("El modelo no llegó a una respuesta final tras varios intentos de consulta.")

    except Exception as e:
        duracion_ms = int((time.monotonic() - inicio) * 1000)
        registrar_consulta(
            pregunta_usuario=pregunta,
            sql_generado=sql_generado,
            filas_retornadas=filas_retornadas,
            respuesta_llm=None,
            modelo=settings.llm_model,
            exito=False,
            error=str(e),
            duracion_ms=duracion_ms,
        )
        raise
