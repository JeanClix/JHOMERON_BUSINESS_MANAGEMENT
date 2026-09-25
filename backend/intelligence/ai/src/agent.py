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

from .config import settings
from .db import get_connection
from .tools import SqlToolError, build_rag_tool_schema, build_sql_tool_schema, buscar_documentos, ejecutar_sql
from .audit import registrar_consulta
from .enrutador import RUTA_FUERA_DE_TEMA, TOOL_DOCUMENTOS, TOOL_SQL, enrutar
from .llm import nueva_conversacion
from .metas import contexto_metas
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


def _fecha_es(dia: date) -> str:
    """Fecha en español, sin depender del locale del servidor."""
    return f"{dia.day} de {_MESES_ES[dia.month - 1]} de {dia.year}"


def _fecha_hoy_es() -> str:
    return _fecha_es(date.today())


_CACHE_ULTIMA_VENTA_S = 600
_cache_ultima_venta: tuple[float, date | None] = (0.0, None)


def _datos_hasta_es() -> str:
    """Hasta qué día hay ventas en el DW (lo que cargó el batch). Sin esto,
    si el batch no corrió en días, el LLM respondía "no tienes ventas esta
    semana" en vez de aclarar que los datos llegan hasta cierta fecha. Se
    cachea unos minutos: cambia solo cuando corre el batch."""
    global _cache_ultima_venta
    momento, ultima = _cache_ultima_venta
    if time.monotonic() - momento > _CACHE_ULTIMA_VENTA_S:
        try:
            with get_connection() as conn:
                ultima = conn.execute("SELECT MAX(fecha) AS f FROM ai.v_ventas").fetchone()["f"]
            _cache_ultima_venta = (time.monotonic(), ultima)
        except Exception:  # noqa: BLE001 -- nunca tumbar el chat por esto
            ultima = None
    if ultima is None:
        return "No se pudo determinar hasta qué fecha hay datos."
    return (f"Los datos de ventas están cargados hasta el **{_fecha_es(ultima)}**. Si preguntan por días "
            "posteriores, aclara que todavía no hay datos cargados de ese período -- no digas que no hubo ventas.")


def responder_pregunta(
    pregunta: str,
    rol: str,
    vendedor: str | None = None,
    nombre: str | None = None,
    historial: list[dict] | None = None,
    usuario: str | None = None,
    token: str | None = None,
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
    nombre -- nunca se usa para autorización. `usuario` es el claim `sub`
    del JWT, solo para la auditoría de consumo (ai.consulta_log.usuario).
    `token` es el JWT tal cual, para pedir las metas a reporting (metas.py).

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
    system_prompt = system_prompt.replace("{{DATOS_HASTA}}", _datos_hasta_es())
    system_prompt = system_prompt.replace("{{METAS}}", contexto_metas(token, es_vendedor=vendedor is not None))

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
            usuario=usuario,
            rol=rol,
            tokens_entrada=0,
            tokens_salida=0,
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

    conversacion = nueva_conversacion(
        system_prompt,
        [{"role": m["role"], "content": m["content"]} for m in historial_acotado if m.get("role") in ("user", "assistant")],
        pregunta,
    )

    sql_generado = None
    filas_retornadas = None
    ultimos_datos: list[dict] | None = None
    # Ventana deslizante de las últimas rondas de tool-calling que se
    # mandan completas al LLM -- ver llm.PLACEHOLDER_RONDA_ANTERIOR. Podar a
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
            # Algunos modelos (ej. deepseek con "thinking") consumen parte del
            # presupuesto en razonamiento antes del contenido final; con poco
            # margen la respuesta queda vacía. Se deja margen amplio.
            respuesta = conversacion.completar(tools_llm, max_tokens=4096, ronda=ronda)

            if not respuesta.llamadas:
                texto_final = respuesta.texto
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
                    usuario=usuario,
                    rol=rol,
                    tokens_entrada=traza.tokens_totales()[0],
                    tokens_salida=traza.tokens_totales()[1],
                )
                traza.cerrar(exito=True)
                return {
                    "respuesta": texto_final,
                    "sql_generado": sql_generado,
                    "filas_retornadas": filas_retornadas,
                    "datos": ultimos_datos,
                    "duracion_ms": duracion_ms,
                }

            resultados_ronda: list[tuple[str, str]] = []
            for llamada in respuesta.llamadas:
                args = llamada.argumentos
                desde_tool = time.monotonic()
                tool_con_error = False
                try:
                    if llamada.nombre == "ejecutar_sql":
                        sql_generado = args.get("sql")
                        resultado = ejecutar_sql(sql_generado, vendedor=vendedor)
                        filas_retornadas = resultado["num_filas"]
                        ultimos_datos = resultado["filas"]
                    elif llamada.nombre == "buscar_documentos":
                        resultado = buscar_documentos(args.get("consulta", ""), rol=rol)
                    else:
                        raise SqlToolError(f"Tool desconocida: {llamada.nombre}")
                    contenido_tool = json.dumps(resultado, default=str)
                except SqlToolError as e:
                    contenido_tool = json.dumps({"error": str(e)})
                    tool_con_error = True
                TrazaTiempos.registrar_tool(ronda, llamada.nombre, desde_tool, tool_con_error)
                resultados_ronda.append((llamada.id, contenido_tool))
            indices_ronda_actual = conversacion.agregar_resultados(resultados_ronda)

            # Ver _PLACEHOLDER_RONDA_ANTERIOR: solo se mantiene el JSON
            # crudo de las últimas _RONDAS_A_MANTENER rondas, las más viejas
            # quedan podadas -- evita que preguntas de varios pasos revienten
            # el límite de tokens por minuto del LLM a mitad de camino, sin
            # quitarle al modelo la memoria de trabajo que todavía necesita.
            ventana_rondas.append(indices_ronda_actual)
            del ventana_rondas[:-_RONDAS_A_MANTENER]
            indices_a_mantener = {i for ronda in ventana_rondas for i in ronda}
            conversacion.podar(indices_a_mantener)

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
            usuario=usuario,
            rol=rol,
            tokens_entrada=traza.tokens_totales()[0],
            tokens_salida=traza.tokens_totales()[1],
        )
        traza.cerrar(exito=False, error=str(e))
        raise
