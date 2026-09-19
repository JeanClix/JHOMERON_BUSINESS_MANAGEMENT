"""Endpoints del dashboard de Gerencia (agregados, sin filtro por vendedor).

FASE 1 (esta semana) -- lo que NO depende de datos que el batch todavia no
extrae:
  - top clientes por productos distintos
  - top productos por facturacion (empresa completa)
  - ticket promedio por cliente
  - tendencia general de ventas
  - mapa de Peru por departamento (monto, sin cruce de linea)
  - clientes en riesgo de inactividad, a nivel empresa (ver /clientes-en-riesgo
    abajo) -- version gerencial de /vendedores/me/clientes-inactivos, mismo
    dato crudo (bi.v_cliente_frecuencia en vez de la variante por vendedor)

FASE 2 (bloqueado, ver TODO.md y schema-bi.sql) -- pendiente de que el SP de
extraccion traiga categoria (OITB) y costo:
  - margen bruto operativo / "EBITDA" (en realidad margen, no EBITDA real --
    ver discusion de arquitectura)
  - margen por linea/categoria y por SKU
  - mapa de Peru cruzado con la linea que mas consume cada departamento
Estos NO estan implementados aqui todavia -- se agregan cuando exista
dwh.dim_producto.categoria y el costo en dwh.fact_ventas.

Forecast vs. real (holdout del modelo ML) NO vive aqui -- ver
backend/intelligence/ml/service/main.py, que ya expone el backtest.
"""
from datetime import date

from fastapi import APIRouter, Depends, Query

from ..auth import require_gerencia
from ..db import get_connection

router = APIRouter(prefix="/gerencia", tags=["gerencia"])


@router.get("/top-clientes")
def top_clientes(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    limite: int = Query(default=15, le=100),
    _claims: dict = Depends(require_gerencia),
):
    """Clientes que compraron mas productos distintos en el mes, a nivel
    de toda la empresa (sin distincion de vendedor)."""
    with get_connection() as conn:
        filas = conn.execute(
            """
            SELECT cliente, departamento, productos_distintos, total_soles
            FROM bi.v_cliente_productos_mes
            WHERE anio = %s AND mes = %s
            ORDER BY productos_distintos DESC, total_soles DESC
            LIMIT %s
            """,
            (anio, mes, limite),
        ).fetchall()

    return {"anio": anio, "mes": mes, "clientes": filas}


@router.get("/top-productos")
def top_productos(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    orden: str = Query(default="desc", pattern="^(asc|desc)$"),
    limite: int = Query(default=10, le=50),
    _claims: dict = Depends(require_gerencia),
):
    """Top Productos por Facturacion, a nivel de toda la empresa (sin
    distincion de vendedor) -- ver bi.v_producto_mes."""
    direccion = "ASC" if orden == "asc" else "DESC"
    with get_connection() as conn:
        filas = conn.execute(
            f"""
            SELECT codigo_producto, producto, total_soles, cantidad
            FROM bi.v_producto_mes
            WHERE anio = %s AND mes = %s
            ORDER BY total_soles {direccion}
            LIMIT %s
            """,
            (anio, mes, limite),
        ).fetchall()

    return {"anio": anio, "mes": mes, "orden": orden, "productos": filas}


@router.get("/ticket-promedio")
def ticket_promedio(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    _claims: dict = Depends(require_gerencia),
):
    """Ticket promedio por cliente en el mes: AVG(total_soles) agrupado por
    cliente (no por factura -- fact_ventas no tiene un ID de factura
    confiable, ver comentario en dwh.fact_ventas.linea). Reusa
    bi.v_cliente_productos_mes en vez de crear una vista nueva."""
    with get_connection() as conn:
        fila = conn.execute(
            """
            SELECT AVG(total_soles) AS ticket_promedio, COUNT(*) AS clientes_activos
            FROM bi.v_cliente_productos_mes
            WHERE anio = %s AND mes = %s
            """,
            (anio, mes),
        ).fetchone()

    return {
        "anio": anio,
        "mes": mes,
        "ticket_promedio": fila["ticket_promedio"] if fila else None,
        "clientes_activos": fila["clientes_activos"] if fila else 0,
    }


@router.get("/tendencia-ventas")
def tendencia_ventas(
    anio: int = Query(default_factory=lambda: date.today().year),
    _claims: dict = Depends(require_gerencia),
):
    """Serie mensual de ventas totales del anio, para el grafico general de
    "como van las ventas"."""
    with get_connection() as conn:
        filas = conn.execute(
            """
            SELECT mes, SUM(total_soles) AS total_soles, SUM(numero_lineas) AS numero_lineas
            FROM bi.v_ventas_departamento_mes
            WHERE anio = %s
            GROUP BY mes
            ORDER BY mes
            """,
            (anio,),
        ).fetchall()

    return {"anio": anio, "meses": filas}


