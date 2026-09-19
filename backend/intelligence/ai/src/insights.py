"""Genera las "Oportunidades de Mejora" del dashboard de gerencia UNA VEZ por
periodo (mes), no en cada visita -- ver ai.insight_mensual (schema-ai.sql) y
el scheduler en main.py.

Diseño pensado para gastar pocos tokens y no dejar que el LLM invente cifras:
  1. Python calcula un puñado de "señales candidatas" con SQL determinístico
     sobre ai.v_ventas / ai.v_ventas_mensual_departamento (producto que más
     creció/cayó, departamento que más creció/cayó, tendencia general, y --
     si el ML Service responde -- el producto con mayor caída proyectada).
     Cada señal ya trae armado su "widget" (kpi_row o bar_chart) con los
     datos reales, en el mismo formato que ya entienden KpiCardComponent /
     BusinessChartComponent del frontend.
  2. UNA sola llamada al LLM recibe la lista de señales (en texto plano, sin
     tool-calling) y solo tiene que: elegir 3, ordenarlas, y redactar
     título/resumen/categoría/impacto/recomendación -- nunca cifras nuevas.
  3. El widget final que se persiste es el que Python ya calculó para esa
     señal, no algo que el LLM haya devuelto -- así una alucinación del LLM
     como mucho arruina el texto, nunca el dato mostrado.
"""
import calendar
import json
import re
from datetime import date

import httpx

from .config import settings
from .db import get_connection

_ML_SERVICE_URL = "http://localhost:8091"

_SYSTEM_PROMPT_INSIGHTS = """Eres un analista de gerencia de JHOMERON (fábrica de pinturas). Se te
da una lista de señales candidatas, cada una YA CALCULADA con datos reales del Data Warehouse (no las
inventes ni las cambies). Tu trabajo es:

1. Elegir EXACTAMENTE 3 señales (las más relevantes para que gerencia actúe esta semana).
2. Ordenarlas de más a menos relevante.
3. Para cada una, redactar en español: un título corto (máx 8 palabras), un resumen de 1-2 frases,
   una categoría (una de: ventas, marina, rentabilidad), un nivel de impacto (uno de: alto, oportunidad,
   alerta) y una recomendación gerencial concreta y accionable (1 frase).

Responde ÚNICAMENTE con un array JSON de 3 objetos, sin texto adicional antes o después, con estas
claves exactas: "senal_id", "categoria", "impacto", "titulo", "resumen", "recomendacion".
El "senal_id" DEBE ser exactamente uno de los ids que se te dieron en la lista de señales."""


def _mes_anterior(anio: int, mes: int) -> tuple[int, int]:
    return (anio - 1, 12) if mes == 1 else (anio, mes - 1)


def _formato_soles(valor: float) -> str:
    return f"S/ {valor:,.0f}".replace(",", " ")


def _kpi_widget(id_: str, titulo: str, subtitulo: str, actual: float, anterior: float, icon: str) -> dict:
    cambio_pct = round(((actual - anterior) / anterior) * 100, 1) if anterior else None
    tipo = "neutral" if cambio_pct is None else ("increase" if cambio_pct >= 0 else "decrease")
    return {
        "widget_tipo": "kpi_row",
        "widget_payload": {
            "kpis": [{
                "id": id_,
                "title": titulo,
                "value": _formato_soles(actual),
                "subtitle": subtitulo,
                "numericValue": actual,
                "changePercent": cambio_pct if cambio_pct is not None else 0,
                "changeType": tipo,
                "comparisonLabel": "vs mes anterior" if cambio_pct is not None else "sin dato del mes anterior",
                "icon": icon,
                "colorTheme": "emerald" if tipo == "increase" else ("red" if tipo == "decrease" else "slate"),
            }]
        },
    }


def _rango_comparacion(conn, anio: int, mes: int) -> tuple[date, date, date, date, bool]:
    """Calcula los rangos [desde, hasta] de "mes actual" y "mismo rango del
    mes anterior" a comparar. Si `mes` es el mes EN CURSO (según la última
    fecha real que trae el batch), ambos rangos se acotan al mismo día del
    mes -- comparar un mes parcial (ej. 10 días) contra uno completo (31
    días) infla artificialmente cualquier "caída" que se detecte. Si `mes`
    ya cerró, se compara mes completo vs mes completo."""
    anio_ant, mes_ant = _mes_anterior(anio, mes)
    ultima_fecha = conn.execute("SELECT MAX(fecha) AS f FROM ai.v_ventas").fetchone()["f"]

    ultimo_dia_mes = calendar.monthrange(anio, mes)[1]
    es_mes_en_curso = bool(ultima_fecha) and ultima_fecha.year == anio and ultima_fecha.month == mes
    dia_corte = ultima_fecha.day if es_mes_en_curso else ultimo_dia_mes

    ultimo_dia_mes_ant = calendar.monthrange(anio_ant, mes_ant)[1]
    desde_actual = date(anio, mes, 1)
    hasta_actual = date(anio, mes, min(dia_corte, ultimo_dia_mes))
    desde_anterior = date(anio_ant, mes_ant, 1)
    hasta_anterior = date(anio_ant, mes_ant, min(dia_corte, ultimo_dia_mes_ant))
    return desde_actual, hasta_actual, desde_anterior, hasta_anterior, es_mes_en_curso


