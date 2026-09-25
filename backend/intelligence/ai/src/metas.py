"""Metas de venta para el prompt del chat.

Las metas (mensual y semanal, configuradas en el panel admin) no están en el
Data Warehouse ni en las vistas ai.*, así que el LLM no puede consultarlas
con SQL -- sin esto le preguntaba la meta al propio vendedor. Se piden a
backend/reporting con el token del usuario (igual que reporting_client.py):
un vendedor recibe SOLO su meta (/vendedores/me/cuota, resuelta desde su
JWT), gerencia recibe las del equipo (/gerencia/metas-vendedores).

Nunca debe tumbar el chat: si reporting no responde, el prompt dice que la
meta no está disponible y la pregunta sigue.
"""
from decimal import Decimal

import httpx

from .config import settings

_TIMEOUT_S = 3.0


def _soles(monto) -> str:
    return f"S/ {Decimal(str(monto)):,.2f}"


def _get(ruta: str, token: str) -> dict:
    resp = httpx.get(
        f"{settings.reporting_base_url}{ruta}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=_TIMEOUT_S,
    )
    resp.raise_for_status()
    return resp.json()


def _texto_vendedor(token: str) -> str:
    cuota = _get("/vendedores/me/cuota", token)
    mensual, semanal = cuota.get("meta_mensual"), cuota.get("meta_semanal")
    if not mensual and not semanal:
        return ("Este vendedor todavía no tiene meta configurada. Si pregunta por su cumplimiento, díselo "
                "(la configura gerencia desde el panel) -- no inventes una meta.")
    partes = []
    if mensual:
        partes.append(f"{_soles(mensual)} al mes")
    if semanal:
        partes.append(f"{_soles(semanal)} a la semana")
    return (f"Su meta de ventas es {' y '.join(partes)} (en soles, `total_soles`), configurada por gerencia. "
            "Úsala directamente para preguntas de cumplimiento de meta -- no se la preguntes.")


def _texto_gerencia(token: str) -> str:
    vendedores = _get("/gerencia/metas-vendedores", token)["vendedores"]
    if not vendedores:
        return "No hay vendedores con meta configurada."
    lineas = []
    for v in vendedores:
        mensual = _soles(v["meta_mensual"]) if v.get("meta_mensual") else "sin meta"
        semanal = _soles(v["meta_semanal"]) if v.get("meta_semanal") else "sin meta"
        lineas.append(f"- {v['nombre']} (en las vistas, vendedor = '{v['vendedor_nombre_sap']}'): "
                      f"mensual {mensual}, semanal {semanal}")
    return ("Metas de ventas de cada vendedor (en soles, `total_soles`), configuradas en el panel. Úsalas "
            "directamente para preguntas de cumplimiento -- no se las preguntes al usuario:\n" + "\n".join(lineas))


def contexto_metas(token: str | None, es_vendedor: bool) -> str:
    if not token:
        return "La meta de ventas no está disponible en este momento; si hace falta, pídesela al usuario."
    try:
        return _texto_vendedor(token) if es_vendedor else _texto_gerencia(token)
    except (httpx.HTTPError, KeyError, ValueError):
        return "La meta de ventas no está disponible en este momento; si hace falta, pídesela al usuario."
