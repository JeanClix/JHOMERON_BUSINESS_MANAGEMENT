import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AiAnalysisResponse, ProcessingStage, ChatMessage, ChatPresetPrompt } from '../models/chat.model';
import { KpiMetric } from '../models/kpi.model';
import { BusinessChartData } from '../models/chart.model';
import { InsightCard } from '../models/insight.model';

@Injectable({
  providedIn: 'root'
})
export class GerenciaChatService {

  // Signals for DeepWiki Query Flow
  public readonly processingStage = signal<ProcessingStage>('idle');
  public readonly processingMessage = signal<string>('');
  public readonly activeAnalysis = signal<AiAnalysisResponse | null>(null);
  public readonly queryHistory = signal<string[]>([
    '¿Cómo están las ventas este mes?',
    '¿Cuáles son los productos más vendidos?',
    'Compara las ventas de este mes con el anterior',
    'Explícame el comportamiento de las ventas'
  ]);

  // Preset Quick Prompts
  private readonly presetPrompts: ChatPresetPrompt[] = [
    {
      id: 'p-sales-month',
      icon: 'fa-solid fa-chart-line',
      title: 'Ventas del Mes',
      prompt: '¿Cómo están las ventas este mes?',
      category: 'ventas'
    },
    {
      id: 'p-top-products',
      icon: 'fa-solid fa-trophy',
      title: 'Productos Top',
      prompt: '¿Cuáles son los productos más vendidos?',
      category: 'marina'
    },
    {
      id: 'p-period-comp',
      icon: 'fa-solid fa-[#0d3393] fa-arrow-right-arrow-left',
      title: 'Comparativa de Períodos',
      prompt: 'Compara las ventas de este mes con el anterior',
      category: 'ventas'
    },
    {
      id: 'p-trend-behavior',
      icon: 'fa-solid fa-lightbulb',
      title: 'Análisis de Comportamiento',
      prompt: 'Explícame el comportamiento de las ventas',
      category: 'rentabilidad'
    }
  ];

