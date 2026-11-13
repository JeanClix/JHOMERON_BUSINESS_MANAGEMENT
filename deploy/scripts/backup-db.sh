#!/usr/bin/env bash
# Backup diario de Postgres (formato custom, restaurable con pg_restore).
# Guarda en deploy/backups/ y borra los de más de 14 días. Para cron:
#   30 3 * * * /home/ubuntu/JHOMERON/deploy/scripts/backup-db.sh >> /home/ubuntu/backup.log 2>&1
# Opcional: subir luego a OCI Object Storage (oci os object put ...).
set -euo pipefail
cd "$(dirname "$0")/.."
archivo="jhomeron_$(date +%Y%m%d_%H%M).dump"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -d jhomeron_batch -Fc -f "/backups/$archivo"
find backups -name 'jhomeron_*.dump' -mtime +14 -delete
echo "backup OK: backups/$archivo"
