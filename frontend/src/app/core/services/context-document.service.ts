import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AI_SERVICE_BASE_URL } from '../config/ai-service.config';
import { ContextDocument, ContextDocumentApi, ContextDocumentPayload } from '../models/context-document.model';
import { AuthService } from './auth.service';

function aContextDocument(api: ContextDocumentApi): ContextDocument {
  return {
    id: api.id,
    titulo: api.titulo,
    categoria: api.categoria,
    formatoOriginal: api.formato_original,
    rolesVisibles: api.roles_visibles,
    subidoPor: api.subido_por,
    activo: api.activo,
    fechaCreacion: api.fecha_creacion,
    fechaActualizacion: api.fecha_actualizacion,
    contenido: api.contenido,
    resumen: api.resumen
  };
}

function aFormData(payload: ContextDocumentPayload): FormData {
  const form = new FormData();
  form.append('titulo', payload.titulo);
  form.append('categoria', payload.categoria);
  payload.rolesVisibles.forEach(rol => form.append('roles_visibles', rol));
  if (payload.archivo) {
    form.append('archivo', payload.archivo);
  }
  return form;
}

/**
 * Documentos de contexto institucional (RAG) -- vive en backend/intelligence/ai
 * (mismo servicio que la búsqueda semántica del chat, ver documentos.py),
 * no en backend/admin. Alta/edición/baja requieren rol ADMIN o GERENCIA
 * (require_gerencia en el backend); la lectura vía chat está abierta a
 * cualquier rol autenticado.
 */
@Injectable({
  providedIn: 'root'
})
export class ContextDocumentService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${AI_SERVICE_BASE_URL}/documentos`;

  private authHeaders(): HttpHeaders {
    const token = this.authService.currentUser()?.token;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  listar(): Observable<ContextDocument[]> {
    return this.http
      .get<{ documentos: ContextDocumentApi[] }>(this.baseUrl, { headers: this.authHeaders() })
      .pipe(map(res => res.documentos.map(aContextDocument)));
  }

  obtener(id: number): Observable<ContextDocument> {
    return this.http
      .get<ContextDocumentApi>(`${this.baseUrl}/${id}`, { headers: this.authHeaders() })
      .pipe(map(aContextDocument));
  }

  crear(payload: ContextDocumentPayload): Observable<ContextDocument> {
    return this.http
      .post<ContextDocumentApi>(this.baseUrl, aFormData(payload), { headers: this.authHeaders() })
      .pipe(map(aContextDocument));
  }

  actualizar(id: number, payload: Partial<ContextDocumentPayload>): Observable<ContextDocument> {
    const form = new FormData();
    if (payload.titulo !== undefined) form.append('titulo', payload.titulo);
    if (payload.categoria !== undefined) form.append('categoria', payload.categoria);
    if (payload.rolesVisibles !== undefined) {
      payload.rolesVisibles.forEach(rol => form.append('roles_visibles', rol));
    }
    if (payload.archivo) form.append('archivo', payload.archivo);

    return this.http
      .put<ContextDocumentApi>(`${this.baseUrl}/${id}`, form, { headers: this.authHeaders() })
      .pipe(map(aContextDocument));
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.authHeaders() });
  }
}
