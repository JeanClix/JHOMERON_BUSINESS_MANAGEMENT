#!/usr/bin/env bash
# ETL nocturno: SQL Server (SAP, por Tailscale) -> Postgres. Para cron:
#   0 2 * * * /home/ubuntu/JHOMERON/deploy/scripts/run-etl.sh >> /home/ubuntu/etl.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== ETL $(date -Is) ==="
docker compose -f docker-compose.prod.yml --profile etl run --rm --build batch
