#!/usr/bin/env bash
# MLflow UI — opcional, puerto 5000
#
# Mismo problema que 04-ml.sh: el .venv tiene shebangs apuntando a la
# ruta vieja (antes de mover intelligence/ml bajo backend/), asi que
# el ejecutable "mlflow" no se encuentra. Se invoca via el interprete.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/backend/intelligence/ml"
.venv/bin/python3 -m mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
