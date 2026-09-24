#!/usr/bin/env bash
# ML Service (pronóstico de ventas) — puerto 8091
#
# NOTA: el .venv de este servicio se creo antes de que "intelligence/ml"
# se moviera bajo "backend/", asi que activate.sh y los shebangs de
# .venv/bin/* (incluido uvicorn) apuntan a una ruta vieja que ya no
# existe. "source .venv/bin/activate" no rompe, pero deja el PATH mal
# armado y "uvicorn" no se encuentra. Por eso aqui se invoca el
# interprete del venv directamente en vez de activar + llamar uvicorn.
# Si en algun momento se recrea el venv (rm -rf .venv && python3 -m venv
# .venv && pip install -r requirements.txt), se puede volver al patron
# normal de "source .venv/bin/activate && uvicorn ...".
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/backend/intelligence/ml"
export MLFLOW_TRACKING_URI="sqlite:///mlflow.db"
.venv/bin/python3 -m uvicorn service.main:app --port 8091
