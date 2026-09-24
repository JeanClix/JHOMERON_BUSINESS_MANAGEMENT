"""Enrutador previo al LLM con Jev (modelo "System One" de TypeSafe AI).

Jev no genera texto: recibe la pregunta y devuelve probabilidades para
preguntas sí/no definidas acá. Con eso se decide, antes de llamar al LLM:

- fuera_de_tema -> respuesta fija, sin llamar al LLM (0 tokens de LLM).
- saludo        -> LLM sin tools y con el prompt recortado a lo general.
- si no         -> solo las tools que hacen falta (ejecutar_sql y/o
                   buscar_documentos) y solo sus secciones del prompt (ver
                   <!-- seccion:... --> en prompts/*.md).

Ante cualquier duda (Jev caído, timeout, probabilidades bajas en todo) la
ruta es "completa": todas las tools y el prompt entero, igual que sin
enrutador. El enrutador puede ahorrar tokens, pero nunca debe dejar al LLM
sin una tool que necesitaba -- por eso el umbral para incluir una tool es
bajo y el de responder sin tools es alto (ver config.py).

Se llama a la API HTTP directo con httpx en vez de usar `typesafe-sdk`: el
SDK exige pydantic>=2.12 y este servicio fija pydantic 2.9 junto con
FastAPI 0.115. Formato tomado del SDK 0.7.1 (POST /v1/systemone).

Las instrucciones para Jev van en inglés: su documentación solo muestra
ejemplos en inglés y no garantiza otros idiomas. La pregunta del usuario
sí va tal cual, en español.
"""
import time
from dataclasses import dataclass, field

import httpx

from .config import settings

TOOL_SQL = "sql"
TOOL_DOCUMENTOS = "documentos"
TODAS_LAS_TOOLS = frozenset({TOOL_SQL, TOOL_DOCUMENTOS})

RUTA_COMPLETA = "completa"
RUTA_SIN_ENRUTADOR = "sin_enrutador"
RUTA_FUERA_DE_TEMA = "fuera_de_tema"
RUTA_SALUDO = "saludo"

_PREGUNTAS_JEV = {
    "ventas": {
        "type": "noul",
        "instructions": (
            "Answering `current_message` requires querying JHOMERON's sales data: amounts, quantities, "
            "customers, products sold, salespeople, regions, rankings, trends or comparisons between "
            "periods. Use `previous_messages` to resolve short follow-ups such as 'and in March?'."
        ),
    },
    "documentos": {
        "type": "noul",
        "instructions": (
            "Answering `current_message` requires JHOMERON's institutional documents: mission, vision, "
            "history, product catalog or product lines, policies, warranties, terms and conditions, "
            "stores, locations or contact information. Use `previous_messages` to resolve follow-ups."
        ),
    },
    "saludo": {
        "type": "noul",
        "instructions": (
            "`current_message` is only a greeting, a thank-you or a goodbye, and contains no question "
            "or request at all."
        ),
    },
    "fuera_de_tema": {
        "type": "noul",
        "instructions": (
            "`current_message` is unrelated to JHOMERON (a manufacturing company) and its business: "
            "for example sports, weather, news, general knowledge, programming or personal tasks."
        ),
    },
}

_client = httpx.Client(base_url=settings.typesafe_base_url, timeout=settings.jev_timeout_s)


@dataclass
class Decision:
    ruta: str
    tools: frozenset[str] = TODAS_LAS_TOOLS
    probabilidades: dict[str, float] = field(default_factory=dict)
    ms: int = 0
    tokens_entrada: int | None = None
    error: str | None = None

    def a_dict(self) -> dict:
        return {
            "ruta": self.ruta,
            "tools": sorted(self.tools),
            "probabilidades": self.probabilidades,
            "ms": self.ms,
            "tokens_entrada": self.tokens_entrada,
            "error": self.error,
        }


def decidir(probabilidades: dict[str, float]) -> tuple[str, frozenset[str]]:
    """Regla pura (sin red) para poder probarla sola: probabilidades de Jev
    -> (ruta, tools a ofrecer al LLM)."""
    umbral_tool = settings.jev_umbral_tool
    umbral_sin_tools = settings.jev_umbral_sin_tools
    p_ventas = probabilidades.get("ventas", 1.0)
    p_documentos = probabilidades.get("documentos", 1.0)
    ninguna_tool = p_ventas < umbral_tool and p_documentos < umbral_tool

    if ninguna_tool and probabilidades.get("fuera_de_tema", 0.0) >= umbral_sin_tools:
        return RUTA_FUERA_DE_TEMA, frozenset()
    if ninguna_tool and probabilidades.get("saludo", 0.0) >= umbral_sin_tools:
        return RUTA_SALUDO, frozenset()

    tools = frozenset(
        t for t, p in ((TOOL_SQL, p_ventas), (TOOL_DOCUMENTOS, p_documentos)) if p >= umbral_tool
    )
    if not tools:
        # Jev no está seguro de nada -- mejor pagar el prompt completo que
        # adivinar.
        return RUTA_COMPLETA, TODAS_LAS_TOOLS
    return "+".join(sorted(tools)), tools


def enrutar(pregunta: str, historial: list[dict]) -> Decision:
    if not settings.jev_habilitado or not settings.typesafe_api_key:
        return Decision(ruta=RUTA_SIN_ENRUTADOR)

    previos = [m["content"][:500] for m in historial if m.get("role") == "user"][-2:]
    desde = time.monotonic()
    try:
        respuesta = _client.post(
            "/v1/systemone",
            headers={"Authorization": f"Bearer {settings.typesafe_api_key}"},
            json={
                "model": settings.jev_modelo,
                "state": {"current_message": pregunta, "previous_messages": previos},
                "questions": _PREGUNTAS_JEV,
            },
        )
        respuesta.raise_for_status()
        cuerpo = respuesta.json()
        probabilidades = {
            nombre: round(float(r["noul"]), 3)
            for nombre, r in cuerpo.get("answers", {}).items()
            if r.get("type") == "noul"
        }
        tokens = (cuerpo.get("usage") or {}).get("input_tokens")
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        return Decision(
            ruta=RUTA_SIN_ENRUTADOR,
            ms=int((time.monotonic() - desde) * 1000),
            error=f"{type(e).__name__}: {e}"[:300],
        )

    ruta, tools = decidir(probabilidades)
    return Decision(
        ruta=ruta,
        tools=tools,
        probabilidades=probabilidades,
        ms=int((time.monotonic() - desde) * 1000),
        tokens_entrada=tokens,
    )
