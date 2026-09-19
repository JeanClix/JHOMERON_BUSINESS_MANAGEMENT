"""Redacta la recomendacion en lenguaje natural de reactivacion de clientes.

El CALCULO de quien es candidato (dias sin comprar, historico con ese
vendedor) viene de backend/reporting, no de aqui -- es determinístico y
auditable. Este modulo es la unica pieza de la Fase 1 de Vendedores que sí
necesita LLM: redactar 1-2 frases accionables no es una GROUP BY.
"""
import json
import time

from openai import OpenAI

from .audit import registrar_consulta
from .config import settings

_client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

_PROMPT_SISTEMA = """Eres un asistente comercial de JHOMERON (fabricante de pinturas \
industriales, Peru). Se te da una lista de clientes que llevan tiempo sin \
comprarle a un vendedor especifico. Para cada cliente, redacta una \
recomendacion breve (1-2 frases, en espanol, tono directo y accionable) de \
que puede hacer el vendedor para reactivarlo: menciona cuanto tiempo lleva \
sin comprar y sugiere una accion concreta (llamarlo, visitarlo, ofrecerle \
una promocion). NO inventes productos ni datos que no esten en la lista \
que te paso el usuario. Responde UNICAMENTE con un JSON (sin \
texto alrededor, sin \\`\\`\\`): una lista de objetos \
{"cliente": <nombre EXACTO tal cual viene en la lista>, "recomendacion": <texto>}."""


def generar_recomendaciones(vendedor: str, clientes: list[dict]) -> list[dict]:
    """clientes: filas de bi.v_cliente_frecuencia_vendedor (via reporting).
    Devuelve la misma lista con un campo "recomendacion" agregado.

    Si el LLM falla o devuelve algo no parseable, cae a un texto generico
    en vez de romper el endpoint -- mismo criterio de "defensa en
    profundidad, nunca inventar en silencio" que tools.py."""
    if not clientes:
        return []

    inicio = time.monotonic()
    entrada = json.dumps(
        [
            {
                "cliente": c["cliente"],
                "dias_desde_ultima_compra": c["dias_desde_ultima_compra"],
                "ultima_compra": str(c["ultima_compra"]),
                "total_soles_historico": float(c["total_soles_historico"]),
            }
            for c in clientes
        ],
        ensure_ascii=False,
    )

    respuesta_llm: str | None = None
    error: str | None = None
    recomendaciones_por_cliente: dict[str, str] = {}

    try:
        respuesta = _client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": _PROMPT_SISTEMA},
                {"role": "user", "content": entrada},
            ],
            max_tokens=1536,
        )
        respuesta_llm = respuesta.choices[0].message.content or ""
        parsed = json.loads(_extraer_json(respuesta_llm))
        for item in parsed:
            if isinstance(item, dict) and "cliente" in item and "recomendacion" in item:
                recomendaciones_por_cliente[item["cliente"]] = item["recomendacion"]
    except Exception as e:
        error = str(e)

    duracion_ms = int((time.monotonic() - inicio) * 1000)
    # Reusa ai.consulta_log para trazabilidad (mismo criterio que /chat):
    # no hay SQL generado aqui (el dato viene de reporting), pero queda
    # registrado que se genero una recomendacion, para que, con el LLM.
    registrar_consulta(
        pregunta_usuario=f"[reactivacion] vendedor={vendedor}, clientes={len(clientes)}",
        sql_generado=None,
        filas_retornadas=len(clientes),
        respuesta_llm=respuesta_llm,
        modelo=settings.llm_model,
        exito=error is None,
        error=error,
        duracion_ms=duracion_ms,
    )

    resultado = []
    for c in clientes:
        recomendacion = recomendaciones_por_cliente.get(
            c["cliente"],
            f"Sin compras hace {c['dias_desde_ultima_compra']} dias -- contactar para reactivar.",
        )
        resultado.append({**c, "recomendacion": recomendacion})
    return resultado


def _extraer_json(texto: str) -> str:
    """Algunos modelos envuelven el JSON en bloque de codigo pese a que se
    pide 'unicamente JSON' -- se recorta antes de parsear."""
    texto = texto.strip()
    if texto.startswith("```"):
        texto = texto.strip("`")
        if texto.lower().startswith("json"):
            texto = texto[4:]
    return texto.strip()
