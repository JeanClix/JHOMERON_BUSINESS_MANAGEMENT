import { KpiMetric } from './kpi.model';
import { BusinessChartData } from './chart.model';

/** Mini-dashboard ya calculado en el backend (ver insights.py) -- nunca
 * generado por el LLM, solo elegido/descrito por él. 'ninguno' cuando la
 * oportunidad no tiene un dato tabular asociado (poco común, ver insights.py). */
export type InsightWidgetTipo = 'kpi_row' | 'bar_chart' | 'ninguno';

export interface InsightWidgetPayload {
  kpis?: KpiMetric[];
  chart?: BusinessChartData;
}

export interface InsightCard {
  id: string;
  title: string;
  category: 'ventas' | 'marcos-operativos' | 'marina' | 'rentabilidad' | 'tendencias';
  categoryLabel: string;
  impactLevel: 'alto' | 'medio' | 'oportunidad' | 'alerta';
  impactBadgeColor: string;
  summary: string;
  description: string;
  keyMetric: string;
  recommendation: string;
  date: string;
  actionPrompt?: string; // Prompt suggestion for chatbot
  widgetTipo?: InsightWidgetTipo;
  widgetPayload?: InsightWidgetPayload;
}

/** Forma tal cual la devuelve el AI Service (GET/POST /insights/*, ver
 * backend/intelligence/ai/src/insights.py) -- snake_case, se mapea a
 * InsightCard en GerenciaDataService antes de llegar a los componentes. */
export interface InsightMensualApi {
  anio: number;
  mes: number;
  orden: number;
  categoria: string;
  impacto: string;
  titulo: string;
  resumen: string;
  recomendacion: string;
  widget_tipo: InsightWidgetTipo;
  widget_payload: InsightWidgetPayload | null;
  generado_en: string;
}
