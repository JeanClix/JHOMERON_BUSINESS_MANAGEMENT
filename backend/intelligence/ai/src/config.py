"""Configuracion del AI Service, cargada desde variables de entorno / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    # "openai" (cualquier API compatible con OpenAI: Groq, xAI, OpenAI,
    # NVIDIA -- usa LLM_BASE_URL / LLM_API_KEY) o "anthropic" (Claude, usa
    # ANTHROPIC_API_KEY). LLM_MODEL aplica a ambos. Ver llm.py.
    llm_provider: str = "openai"
    anthropic_api_key: str | None = None
    # Solo Anthropic: presupuesto de tokens de razonamiento (thinking) por
    # llamada. 0 = sin thinking. Mínimo 1024 si se activa.
    llm_thinking_budget: int = 0
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"
    llm_model: str = "llama3.1"
    sql_tool_max_rows: int = 40
    # Esfuerzo de razonamiento para modelos que lo soportan (OpenAI GPT-5.x:
    # none/low/medium/high...). Vacío = no se manda y el modelo usa su
    # default. Groq/xAI lo ignoran o no lo necesitan -- dejarlo vacío ahí.
    llm_reasoning_effort: str | None = None

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

    # Traza de tiempos por pregunta del chat (ver tiempos.py), una línea
    # JSON por request. Vacío = no se escribe archivo (el resumen por
    # consola se imprime igual).
    tiempos_log_path: str = "logs/tiempos_chat.jsonl"

    # Enrutador previo con Jev (TypeSafe AI, ver enrutador.py): decide qué
    # tools y qué secciones del prompt necesita cada pregunta antes de
    # llamar al LLM. Apagado por defecto -- sin él el chat se comporta como
    # siempre (todas las tools, prompt completo).
    jev_habilitado: bool = False
    typesafe_api_key: str | None = None
    typesafe_base_url: str = "https://api.typesafe.ai"
    jev_modelo: str = "jev-latest"
    # Si Jev no responde en este tiempo se sigue sin enrutar -- nunca debe
    # hacer más lento el chat de lo que ya es.
    jev_timeout_s: float = 1.5
    # Probabilidad mínima para incluir una tool. Bajo a propósito: incluir
    # una tool de más solo cuesta tokens, quitar una necesaria rompe la
    # respuesta.
    jev_umbral_tool: float = 0.35
    # Probabilidad mínima para responder "fuera de tema" / "saludo" sin
    # tools. Alto a propósito: un falso positivo rechaza una pregunta válida.
    jev_umbral_sin_tools: float = 0.85


settings = Settings()


def opciones_llm(max_tokens: int) -> dict:
    """Parámetros comunes a toda llamada de chat al LLM. Se usa
    `max_completion_tokens` (no `max_tokens`): los modelos con razonamiento
    de OpenAI rechazan `max_tokens` (Groq acepta ambos, verificado). El límite
    incluye los tokens de razonamiento, por eso los valores son holgados.
    `reasoning_effort` va por extra_body porque el SDK fijado (openai 1.51)
    todavía no lo tiene como parámetro propio."""
    opciones: dict = {"max_completion_tokens": max_tokens}
    if settings.llm_reasoning_effort:
        opciones["extra_body"] = {"reasoning_effort": settings.llm_reasoning_effort}
    return opciones
