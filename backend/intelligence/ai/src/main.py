"""AI Service de JHOMERON: asistente de gerencia sobre el Data Warehouse
de ventas, vía Text-to-SQL + tool-calling (no RAG, ver README de esta carpeta).
"""
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import responder_pregunta
from .auth import get_bearer_token, require_vendedor
from .recomendaciones import generar_recomendaciones
from .reporting_client import ReportingClientError, obtener_clientes_inactivos

app = FastAPI(title="JHOMERON AI Service", version="0.1.0")

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
def chat(request: PreguntaRequest):
    try:
        return responder_pregunta(request.pregunta)
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
