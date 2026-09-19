"""Endpoints del area Vendedores (dashboard individual).

Cada endpoint resuelve el vendedor desde el JWT (`require_vendedor`), nunca
desde un parametro de query/body -- un vendedor autenticado solo puede ver
sus propios datos. Ver src/auth.py.
"""
import calendar
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from ..auth import require_vendedor
from ..db import get_connection

router = APIRouter(prefix="/vendedores/me", tags=["vendedores"])


def _rango_fechas(
    modo: str, anio: int, mes: int, anio_iso: int, semana_iso: int
) -> tuple[date, date]:
    """Rango [desde, hasta] segun el modo del filtro -- compartido entre
    /cuota y /ventas para que ambos usen exactamente el mismo criterio de
    "que es la semana/mes actual" (ver ventas.component.ts en el frontend,
    que hace el mismo calculo del lado del cliente para no pedir de mas)."""
    if modo == "semana":
        desde = date.fromisocalendar(anio_iso, semana_iso, 1)
        hasta = desde + timedelta(days=6)
    else:
        ultimo_dia = calendar.monthrange(anio, mes)[1]
        desde = date(anio, mes, 1)
        hasta = date(anio, mes, ultimo_dia)
    return desde, hasta


@router.get("/cuota")
def cuota(
    modo: str = Query(default="mes", pattern="^(mes|semana)$"),
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    anio_iso: int = Query(default_factory=lambda: date.today().isocalendar()[0]),
    semana_iso: int = Query(default_factory=lambda: date.today().isocalendar()[1], ge=1, le=53),
    vendedor: str = Depends(require_vendedor),
):
    """% de cumplimiento de la meta (para el "tachito de pintura").

    `modo=mes` (default) compara contra meta_mensual en el mes indicado;
    `modo=semana` compara contra meta_semanal en la semana ISO indicada --
    son dos metas INDEPENDIENTES configuradas en el panel admin, no una
    derivada de la otra (ver User.java: meta_semanal no es meta_mensual/4).

    Si la meta que aplica no esta configurada, se devuelve
    porcentaje_cumplimiento=None -- el frontend debe mostrar "sin meta
    configurada", nunca un 0% (seria enganoso: no es que no vendio nada, es
    que no hay con que comparar).
    """
    desde, hasta = _rango_fechas(modo, anio, mes, anio_iso, semana_iso)

    with get_connection() as conn:
        meta_row = conn.execute(
            "SELECT meta_mensual, meta_semanal FROM bi.v_vendedores WHERE vendedor_nombre_sap = %s",
            (vendedor,),
        ).fetchone()
        meta_mensual = meta_row["meta_mensual"] if meta_row else None
        meta_semanal = meta_row["meta_semanal"] if meta_row else None
        meta_aplicada = meta_semanal if modo == "semana" else meta_mensual

        venta_row = conn.execute(
            """
            SELECT COALESCE(SUM(total_soles), 0) AS total_soles
            FROM bi.v_ventas_vendedor_dia
            WHERE vendedor = %s AND fecha BETWEEN %s AND %s
            """,
            (vendedor, desde, hasta),
        ).fetchone()
        total_vendido = venta_row["total_soles"] or Decimal("0")

    porcentaje = None
    if meta_aplicada and meta_aplicada > 0:
        # Sin tope en 100: el frontend decide si "llena el tacho" hasta 100%
        # y muestra el excedente aparte, o lo deja pasar de 100 visualmente.
        porcentaje = round(float(total_vendido) / float(meta_aplicada) * 100, 1)

    return {
        "vendedor": vendedor,
        "modo": modo,
        "anio": anio,
        "mes": mes,
        "anio_iso": anio_iso,
        "semana_iso": semana_iso,
        "meta_mensual": meta_mensual,
        "meta_semanal": meta_semanal,
        "meta_aplicada": meta_aplicada,
        "total_vendido": total_vendido,
        "porcentaje_cumplimiento": porcentaje,
    }


