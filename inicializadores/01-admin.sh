#!/usr/bin/env bash
# Admin Service (login) — puerto 8092
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/backend/admin"
./mvnw spring-boot:run
