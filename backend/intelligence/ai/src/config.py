"""Configuracion del AI Service, cargada desde variables de entorno / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"
    llm_model: str = "llama3.1"
    sql_tool_max_rows: int = 40

    # Para /recomendaciones/reactivacion: valida el JWT emitido por admin
    # (MISMO valor que JWT_SECRET en backend/admin y backend/reporting) y
    # llama a reporting para traer los clientes inactivos del vendedor
    # autenticado. Sin default a proposito -- ver .env.example.
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    reporting_base_url: str = "http://localhost:8093"

    # Embeddings para la tool buscar_documentos (RAG sobre documentación
    # empresarial). Puede ser un proveedor distinto al de chat (ej. hoy el
    # chat corre en Groq, que no ofrece embeddings) -- si embedding_base_url
    # / embedding_api_key no se configuran, se reusa el cliente de LLM_*.
    embedding_model: str = "nvidia/nemotron-3-embed-1b"
    embedding_base_url: str | None = None
    embedding_api_key: str | None = None
    # Dimensión del vector en rag.chunk.embedding (ver schema-rag.sql) -- si
    # se cambia de modelo de embeddings con otra dimensión, hay que migrar
    # la columna también.
    embedding_dimensions: int = 2048
    rag_tool_max_chunks: int = 6


settings = Settings()
