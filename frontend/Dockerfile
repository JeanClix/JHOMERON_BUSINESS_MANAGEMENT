# ============================================================
# JHOMERON Frontend - Dockerfile de DESARROLLO
# ============================================================
# Corre `ng serve` dentro del contenedor con hot-reload, para no
# depender de tener Node instalado (ni en la versión exacta que exige
# Angular CLI) en la máquina local.
#
# Build:
#   docker build -t jhomeron-frontend .
#
# Run:
#   docker run --rm -p 4200:4200 -v "%cd%/src:/app/src" jhomeron-frontend
#   (en PowerShell usar ${PWD} en vez de %cd%)
#
# El navegador sigue corriendo en el host, así que las llamadas al
# AI Service (http://localhost:8090) funcionan igual sin tocar nada de
# red del contenedor -- CORS ya permite http://localhost:4200.
# ============================================================
FROM node:22-alpine

WORKDIR /app

# Cachear dependencias por separado del código fuente
COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 4200

# --host 0.0.0.0: necesario para que el servidor sea accesible desde
# fuera del contenedor (por defecto ng serve solo escucha en localhost).
# --allowed-hosts: el dev server (Vite) valida el header Host por defecto;
# esto evita el error "Blocked request" al acceder vía localhost:4200 mapeado.
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--allowed-hosts"]
