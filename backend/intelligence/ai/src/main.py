"""AI Service de JHOMERON: asistente de gerencia sobre el Data Warehouse
de ventas, vía Text-to-SQL + tool-calling (no RAG, ver README de esta carpeta).
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import responder_pregunta

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