def _calcular_senales(anio: int, mes: int) -> tuple[dict[str, str], dict[str, dict]]:
    """Devuelve (descripciones_para_el_llm, widgets_por_id). Nunca falla por
    completo si algo puntual no tiene datos -- simplemente esa señal no se
    agrega a la lista de candidatas."""
    descripciones: dict[str, str] = {}
    widgets: dict[str, dict] = {}

    with get_connection() as conn:
        da, ha, dan, han, es_parcial = _rango_comparacion(conn, anio, mes)
        nota_parcial = f" (en lo que va del mes, hasta el día {ha.day})" if es_parcial else ""

        # --- Producto que más creció / más cayó (mínimo S/ 1000 para no
        # levantar ruido de productos casi sin ventas, mismo criterio que el
        # ML Service para su ranking de caída proyectada). Se compara por
        # rango de FECHAS (no anio/mes) para poder alinear el corte de día
        # cuando el mes está en curso -- ver _rango_comparacion. ---
        filas = conn.execute(
            """
            WITH actual AS (
                SELECT codigo_producto, MAX(producto) AS producto, SUM(total_soles) AS total_actual
                FROM ai.v_ventas WHERE fecha BETWEEN %(da)s AND %(ha)s GROUP BY codigo_producto
            ), anterior AS (
                SELECT codigo_producto, MAX(producto) AS producto, SUM(total_soles) AS total_anterior
                FROM ai.v_ventas WHERE fecha BETWEEN %(dan)s AND %(han)s GROUP BY codigo_producto
            )
            SELECT COALESCE(a.codigo_producto, an.codigo_producto) AS codigo_producto,
                   COALESCE(a.producto, an.producto) AS producto,
                   COALESCE(a.total_actual, 0) AS total_actual,
                   COALESCE(an.total_anterior, 0) AS total_anterior
            FROM actual a
            FULL OUTER JOIN anterior an ON an.codigo_producto = a.codigo_producto
            WHERE COALESCE(a.total_actual, 0) >= 1000 OR COALESCE(an.total_anterior, 0) >= 1000
            """,
            {"da": da, "ha": ha, "dan": dan, "han": han},
        ).fetchall()
        # psycopg devuelve NUMERIC como Decimal -- se castea a float ya acá
        # para no arrastrar Decimal hasta json.dumps() del widget_payload.
        filas = [dict(f, total_actual=float(f["total_actual"]), total_anterior=float(f["total_anterior"])) for f in filas]

        if filas:
            mayor_crecimiento = max(filas, key=lambda f: f["total_actual"] - f["total_anterior"])
            mayor_caida = min(filas, key=lambda f: f["total_actual"] - f["total_anterior"])

            if mayor_crecimiento["total_actual"] > mayor_crecimiento["total_anterior"]:
                descripciones["prod_crecimiento"] = (
                    f'Producto con mayor crecimiento en ventas{nota_parcial}: '
                    f'"{mayor_crecimiento["producto"]}" pasó de {_formato_soles(mayor_crecimiento["total_anterior"])} '
                    f'a {_formato_soles(mayor_crecimiento["total_actual"])} (mismo rango de días del mes anterior).'
                )
                widgets["prod_crecimiento"] = _kpi_widget(
                    "kpi-insight-prod-crecimiento", mayor_crecimiento["producto"][:40], "Producto en crecimiento",
                    mayor_crecimiento["total_actual"], mayor_crecimiento["total_anterior"] or mayor_crecimiento["total_actual"],
                    "fa-solid fa-arrow-trend-up",
                )

            if mayor_caida["total_actual"] < mayor_caida["total_anterior"]:
                descripciones["prod_caida"] = (
                    f'Producto con mayor caída en ventas{nota_parcial}: '
                    f'"{mayor_caida["producto"]}" bajó de {_formato_soles(mayor_caida["total_anterior"])} '
                    f'a {_formato_soles(mayor_caida["total_actual"])} (mismo rango de días del mes anterior).'
                )
                widgets["prod_caida"] = _kpi_widget(
                    "kpi-insight-prod-caida", mayor_caida["producto"][:40], "Producto en caída",
                    mayor_caida["total_actual"], mayor_caida["total_anterior"], "fa-solid fa-arrow-trend-down",
                )

        # --- Departamento que más creció / más cayó, y tendencia general --
        # agregado directo de ai.v_ventas por el mismo rango de fechas de
        # arriba (no ai.v_ventas_mensual_departamento: esa vista está
        # pre-agregada por mes calendario completo y no permite alinear el
        # corte de día cuando el mes está en curso). ---
        filas_dep_actual = conn.execute(
            "SELECT departamento, SUM(total_soles) AS total FROM ai.v_ventas WHERE fecha BETWEEN %(da)s AND %(ha)s GROUP BY departamento",
            {"da": da, "ha": ha},
        ).fetchall()
        filas_dep_anterior = conn.execute(
            "SELECT departamento, SUM(total_soles) AS total FROM ai.v_ventas WHERE fecha BETWEEN %(dan)s AND %(han)s GROUP BY departamento",
            {"dan": dan, "han": han},
        ).fetchall()

        por_depto: dict[str, dict[str, float]] = {}
        for f in filas_dep_actual:
            por_depto.setdefault(f["departamento"], {"actual": 0.0, "anterior": 0.0})["actual"] += float(f["total"])
        for f in filas_dep_anterior:
            por_depto.setdefault(f["departamento"], {"actual": 0.0, "anterior": 0.0})["anterior"] += float(f["total"])

        if por_depto:
            deltas = [(dep, v["actual"] - v["anterior"], v) for dep, v in por_depto.items()]
            dep_crece, _, v_crece = max(deltas, key=lambda x: x[1])
            dep_cae, _, v_cae = min(deltas, key=lambda x: x[1])

            if v_crece["actual"] > v_crece["anterior"]:
                descripciones["dep_crecimiento"] = (
                    f'Departamento con mayor crecimiento{nota_parcial}: "{dep_crece}" pasó de '
                    f'{_formato_soles(v_crece["anterior"])} a {_formato_soles(v_crece["actual"])} (mismo rango de días del mes anterior).'
                )
                widgets["dep_crecimiento"] = _kpi_widget(
                    "kpi-insight-dep-crecimiento", dep_crece, "Departamento en crecimiento",
                    v_crece["actual"], v_crece["anterior"] or v_crece["actual"], "fa-solid fa-map-location-dot",
                )

            if v_cae["actual"] < v_cae["anterior"] and dep_cae != dep_crece:
                descripciones["dep_caida"] = (
                    f'Departamento con mayor caída{nota_parcial}: "{dep_cae}" bajó de '
                    f'{_formato_soles(v_cae["anterior"])} a {_formato_soles(v_cae["actual"])} (mismo rango de días del mes anterior).'
                )
                widgets["dep_caida"] = _kpi_widget(
                    "kpi-insight-dep-caida", dep_cae, "Departamento en caída",
                    v_cae["actual"], v_cae["anterior"], "fa-solid fa-map-location-dot",
                )

            total_actual = sum(v["actual"] for v in por_depto.values())
            total_anterior = sum(v["anterior"] for v in por_depto.values())
            if total_anterior > 0:
                cambio = round(((total_actual - total_anterior) / total_anterior) * 100, 1)
                descripciones["tendencia_general"] = (
                    f'Ventas totales de la empresa{nota_parcial}: {_formato_soles(total_actual)} vs '
                    f'{_formato_soles(total_anterior)} en el mismo rango de días del mes anterior '
                    f'({"+" if cambio >= 0 else ""}{cambio}%).'
                )
                widgets["tendencia_general"] = {
                    "widget_tipo": "bar_chart",
                    "widget_payload": {
                        "chart": {
                            "id": "chart-insight-tendencia",
                            "title": "Ventas Totales: Mes Anterior vs Actual",
                            "type": "bar",
                            "labels": ["Mes anterior", "Mes actual"],
                            "datasets": [{
                                "label": "Ventas (S/)",
                                "data": [total_anterior, total_actual],
                                "backgroundColor": ["#94a3b8", "#0d3393"],
                                "borderWidth": 0,
                            }],
                        }
                    },
                }

    # --- Producto con mayor caída proyectada, según el ML Service (best
    # effort: si el servicio no responde, esta señal simplemente no aparece). ---
    try:
        resp = httpx.get(f"{_ML_SERVICE_URL}/predict/productos", params={"dias": 30, "top": 1}, timeout=8.0)
        resp.raise_for_status()
        caida = resp.json().get("mayor_caida_proyectada") or []
        if caida:
            p = caida[0]
            descripciones["ml_caida_proyectada"] = (
                f'El modelo de Machine Learning proyecta que "{p["producto"]}" va a caer de '
                f'{_formato_soles(p["ventas_actuales_soles"])} a {_formato_soles(p["prediccion_soles"])} '
                f'en los próximos 30 días ({p["cambio_pct"]}%).'
            )
            widgets["ml_caida_proyectada"] = _kpi_widget(
                "kpi-insight-ml-caida", p["producto"][:40], "Caída proyectada por ML (próx. 30 días)",
                p["prediccion_soles"], p["ventas_actuales_soles"], "fa-solid fa-robot",
            )
    except (httpx.HTTPError, KeyError, ValueError):
        pass

    return descripciones, widgets


