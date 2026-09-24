#!/usr/bin/env bash
# Batch (ETL) — opcional, solo si quieres correr la extraccion de nuevo
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/backend/batch"
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
