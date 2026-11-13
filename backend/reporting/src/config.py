"""Configuracion del Reporting Service, cargada desde variables de entorno / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    # Mismo secreto que jwt.secret en
    # backend/admin/src/main/resources/application.yaml -- admin es quien
    # emite el token (ver security/JwtService.java), este servicio solo lo
    # valida.
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # Orígenes del frontend permitidos por CORS, separados por coma. En
    # producción: el dominio de Cloudflare Pages (ver deploy/.env.prod.example).
    cors_origins: str = "http://localhost:4200,http://127.0.0.1:4200"


settings = Settings()
