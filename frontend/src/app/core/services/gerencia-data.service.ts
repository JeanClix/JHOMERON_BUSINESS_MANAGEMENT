import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AI_SERVICE_BASE_URL } from '../config/ai-service.config';
import { KpiMetric } from '../models/kpi.model';
import { BusinessChartData } from '../models/chart.model';
import { BusinessDocument } from '../models/document.model';
import { InsightCard, InsightMensualApi } from '../models/insight.model';
import { AuthService } from './auth.service';

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

  // Mock Business Documents (DeepWiki Repository)
  private readonly documentsData: BusinessDocument[] = [
    {
      id: 'doc-linea-marina-manual',
      title: 'Manual Técnico de Sistemas de Pintado Marino Jhomeron',
      category: 'lineas-producto',
      categoryLabel: 'Líneas de Producto',
      summary: 'Especificaciones completas de recubrimientos anticorrosivos, epóxicos y antifouling para embarcaciones e instalaciones portuarias.',
      content: `
# Manual Técnico de Sistemas de Pintado Marino Jhomeron (Edición 2026)

## 1. Visión General del Portafolio Marino
Fábrica Jhomeron desarrolla formulaciones de alto performance diseñadas para resistir los ambientes marinos agresivos de la costa peruana y sudamericana. Nuestros recubrimientos están homologados bajo normas ASTM y SSPC.

## 2. Esquema de Protección para Cascos de Acero (Obra Viva)
Para embarcaciones pesqueras y comerciales expuestas a inmersión permanente:
1. **Tratamiento Superficial**: Chorro abrasivo al grado SSPC-SP10 (Casi al Blanco).
2. **Capas Primarias**: 2 manos de **Primer Epóxico Marino Poliamida 2K** (JHM-MAR-EPOX01), espesor película seca (EPS) recomendada: 125 micras por mano.
3. **Capa Anti-incrustante**: 2 manos de **Antifouling Caucho Clorado** (JHM-MAR-CAU03), liberador gradual de biocidas contra cirripedios y algas (vida útil 24-36 meses).

## 3. Esquema para Tanques de Lastre y Sentinas
- **Producto Recomendado**: *Esmalte Epóxico Bituminoso Inmersión* (JHM-MAR-BIT04).
- **Resistencia**: Inmersión continua en salmuera, petróleo pesado y efluentes industriales.
- **Rendimiento**: 35 m² por galón a 1 mano (100 micras secas).

## 4. Rendimientos Estándar y Tiempos de Secado
- Secado al tacto: 2 horas a 25°C.
- Secado al repintado: Mínimo 8 horas, máximo 48 horas sin lijado previo.
- Curado total epóxico: 7 días antes de botadura o puesta en servicio de agua salada.
      `,
      author: 'Ing. Carlos Mendoza - Dpto. I+D Jhomeron',
      lastUpdated: '02 de Agosto, 2026',
      version: 'v4.2',
      readingTime: '6 min',
      tags: ['Línea Marina', 'Epóxico', 'Antifouling', 'Fichas Técnicas', 'Cascos de Acero'],
      featured: true,
      outline: [
        { id: 'sec-1', title: '1. Visión General del Portafolio Marino', level: 2 },
        { id: 'sec-2', title: '2. Esquema de Protección para Cascos (Obra Viva)', level: 2 },
        { id: 'sec-3', title: '3. Esquema para Tanques de Lastre y Sentinas', level: 2 },
        { id: 'sec-4', title: '4. Rendimientos Estándar y Tiempos de Secado', level: 2 }
      ],
      keyTakeaways: [
        'El Primer Epóxico 2K requiere grado de limpieza SSPC-SP10 para garantizar 5+ años de vida útil.',
        'El volumen de sólidos en Antifouling es del 58%, permitiendo coberturas eficientes con 2 manos.',
        'Los tiempos de repintado estrictos evitan el fallo de adherencia intercapa.'
      ],
      relatedMetrics: ['kpi-linea-marina']
    },
    {
      id: 'doc-politica-credito-descuentos',
      title: 'Política Comercial de Créditos, Comisiones y Descuentos Q3-Q4',
      category: 'politicas',
      categoryLabel: 'Políticas & Procesos',
      summary: 'Reglamento para la aprobación de líneas de crédito a astilleros y distribuidoras, márgenes mínimos por volumen y comisiones para la fuerza de ventas.',
      content: `
# Política Comercial de Créditos, Comisiones y Descuentos Q3-Q4 2026

## 1. Escala de Descuentos por Volumen de Compra
- **Nivel Bronce (S/ 5,000 a S/ 15,000/mes)**: Descuento base 5% sobre lista oficial.
- **Nivel Plata (S/ 15,001 a S/ 45,000/mes)**: Descuento del 9% + Flete gratuito en Lima Metropolitana.
- **Nivel Oro / Astilleros (> S/ 45,000/mes)**: Descuento especial de 14% previa autorización del Gerente Comercial.

## 2. Condiciones para Aprobación de Crédito Directo
1. **Crédito 30 días**: Evaluación crediticia Infocorp / Sentinel verde + 3 referencias comerciales activas.
2. **Crédito 60 días (Exclusivo Astilleros Pesqueros)**: Requiere Pagaré firmado por el representante legal + orden de compra validada.
3. **Monto Máximo Inicial**: S/ 30,000 de línea renovable.

## 3. Esquema de Comisiones para Agentes Comerciales
- **Cuota Cumplida 80-99%**: 3.5% de comisión sobre ventas cobradas.
- **Cuota Cumplida 100-119%**: 5.0% de comisión + Bono de S/ 800.00.
- **Cuota Cumplida > 120%**: 6.5% de comisión acelerada sobre el excedente.
      `,
      author: 'Gerencia Financiera & Comercial',
      lastUpdated: '15 de Julio, 2026',
      version: 'v2.0',
      readingTime: '4 min',
      tags: ['Créditos', 'Descuentos', 'Comisiones', 'Astilleros', 'Ventas'],
      featured: true,
      outline: [
        { id: 'sec-p1', title: '1. Escala de Descuentos por Volumen', level: 2 },
        { id: 'sec-p2', title: '2. Condiciones para Aprobación de Crédito Directo', level: 2 },
        { id: 'sec-p3', title: '3. Esquema de Comisiones para Agentes', level: 2 }
      ],
      keyTakeaways: [
        'Descuento máximo autorizado sin firma gerencial es del 9%.',
        'Línea de crédito a 60 días reservada exclusivamente para el sector Astilleros.',
        'Comisión acelerada al 6.5% al superar el 120% de la cuota mensual.'
      ]
    },
    {
      id: 'doc-reporte-ejecutivo-q2',
      title: 'Reporte Financiero y Operativo H1 2026',
      category: 'financiero',
      categoryLabel: 'Financiero & Ventas',
      summary: 'Consolidado de ingresos, costos de materias primas (resinas epóxicas y solventes) y rentabilidad neta del primer semestre.',
      content: `
# Reporte Financiero y Operativo H1 2026 (Consolidado)

## 1. Resumen Ejecutivo de Desempeño
Durante el primer semestre del 2026, Jhomeron alcanzó una facturación neta de **S/ 2,140,000.00**, lo que representa un incremento del 16.5% en comparación con el mismo período de 2025.

## 2. Análisis del Margen por Categoría
- **Línea Marina**: Margen bruto de 42.1% debido a la optimización de compras de resina epóxica en volumen de importación directa.
- **Acabados Alquídicos**: Margen del 31.5% afectado moderadamente por el alza internacional en dióxido de titanio.
- **Línea Industrial Epóxica**: Margen del 39.0%.

## 3. Plan de Inversión y Expansión H2 2026
- Ampliación de la planta de mezclado en un 25% para atender la demanda pesquera del norte.
- Certificación ISO 9001:2015 en proceso final para licitaciones estatales y mineras.
      `,
      author: 'Dirección General Jhomeron',
      lastUpdated: '01 de Julio, 2026',
      version: 'v1.0',
      readingTime: '5 min',
      tags: ['Reporte H1', 'Finanzas', 'Margen Bruto', 'Inversión', 'Estrategia'],
      featured: false,
      outline: [
        { id: 'sec-r1', title: '1. Resumen Ejecutivo de Desempeño', level: 2 },
        { id: 'sec-r2', title: '2. Análisis del Margen por Categoría', level: 2 },
        { id: 'sec-r3', title: '3. Plan de Inversión y Expansión H2', level: 2 }
      ],
      keyTakeaways: [
        'Facturación H1 superó los S/ 2.14M con un crecimiento del 16.5%.',
        'La importación directa de resinas epóxicas elevó el margen marino al 42.1%.'
      ]
    },
    {
      id: 'doc-manual-procesos-calidad',
      title: 'Protocolo de Control de Calidad y Mezclado en Planta',
      category: 'procesos',
      categoryLabel: 'Procesos & Calidad',
      summary: 'Procedimientos operativos estándar para el control de viscosidad, molienda Hegman y pruebas de adherencia por corte de rejilla.',
      content: `
# Protocolo de Control de Calidad y Mezclado Jhomeron

## 1. Pruebas Obligatorias por Lote de Producción
Todo lote de pintura producida en nuestra planta debe someterse a los siguientes controles antes del envasado:
1. **Grado de Molienda (Escala Hegman)**: Mínimo 6 Hegman para acabados epóxicos marinos.
2. **Viscosidad Krebs-Stormer**: Tolerancia +/- 5 KU según la hoja técnica del producto.
3. **Prueba de Secado en Cuarto Térmico (ASTM D1640)**: Verificación de secado duro a 24 horas.
4. **Adherencia por Corte de Rejilla (ASTM D3359)**: Calificación mínima 4B / 5B sobre sustrato chorreado.

## 2. Gestión de Lotes y Trazabilidad
Cada balde o galón debe llevar estampado el número de lote (Ej. **L-20260811-04**), fecha de fabricación y fecha de caducidad (24 meses para epóxicos y alquídicos).
      `,
      author: 'Departamento de Control de Calidad',
      lastUpdated: '10 de Junio, 2026',
      version: 'v3.1',
      readingTime: '4 min',
      tags: ['Calidad', 'Pruebas ASTM', 'Viscosidad', 'Hegman', 'Procesos Planta'],
      featured: false,
      outline: [
        { id: 'sec-c1', title: '1. Pruebas Obligatorias por Lote', level: 2 },
        { id: 'sec-c2', title: '2. Gestión de Lotes y Trazabilidad', level: 2 }
      ],
      keyTakeaways: [
        'Ningún lote sale a despacho sin la firma del Certificado de Análisis por CC.',
        'La tolerancia máxima de viscosidad permitida es de +/- 5 KU.'
      ]
    }
  ];

  // Signals for state
  public readonly selectedDocument = signal<BusinessDocument>(this.documentsData[0]);

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

  getBusinessDocuments(): Observable<BusinessDocument[]> {
    return of(this.documentsData);
  }

  getDocumentById(id: string): Observable<BusinessDocument | undefined> {
    const doc = this.documentsData.find(d => d.id === id);
    return of(doc);
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
