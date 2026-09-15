/**
 * Contrato con el AI Service (FastAPI, backend/intelligence/ai/src/main.py).
 * Mantener sincronizado con RespuestaResponse de ese servicio.
 */
export interface AiChatRequest {
  pregunta: string;
}

export interface AiChatApiResponse {
  respuesta: string;
  sql_generado?: string | null;
  filas_retornadas?: number | null;
  /** Filas crudas de la última consulta SQL ejecutada, para tabla/gráfico. */
  datos?: Record<string, unknown>[] | null;
  duracion_ms: number;
}

export interface VentasChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sqlGenerado?: string | null;
  filasRetornadas?: number | null;
  datos?: Record<string, unknown>[] | null;
  isError?: boolean;
}

export interface VentasPresetPrompt {
  id: string;
  icon: string;
  label: string;
  prompt: string;
}