@router.get("/ventas")
def ventas(
    modo: str = Query(default="mes", pattern="^(mes|semana)$"),
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    anio_iso: int = Query(default_factory=lambda: date.today().isocalendar()[0]),
    semana_iso: int = Query(default_factory=lambda: date.today().isocalendar()[1], ge=1, le=53),
    vendedor: str = Depends(require_vendedor),
):
    """Ventas dia a dia del vendedor -- base del grafico de barras con el
    filtro arriba en la UI, que por defecto muestra el mes actual
    (`modo=mes`) y se puede cambiar a una semana ISO especifica
    (`modo=semana`, corte lunes-domingo inequivoco sin importar en que mes
    cae cada dia).
    """
    desde, hasta = _rango_fechas(modo, anio, mes, anio_iso, semana_iso)

    with get_connection() as conn:
        filas = conn.execute(
            """
            SELECT fecha, dia_nombre, dia_semana, total_soles, cantidad, numero_lineas
            FROM bi.v_ventas_vendedor_dia
            WHERE vendedor = %s AND fecha BETWEEN %s AND %s
            ORDER BY fecha
            """,
            (vendedor, desde, hasta),
        ).fetchall()

    return {
        "vendedor": vendedor,
        "modo": modo,
        "anio": anio,
        "mes": mes,
        "anio_iso": anio_iso,
        "semana_iso": semana_iso,
        "desde": desde,
        "hasta": hasta,
        "dias": filas,
    }


@router.get("/productos")
def productos(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    orden: str = Query(default="desc", pattern="^(asc|desc)$"),
    limite: int = Query(default=10, le=50),
    vendedor: str = Depends(require_vendedor),
):
    """Producto que mas/menos vendio el vendedor en el mes, por CANTIDAD
    (unidades), no por monto en soles -- lo que importa acá es cuánto se
    movió de cada producto, no su precio.

    PROXY de "linea de producto": dwh.dim_producto no tiene categoria real
    (OITB de SAP) todavia -- ver TODO.md y el comentario en
    bi.v_vendedor_producto_mes. Cuando el batch extraiga categoria, este
    endpoint se re-agrega por categoria en vez de por producto individual.

    Se excluyen productos con cantidad=0: en "menos vendidos" un producto
    con 0 unidades no es información útil (no se vendió, punto), es ruido.
    """
    direccion = "ASC" if orden == "asc" else "DESC"
    with get_connection() as conn:
        filas = conn.execute(
            f"""
            SELECT codigo_producto, producto, total_soles, cantidad
            FROM bi.v_vendedor_producto_mes
            WHERE vendedor = %s AND anio = %s AND mes = %s AND cantidad > 0
            ORDER BY cantidad {direccion}
            LIMIT %s
            """,
            (vendedor, anio, mes, limite),
        ).fetchall()

    return {"vendedor": vendedor, "anio": anio, "mes": mes, "orden": orden, "productos": filas}


