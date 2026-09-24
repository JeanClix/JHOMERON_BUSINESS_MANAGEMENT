import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { REPORTING_SERVICE_BASE_URL } from '../config/reporting-service.config';
import { AuthService } from './auth.service';
import {
  ClientesCarteraResponse,
  ClientesEnRiesgoResponse,
  ClientesInactivosResponse,
  CuotaVendedor,
  MapaDepartamentosResponse,
  PeriodoModo,
  ProductosVendedorResponse,
  TendenciaVentasResponse,
  TicketPromedioResponse,
  TopClientesGerenciaResponse,
  TopProductosGerenciaResponse,
  VentasPeriodoResponse
} from '../models/reporting.model';

/**
 * Cliente HTTP hacia backend/reporting (endpoints /vendedores/me/* y
 * /gerencia/*).
 *
 * Cada request manda el JWT del usuario logueado como
 * "Authorization: Bearer <token>" -- reporting deriva el vendedor/rol del
 * token, nunca de un parámetro que mande este servicio (ver
 * backend/reporting/src/auth.py). Si no hay token, o el rol no alcanza
 * (VENDEDOR pidiendo /gerencia/*, o viceversa), reporting responde
 * 401/403/409 y se propaga como error del Observable/Promise.
 */
@Injectable({
  providedIn: 'root'
})
export class ReportingService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private authHeaders(): HttpHeaders {
    const token = this.authService.currentUser()?.token;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  getCuota(opts: {
    modo: PeriodoModo;
    anio: number;
    mes: number;
    anioIso: number;
    semanaIso: number;
  }): Promise<CuotaVendedor> {
    const params = new HttpParams()
      .set('modo', opts.modo)
      .set('anio', opts.anio)
      .set('mes', opts.mes)
      .set('anio_iso', opts.anioIso)
      .set('semana_iso', opts.semanaIso);
    return firstValueFrom(
      this.http.get<CuotaVendedor>(`${REPORTING_SERVICE_BASE_URL}/vendedores/me/cuota`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getVentasPeriodo(opts: {
    modo: PeriodoModo;
    anio: number;
    mes: number;
    anioIso: number;
    semanaIso: number;
  }): Promise<VentasPeriodoResponse> {
    const params = new HttpParams()
      .set('modo', opts.modo)
      .set('anio', opts.anio)
      .set('mes', opts.mes)
      .set('anio_iso', opts.anioIso)
      .set('semana_iso', opts.semanaIso);
    return firstValueFrom(
      this.http.get<VentasPeriodoResponse>(`${REPORTING_SERVICE_BASE_URL}/vendedores/me/ventas`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getProductosTop(
    anio: number,
    mes: number,
    orden: 'asc' | 'desc' = 'desc',
    limite = 5
  ): Promise<ProductosVendedorResponse> {
    const params = new HttpParams()
      .set('anio', anio)
      .set('mes', mes)
      .set('orden', orden)
      .set('limite', limite);
    return firstValueFrom(
      this.http.get<ProductosVendedorResponse>(`${REPORTING_SERVICE_BASE_URL}/vendedores/me/productos`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getClientesInactivos(diasUmbral = 30, limite = 5): Promise<ClientesInactivosResponse> {
    const params = new HttpParams().set('dias_umbral', diasUmbral).set('limite', limite);
    return firstValueFrom(
      this.http.get<ClientesInactivosResponse>(`${REPORTING_SERVICE_BASE_URL}/vendedores/me/clientes-inactivos`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getClientesCartera(limite = 200): Promise<ClientesCarteraResponse> {
    const params = new HttpParams().set('limite', limite);
    return firstValueFrom(
      this.http.get<ClientesCarteraResponse>(`${REPORTING_SERVICE_BASE_URL}/vendedores/me/clientes`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  // ----- /gerencia/* (requiere role GERENCIA o ADMIN) -----

  // mes omitido (undefined) = todo el año -- ver backend/reporting/src/routers/gerencia.py
  getTopClientesGerencia(anio: number, mes?: number, limite = 15): Promise<TopClientesGerenciaResponse> {
    let params = new HttpParams().set('anio', anio).set('limite', limite);
    if (mes !== undefined) params = params.set('mes', mes);
    return firstValueFrom(
      this.http.get<TopClientesGerenciaResponse>(`${REPORTING_SERVICE_BASE_URL}/gerencia/top-clientes`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getTopProductosGerencia(
    anio: number,
    mes?: number,
    orden: 'asc' | 'desc' = 'desc',
    limite = 10
  ): Promise<TopProductosGerenciaResponse> {
    let params = new HttpParams().set('anio', anio).set('orden', orden).set('limite', limite);
    if (mes !== undefined) params = params.set('mes', mes);
    return firstValueFrom(
      this.http.get<TopProductosGerenciaResponse>(`${REPORTING_SERVICE_BASE_URL}/gerencia/top-productos`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getTicketPromedio(anio: number, mes?: number): Promise<TicketPromedioResponse> {
    let params = new HttpParams().set('anio', anio);
    if (mes !== undefined) params = params.set('mes', mes);
    return firstValueFrom(
      this.http.get<TicketPromedioResponse>(`${REPORTING_SERVICE_BASE_URL}/gerencia/ticket-promedio`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getTendenciaVentas(anio: number): Promise<TendenciaVentasResponse> {
    const params = new HttpParams().set('anio', anio);
    return firstValueFrom(
      this.http.get<TendenciaVentasResponse>(`${REPORTING_SERVICE_BASE_URL}/gerencia/tendencia-ventas`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getMapaDepartamentos(anio: number, mes?: number): Promise<MapaDepartamentosResponse> {
    let params = new HttpParams().set('anio', anio);
    if (mes !== undefined) {
      params = params.set('mes', mes);
    }
    return firstValueFrom(
      this.http.get<MapaDepartamentosResponse>(`${REPORTING_SERVICE_BASE_URL}/gerencia/mapa-departamentos`, {
        params,
        headers: this.authHeaders()
      })
    );
  }

  getClientesEnRiesgoGerencia(limite = 8): Promise<ClientesEnRiesgoResponse> {
    const params = new HttpParams().set('limite', limite);
    return firstValueFrom(
      this.http.get<ClientesEnRiesgoResponse>(`${REPORTING_SERVICE_BASE_URL}/gerencia/clientes-en-riesgo`, {
        params,
        headers: this.authHeaders()
      })
    );
  }
}
