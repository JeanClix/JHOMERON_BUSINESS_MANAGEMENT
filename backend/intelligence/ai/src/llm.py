"""Capa de proveedor de LLM: todo lo que cambia entre OpenAI-compatible
(Groq, xAI, OpenAI, NVIDIA) y Anthropic (Claude) vive acá -- formato de
mensajes y tools, lectura de la respuesta, tokens, reintentos por rate
limit. agent.py, insights.py y recomendaciones.py no saben qué proveedor hay
detrás; se elige con LLM_PROVIDER en .env.

- "openai" (default): SDK de OpenAI con LLM_BASE_URL / LLM_API_KEY. Es el
  comportamiento de siempre.
- "anthropic": SDK oficial de Anthropic con ANTHROPIC_API_KEY. Las tools se
  siguen definiendo en formato OpenAI (tools.py) y se traducen acá.
"""
import json
import time
from dataclasses import dataclass

import anthropic
from openai import APIConnectionError, APIStatusError, OpenAI

from .config import opciones_llm, settings
from .tiempos import TrazaTiempos

PROVEEDOR_ANTHROPIC = "anthropic"

_RATE_LIMIT_REINTENTOS = 3
_RATE_LIMIT_ESPERA_S = 8
_RATE_LIMIT_ESPERA_MAX_S = 60

# Placeholder que reemplaza el resultado de una ronda de tool-calling YA
# PASADA (ver Conversacion.podar): el modelo ya razonó sobre esos datos en su
# propia respuesta de esa ronda -- esa conclusión sigue intacta en sus
# mensajes anteriores, no hace falta reenviar el JSON crudo cada vez que se
# llama al LLM de nuevo. Sin esto, una pregunta que necesita varias consultas
# encadenadas (ej. "compara el mes con más ingreso contra el de menos y
# explica por qué") acumula tanto JSON en el historial que una ronda
# intermedia supera el límite de tokens por minuto del LLM y la pregunta
# falla aunque cada consulta individual sea chica.
PLACEHOLDER_RONDA_ANTERIOR = json.dumps({
    "nota": "Resultado de una consulta de una ronda anterior de esta misma pregunta -- ya fue usado. "
            "Si lo necesitas de nuevo, vuelve a ejecutar la consulta."
})

# max_retries=0 en ambos clientes: los reintentos los hace _con_reintento.
# Con los del SDK (2 por defecto) un 429 de Groq se dormía en silencio
# 12-31 s dentro de la llamada y la traza de tiempos lo veía como "LLM lento".
_cliente_openai: OpenAI | None = None
_cliente_anthropic: anthropic.Anthropic | None = None


def _openai() -> OpenAI:
    global _cliente_openai
    if _cliente_openai is None:
        _cliente_openai = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key, max_retries=0)
    return _cliente_openai


def _anthropic() -> anthropic.Anthropic:
    global _cliente_anthropic
    if _cliente_anthropic is None:
        _cliente_anthropic = anthropic.Anthropic(api_key=settings.anthropic_api_key, max_retries=0)
    return _cliente_anthropic


def _usa_anthropic() -> bool:
    return settings.llm_provider == PROVEEDOR_ANTHROPIC


# ============================================================
# Rate limit y reintentos (ambos proveedores)
# ============================================================

def es_rate_limit(e: Exception) -> bool:
    """Groq responde el rate limit por TPM con distintos status codes (429
    o incluso 413) pero siempre con code=='rate_limit_exceeded' en el body.
    Anthropic usa 429 (RateLimitError)."""
    if isinstance(e, anthropic.RateLimitError):
        return True
    if isinstance(e, APIStatusError):
        body = e.body if isinstance(e.body, dict) else {}
        codigo = (body.get("error") or {}).get("code") if isinstance(body.get("error"), dict) else None
        return e.status_code == 429 or codigo == "rate_limit_exceeded"
    return False


def _es_transitorio(e: Exception) -> bool:
    """Errores que vale la pena reintentar sin ser rate limit: red caída o
    5xx del proveedor (en Anthropic, 529 = sobrecargado)."""
    if isinstance(e, (APIConnectionError, anthropic.APIConnectionError)):
        return True
    if isinstance(e, (APIStatusError, anthropic.APIStatusError)):
        return e.status_code >= 500
    return False


def _espera_rate_limit_s(e: Exception, intento: int) -> float:
    """Lo que pide el proveedor en `retry-after` (Groq y Anthropic lo
    mandan); si no viene, backoff lineal."""
    try:
        return min(float(e.response.headers.get("retry-after")), _RATE_LIMIT_ESPERA_MAX_S)
    except (AttributeError, TypeError, ValueError):
        return _RATE_LIMIT_ESPERA_S * (intento + 1)


