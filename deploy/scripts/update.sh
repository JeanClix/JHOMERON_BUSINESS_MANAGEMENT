#!/usr/bin/env bash
# Actualiza producción con lo último de `main`: git pull + rebuild.
#
#   ./scripts/update.sh              # todos los servicios (solo cambian los que cambiaron)
#   ./scripts/update.sh ai reporting # solo esos servicios
#
# Construye las imágenes ANTES de recrear los contenedores, así cada servicio
# queda caído solo los segundos del reinicio, no lo que dura el build.
# Cambios de SQL, .env o modelo ML van aparte (ver DEPLOY.md, "Actualizar").
set -euo pipefail
cd "$(dirname "$0")/.."
compose=(docker compose -f docker-compose.prod.yml)

rama=$(git rev-parse --abbrev-ref HEAD)
if [[ "$rama" != "main" ]]; then
  echo "⚠ La VM está en la rama '$rama', no en 'main'." >&2
  read -rp "¿Continuar igual? [s/N] " resp
  [[ "$resp" =~ ^[sS]$ ]] || exit 1
fi

antes=$(git rev-parse HEAD)
git pull --ff-only
despues=$(git rev-parse HEAD)

if [[ "$antes" == "$despues" ]]; then
  echo "Sin commits nuevos; se reconstruye igual por si hubo cambios locales."
else
  echo "=== Commits nuevos ==="
  git log --oneline "$antes..$despues"
  echo "=== Carpetas tocadas ==="
  git diff --name-only "$antes" "$despues" | cut -d/ -f1-3 | sort -u
  if git diff --name-only "$antes" "$despues" | grep -q '\.sql$'; then
    echo "⚠ Hay cambios en archivos .sql: aplícalos a mano (ver DEPLOY.md)." >&2
  fi
fi

echo "=== Build ==="
# --profile etl: incluye la imagen del batch (que no queda corriendo, la usa el cron)
"${compose[@]}" --profile etl build "$@"
echo "=== Recreando contenedores ==="
"${compose[@]}" up -d "$@"

# Imágenes viejas sin uso (cada build deja una); libera disco en la VM
docker image prune -f >/dev/null

"${compose[@]}" ps
echo "✔ Actualizado a $(git log -1 --format='%h %s')"