@router.get("/clientes-inactivos")
def clientes_inactivos(
    dias_umbral: int = Query(
        default=30,
        ge=1,
        description=(
            "Dias sin comprar (con ESTE vendedor) para considerar al cliente "
            "candidato a reactivacion. Definido con el area de ventas en 30 "
            "dias. Ajustable por query param si se necesita otro corte."
        ),
    ),
    dias_umbral_max: int = Query(
        default=50,
        ge=1,
        description=(
            "Tope de dias sin comprar: mas alla de esto ya no es 'candidato a "
            "reactivacion' (se considera cliente perdido, no un caso a "
            "trabajar ahora) -- se deja de mostrar en esta lista."
        ),
    ),
    compras_minimas: int = Query(
        default=5,
        ge=1,
        description=(
            "Compras historicas minimas (con ESTE vendedor) para considerar "
            "al cliente. Un cliente con 1-2 compras aisladas no tiene un "
            "patron de recompra que se pueda decir que 'se rompio' -- no es "
            "un candidato real a reactivacion, solo ruido."
        ),
    ),
    monto_minimo: float = Query(
        default=1000,
        ge=0,
        description="Monto historico minimo en soles (con ESTE vendedor) para considerar al cliente relevante.",
    ),
    limite: int = Query(default=20, le=100),
    vendedor: str = Depends(require_vendedor),
):
    """Candidatos a reactivacion: clientes que le compraron a ESTE vendedor
    alguna vez, con un historial real de compra (no un caso aislado), pero
    llevan mas de `dias_umbral` dias sin volver a hacerlo.

    Devuelve el dato crudo (determinístico, auditable) -- el TEXTO de la
    recomendacion ("ofrecele X") lo genera el AI Service a partir de esta
    misma lista, no este endpoint. Ver decision de Fase 1: separar el
    calculo (aqui) de la redaccion con LLM (en backend/intelligence/ai).

    NOTA: "cliente del vendedor" = tiene compras historicas con el, no una
    cartera asignada formal (no existe ese concepto en el modelo estrella
    hoy) -- ver comentario en bi.v_cliente_frecuencia_vendedor.
    """
    with get_connection() as conn:
        filas = conn.execute(
            """
            SELECT cliente, ruc, departamento, ultima_compra,
                   dias_desde_ultima_compra, compras_mes_actual,
                   compras_anio_actual, compras_historicas, total_soles_historico
            FROM bi.v_cliente_frecuencia_vendedor
            WHERE vendedor = %s
              AND dias_desde_ultima_compra >= %s
              AND dias_desde_ultima_compra <= %s
              AND compras_historicas > %s
              AND total_soles_historico > %s
            ORDER BY dias_desde_ultima_compra DESC
            LIMIT %s
            """,
            (vendedor, dias_umbral, dias_umbral_max, compras_minimas, monto_minimo, limite),
        ).fetchall()

    return {"vendedor": vendedor, "dias_umbral": dias_umbral, "clientes": filas}


@router.get("/clientes")
def clientes(
    limite: int = Query(default=200, le=1000),
    vendedor: str = Depends(require_vendedor),
):
    """Cartera de clientes del vendedor: TODOS los clientes a los que le ha
    vendido alguna vez (dato real de SAP, no una cartera asignada formal --
    ver nota en bi.v_cliente_frecuencia_vendedor). Base de la pestaña
    "Cartera de Clientes" del dashboard, que antes mostraba datos de ejemplo
    hardcodeados (línea de crédito, contacto) que no existen en el modelo
    estrella hoy.
    """
    with get_connection() as conn:
        filas = conn.execute(
            """
            SELECT cliente, ruc, departamento, ultima_compra,
                   dias_desde_ultima_compra, compras_historicas, total_soles_historico
            FROM bi.v_cliente_frecuencia_vendedor
            WHERE vendedor = %s
            ORDER BY total_soles_historico DESC
            LIMIT %s
            """,
            (vendedor, limite),
        ).fetchall()

    return {"vendedor": vendedor, "clientes": filas}


@router.get("/clientes-top-productos")
def clientes_top_productos(
    anio: int = Query(default_factory=lambda: date.today().year),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    limite: int = Query(default=10, le=50),
    vendedor: str = Depends(require_vendedor),
):
    """Clientes del vendedor que compraron mas productos distintos en el mes.

    Igual limitacion de "cliente del vendedor" que clientes-inactivos: son
    los clientes con compras historicas con ESTE vendedor, no una cartera
    asignada formal (ver bi.v_cliente_productos_mes_vendedor).
    """
    with get_connection() as conn:
        filas = conn.execute(
            """
            SELECT cliente, departamento, productos_distintos, total_soles
            FROM bi.v_cliente_productos_mes_vendedor
            WHERE vendedor = %s AND anio = %s AND mes = %s
            ORDER BY productos_distintos DESC, total_soles DESC
            LIMIT %s
            """,
            (vendedor, anio, mes, limite),
        ).fetchall()

    return {"vendedor": vendedor, "anio": anio, "mes": mes, "clientes": filas}
