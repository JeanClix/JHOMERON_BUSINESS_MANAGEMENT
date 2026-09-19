import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ML_SERVICE_BASE_URL } from '../config/ml-service.config';
import { PrediccionProximoMes, ProductosProyectadosResponse } from '../models/prediccion.model';

/**
 * Predicciones reales del ML Service (Random Forest, Model Registry MLflow).
 * Ver intelligence/ml/REPORTE_ENTRENAMIENTO.md para el detalle de cómo se
 * entrenó y calibró el modelo detrás de este endpoint.
 */
@Injectable({
  providedIn: 'root'
})
export class PrediccionService {
  private readonly http = inject(HttpClient);

  getPrediccionProximoMes(dias: number = 30): Observable<PrediccionProximoMes> {
    return this.http.get<PrediccionProximoMes>(`${ML_SERVICE_BASE_URL}/predict/proximo-mes`, {
      params: { dias }
    });
  }

  getProductosProyectados(dias: number = 30, top: number = 6): Observable<ProductosProyectadosResponse> {
    return this.http.get<ProductosProyectadosResponse>(`${ML_SERVICE_BASE_URL}/predict/productos`, {
      params: { dias, top }
    });
  }
}
