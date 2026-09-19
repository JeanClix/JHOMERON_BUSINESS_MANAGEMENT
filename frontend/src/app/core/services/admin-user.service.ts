import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ADMIN_SERVICE_BASE_URL } from '../config/admin-service.config';
import { AdminUser, AdminUserPayload, MetaVendedoresPayload } from '../models/admin-user.model';
import { AuthService } from './auth.service';

/**
 * `/api/admin/**` en backend/admin ahora exige un JWT con role=ADMIN (ver
 * JwtAuthFilter.java) -- sin este header todo devolvía 401 y la lista de
 * usuarios se veía vacía en el panel, sin ningún error visible.
 */
@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${ADMIN_SERVICE_BASE_URL}/api/admin/users`;

  private authHeaders(): HttpHeaders {
    const token = this.authService.currentUser()?.token;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  listar(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.baseUrl, { headers: this.authHeaders() });
  }

  obtener(id: number): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.baseUrl}/${id}`, { headers: this.authHeaders() });
  }

  crear(payload: AdminUserPayload): Observable<AdminUser> {
    return this.http.post<AdminUser>(this.baseUrl, payload, { headers: this.authHeaders() });
  }

  actualizar(id: number, payload: Partial<AdminUserPayload>): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.baseUrl}/${id}`, payload, { headers: this.authHeaders() });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.authHeaders() });
  }

  /** Actualiza meta_mensual y/o meta_semanal para TODOS los vendedores a la vez. */
  actualizarMetaVendedores(payload: MetaVendedoresPayload): Observable<{ vendedoresActualizados: number }> {
    return this.http.put<{ vendedoresActualizados: number }>(`${this.baseUrl}/meta-vendedores`, payload, {
      headers: this.authHeaders()
    });
  }
}
