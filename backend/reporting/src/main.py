"""Reporting Service de JHOMERON: endpoints REST deterministicos (sin LLM)
para los dashboards de Vendedores y Gerencia.

Por que existe separado de ai/ml/admin/batch -- ver
backend/reporting/README.md. En corto: batch solo extrae, admin es
identidad/config, ai es conversacional (Text-to-SQL vía LLM, no encaja para
graficos que necesitan una forma JSON fija y respuesta rapida), ml es
entrenamiento/inferencia. Este servicio es el unico que le sirve datos
tipados y deterministicos al frontend para dashboards.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import gerencia, vendedores

app = FastAPI(title="JHOMERON Reporting Service", version="0.1.0")

# El frontend Angular (dev server) corre en otro origen (localhost:4200).
# Mismo criterio que backend/intelligence/ai/src/main.py.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(vendedores.router)
app.include_router(gerencia.router)


@app.get("/health")
def health():
    return {"status": "ok"}