def _extraer_json(texto: str) -> list[dict]:
    """El LLM a veces envuelve el JSON en ```json ... ``` pese a que se le
    pide que no lo haga -- se extrae el primer array balanceado como fallback."""
    texto = texto.strip()
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\[.*\]", texto, re.DOTALL)
    if not m:
        raise ValueError(f"El LLM no devolvió un JSON array válido: {texto[:200]!r}")
    return json.loads(m.group(0))


def generar_insights(anio: int | None = None, mes: int | None = None) -> list[dict]:
    """Calcula señales reales, le pide al LLM que elija/redacte 3, y
    persiste el resultado en ai.insight_mensual (reemplazando lo que hubiera
    para ese período). Devuelve las filas insertadas."""
    from openai import OpenAI  # import local para no acoplar este módulo al cliente si no se usa

    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month

    descripciones, widgets = _calcular_senales(anio, mes)
    if not descripciones:
        return []

    lista_senales = "\n".join(f'- id="{k}": {v}' for k, v in descripciones.items())
    mensajes = [
        {"role": "system", "content": _SYSTEM_PROMPT_INSIGHTS},
        {"role": "user", "content": f"Señales candidatas de {mes}/{anio}:\n{lista_senales}"},
    ]

    client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)
    respuesta = client.chat.completions.create(
        model=settings.llm_model,
        messages=mensajes,
        # Igual que en agent.py: algunos modelos consumen parte del
        # presupuesto en razonamiento antes del JSON final -- con poco
        # margen la respuesta queda truncada a mitad del array.
        max_tokens=2048,
    )
    elegidas = _extraer_json(respuesta.choices[0].message.content or "[]")[:3]

    filas_finales = []
    for orden, item in enumerate(elegidas, start=1):
        senal_id = item.get("senal_id")
        widget = widgets.get(senal_id, {"widget_tipo": "ninguno", "widget_payload": None})
        filas_finales.append({
            "anio": anio,
            "mes": mes,
            "orden": orden,
            "categoria": item.get("categoria", "ventas"),
            "impacto": item.get("impacto", "oportunidad"),
            "titulo": item.get("titulo", "Oportunidad detectada"),
            "resumen": item.get("resumen", ""),
            "recomendacion": item.get("recomendacion", ""),
            "widget_tipo": widget["widget_tipo"],
            "widget_payload": widget["widget_payload"],
        })

    if not filas_finales:
        return []

    with get_connection() as conn:
        conn.execute("DELETE FROM ai.insight_mensual WHERE anio = %s AND mes = %s", (anio, mes))
        for fila in filas_finales:
            conn.execute(
                """
                INSERT INTO ai.insight_mensual
                    (anio, mes, orden, categoria, impacto, titulo, resumen, recomendacion, widget_tipo, widget_payload)
                VALUES (%(anio)s, %(mes)s, %(orden)s, %(categoria)s, %(impacto)s, %(titulo)s, %(resumen)s,
                        %(recomendacion)s, %(widget_tipo)s, %(widget_payload)s)
                """,
                {**fila, "widget_payload": json.dumps(fila["widget_payload"]) if fila["widget_payload"] else None},
            )
        conn.commit()

    return filas_finales


def obtener_insights_actuales() -> list[dict]:
    """Últimas 3 oportunidades persistidas (del período más reciente que
    tenga filas) -- lo que lee el dashboard, sin llamar al LLM."""
    with get_connection() as conn:
        fila_periodo = conn.execute(
            "SELECT anio, mes FROM ai.insight_mensual ORDER BY anio DESC, mes DESC LIMIT 1"
        ).fetchone()
        if not fila_periodo:
            return []
        filas = conn.execute(
            """
            SELECT anio, mes, orden, categoria, impacto, titulo, resumen, recomendacion,
                   widget_tipo, widget_payload, generado_en
            FROM ai.insight_mensual
            WHERE anio = %s AND mes = %s
            ORDER BY orden
            """,
            (fila_periodo["anio"], fila_periodo["mes"]),
        ).fetchall()
    return filas