  // Initial Chat History
  private readonly messagesSignal = signal<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      content: `¡Hola! Soy el **Copiloto de Inteligencia Empresarial para Gerencia** 🤖.
Puedes realizar cualquier consulta en la barra inferior para generar visualizaciones, análisis y resúmenes ejecutivos estilo DeepWiki.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  public readonly messages = this.messagesSignal.asReadonly();

  constructor(private router: Router) {}

  getPresetPrompts(): ChatPresetPrompt[] {
    return this.presetPrompts;
  }

  /**
   * Execute DeepWiki Query Flow with Simulated Step-by-Step Processing
   */
  async submitQuery(queryText: string): Promise<void> {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    // Add query to history if not present
    if (!this.queryHistory().includes(trimmed)) {
      this.queryHistory.update(history => [trimmed, ...history]);
    }

    // Step 1: Analyzing query
    this.processingStage.set('analyzing_query');
    this.processingMessage.set('🤖 Analizando consulta...');
    this.router.navigate(['/gerencia/analisis']);
    await this.sleep(300);

    // Step 2: Fetching data
    this.processingStage.set('fetching_data');
    this.processingMessage.set('🤖 Analizando información...');
    await this.sleep(350);

    // Step 3: Preparing analysis
    this.processingStage.set('preparing_analysis');
    this.processingMessage.set('🤖 Preparando análisis...');
    await this.sleep(300);

    // Step 4: Generating visualization
    this.processingStage.set('generating_visualization');
    this.processingMessage.set('🤖 Generando visualización...');
    await this.sleep(350);

    // Step 5: Completed
    const mockResponse = this.generateMockAnalysis(trimmed);
    this.activeAnalysis.set(mockResponse);
    this.processingStage.set('completed');
    this.processingMessage.set('✓ Análisis completado');
  }

  resetToDashboard(): void {
    this.processingStage.set('idle');
    this.activeAnalysis.set(null);
    this.router.navigate(['/gerencia/dashboard']);
  }

  /**
   * Chat message service fallback (for legacy chat view)
   */
  sendMessage(userQuery: string): Observable<ChatMessage> {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      content: userQuery,
      timestamp: timeStr
    };
    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    
    // Also trigger DeepWiki Flow
    this.submitQuery(userQuery);

    const responseMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'assistant',
      content: `Se ha generado el análisis de gerencia para: **"${userQuery}"**.`,
      timestamp: timeStr
    };
    return of(responseMsg).pipe(delay(600));
  }

  clearHistory(): void {
    this.queryHistory.set([
      '¿Cómo están las ventas este mes?',
      '¿Cuáles son los productos más vendidos?',
      'Compara las ventas de este mes con el anterior',
      'Explícame el comportamiento de las ventas'
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate Enriched DeepWiki Response Mock Data
   */
  private generateMockAnalysis(query: string): AiAnalysisResponse {
    const q = query.toLowerCase();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (q.includes('productos') || q.includes('vendidos') || q.includes('ranking')) {
      return {
        id: `analysis-${Date.now()}`,
        query,
        timestamp: timeStr,
        summary: `El análisis comercial refleja un liderazgo absoluto de los recubrimientos marinos anticorrosivos. El **Primer Epóxico Marino 2K** encabeza la facturación con S/ 98,500.00 (680 galones), seguido del **Antifouling Caucho Clorado** con S/ 74,200.00.`,
        kpis: [
          {
            id: 'kpi-top-1',
            title: 'SKU #1 Facturación',
            value: 'S/ 98,500',
            subtitle: 'Primer Epóxico 2K',
            numericValue: 98500,
            changePercent: 24.5,
            changeType: 'increase',
            comparisonLabel: 'vs mes anterior',
            icon: 'fa-solid fa-trophy',
            colorTheme: 'blue',
            badge: '680 Galones'
          },
          {
            id: 'kpi-top-2',
            title: 'SKU #2 Antifouling',
            value: 'S/ 74,200',
            subtitle: 'Antifouling Caucho',
            numericValue: 74200,
            changePercent: 18.2,
            changeType: 'increase',
            comparisonLabel: 'vs mes anterior',
            icon: 'fa-solid fa-ship',
            colorTheme: 'red',
            badge: '353 Galones'
          },
          {
            id: 'kpi-top-share',
            title: 'Cuota Línea Marina',
            value: '48.1%',
            subtitle: 'Del total de fábrica',
            numericValue: 48.1,
            changePercent: 5.4,
            changeType: 'increase',
            comparisonLabel: 'vs Q2',
            icon: 'fa-solid fa-chart-pie',
            colorTheme: 'indigo'
          }
        ],
        chart: {
          id: 'chart-top-products-res',
          title: 'Ranking de Facturación por Producto (S/)',
          subtitle: 'Top 5 SKUs de mayor rendimiento comercial en Agosto 2026',
          type: 'bar',
          labels: [
            'Primer Epóxico Marino 2K',
            'Antifouling Caucho Clorado',
            'Esmalte Epóxico Bituminoso',
            'Acabado Alquídico Brillo',
            'Epóxico Poliamida Alto Espesor'
          ],
          datasets: [
            {
              label: 'Ventas en Soles (S/)',
              data: [98500, 74200, 46800, 42100, 36900],
              backgroundColor: ['#0d3393', '#ef0606', '#10b981', '#3b82f6', '#8b5cf6'],
              borderWidth: 1
            }
          ],
          summaryNote: 'Los productos marinos acumulan más del 70% de la facturación del Top 5.'
        },
        table: {
          title: 'Detalle de Movimiento e Inventario Top SKUs',
          subtitle: 'Datos de ventas y stock en almacén al día de hoy',
          columns: [
            { key: 'code', label: 'Código SKU', align: 'left' },
            { key: 'name', label: 'Producto', align: 'left' },
            { key: 'category', label: 'Línea', align: 'center', isBadge: true },
            { key: 'volume', label: 'Volumen Sold', align: 'right' },
            { key: 'revenue', label: 'Facturación Total', align: 'right', isCurrency: true },
            { key: 'stock', label: 'Stock Almacén', align: 'right' }
          ],
          rows: [
            { code: 'JHM-MAR-EPOX01', name: 'Primer Epóxico Marino 2K', category: 'Epóxico', volume: '680 gal', revenue: 98500, stock: '45 gal' },
            { code: 'JHM-MAR-CAU03', name: 'Antifouling Caucho Clorado', category: 'Caucho', volume: '353 gal', revenue: 74200, stock: '32 gal' },
            { code: 'JHM-MAR-BIT04', name: 'Esmalte Epóxico Bituminoso', category: 'Epóxico', volume: '283 gal', revenue: 46800, stock: '18 gal' },
            { code: 'JHM-MAR-ALQ02', name: 'Acabado Alquídico Brillo', category: 'Alquídico', volume: '475 gal', revenue: 42100, stock: '120 gal' },
            { code: 'JHM-IND-EPOX05', name: 'Epóxico Poliamida Alto Espesor', category: 'Epóxico', volume: '210 gal', revenue: 36900, stock: '60 gal' }
          ]
        },
        insights: [
          {
            id: 'ins-cross-sell',
            title: 'Oportunidad de Venta Cruzada (Epóxico + Antifouling)',
            category: 'marina',
            categoryLabel: 'Comercial',
            impactLevel: 'alto',
            impactBadgeColor: 'bg-[#0d3393] text-white',
            summary: 'El 82% de los clientes que compran Primer Epóxico 2K también requieren Antifouling para embarcaciones.',
            description: 'Se recomienda ofrecer kits en combo para mantenimiento de cascos con un 3% de descuento promocional.',
            keyMetric: '82% Coincidencia de compra',
            recommendation: 'Lanzar el "Kit Pintado Marino Pro" para astilleros.',
            date: '11 de Agosto, 2026'
          }
        ],
        recommendations: [
          'Priorizar la producción de 500 galones adicionales de Primer Epóxico 2K debido al stock crítico (45 gal).',
          'Establecer acuerdos de consignación con distribuidoras del Callao y Paita para asegurar disponibilidad en temporada alta.'
        ],
        sources: [
          { title: 'Manual Técnico de Pintado Marino', docId: 'doc-linea-marina-manual' },
          { title: 'Inventario de Planta Jhomeron Agosto', docId: 'dashboard' }
        ]
      };
    }

    if (q.includes('compar') || q.includes('anterior') || q.includes('período')) {
      return {
        id: `analysis-${Date.now()}`,
        query,
        timestamp: timeStr,
        summary: `Al comparar las ventas de **Agosto (S/ 384,500.00)** frente a **Julio (S/ 335,000.00)**, se observa un incremento neto de **S/ 49,500.00 (+14.8%)**. La mayor aceleración proviene del sector Astilleros en Callao y Paita.`,
        kpis: [
          {
            id: 'kpi-comp-current',
            title: 'Agosto 2026 (Actual)',
            value: 'S/ 384,500',
            subtitle: 'Al día 11 del mes',
            numericValue: 384500,
            changePercent: 14.8,
            changeType: 'increase',
            comparisonLabel: 'vs Julio',
            icon: 'fa-solid fa-calendar-check',
            colorTheme: 'blue'
          },
          {
            id: 'kpi-comp-prev',
            title: 'Julio 2026 (Anterior)',
            value: 'S/ 335,000',
            subtitle: 'Cierre total de mes',
            numericValue: 335000,
            changePercent: 8.2,
            changeType: 'increase',
            comparisonLabel: 'vs Junio',
            icon: 'fa-solid fa-calendar-minus',
            colorTheme: 'slate'
          },
          {
            id: 'kpi-comp-diff',
            title: 'Crecimiento Neto',
            value: '+S/ 49,500',
            subtitle: '+14.8% Variación',
            numericValue: 49500,
            changePercent: 14.8,
            changeType: 'increase',
            comparisonLabel: 'Diferencia mensual',
            icon: 'fa-solid fa-arrow-trend-up',
            colorTheme: 'emerald'
          }
        ],
        chart: {
          id: 'chart-comp-res',
          title: 'Comparativa de Facturación por Categoría (Julio vs Agosto)',
          subtitle: 'Evolución de las 4 líneas principales de producto',
          type: 'bar',
          labels: ['Línea Epóxica Marina', 'Acabados Alquídicos', 'Antifouling Caucho', 'Bituminoso / Especiales'],
          datasets: [
            {
              label: 'Julio 2026 (S/)',
              data: [152000, 79000, 58000, 46000],
              backgroundColor: 'rgba(148, 163, 184, 0.7)',
              borderColor: '#64748b',
              borderWidth: 1
            },
            {
              label: 'Agosto 2026 (S/)',
              data: [185200, 84500, 68000, 46800],
              backgroundColor: '#0d3393',
              borderColor: '#0b2670',
              borderWidth: 1
            }
          ],
          summaryNote: 'La Línea Epóxica Marina creció S/ 33.2k, representando el 67% del crecimiento total del mes.'
        },
        table: {
          title: 'Matriz Comparativa de Variación por Categoría',
          columns: [
            { key: 'category', label: 'Categoría de Producto', align: 'left' },
            { key: 'julio', label: 'Julio 2026', align: 'right', isCurrency: true },
            { key: 'agosto', label: 'Agosto 2026', align: 'right', isCurrency: true },
            { key: 'diff', label: 'Diferencia Soles', align: 'right', isCurrency: true },
            { key: 'growth', label: 'Variación %', align: 'center', isBadge: true }
          ],
          rows: [
            { category: 'Línea Epóxica Marina', julio: 152000, agosto: 185200, diff: 33200, growth: '+21.8%' },
            { category: 'Acabados Alquídicos', julio: 79000, agosto: 84500, diff: 5500, growth: '+7.0%' },
            { category: 'Antifouling Caucho Clorado', julio: 58000, agosto: 68000, diff: 10000, growth: '+17.2%' },
            { category: 'Epóxico Bituminoso', julio: 46000, agosto: 46800, diff: 800, growth: '+1.7%' }
          ]
        },
        insights: [
          {
            id: 'ins-growth-north',
            title: 'Aceleración en Plazas de Paita y Callao',
            category: 'marina',
            categoryLabel: 'Mercado',
            impactLevel: 'alto',
            impactBadgeColor: 'bg-emerald-600 text-white',
            summary: 'El reinicio de flota pesquera impulsó un incremento del 21.8% en epóxicos marinos.',
            description: 'Las compras preventivas para mantenimiento de barcos han acelerado el consumo antes de la temporada de pesca.',
            keyMetric: '+21.8% en epóxicos',
            recommendation: 'Asegurar despacho semanal a distribuidores de Paita.',
            date: '11 de Agosto, 2026'
          }
        ],
        recommendations: [
          'Mantener el ritmo de abastecimiento en resinas epóxicas para evitar quiebres de stock en el cierre de Agosto.',
          'Revisar las metas comerciales de Q4 al alza en un 10% dado el rendimiento del sector marítimo.'
        ]
      };
    }

    if (q.includes('comportamiento') || q.includes('tendencia') || q.includes('margen') || q.includes('explic')) {
      return {
        id: `analysis-${Date.now()}`,
        query,
        timestamp: timeStr,
        summary: `El comportamiento de las ventas muestra una **tendencia fuertemente ascendente** en los últimos 4 meses, impulsada por la profesionalización técnica de la fuerza de ventas y acuerdos con grandes astilleros. El **margen bruto se consolida en 38.4%**.`,
        kpis: [
          {
            id: 'kpi-beh-margin',
            title: 'Margen Bruto Global',
            value: '38.4%',
            subtitle: '+6.4% sobre industria',
            numericValue: 38.4,
            changePercent: 3.2,
            changeType: 'increase',
            comparisonLabel: 'vs H1 2026',
            icon: 'fa-solid fa-sack-dollar',
            colorTheme: 'emerald'
          },
          {
            id: 'kpi-beh-ticket',
            title: 'Ticket Promedio',
            value: 'S/ 8,350',
            subtitle: '46 Cuentas Activas',
            numericValue: 8350,
            changePercent: -1.8,
            changeType: 'decrease',
            comparisonLabel: 'vs objetivo',
            icon: 'fa-solid fa-receipt',
            colorTheme: 'amber'
          },
          {
            id: 'kpi-beh-target',
            title: 'Proyección Cierre Agosto',
            value: 'S/ 410,000',
            subtitle: 'Meta: S/ 420,000',
            numericValue: 410000,
            changePercent: 12.4,
            changeType: 'increase',
            comparisonLabel: 'Proyección final',
            icon: 'fa-solid fa-chart-line',
            colorTheme: 'blue'
          }
        ],
        chart: {
          id: 'chart-behavior-res',
          title: 'Evolución Acumulada de Ventas y Proyección (2026)',
          subtitle: 'Comportamiento mensual de ventas reales (en miles S/)',
          type: 'line',
          labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago (Proy)'],
          datasets: [
            {
              label: 'Ventas Reales (S/)',
              data: [290, 310, 345, 330, 368, 372, 384.5, 410],
              borderColor: '#0d3393',
              backgroundColor: 'rgba(13, 51, 147, 0.15)',
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
          summaryNote: 'Curva ascendente continua desde Mayo 2026.'
        },
        table: {
          title: 'Comportamiento Mensual de Ingresos y Margen Bruto',
          columns: [
            { key: 'month', label: 'Mes', align: 'left' },
            { key: 'sales', label: 'Ventas Reales', align: 'right', isCurrency: true },
            { key: 'target', label: 'Meta', align: 'right', isCurrency: true },
            { key: 'margin', label: 'Margen Bruto', align: 'center', isBadge: true },
            { key: 'status', label: 'Estado', align: 'center', isBadge: true }
          ],
          rows: [
            { month: 'Mayo 2026', sales: 368000, target: 360000, margin: '37.8%', status: 'Superado' },
            { month: 'Junio 2026', sales: 372000, target: 370000, margin: '38.0%', status: 'Superado' },
            { month: 'Julio 2026', sales: 384500, target: 390000, margin: '38.4%', status: '98.5%' },
            { month: 'Agosto (Proy)', sales: 410000, target: 420000, margin: '38.6%', status: 'En Proceso' }
          ]
        },
        insights: [
          {
            id: 'ins-margin-opt-2',
            title: 'Estabilidad de Margen por Importación de Resina Epóxica',
            category: 'rentabilidad',
            categoryLabel: 'Operaciones',
            impactLevel: 'oportunidad',
            impactBadgeColor: 'bg-emerald-600 text-white',
            summary: 'La compra consolidada de insumos ha blindado el margen bruto frente a la inflación.',
            description: 'El costo por galón epóxico producido se redujo un 6.2% gracias a la importación directa.',
            keyMetric: '38.4% Margen consolidado',
            recommendation: 'Ampliar contratos anuales con proveedores de catalizadores.',
            date: '11 de Agosto, 2026'
          }
        ],
        recommendations: [
          'Mantener la estrategia de empaquetado de productos de alto margen (Epóxicos + Antifouling).',
          'Monitorear la cotización del dióxido de titanio para proteger la línea alquídica.'
        ]
      };
    }

    // General Default Sales Analysis Response
    return {
      id: `analysis-${Date.now()}`,
      query,
      timestamp: timeStr,
      summary: `Resumen de Inteligencia Gerencial para **"${query}"**: Las ventas actuales de fábrica alcanzan **S/ 384,500.00** con un cumplimiento del **91.5%** sobre la meta de Agosto. El desempeño general muestra estabilidad financiera y excelente rentabilidad.`,
      kpis: [
        {
          id: 'kpi-gen-1',
          title: 'Ventas Acumuladas',
          value: 'S/ 384,500',
          subtitle: '91.5% de Meta',
          numericValue: 384500,
          changePercent: 14.8,
          changeType: 'increase',
          comparisonLabel: 'vs mes previo',
          icon: 'fa-solid fa-chart-line',
          colorTheme: 'blue'
        },
        {
          id: 'kpi-gen-2',
          title: 'Margen Bruto',
          value: '38.4%',
          subtitle: 'Saludable',
          numericValue: 38.4,
          changePercent: 3.2,
          changeType: 'increase',
          comparisonLabel: 'vs Q2',
          icon: 'fa-solid fa-sack-dollar',
          colorTheme: 'emerald'
        }
      ],
      chart: {
        id: 'chart-gen-res',
        title: 'Evolución General de Ventas (2026)',
        type: 'line',
        labels: ['May', 'Jun', 'Jul', 'Ago'],
        datasets: [
          {
            label: 'Ventas (S/)',
            data: [368, 372, 384.5, 410],
            borderColor: '#0d3393',
            backgroundColor: 'rgba(13, 51, 147, 0.12)',
            fill: true,
            tension: 0.3,
            borderWidth: 3
          }
        ]
      },
      table: {
        title: 'Resumen Consolidado de Facturación',
        columns: [
          { key: 'metric', label: 'Indicador', align: 'left' },
          { key: 'val', label: 'Valor', align: 'right' },
          { key: 'status', label: 'Estado', align: 'center', isBadge: true }
        ],
        rows: [
          { metric: 'Facturación Mensual', val: 'S/ 384,500.00', status: 'Conforme' },
          { metric: 'Cuota Cumplida', val: '91.5%', status: 'En Meta' },
          { metric: 'Línea Destacada', val: 'Línea Marina (48.1%)', status: 'Líder' }
        ]
      },
      recommendations: [
        'Continuar el seguimiento de proformas pesqueras en el Callao y Paita.',
        'Revisar las líneas de crédito asignadas a astilleros de mayor volumen.'
      ],
      sources: [
        { title: 'DeepWiki Repositorio Jhomeron', docId: 'doc-linea-marina-manual' }
      ]
    };
  }
}
