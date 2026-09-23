"""Orquestacion del agente: pregunta -> LLM (con tool ejecutar_sql) -> SQL ->
datos reales -> LLM interpreta -> respuesta. Cada paso queda trazado.

No es RAG: para datos estructurados como ventas, Text-to-SQL vía tool-calling
responde preguntas analíticas mejor que similitud de embeddings.
"""
import json
import time
from datetime import date
from pathlib import Path

from openai import APIStatusError, OpenAI

from .config import settings
from .tools import SqlToolError, build_kb_tool_schema, build_sql_tool_schema, buscar_base_conocimiento, ejecutar_sql
from .audit import registrar_consulta

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_SYSTEM_PROMPT_EMPRESA = (_PROMPTS_DIR / "system_prompt.md").read_text(encoding="utf-8")
_SYSTEM_PROMPT_VENDEDOR = (_PROMPTS_DIR / "system_prompt_vendedor.md").read_text(encoding="utf-8")

_client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

MAX_TOOL_ROUNDS = 6

# Mensajes previos (user+assistant, sin contar tool calls) que se reenvian al
# LLM como contexto de la conversacion -- ver responder_pregunta(). Un numero
# chico porque cada mensaje viejo ya "gasto" su presupuesto de tokens una vez;
# 8 mensajes (~4 turnos) alcanza para que el asistente recuerde de que se
# viene hablando sin arrastrar una conversacion entera cada vez.
_HISTORIAL_MAX_MENSAJES = 8

_MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
]


def _fecha_hoy_es() -> str:
    """Fecha de hoy en español, sin depender del locale del servidor."""
    hoy = date.today()
    return f"{hoy.day} de {_MESES_ES[hoy.month - 1]} de {hoy.year}"


_RATE_LIMIT_REINTENTOS = 3
_RATE_LIMIT_ESPERA_S = 8


def _es_rate_limit(e: APIStatusError) -> bool:
    """Groq responde el rate limit por TPM con distintos status codes (429
    o incluso 413) pero siempre con code=='rate_limit_exceeded' en el body."""
    body = e.body if isinstance(e.body, dict) else {}
    codigo = (body.get("error") or {}).get("code") if isinstance(body.get("error"), dict) else None
    return e.status_code == 429 or codigo == "rate_limit_exceeded"


# Placeholder que reemplaza el resultado de una ronda de tool-calling YA
# PASADA (ver _podar_resultados_antiguos): el modelo ya razonó sobre esos
# datos en su propia respuesta de esa ronda -- esa conclusión sigue intacta
# en sus mensajes anteriores, no hace falta reenviar el JSON crudo cada vez
# que se llama al LLM de nuevo. Sin esto, una pregunta que necesita varias
# consultas encadenadas (ej. "compara el mes con más ingreso contra el de
# menos y explica por qué") acumula tanto JSON en el historial que una ronda
# intermedia supera el límite de tokens por minuto del LLM y la pregunta
# falla aunque cada consulta individual sea chica.
_PLACEHOLDER_RONDA_ANTERIOR = json.dumps({
    "nota": "Resultado de una consulta de una ronda anterior de esta misma pregunta -- ya fue usado. "
            "Si lo necesitas de nuevo, vuelve a ejecutar la consulta."
})


def _podar_resultados_antiguos(mensajes: list[dict], indices_a_mantener: set[int]) -> None:
    for i, m in enumerate(mensajes):
        if m.get("role") == "tool" and i not in indices_a_mantener and m["content"] != _PLACEHOLDER_RONDA_ANTERIOR:
            m["content"] = _PLACEHOLDER_RONDA_ANTERIOR


def _completar_con_reintento(**kwargs):
    """Reintenta con backoff cuando el LLM devuelve rate limit (TPM) --
    la ventana de Groq es por minuto, así que un par de segundos de espera
    suele bastar para que la siguiente llamada entre dentro del cupo."""
    for intento in range(_RATE_LIMIT_REINTENTOS + 1):
        try:
            return _client.chat.completions.create(**kwargs)
        except APIStatusError as e:
            if intento == _RATE_LIMIT_REINTENTOS or not _es_rate_limit(e):
                raise
            time.sleep(_RATE_LIMIT_ESPERA_S * (intento + 1))


