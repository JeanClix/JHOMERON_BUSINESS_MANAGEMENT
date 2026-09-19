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


settings = Settings()
