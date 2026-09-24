/** Respuesta de GET /api/admin/consumo-ia (backend/admin, ConsumoIaController). */
export interface ConsumoIaResponse {
  desde: string;
  dias: number;
  totales: ConsumoIaTotales;
  porUsuario: ConsumoIaUsuario[];
  chats: ConsumoIaChat[];
}

export interface ConsumoIaTotales {
  preguntas: number;
  tokensEntrada: number;
  tokensSalida: number;
  costoEstimadoUsd: number;
  /** Preguntas registradas antes de que se guardaran los tokens -- no suman al total. */
  preguntasSinTokens: number;
}

export interface ConsumoIaUsuario {
  /** Identificador para filtrar los chats: usuario, nombre SAP o "sin-identificar". */
  clave: string;
  usuario: string | null;
  nombre: string | null;
  rol: string | null;
  preguntas: number;
  fallidas: number;
  preguntasSinTokens: number;
  tokensEntrada: number;
  tokensSalida: number;
  costoEstimadoUsd: number;
  modelos: string[];
  ultimaPregunta: string | null;
}

export interface ConsumoIaChat {
  id: number;
  fecha: string | null;
  clave: string;
  usuario: string | null;
  nombre: string | null;
  rol: string | null;
  pregunta: string;
  respuesta: string | null;
  modelo: string | null;
  exito: boolean;
  duracionMs: number | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
}
