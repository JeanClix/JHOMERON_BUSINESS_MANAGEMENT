"""Endpoints del dashboard de Gerencia (agregados, sin filtro por vendedor).

FASE 1 (esta semana) -- lo que NO depende de datos que el batch todavia no
extrae:
  - top clientes por productos distintos
  - top productos por facturacion (empresa completa)
  - ticket promedio por cliente
  - tendencia general de ventas
  - mapa de Peru por departamento (monto, sin cruce de linea)

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
