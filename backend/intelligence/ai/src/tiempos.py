"""Medición de tiempos del chat: dónde se va la latencia de cada pregunta.

Una TrazaTiempos por request a /chat. Separa lo que tarda el LLM de verdad
(llm_ms), lo que se pierde esperando por rate limit (espera_rate_limit_ms,
ver agent._completar_con_reintento) y lo que tardan las tools (SQL / RAG,
este último incluye la llamada de embeddings). Así se puede decidir con
números si conviene cambiar de proveedor, pagar un tier con más cupo o
recortar rondas de tool-calling.

Cada traza se agrega como una línea JSON a settings.tiempos_log_path (vacío
= desactivado) y se imprime un resumen de una línea en la consola de
uvicorn. Resumen agregado: python -m scripts.resumen_tiempos.
"""
import json
import logging
import time
from datetime import datetime
from pathlib import Path

from .config import settings

_logger = logging.getLogger("jhomeron.ai.tiempos")
_logger.setLevel(logging.INFO)
if not _logger.handlers:
    # uvicorn no configura el root logger -- sin handler propio el INFO no
    # sale por consola.
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("TIEMPOS  %(message)s"))
    _logger.addHandler(_handler)
    _logger.propagate = False


def _ms(desde: float) -> int:
    return int((time.monotonic() - desde) * 1000)


class TrazaTiempos:
    def __init__(self, pregunta: str, rol: str | None, historial_mensajes: int):
        self._inicio = time.monotonic()
        self.datos: dict = {
            "fecha": datetime.now().isoformat(timespec="seconds"),
            "modelo": settings.llm_model,
            "proveedor": "anthropic" if settings.llm_provider == "anthropic" else settings.llm_base_url,
            "rol": rol,
            "pregunta": pregunta[:200],
            "historial_mensajes": historial_mensajes,
            "rondas": [],
        }

    def nueva_ronda(self) -> dict:
        ronda = {
            "llm_ms": 0,
            "espera_rate_limit_ms": 0,
            "reintentos": 0,
            "tokens_entrada": None,
            "tokens_salida": None,
            "tokens_razonamiento": None,
            "tools": [],
        }
        self.datos["rondas"].append(ronda)
        return ronda

    @staticmethod
    def registrar_uso(ronda: dict, respuesta) -> None:
        """Tokens tal cual los reporta el proveedor (OpenAI-compatible). El
        detalle de razonamiento no lo mandan todos -- queda None."""
        uso = getattr(respuesta, "usage", None)
        if not uso:
            return
        ronda["tokens_entrada"] = uso.prompt_tokens
        ronda["tokens_salida"] = uso.completion_tokens
        detalle = getattr(uso, "completion_tokens_details", None)
        ronda["tokens_razonamiento"] = getattr(detalle, "reasoning_tokens", None) if detalle else None

    @staticmethod
    def registrar_tool(ronda: dict, nombre: str, desde: float, error: bool) -> None:
        ronda["tools"].append({"nombre": nombre, "ms": _ms(desde), "error": error})

    def cerrar(self, exito: bool, error: str | None = None) -> None:
        rondas = self.datos["rondas"]
        self.datos.update({
            "exito": exito,
            "error": error[:300] if error else None,
            "total_ms": _ms(self._inicio),
            "num_rondas": len(rondas),
            "llm_ms": sum(r["llm_ms"] for r in rondas),
            "espera_rate_limit_ms": sum(r["espera_rate_limit_ms"] for r in rondas),
            "tools_ms": sum(t["ms"] for r in rondas for t in r["tools"]),
            "tokens_entrada": sum(r["tokens_entrada"] or 0 for r in rondas),
            "tokens_salida": sum(r["tokens_salida"] or 0 for r in rondas),
        })
        d = self.datos
        d["otros_ms"] = d["total_ms"] - d["llm_ms"] - d["espera_rate_limit_ms"] - d["tools_ms"]
        # La medición nunca debe tumbar una respuesta del chat.
        try:
            self._emitir()
        except Exception as e:  # noqa: BLE001
            _logger.warning("no se pudo registrar la traza: %s", e)

    def _emitir(self) -> None:
        d = self.datos
        _logger.info(
            "total=%dms rondas=%d llm=%dms espera_rl=%dms tools=%dms otros=%dms tokens=%d/%d exito=%s",
            d["total_ms"], d["num_rondas"], d["llm_ms"], d["espera_rate_limit_ms"], d["tools_ms"],
            d["otros_ms"], d["tokens_entrada"], d["tokens_salida"], d["exito"],
        )
        if settings.tiempos_log_path:
            ruta = Path(settings.tiempos_log_path)
            ruta.parent.mkdir(parents=True, exist_ok=True)
            with ruta.open("a", encoding="utf-8") as f:
                f.write(json.dumps(d, ensure_ascii=False) + "\n")
