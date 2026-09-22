export type ContextDocCategoria = 'general' | 'lineas-producto' | 'procesos' | 'financiero' | 'politicas';

export const CONTEXT_DOC_ROLES = ['VENDEDOR', 'GERENCIA', 'ADMIN'] as const;
export type ContextDocRol = (typeof CONTEXT_DOC_ROLES)[number];

export interface ContextDocument {
  id: number;
  titulo: string;
  categoria: ContextDocCategoria;
  formatoOriginal: string;
  rolesVisibles: ContextDocRol[];
  subidoPor?: string | null;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  contenido?: string; // solo viene en el detalle (GET /documentos/{id})
  resumen?: string; // extracto de `contenido`, viene en listar/obtener (no en crear/actualizar)
}

/** Forma tal cual la devuelve el AI Service (GET/POST/PUT /documentos*, ver
 * backend/intelligence/ai/src/documentos.py) -- snake_case, se mapea a
 * ContextDocument en ContextDocumentService antes de llegar a los componentes. */
export interface ContextDocumentApi {
  id: number;
  titulo: string;
  categoria: ContextDocCategoria;
  contenido?: string;
  resumen?: string;
  formato_original: string;
  roles_visibles: ContextDocRol[];
  subido_por: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

/** Payload de alta/edición -- se envía como FormData (incluye el archivo), no JSON. */
export interface ContextDocumentPayload {
  titulo: string;
  categoria: ContextDocCategoria;
  rolesVisibles: ContextDocRol[];
  archivo?: File;
}