@router.get("/mapa-departamentos")
def mapa_departamentos(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int | None = Query(default=None, ge=1, le=12),
    _claims: dict = Depends(require_gerencia),
):
    """Ventas por departamento para el mapa de Peru.

    LIMITACION (Fase 2, ver TODO.md): no incluye "que linea consume mas" por
    departamento -- dwh.dim_producto no tiene categoria todavia. Este
    endpoint solo devuelve monto total y clientes distintos por
    departamento; el cruce con linea se agrega cuando el batch extraiga
    categoria.
    """
    with get_connection() as conn:
        if mes is not None:
            filas = conn.execute(
                """
                SELECT departamento, total_soles, numero_lineas, clientes_distintos
                FROM bi.v_ventas_departamento_mes
                WHERE anio = %s AND mes = %s
                ORDER BY total_soles DESC
                """,
                (anio, mes),
            ).fetchall()
        else:
            filas = conn.execute(
                """
                SELECT departamento,
                       SUM(total_soles) AS total_soles,
                       SUM(numero_lineas) AS numero_lineas,
                       SUM(clientes_distintos) AS clientes_distintos
                FROM bi.v_ventas_departamento_mes
                WHERE anio = %s
                GROUP BY departamento
                ORDER BY total_soles DESC
                """,
                (anio,),
            ).fetchall()

    return {"anio": anio, "mes": mes, "departamentos": filas}


@router.get("/clientes-en-riesgo")
def clientes_en_riesgo(
    dias_umbral: int = Query(
        default=30,
        ge=1,
        description="Dias sin comprar (con CUALQUIER vendedor) para considerar al cliente en riesgo de inactividad. Mismo corte que /vendedores/me/clientes-inactivos.",
    ),
    dias_umbral_max: int = Query(
        default=50,
        ge=1,
        description="Tope de dias sin comprar: mas alla de esto se considera cliente perdido, no un caso a priorizar ahora.",
    ),
    dias_compra_minimos: int = Query(
        default=5,
        ge=1,
        description=(
            "Dias distintos con compra (historico) minimos para considerar al cliente. "
            "bi.v_cliente_frecuencia no trackea numero de transacciones, solo dias "
            "distintos de compra -- un cliente con 1-2 dias de compra aislados no tiene "
            "un patron de recompra que se pueda decir que 'se rompio'."
        ),
    ),
    monto_minimo: float = Query(default=1000, ge=0, description="Monto historico minimo en soles para considerar al cliente relevante."),
    limite: int = Query(default=20, le=100),
    _claims: dict = Depends(require_gerencia),
):
    """Clientes en riesgo de inactividad a nivel de TODA la empresa (sin
    distincion de vendedor) -- version gerencial de
    /vendedores/me/clientes-inactivos, sobre bi.v_cliente_frecuencia en vez
    de la variante acotada a un vendedor. Igual que alla, se devuelve el dato
    crudo (deterministico, auditable); la redaccion de una recomendacion con
    LLM es una decision de otra capa, no de este endpoint.

    Ademas del listado (acotado por `limite`, ordenado por monto historico
    para priorizar los casos con mas en juego), se devuelve el TOTAL de
    clientes en riesgo y el monto agregado en riesgo -- sin el limite -- para
    poder mostrar un KPI ("42 clientes en riesgo, S/ 180,000 en juego") sin
    tener que traer la lista completa.
    """
    with get_connection() as conn:
        resumen = conn.execute(
            """
            SELECT COUNT(*) AS total_clientes, COALESCE(SUM(total_soles_historico), 0) AS monto_en_riesgo
            FROM bi.v_cliente_frecuencia
            WHERE dias_desde_ultima_compra >= %s
              AND dias_desde_ultima_compra <= %s
              AND dias_distintos_compra_historico > %s
              AND total_soles_historico > %s
            """,
            (dias_umbral, dias_umbral_max, dias_compra_minimos, monto_minimo),
        ).fetchone()

        filas = conn.execute(
            """
            SELECT cliente, ruc, departamento, ultima_compra,
                   dias_desde_ultima_compra, dias_distintos_compra_historico,
                   total_soles_historico
            FROM bi.v_cliente_frecuencia
            WHERE dias_desde_ultima_compra >= %s
              AND dias_desde_ultima_compra <= %s
              AND dias_distintos_compra_historico > %s
              AND total_soles_historico > %s
            ORDER BY total_soles_historico DESC
            LIMIT %s
            """,
            (dias_umbral, dias_umbral_max, dias_compra_minimos, monto_minimo, limite),
        ).fetchall()

    return {
        "dias_umbral": dias_umbral,
        "dias_umbral_max": dias_umbral_max,
        "total_clientes_en_riesgo": resumen["total_clientes"],
        "monto_en_riesgo_soles": resumen["monto_en_riesgo"],
        "clientes": filas,
    }
