"""AI Service de JHOMERON: asistente de gerencia sobre el Data Warehouse de
ventas (Text-to-SQL) y sobre documentación institucional (RAG con pgvector,
ver src/tools.py::buscar_documentos y src/documentos.py), vía tool-calling.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import APIStatusError
from pydantic import BaseModel

from .agent import _es_rate_limit, responder_pregunta
from .auth import get_bearer_token, get_current_claims, require_gerencia, require_vendedor, resolve_chat_identity
from .chunking import ExtraccionError
from .documentos import (
    DocumentoError,
    actualizar_documento,
    crear_documento,
    desactivar_documento,
    listar_documentos,
    obtener_documento,
)
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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


class MensajeHistorial(BaseModel):
    role: str
    content: str


class PreguntaRequest(BaseModel):
    pregunta: str
    # Mensajes previos de esta conversación (más viejo primero, sin incluir
    # `pregunta`) -- ver comentario en agent.responder_pregunta. Opcional:
    # una primera pregunta de una conversación nueva no manda nada.
    historial: list[MensajeHistorial] = []


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
        return responder_pregunta(
            request.pregunta,
            rol=claims.get("role"),
            vendedor=vendedor,
            nombre=claims.get("name"),
            historial=[m.model_dump() for m in request.historial],
        )
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


# ============================================================
# Documentos institucionales (RAG) -- alta/edición solo ADMIN/GERENCIA
# (require_gerencia ya acepta ambos, ver auth.py). La lectura vía chat
# (buscar_documentos) está disponible para cualquier rol -- ver /chat.
# ============================================================

_FORMATOS_ACEPTADOS = (".md", ".txt", ".pdf", ".docx")


def _validar_extension(nombre_archivo: str) -> None:
    if not nombre_archivo.lower().endswith(_FORMATOS_ACEPTADOS):
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado. Formatos aceptados: {', '.join(_FORMATOS_ACEPTADOS)}.",
        )


@app.post("/documentos")
async def crear_documento_endpoint(
    titulo: str = Form(...),
    categoria: str = Form("general"),
    roles_visibles: list[str] | None = Form(None),
    archivo: UploadFile = File(...),
    claims: dict = Depends(get_current_claims),
    _guard: None = Depends(require_gerencia),
):
    _validar_extension(archivo.filename)
    try:
        return crear_documento(
            titulo=titulo,
            categoria=categoria,
            roles_visibles=roles_visibles,
            nombre_archivo=archivo.filename,
            archivo_bytes=await archivo.read(),
            subido_por=claims.get("name"),
        )
    except (DocumentoError, ExtraccionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/documentos")
def listar_documentos_endpoint(_claims: dict = Depends(require_gerencia)):
    return {"documentos": listar_documentos()}


@app.get("/documentos/{documento_id}")
def obtener_documento_endpoint(documento_id: int, _claims: dict = Depends(require_gerencia)):
    try:
        return obtener_documento(documento_id)
    except DocumentoError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put("/documentos/{documento_id}")
async def actualizar_documento_endpoint(
    documento_id: int,
    titulo: str | None = Form(None),
    categoria: str | None = Form(None),
    roles_visibles: list[str] | None = Form(None),
    archivo: UploadFile | None = File(None),
    claims: dict = Depends(get_current_claims),
    _guard: None = Depends(require_gerencia),
):
    if archivo is not None:
        _validar_extension(archivo.filename)
    try:
        return actualizar_documento(
            documento_id,
            titulo=titulo,
            categoria=categoria,
            roles_visibles=roles_visibles,
            nombre_archivo=archivo.filename if archivo else None,
            archivo_bytes=(await archivo.read()) if archivo else None,
            subido_por=claims.get("name"),
        )
    except (DocumentoError, ExtraccionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/documentos/{documento_id}")
def desactivar_documento_endpoint(documento_id: int, _claims: dict = Depends(require_gerencia)):
    try:
        desactivar_documento(documento_id)
    except DocumentoError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}
