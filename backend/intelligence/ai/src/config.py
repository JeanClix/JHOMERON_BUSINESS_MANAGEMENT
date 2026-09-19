"""Configuracion del AI Service, cargada desde variables de entorno / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"
    llm_model: str = "llama3.1"
    sql_tool_max_rows: int = 200

    # Para /recomendaciones/reactivacion: valida el JWT emitido por admin
    # (MISMO valor que JWT_SECRET en backend/admin y backend/reporting) y
    # llama a reporting para traer los clientes inactivos del vendedor
    # autenticado. Sin default a proposito -- ver .env.example.
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    reporting_base_url: str = "http://localhost:8093"


settings = Settings()
