#!/usr/bin/env bash
# Reporting Service (dashboards) — puerto 8093
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/backend/reporting"
source .venv/bin/activate
uvicorn src.main:app --port 8093
