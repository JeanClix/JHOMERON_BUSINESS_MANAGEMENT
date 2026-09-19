/** Contrato con el ML Service (intelligence/ml/service/main.py, /predict/proximo-mes). */
export interface BacktestInfo {
  backtest_periodo: string;
  backtest_real_soles: number;
  backtest_predicho_soles: number;
  factor_calibracion: number;
}

export interface PrediccionProximoMes {
  prediccion_total_soles: number;
  prediccion_sin_calibrar_soles?: number;
  periodo_dias: number;
  /** Rango de fechas que cubre la predicción, ej. "2026-09-11 -> 2026-10-10" */
  periodo_prediccion?: string;
  productos_considerados: number;
  modelo_nombre: string;
  modelo_version: number;
  /** Última fecha con datos REALES usada como ancla (no la fecha de hoy) */
  fecha_datos_hasta: string;
  metodo?: string;
  backtest?: BacktestInfo;
  nota?: string;
}

/** Contrato con el ML Service, /predict/productos (desglose por producto de
 * la misma predicción de /predict/proximo-mes -- ver comentario en
 * intelligence/ml/service/main.py sobre por qué solo se expone la caída). */
export interface ProductoProyectado {
  codigo_producto: string;
  producto: string;
  ventas_actuales_soles: number;
  prediccion_soles: number;
  cambio_pct: number | null;
}

export interface ProductosProyectadosResponse {
  periodo_dias: number;
  periodo_prediccion?: string;
  fecha_datos_hasta: string;
  productos_considerados: number;
  productos_evaluados_en_ranking?: number;
  mayor_crecimiento_proyectado: ProductoProyectado[];
  mayor_caida_proyectada: ProductoProyectado[];
  nota?: string;
}
