"""Orquestacion del agente: pregunta -> LLM (con tools ejecutar_sql y
buscar_documentos) -> SQL o búsqueda semántica -> datos reales -> LLM
interpreta -> respuesta. Cada paso queda trazado.

Para datos de ventas (estructurados), Text-to-SQL vía tool-calling responde
mejor que RAG. Para documentación institucional (no estructurada: políticas,
catálogo, procesos) sí se usa RAG -- ver buscar_documentos en tools.py.
"""
import json
import re
import time
from datetime import date
from pathlib import Path

from openai import APIConnectionError, APIStatusError, OpenAI

from .config import opciones_llm, settings
from .tools import SqlToolError, build_rag_tool_schema, build_sql_tool_schema, buscar_documentos, ejecutar_sql
from .audit import registrar_consulta
from .enrutador import RUTA_FUERA_DE_TEMA, TOOL_DOCUMENTOS, TOOL_SQL, enrutar
from .tiempos import TrazaTiempos

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_SYSTEM_PROMPT_EMPRESA = (_PROMPTS_DIR / "system_prompt.md").read_text(encoding="utf-8")
_SYSTEM_PROMPT_VENDEDOR = (_PROMPTS_DIR / "system_prompt_vendedor.md").read_text(encoding="utf-8")

_SECCION_PROMPT = re.compile(r"<!-- seccion:(\w+) -->\n(.*?)<!-- /seccion:\1 -->\n", re.S)


def _recortar_prompt(prompt: str, tools: frozenset[str]) -> str:
    """Deja solo las secciones <!-- seccion:X --> de las tools que se van a
    ofrecer (ver enrutador.py) y quita las marcas. Sin enrutador `tools` son
    todas y el prompt queda igual que antes, solo sin las marcas."""
    recortado = _SECCION_PROMPT.sub(lambda m: m.group(2) if m.group(1) in tools else "", prompt)
    return re.sub(r"\n{3,}", "\n\n", recortado)


def _respuesta_fuera_de_tema(vendedor: str | None, nombre: str | None) -> str:
    """Misma respuesta que pide el prompt para temas ajenos al negocio, pero
    sin pasar por el LLM (ver enrutador.RUTA_FUERA_DE_TEMA)."""
    if vendedor:
        primer_nombre = (nombre or "").split(" ")[0]
        saludo = f"{primer_nombre}, solo" if primer_nombre else "Solo"
        return f"{saludo} puedo ayudarte con tus ventas, clientes y productos, o con documentación de JHOMERON. ¿Te ayudo con algo de eso?"
    return "Solo puedo ayudarte con consultas del negocio de JHOMERON: ventas, clientes, productos o documentación de la empresa. ¿Quieres preguntarme algo de eso?"

# max_retries=0: los reintentos los hace _completar_con_reintento. Con los
# del SDK (2 por defecto) un 429 de Groq se dormía en silencio 12-31 s dentro
# de la llamada y la traza de tiempos lo veía como "LLM lento".
_client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key, max_retries=0)

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
_RATE_LIMIT_ESPERA_MAX_S = 60


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


def _espera_rate_limit_s(e: APIStatusError, intento: int) -> float:
    """Lo que pide el proveedor en `retry-after` (Groq lo manda con la
    cuenta exacta hasta que se libera cupo); si no viene, backoff lineal."""
    try:
        return min(float(e.response.headers.get("retry-after")), _RATE_LIMIT_ESPERA_MAX_S)
    except (TypeError, ValueError):
        return _RATE_LIMIT_ESPERA_S * (intento + 1)


def _completar_con_reintento(ronda: dict | None = None, **kwargs):
    """Reintenta cuando el LLM devuelve rate limit (TPM), esperando lo que
    indique el proveedor -- la ventana de Groq es por minuto. También
    reintenta errores transitorios (red, 5xx), como hacía el SDK antes de
    max_retries=0.

    `ronda` (ver tiempos.py) acumula por separado el tiempo en llamadas al
    LLM (incluidas las que fallan por rate limit) y el tiempo dormido
    esperando para reintentar."""
    for intento in range(_RATE_LIMIT_REINTENTOS + 1):
        desde = time.monotonic()
        try:
            respuesta = _client.chat.completions.create(**kwargs)
            if ronda is not None:
                ronda["llm_ms"] += int((time.monotonic() - desde) * 1000)
                TrazaTiempos.registrar_uso(ronda, respuesta)
            return respuesta
        except (APIStatusError, APIConnectionError) as e:
            if ronda is not None:
                ronda["llm_ms"] += int((time.monotonic() - desde) * 1000)
            es_rate_limit = isinstance(e, APIStatusError) and _es_rate_limit(e)
            es_transitorio = isinstance(e, APIConnectionError) or e.status_code >= 500
            if intento == _RATE_LIMIT_REINTENTOS or not (es_rate_limit or es_transitorio):
                raise
            espera_s = _espera_rate_limit_s(e, intento) if es_rate_limit else intento + 1
            if ronda is not None:
                ronda["reintentos"] += 1
                if es_rate_limit:
                    ronda["espera_rate_limit_ms"] += int(espera_s * 1000)
            time.sleep(espera_s)