def _con_reintento(llamada, ronda: dict | None):
    """Ejecuta `llamada()` reintentando rate limit (esperando lo que indique
    el proveedor) y errores transitorios. `ronda` (ver tiempos.py) acumula
    por separado el tiempo en llamadas al LLM (incluidas las que fallan) y el
    tiempo dormido esperando por rate limit."""
    for intento in range(_RATE_LIMIT_REINTENTOS + 1):
        desde = time.monotonic()
        try:
            respuesta = llamada()
            if ronda is not None:
                ronda["llm_ms"] += int((time.monotonic() - desde) * 1000)
            return respuesta
        except (APIStatusError, APIConnectionError, anthropic.APIStatusError, anthropic.APIConnectionError) as e:
            if ronda is not None:
                ronda["llm_ms"] += int((time.monotonic() - desde) * 1000)
            rate_limit = es_rate_limit(e)
            if intento == _RATE_LIMIT_REINTENTOS or not (rate_limit or _es_transitorio(e)):
                raise
            espera_s = _espera_rate_limit_s(e, intento) if rate_limit else intento + 1
            if ronda is not None:
                ronda["reintentos"] += 1
                if rate_limit:
                    ronda["espera_rate_limit_ms"] += int(espera_s * 1000)
            time.sleep(espera_s)


# ============================================================
# Conversación con tools (chat del agente)
# ============================================================

@dataclass
class LlamadaTool:
    id: str
    nombre: str
    argumentos: dict


@dataclass
class RespuestaLLM:
    texto: str
    llamadas: list[LlamadaTool]


class Conversacion:
    """Historial de UNA pregunta del chat en el formato del proveedor. El
    agente solo usa estos métodos -- ver agent.responder_pregunta."""

    def completar(self, tools: list[dict], max_tokens: int, ronda: dict | None) -> RespuestaLLM:
        raise NotImplementedError

    def agregar_resultados(self, resultados: list[tuple[str, str]]) -> set[int]:
        """Agrega los resultados de las tools de esta ronda y devuelve los
        índices de mensaje que los contienen (para podar después)."""
        raise NotImplementedError

    def podar(self, indices_a_mantener: set[int]) -> None:
        raise NotImplementedError

    def agregar_aviso(self, texto: str) -> None:
        """Agrega un mensaje del sistema/servicio (no del usuario) después de
        la última respuesta del modelo -- ver el control de cifras en
        agent.responder_pregunta."""
        self.mensajes.append({"role": "user", "content": f"[Aviso del sistema, no del usuario] {texto}"})


class _ConversacionOpenAI(Conversacion):
    def __init__(self, system_prompt: str, historial: list[dict], pregunta: str):
        self.mensajes: list[dict] = [
            {"role": "system", "content": system_prompt},
            *historial,
            {"role": "user", "content": pregunta},
        ]

    def completar(self, tools, max_tokens, ronda):
        # Sin tools (ruta "saludo" del enrutador) no se manda la clave:
        # algunos proveedores rechazan `tools=[]`.
        kwargs_tools = {"tools": tools} if tools else {}
        respuesta = _con_reintento(
            lambda: _openai().chat.completions.create(
                model=settings.llm_model, messages=self.mensajes, **kwargs_tools, **opciones_llm(max_tokens)
            ),
            ronda,
        )
        if ronda is not None:
            TrazaTiempos.registrar_uso(ronda, respuesta)
        mensaje = respuesta.choices[0].message
        self.mensajes.append(mensaje.model_dump(exclude_none=True))
        return RespuestaLLM(
            texto=mensaje.content or "",
            llamadas=[
                LlamadaTool(t.id, t.function.name, json.loads(t.function.arguments or "{}"))
                for t in (mensaje.tool_calls or [])
            ],
        )

    def agregar_resultados(self, resultados):
        indices = set()
        for tool_call_id, contenido in resultados:
            self.mensajes.append({"role": "tool", "tool_call_id": tool_call_id, "content": contenido})
            indices.add(len(self.mensajes) - 1)
        return indices

    def podar(self, indices_a_mantener):
        for i, m in enumerate(self.mensajes):
            if m.get("role") == "tool" and i not in indices_a_mantener and m["content"] != PLACEHOLDER_RONDA_ANTERIOR:
                m["content"] = PLACEHOLDER_RONDA_ANTERIOR