def responder_pregunta(
    pregunta: str,
    vendedor: str | None = None,
    nombre: str | None = None,
    rol: str = "GERENCIA",
    historial: list[dict] | None = None,
) -> dict:
    """`vendedor` viene del claim `vendedorNombreSap` del JWT (nunca de un
    parámetro que mande el cliente) -- ver main.py/auth.py. Si es None, quien
    pregunta es GERENCIA/ADMIN y puede ver los agregados de toda la empresa;
    si tiene valor, cada consulta SQL queda forzada a las ventas de ESE
    vendedor únicamente (ver tools.py y ai.v_ventas_vendedor). `nombre` es el
    claim `name` del JWT (nombre real de la persona), solo para que el LLM
    salude por su nombre -- nunca se usa para autorización. `rol` filtra qué
    documentos de la base de conocimiento puede traer buscar_base_conocimiento
    (ver ai.documento_contexto.roles_visibles).

    `historial` son los mensajes previos de ESTA conversación (lista de
    {"role": "user"|"assistant", "content": str}, más viejo primero, sin el
    mensaje actual) -- el frontend los manda porque cada request a /chat es
    stateless para este servicio (no guarda sesión); sin esto el asistente no
    tiene memoria de lo que ya se habló y cada pregunta se resuelve aislada.
    Se limitan a las últimas N (ver _HISTORIAL_MAX_MENSAJES) para no inflar
    el presupuesto de tokens del LLM con una conversación larga.
    """
    inicio = time.monotonic()
    if vendedor:
        system_prompt = _SYSTEM_PROMPT_VENDEDOR.replace(
            "{{NOMBRE_VENDEDOR}}", nombre or "el vendedor"
        )
    else:
        system_prompt = _SYSTEM_PROMPT_EMPRESA
    system_prompt = system_prompt.replace("{{FECHA_HOY}}", _fecha_hoy_es())
    sql_tool_schema = build_sql_tool_schema(vendedor)
    kb_tool_schema = build_kb_tool_schema()

    historial_acotado = (historial or [])[-_HISTORIAL_MAX_MENSAJES:]
    mensajes = [
        {"role": "system", "content": system_prompt},
        *[{"role": m["role"], "content": m["content"]} for m in historial_acotado if m.get("role") in ("user", "assistant")],
        {"role": "user", "content": pregunta},
    ]

    sql_generado = None
    filas_retornadas = None
    ultimos_datos: list[dict] | None = None
    # Ventana deslizante de las últimas rondas de tool-calling que se
    # mandan completas al LLM -- ver _podar_resultados_antiguos. Podar a
    # solo 1 ronda le quitaba al modelo datos que todavía necesitaba para
    # preguntas comparativas (ej. "compara marzo con mayo"), y terminaba
    # agotando MAX_TOOL_ROUNDS sin llegar a una respuesta final. 2 rondas es
    # el equilibrio: suficiente memoria de trabajo para comparar dos
    # periodos, sin dejar crecer el historial sin límite.
    _RONDAS_A_MANTENER = 2
    ventana_rondas: list[set[int]] = []

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            respuesta = _completar_con_reintento(
                model=settings.llm_model,
                messages=mensajes,
                tools=[sql_tool_schema, kb_tool_schema],
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
                    vendedor=vendedor,
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

            indices_ronda_actual = set()
            for tool_call in mensaje.tool_calls:
                args = json.loads(tool_call.function.arguments)

                if tool_call.function.name == "buscar_base_conocimiento":
                    resultado_kb = buscar_base_conocimiento(args.get("consulta", ""), rol=rol)
                    contenido_tool = json.dumps(resultado_kb, default=str)
                else:
                    sql_generado = args.get("sql")
                    try:
                        resultado = ejecutar_sql(sql_generado, vendedor=vendedor)
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
                indices_ronda_actual.add(len(mensajes) - 1)

            # Ver _PLACEHOLDER_RONDA_ANTERIOR: solo se mantiene el JSON
            # crudo de las últimas _RONDAS_A_MANTENER rondas, las más viejas
            # quedan podadas -- evita que preguntas de varios pasos revienten
            # el límite de tokens por minuto del LLM a mitad de camino, sin
            # quitarle al modelo la memoria de trabajo que todavía necesita.
            ventana_rondas.append(indices_ronda_actual)
            del ventana_rondas[:-_RONDAS_A_MANTENER]
            indices_a_mantener = {i for ronda in ventana_rondas for i in ronda}
            _podar_resultados_antiguos(mensajes, indices_a_mantener)

        # Se agotaron los intentos de tool-calling sin respuesta final
        raise RuntimeError("El modelo no llegó a una respuesta final tras varios intentos de consulta.")

    except Exception as e:
        duracion_ms = int((time.monotonic() - inicio) * 1000)
        registrar_consulta(
            pregunta_usuario=pregunta,
            vendedor=vendedor,
            sql_generado=sql_generado,
            filas_retornadas=filas_retornadas,
            respuesta_llm=None,
            modelo=settings.llm_model,
            exito=False,
            error=str(e),
            duracion_ms=duracion_ms,
        )
        raise