def responder_pregunta(
    pregunta: str,
    rol: str,
    vendedor: str | None = None,
    nombre: str | None = None,
    historial: list[dict] | None = None,
) -> dict:
    """`vendedor` viene del claim `vendedorNombreSap` del JWT (nunca de un
    parámetro que mande el cliente) -- ver main.py/auth.py. Si es None, quien
    pregunta es GERENCIA/ADMIN y puede ver los agregados de toda la empresa;
    si tiene valor, cada consulta SQL queda forzada a las ventas de ESE
    vendedor únicamente (ver tools.py y ai.v_ventas_vendedor). `rol` es el
    claim `role` del JWT (VENDEDOR/GERENCIA/ADMIN) -- a diferencia de
    `vendedor`, buscar_documentos lo necesita siempre (los tres roles pueden
    consultar documentos, no solo VENDEDOR). `nombre` es el claim `name` del
    JWT (nombre real de la persona), solo para que el LLM salude por su
    nombre -- nunca se usa para autorización.

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

    historial_acotado = (historial or [])[-_HISTORIAL_MAX_MENSAJES:]
    traza = TrazaTiempos(pregunta, rol, historial_mensajes=len(historial_acotado))

    decision = enrutar(pregunta, historial_acotado)
    traza.datos["enrutador"] = decision.a_dict()
    if decision.ruta == RUTA_FUERA_DE_TEMA:
        texto_final = _respuesta_fuera_de_tema(vendedor, nombre)
        duracion_ms = int((time.monotonic() - inicio) * 1000)
        registrar_consulta(
            pregunta_usuario=pregunta,
            vendedor=vendedor,
            sql_generado=None,
            filas_retornadas=None,
            respuesta_llm=texto_final,
            modelo=f"enrutador:{settings.jev_modelo}",
            exito=True,
            error=None,
            duracion_ms=duracion_ms,
        )
        traza.cerrar(exito=True)
        return {
            "respuesta": texto_final,
            "sql_generado": None,
            "filas_retornadas": None,
            "datos": None,
            "duracion_ms": duracion_ms,
        }

    system_prompt = _recortar_prompt(system_prompt, decision.tools)
    tools_llm = []
    if TOOL_SQL in decision.tools:
        tools_llm.append(build_sql_tool_schema(vendedor))
    if TOOL_DOCUMENTOS in decision.tools:
        tools_llm.append(build_rag_tool_schema())
    # Sin tools (ruta "saludo") no se manda la clave: algunos proveedores
    # rechazan `tools=[]`.
    kwargs_tools = {"tools": tools_llm} if tools_llm else {}

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
            ronda = traza.nueva_ronda()
            respuesta = _completar_con_reintento(
                ronda,
                model=settings.llm_model,
                messages=mensajes,
                **kwargs_tools,
                # Algunos modelos (ej. deepseek con "thinking") consumen parte del
                # presupuesto en razonamiento antes del contenido final; con poco
                # margen la respuesta queda vacía. Se deja margen amplio.
                **opciones_llm(4096),
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
                traza.cerrar(exito=True)
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
                desde_tool = time.monotonic()
                tool_con_error = False
                try:
                    if tool_call.function.name == "ejecutar_sql":
                        sql_generado = args.get("sql")
                        resultado = ejecutar_sql(sql_generado, vendedor=vendedor)
                        filas_retornadas = resultado["num_filas"]
                        ultimos_datos = resultado["filas"]
                    elif tool_call.function.name == "buscar_documentos":
                        resultado = buscar_documentos(args.get("consulta", ""), rol=rol)
                    else:
                        raise SqlToolError(f"Tool desconocida: {tool_call.function.name}")
                    contenido_tool = json.dumps(resultado, default=str)
                except SqlToolError as e:
                    contenido_tool = json.dumps({"error": str(e)})
                    tool_con_error = True
                TrazaTiempos.registrar_tool(ronda, tool_call.function.name, desde_tool, tool_con_error)

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
        traza.cerrar(exito=False, error=str(e))
        raise