def _tool_a_anthropic(tool: dict) -> dict:
    """tools.py define las tools en formato OpenAI ({"type": "function",
    "function": {...}}); la Messages API de Anthropic usa name /
    description / input_schema."""
    funcion = tool["function"]
    return {"name": funcion["name"], "description": funcion["description"], "input_schema": funcion["parameters"]}


class _ConversacionAnthropic(Conversacion):
    def __init__(self, system_prompt: str, historial: list[dict], pregunta: str):
        self.system = system_prompt
        previos = [m for m in historial if m.get("content")]
        # La Messages API exige que el primer mensaje sea del usuario -- si el
        # historial que manda el frontend arranca con un saludo del asistente,
        # ese saludo no aporta contexto y se descarta.
        while previos and previos[0]["role"] != "user":
            previos.pop(0)
        self.mensajes: list[dict] = [*previos, {"role": "user", "content": pregunta}]

    def completar(self, tools, max_tokens, ronda):
        kwargs: dict = {}
        if tools:
            kwargs["tools"] = [_tool_a_anthropic(t) for t in tools]
        if settings.llm_thinking_budget > 0:
            # Haiku 4.5 usa thinking con presupuesto fijo (budget_tokens, mín.
            # 1024 y menor que max_tokens); los bloques de thinking vuelven en
            # response.content y se reenvían tal cual en la ronda siguiente.
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": settings.llm_thinking_budget}
            max_tokens += settings.llm_thinking_budget
        respuesta = _con_reintento(
            lambda: _anthropic().messages.create(
                model=settings.llm_model, max_tokens=max_tokens, system=self.system, messages=self.mensajes, **kwargs
            ),
            ronda,
        )
        if ronda is not None:
            uso = respuesta.usage
            ronda["tokens_entrada"] = (
                uso.input_tokens + (uso.cache_read_input_tokens or 0) + (uso.cache_creation_input_tokens or 0)
            )
            ronda["tokens_salida"] = uso.output_tokens
        self.mensajes.append({"role": "assistant", "content": respuesta.content})

        texto = "".join(b.text for b in respuesta.content if b.type == "text")
        if respuesta.stop_reason == "refusal" and not texto:
            texto = "No puedo ayudarte con esa consulta. ¿Quieres preguntarme algo sobre ventas o documentación de JHOMERON?"
        return RespuestaLLM(
            texto=texto,
            llamadas=[LlamadaTool(b.id, b.name, b.input) for b in respuesta.content if b.type == "tool_use"],
        )

    def agregar_resultados(self, resultados):
        # Todos los resultados de una ronda van juntos en UN mensaje de
        # usuario (separarlos hace que Claude deje de pedir tools en paralelo).
        self.mensajes.append({
            "role": "user",
            "content": [{"type": "tool_result", "tool_use_id": i, "content": c} for i, c in resultados],
        })
        return {len(self.mensajes) - 1}

    def podar(self, indices_a_mantener):
        for i, m in enumerate(self.mensajes):
            if i in indices_a_mantener or m["role"] != "user" or not isinstance(m["content"], list):
                continue
            for bloque in m["content"]:
                if bloque.get("type") == "tool_result":
                    bloque["content"] = PLACEHOLDER_RONDA_ANTERIOR


def nueva_conversacion(system_prompt: str, historial: list[dict], pregunta: str) -> Conversacion:
    """`historial`: mensajes previos {"role": "user"|"assistant", "content": str}."""
    clase = _ConversacionAnthropic if _usa_anthropic() else _ConversacionOpenAI
    return clase(system_prompt, historial, pregunta)


# ============================================================
# Llamada simple sin tools (insights, recomendaciones)
# ============================================================

def completar_texto(system_prompt: str, mensaje_usuario: str, max_tokens: int, uso: dict | None = None) -> str:
    """`uso`, si se pasa, se completa con {"entrada": int, "salida": int}
    para la auditoría de consumo (ai.consulta_log)."""
    if _usa_anthropic():
        respuesta = _con_reintento(
            lambda: _anthropic().messages.create(
                model=settings.llm_model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": mensaje_usuario}],
            ),
            None,
        )
        if uso is not None:
            uso.update(entrada=respuesta.usage.input_tokens, salida=respuesta.usage.output_tokens)
        return "".join(b.text for b in respuesta.content if b.type == "text")

    respuesta = _con_reintento(
        lambda: _openai().chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": mensaje_usuario},
            ],
            **opciones_llm(max_tokens),
        ),
        None,
    )
    if uso is not None and respuesta.usage:
        uso.update(entrada=respuesta.usage.prompt_tokens, salida=respuesta.usage.completion_tokens)
    return respuesta.choices[0].message.content or ""
