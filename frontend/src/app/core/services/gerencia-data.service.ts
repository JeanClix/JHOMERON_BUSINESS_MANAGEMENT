import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AI_SERVICE_BASE_URL } from '../config/ai-service.config';
import { KpiMetric } from '../models/kpi.model';
import { BusinessChartData } from '../models/chart.model';
import { BusinessDocument } from '../models/document.model';
import { ContextDocument } from '../models/context-document.model';
import { InsightCard, InsightMensualApi } from '../models/insight.model';
import { AuthService } from './auth.service';
import { ContextDocumentService } from './context-document.service';

const _DOC_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  'lineas-producto': 'Líneas de Producto',
  procesos: 'Procesos & Calidad',
  financiero: 'Financiero & Ventas',
  politicas: 'Políticas & Procesos'
};

const _CATEGORY_LABELS: Record<string, string> = {
  ventas: 'Ventas',
  marina: 'Línea Marina',
  rentabilidad: 'Rentabilidad'
};

const _IMPACT_COLORS: Record<string, string> = {
  alto: 'bg-[#0d3393] text-white',
  oportunidad: 'bg-emerald-600 text-white',
  alerta: 'bg-amber-600 text-white'
};

@Injectable({
  providedIn: 'root'
})
export class GerenciaDataService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly contextDocumentService = inject(ContextDocumentService);

  // Mock KPIs Executive Summary
  private readonly kpisData: KpiMetric[] = [
    {
      id: 'kpi-ventas-mes',
      title: 'Ventas Mensuales Totales',
      value: 'S/ 384,500',
      subtitle: 'Meta Agosto 2026: S/ 420,000',
      numericValue: 384500,
      unit: 'S/',
      changePercent: 14.8,
      changeType: 'increase',
      comparisonLabel: 'vs mes anterior',
      icon: 'fa-solid fa-chart-line',
      colorTheme: 'blue',
      badge: '91.5% de Meta'
    },
    {
      id: 'kpi-margen-operativo',
      title: 'Margen Bruto Operativo',
      value: '38.4%',
      subtitle: 'Promedio industrial: 32%',
      numericValue: 38.4,
      unit: '%',
      changePercent: 3.2,
      changeType: 'increase',
      comparisonLabel: 'vs Q2 2026',
      icon: 'fa-solid fa-sack-dollar',
      colorTheme: 'emerald',
      badge: 'Saludable'
    },
    {
      id: 'kpi-linea-marina',
      title: 'Ventas Línea Marina',
      value: 'S/ 185,200',
      subtitle: '48.1% del volumen total',
      numericValue: 185200,
      unit: 'S/',
      changePercent: 22.4,
      changeType: 'increase',
      comparisonLabel: 'vs mes anterior',
      icon: 'fa-solid fa-anchor',
      colorTheme: 'indigo',
      badge: 'Líder'
    },
    {
      id: 'kpi-ticket-promedio',
      title: 'Ticket Promedio por Cliente',
      value: 'S/ 8,350',
      subtitle: '46 Cuentas Activas',
      numericValue: 8350,
      unit: 'S/',
      changePercent: -1.8,
      changeType: 'decrease',
      comparisonLabel: 'vs promedio H1',
      icon: 'fa-solid fa-receipt',
      colorTheme: 'amber'
    }
  ];

  // Mock Charts Datasets
  private readonly chartMonthlySales: BusinessChartData = {
    id: 'monthly-sales-chart',
    title: 'Evolución de Ventas e Ingresos (2026)',
    subtitle: 'Comparativa mensual acumulada de ventas reales vs proyección gerencial (en miles S/)',
    type: 'line',
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago (Proy)'],
    datasets: [
      {
        label: 'Ventas Reales (S/)',
        data: [290, 310, 345, 330, 368, 372, 384.5, 410],
        borderColor: '#0d3393',
        backgroundColor: 'rgba(13, 51, 147, 0.12)',
        fill: true,
        tension: 0.35,
        borderWidth: 3
      },
      {
        label: 'Meta Comercial (S/)',
        data: [300, 315, 330, 350, 360, 370, 390, 420],
        borderColor: '#ef0606',
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.1
      }
    ],
    summaryNote: 'El crecimiento en Julio (S/ 384.5k) fue impulsado por contrataciones directas con astilleros del Callao.'
  };

  private readonly chartCategoryDistribution: BusinessChartData = {
    id: 'category-dist-chart',
    title: 'Distribución de Ventas por Categoría',
    subtitle: 'Participación porcentual sobre la facturación del mes vigente',
    type: 'doughnut',
    labels: ['Línea Marina Epóxica', 'Acabados Alquídicos', 'Antifouling Caucho Clorado', 'Epóxico Bituminoso / Especiales'],
    datasets: [
      {
        label: 'Ventas (S/)',
        data: [185200, 84500, 68000, 46800],
        backgroundColor: ['#0d3393', '#3b82f6', '#ef0606', '#10b981'],
        borderWidth: 2
      }
    ],
    summaryNote: 'La Línea Marina Epóxica representa cerca del 48% del ingreso total de la fábrica Jhomeron.'
  };

  private readonly chartTopProducts: BusinessChartData = {
    id: 'top-products-chart',
    title: 'Top 5 Productos por Facturación (S/)',
    subtitle: 'Rendimiento comercial por código SKU en los últimos 30 días',
    type: 'bar',
    labels: [
      'Primer Epóxico Marino 2K',
      'Antifouling Caucho Clorado',
      'Esmalte Bituminoso Inmersión',
      'Acabado Alquídico Brillo Superior',
      'Epóxico Poliamida Alto Espesor'
    ],
    datasets: [
      {
        label: 'Facturación (S/)',
        data: [98500, 74200, 46800, 42100, 36900],
        backgroundColor: '#0d3393',
        borderColor: '#0b2670',
        borderWidth: 1
      }
    ],
    summaryNote: 'El Primer Epóxico Marino 2K encabeza el volumen con 680 galones vendidos.'
  };

  private readonly chartZoneComparison: BusinessChartData = {
    id: 'zone-comparison-chart',
    title: 'Ventas por Zona Geográfica / Sector',
    subtitle: 'Comparativa de cobertura de mercado en las principales plazas',
    type: 'radar',
    labels: ['Callao / Astilleros', 'Lima Norte', 'Lima Sur / Chorrillos', 'Paita / Piura', 'Ilo / Moquegua', 'Chimbote'],
    datasets: [
      {
        label: 'Mes Actual (Agosto)',
        data: [95, 78, 62, 84, 58, 72],
        borderColor: '#0d3393',
        backgroundColor: 'rgba(13, 51, 147, 0.25)',
        borderWidth: 2
      },
      {
        label: 'Trimestre Anterior',
        data: [80, 72, 59, 70, 50, 65],
        borderColor: '#94a3b8',
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderWidth: 1.5
      }
    ],
    summaryNote: 'Crecimiento destacado en la plaza Callao/Astilleros (+18.7%) y Paita (+20%).'
  };

  // Methods returning Observables or Signals (Ready for future REST API injection)
  getExecutiveKpis(): Observable<KpiMetric[]> {
    return of(this.kpisData);
  }

  getMonthlySalesChart(): Observable<BusinessChartData> {
    return of(this.chartMonthlySales);
  }

  getCategoryDistributionChart(): Observable<BusinessChartData> {
    return of(this.chartCategoryDistribution);
  }

  getTopProductsChart(): Observable<BusinessChartData> {
    return of(this.chartTopProducts);
  }

  getZoneComparisonChart(): Observable<BusinessChartData> {
    return of(this.chartZoneComparison);
  }

  /**
   * Documentos reales de rag.documento (backend/intelligence/ai) -- ya NO
   * son el mock hardcodeado de 4 documentos de ejemplo. El listado no trae
   * `contenido` completo (solo `resumen`, ver documentos.py), así que el
   * campo `content` queda vacío hasta que se pida el detalle individual.
   */
  getBusinessDocuments(): Observable<BusinessDocument[]> {
    return this.contextDocumentService.listar().pipe(map((docs) => docs.map((d) => this.mapDocument(d))));
  }

  getDocumentById(id: string): Observable<BusinessDocument | undefined> {
    const numId = Number(id);
    if (!Number.isFinite(numId)) return of(undefined);
    return this.contextDocumentService.obtener(numId).pipe(map((d) => this.mapDocument(d)));
  }

  private mapDocument(doc: ContextDocument): BusinessDocument {
    const fecha = new Date(doc.fechaActualizacion);
    const fechaLabel = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    return {
      id: String(doc.id),
      title: doc.titulo,
      category: doc.categoria,
      categoryLabel: _DOC_CATEGORY_LABELS[doc.categoria] || 'General',
      summary: doc.resumen || '',
      content: doc.contenido || '',
      author: doc.subidoPor || 'Equipo Jhomeron',
      lastUpdated: fechaLabel,
      // Sin versionado real todavía (cada edición sobrescribe el contenido
      // y re-embebe, ver documentos.py) -- se muestra la fecha en su lugar.
      version: fechaLabel,
      readingTime: this.estimarLectura(doc.contenido || doc.resumen || ''),
      tags: [],
      outline: [],
      keyTakeaways: []
    };
  }

  private estimarLectura(texto: string): string {
    const palabras = texto.trim().split(/\s+/).filter(Boolean).length;
    const minutos = Math.max(1, Math.round(palabras / 200));
    return `${minutos} min`;
  }

  /**
   * Oportunidades de mejora reales del AI Service (backend/intelligence/ai,
   * ai.insight_mensual) -- se generan una vez por período (scheduler mensual
   * o botón "Actualizar ahora"), este método solo LEE lo ya persistido, no
   * dispara ninguna llamada al LLM.
   */
  getExecutiveInsights(): Observable<InsightCard[]> {
    return this.http
      .get<{ insights: InsightMensualApi[] }>(`${AI_SERVICE_BASE_URL}/insights/actual`, { headers: this.authHeaders() })
      .pipe(map((res) => res.insights.map((r) => this.mapInsight(r))));
  }

  /** Dispara la generación ahora mismo (botón "Actualizar ahora"). */
  regenerarInsights(): Observable<InsightCard[]> {
    return this.http
      .post<{ insights: InsightMensualApi[] }>(`${AI_SERVICE_BASE_URL}/insights/generar`, {}, { headers: this.authHeaders() })
      .pipe(map((res) => res.insights.map((r) => this.mapInsight(r))));
  }

  private mapInsight(row: InsightMensualApi): InsightCard {
    const fecha = new Date(row.generado_en);
    return {
      id: `insight-${row.anio}-${row.mes}-${row.orden}`,
      title: row.titulo,
      category: (row.categoria as InsightCard['category']) || 'ventas',
      categoryLabel: _CATEGORY_LABELS[row.categoria] || 'Gerencia',
      impactLevel: (row.impacto as InsightCard['impactLevel']) || 'oportunidad',
      impactBadgeColor: _IMPACT_COLORS[row.impacto] || 'bg-slate-600 text-white',
      summary: row.resumen,
      description: row.resumen,
      keyMetric: '',
      recommendation: row.recomendacion,
      date: fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }),
      widgetTipo: row.widget_tipo,
      widgetPayload: row.widget_payload ?? undefined
    };
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.currentUser()?.token;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
