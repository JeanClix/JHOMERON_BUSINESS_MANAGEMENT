#!/usr/bin/env bash
# AI Service (chat + RAG) — puerto 8090
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/backend/intelligence/ai"
source .venv/bin/activate
uvicorn src.main:app --port 8090
