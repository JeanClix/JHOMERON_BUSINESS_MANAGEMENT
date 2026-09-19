"""Cliente HTTP hacia backend/reporting: trae los clientes inactivos del
vendedor autenticado (dato crudo, deterministico -- ver
bi.v_cliente_frecuencia_vendedor) para que este servicio solo se encargue de
REDACTAR la recomendacion. Decision de Fase 1: separar el calculo
(reporting, auditable/reproducible) de la redaccion con LLM (aqui, en
recomendaciones.py) -- ver backend/reporting/README.md.

El token del vendedor se reenvia tal cual (no se vuelve a emitir ni se
inspecciona aqui) -- reporting es quien decide, con su propia copia del
JWT_SECRET, si el token es valido y de que vendedor es.
"""
import httpx

from .config import settings


class ReportingClientError(Exception):
    pass


def obtener_clientes_inactivos(token: str, dias_umbral: int = 45, limite: int = 15) -> list[dict]:
    try:
        resp = httpx.get(
            f"{settings.reporting_base_url}/vendedores/me/clientes-inactivos",
            params={"dias_umbral": dias_umbral, "limite": limite},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise ReportingClientError(
            f"reporting respondio {e.response.status_code}: {e.response.text}"
        ) from e
    except httpx.HTTPError as e:
        raise ReportingClientError(f"No se pudo contactar a reporting: {e}") from e

    return resp.json()["clientes"]
