# Despliegue a producción — JHOMERON

```
Navegador ─► app.<dominio>  Cloudflare Pages (Angular estático)
         └─► api.<dominio>  Cloudflare Tunnel ─► VM Oracle (Docker)
                              caddy ─┬─ /admin/*     → admin:8092
                                     ├─ /reporting/* → reporting:8093
                                     ├─ /ai/*        → ai:8090
                                     └─ /ml/*        → ml:8091
                              postgres (pgvector, pg17) · batch (cron) · Tailscale → SQL Server SAP
```

La VM no abre puertos a internet salvo SSH. MLflow UI no se publica.

---

## 1. VM en Oracle Cloud

- Shape **VM.Standard.A1.Flex** (ARM, Always Free): 4 OCPU / 24 GB, Ubuntu 24.04, disco de 100 GB.
- Si sale *Out of capacity*, pasa la cuenta a *Pay As You Go*. No cobra mientras uses solo Always Free.
- Security List: deja solo **22/tcp** de entrada (idealmente restringido a tu IP).

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # cerrar sesión y volver a entrar
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up               # loguearse con la misma cuenta del SQL Server
nc -vz 100.117.64.56 1433       # debe conectar
```

## 2. Código y secretos

```bash
git clone <repo> ~/JHOMERON && cd ~/JHOMERON/deploy
cp .env.prod.example .env && chmod 600 .env        # llenar valores
cp ../backend/intelligence/ai/.env.example ai.env && chmod 600 ai.env
# en ai.env: LLM_*, EMBEDDING_*, etc. (DATABASE_URL/JWT/CORS los pone el compose)
```

Usa **llaves nuevas**, no las de desarrollo: `openssl rand -base64 32` para `JWT_SECRET` y las contraseñas.

## 3. Modelo ML (desde tu máquina)

`mlruns/` no está en git. Copia solo la carpeta `artifacts` del modelo en Production:

```bash
scp -r backend/intelligence/ml/mlruns/1/models/m-a7ce7ef0249c4ac4aea1528170b3d027/artifacts \
    ubuntu@<IP_VM>:~/JHOMERON/deploy/ml-model
```

## 4. Base de datos (desde tu máquina)

```bash
pg_dump -h localhost -U postgres -d jhomeron_batch -Fc -f jhomeron.dump
scp jhomeron.dump ubuntu@<IP_VM>:~/JHOMERON/deploy/backups/
```

En la VM:

```bash
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -c \
  "CREATE ROLE bi_readonly LOGIN; CREATE ROLE ai_readonly LOGIN;"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U postgres -d jhomeron_batch --no-owner /backups/jhomeron.dump
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d jhomeron_batch -c \
  "ALTER ROLE bi_readonly PASSWORD '<BI_READONLY_PASSWORD>'; ALTER ROLE ai_readonly PASSWORD '<AI_READONLY_PASSWORD>';"
```

`pg_dump` no incluye roles, por eso se crean antes del restore. Así los `GRANT` del dump se aplican.
Revisa que no haya errores de `GRANT` en la salida.

## 5. Cloudflare Tunnel

Zero Trust → Networks → Tunnels → *Create tunnel* (Cloudflared) → copia el token a `CLOUDFLARE_TUNNEL_TOKEN`.
Public hostname: `api.<dominio>` → servicio `http://caddy:80`.

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl https://api.<dominio>/reporting/docs   # debe responder
```

## 6. Cloudflare Pages (frontend)

Workers & Pages → Create → Pages → conectar el repo de GitHub:

| Campo | Valor |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build:prod` |
| Output directory | `dist/frontend/browser` |
| Variable de entorno | `API_BASE_URL=https://api.<dominio>` |

Las rutas SPA (`/gerencia/...`) funcionan sin configurar nada, porque Pages sirve `index.html` cuando no hay `404.html`.
Agrega el dominio de Pages (y `app.<dominio>`, si lo usas) a `CORS_ORIGINS`. Después corre `docker compose ... up -d` para que se aplique.

## 7. Cron (ETL + backups)

```bash
crontab -e
0 2 * * *  /home/ubuntu/JHOMERON/deploy/scripts/run-etl.sh   >> /home/ubuntu/etl.log 2>&1
30 3 * * * /home/ubuntu/JHOMERON/deploy/scripts/backup-db.sh >> /home/ubuntu/backup.log 2>&1
```

## Actualizar (nueva versión)

`main` = producción. Trabaja en tu rama, haz merge a `main` y luego:

- **Frontend**: automático. Pages compila y publica con cada push a `main`. Las otras ramas reciben una URL de preview.
- **Backends**: en la VM:

```bash
~/JHOMERON/deploy/scripts/update.sh              # pull + rebuild de lo que cambió
~/JHOMERON/deploy/scripts/update.sh ai           # solo un servicio
```

Lo que `update.sh` no cubre:

| Cambio | Qué hacer |
|---|---|
| Entidades JPA de admin | Nada (`ddl-auto: update`) |
| `.sql` de esquemas/vistas | `scripts/backup-db.sh`, luego `docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d jhomeron_batch < archivo.sql` |
| `.env` / `ai.env` | Editar en la VM → `docker compose -f docker-compose.prod.yml up -d` |
| Modelo ML reentrenado | `scp` de la nueva carpeta `artifacts` a `deploy/ml-model`, subir `ML_MODEL_VERSION` → `docker compose -f docker-compose.prod.yml up -d ml` |
| Código del ETL | Lo reconstruye `update.sh` (y `run-etl.sh` usa `--build`) |

## Operación

```bash
docker compose -f docker-compose.prod.yml logs -f ai          # logs
ssh -L 5432:localhost:5432 ubuntu@<IP_VM>                     # DBeaver/psql desde tu PC
```
