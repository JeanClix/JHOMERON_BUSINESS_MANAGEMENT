"""AI Service de JHOMERON: asistente de gerencia sobre el Data Warehouse
de ventas, vía Text-to-SQL + tool-calling (no RAG, ver README de esta carpeta).
"""
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import APIStatusError
from pydantic import BaseModel

from .agent import _es_rate_limit, responder_pregunta
from .auth import get_bearer_token, get_current_claims, require_gerencia, require_vendedor, resolve_chat_identity
from .insights import generar_insights, obtener_insights_actuales
from .recomendaciones import generar_recomendaciones
from .reporting_client import ReportingClientError, obtener_clientes_inactivos

app = FastAPI(title="JHOMERON AI Service", version="0.1.0")

_scheduler = BackgroundScheduler()


@app.on_event("startup")
def _iniciar_scheduler_insights():
    """Refresca las oportunidades de gerencia el dia 1 de cada mes. Best
    effort: si el servicio no esta corriendo justo en ese momento, no se
    dispara -- para eso existe POST /insights/generar como respaldo manual
    (boton "Actualizar ahora" en el dashboard de gerencia)."""
    _scheduler.add_job(generar_insights, "cron", day=1, hour=3, id="insights_mensual", replace_existing=True)
    _scheduler.start()

# El frontend Angular (dev server) corre en otro origen (localhost:4200).
# Solo se habilitan los orígenes de desarrollo conocidos; en producción
# esto debería restringirse al dominio real del frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class PreguntaRequest(BaseModel):
    pregunta: str


class RespuestaResponse(BaseModel):
    respuesta: str
    sql_generado: str | None = None
    filas_retornadas: int | None = None
    # Filas crudas de la última consulta exitosa (para que el frontend pueda
    # mostrar una tabla/gráfico además del texto). None si no se ejecutó SQL.
    datos: list[dict] | None = None
    duracion_ms: int


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat", response_model=RespuestaResponse)
def chat(
    request: PreguntaRequest,
    vendedor: str | None = Depends(resolve_chat_identity),
    claims: dict = Depends(get_current_claims),
):
    """Requiere JWT (ver resolve_chat_identity): un VENDEDOR solo puede
    consultar sus propias ventas (ai.v_ventas_vendedor, forzado en tools.py),
    GERENCIA/ADMIN accede a los agregados de toda la empresa. `claims` es el
    mismo JWT ya decodificado (FastAPI cachea la dependencia dentro del
    request, no se vuelve a parsear) -- solo se usa para el nombre con el
    que saluda el asistente, nunca para autorización."""
    try:
        return responder_pregunta(request.pregunta, vendedor=vendedor, nombre=claims.get("name"))
    except APIStatusError as e:
        if _es_rate_limit(e):
            raise HTTPException(
                status_code=503,
                detail="El asistente está muy solicitado en este momento. Espera unos segundos y vuelve a intentar.",
            )
        raise HTTPException(status_code=502, detail=f"Error del asistente de IA: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error del asistente de IA: {e}")


@app.get("/recomendaciones/reactivacion")
def recomendaciones_reactivacion(
    dias_umbral: int = 45,
    limite: int = 15,
    token: str = Depends(get_bearer_token),
    vendedor: str = Depends(require_vendedor),
):
    """Candidatos a reactivacion del vendedor autenticado + recomendacion
    redactada por el LLM. El calculo de quien es candidato viene de
    backend/reporting (ver reporting_client.py); este endpoint solo agrega
    el texto -- ver recomendaciones.py.
    """
    try:
        clientes = obtener_clientes_inactivos(token, dias_umbral=dias_umbral, limite=limite)
    except ReportingClientError as e:
        raise HTTPException(status_code=502, detail=f"Error consultando reporting: {e}")

    recomendaciones = generar_recomendaciones(vendedor, clientes)
    return {"vendedor": vendedor, "dias_umbral": dias_umbral, "clientes": recomendaciones}


@app.get("/insights/actual")
def insights_actual(_claims: dict = Depends(require_gerencia)):
    """Últimas oportunidades de mejora ya persistidas -- ver insights.py.
    No llama al LLM (por eso no hay parámetro de período: siempre es lo
    último que se generó, sea por el scheduler mensual o por /generar)."""
    return {"insights": obtener_insights_actuales()}


@app.post("/insights/generar")
def insights_generar(_claims: dict = Depends(require_gerencia)):
    """Dispara la generación ahora mismo (botón "Actualizar ahora" del
    dashboard) -- mismo código que corre el scheduler mensual, ver insights.py."""
    try:
        filas = generar_insights()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudieron generar los insights: {e}")
    return {"insights": filas}
