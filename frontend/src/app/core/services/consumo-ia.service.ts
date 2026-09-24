import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ADMIN_SERVICE_BASE_URL } from '../config/admin-service.config';
import { ConsumoIaResponse } from '../models/consumo-ia.model';
import { AuthService } from './auth.service';

/** Consumo del asistente de IA por empleado -- solo ADMIN (ver JwtAuthFilter.java). */
@Injectable({
  providedIn: 'root'
})
export class ConsumoIaService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${ADMIN_SERVICE_BASE_URL}/api/admin/consumo-ia`;

  private authHeaders(): HttpHeaders {
    const token = this.authService.currentUser()?.token;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  obtener(dias: number, clave?: string | null): Observable<ConsumoIaResponse> {
    let params = new HttpParams().set('dias', dias);
    if (clave) {
      params = params.set('usuario', clave);
    }
    return this.http.get<ConsumoIaResponse>(this.baseUrl, { headers: this.authHeaders(), params });
  }
}
