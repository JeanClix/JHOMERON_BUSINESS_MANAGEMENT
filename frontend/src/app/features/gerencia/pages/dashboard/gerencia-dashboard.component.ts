import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GerenciaDataService } from '../../../../core/services/gerencia-data.service';
import { ReportingService } from '../../../../core/services/reporting.service';
import { KpiMetric } from '../../../../core/models/kpi.model';
import { BusinessChartData } from '../../../../core/models/chart.model';
import { InsightCard } from '../../../../core/models/insight.model';
import {
  ClienteTopGerencia,
  DepartamentoVentas,
  ProductoGerencia,
  VentasMes
} from '../../../../core/models/reporting.model';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { BusinessChartComponent } from '../../../../shared/components/business-chart/business-chart.component';
import { InsightCardComponent } from '../../../../shared/components/insight-card/insight-card.component';
import { ForecastComparisonCardComponent } from '../../../../shared/components/forecast-comparison-card/forecast-comparison-card.component';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';
import { PrediccionService } from '../../../../core/services/prediccion.service';
import { PrediccionProximoMes } from '../../../../core/models/prediccion.model';

@Component({
  selector: 'app-gerencia-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    BusinessChartComponent,
    InsightCardComponent,
    ForecastComparisonCardComponent
  ],
  template: `
    <div class="space-y-6">
      <!-- Executive Welcome Banner -->
      <div class="rounded-2xl bg-gradient-to-r from-[#0c2461] via-[#0d3393] to-[#1e40af] p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="space-y-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Resumen Gerencial — {{ periodoLabel() }}
          </span>

          <h1 class="text-2xl md:text-3xl font-black tracking-tight text-white">
            Panel Ejecutivo de Inteligencia & Decisiones
          </h1>

          <p class="text-xs text-slate-200 max-w-2xl leading-relaxed">
            Consolidado de ventas, tendencia mensual, productos y clientes con más movimiento, sobre datos reales del Data Warehouse.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            (click)="navigateToChat('¿Cómo van las ventas este mes?')"
            class="rounded-xl bg-[#ef0606] hover:bg-[#c70505] text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md flex items-center gap-2"
          >
            <i class="fa-solid fa-robot"></i>
            <span>Consultar IA Gerencial</span>
          </button>
        </div>
      </div>

      @if (errorReporte()) {
        <div class="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 flex items-center gap-2">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>{{ errorReporte() }}</span>
        </div>
      }

      <!-- Filtro de mes -->
      <div class="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
        <div class="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <i class="fa-solid fa-calendar-days text-[#0d3393]"></i>
          <span>Período del reporte</span>
          @if (cargandoReporte()) {
            <i class="fa-solid fa-circle-notch fa-spin text-[#0d3393] ml-1"></i>
          }
        </div>
        <div class="flex items-center gap-2">
          <button
            (click)="mesAnterior()"
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#0d3393] hover:bg-slate-200 transition-colors"
            title="Mes anterior"
          >
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <span class="text-xs font-bold text-slate-900 min-w-[10rem] text-center">{{ periodoLabel() }}</span>
          <button
            (click)="mesSiguiente()"
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#0d3393] hover:bg-slate-200 transition-colors"
            title="Mes siguiente"
          >
            <i class="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>
      </div>

      <!-- Executive KPIs Grid (datos reales de backend/reporting) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (kpi of kpis(); track kpi.id) {
          <app-kpi-card [metric]="kpi"></app-kpi-card>
        }

        <!-- Bloqueado hasta Fase 2: requiere costo/categoría en el pipeline del batch -->
        <div class="rounded-2xl bg-slate-50 p-5 border border-dashed border-slate-300 flex flex-col justify-center items-center text-center gap-1.5" title="Requiere que el batch extraiga costo (COGS) de SAP -- ver TODO.md">
          <i class="fa-solid fa-lock text-slate-400"></i>
          <span class="text-xs font-bold text-slate-500">Margen Bruto Operativo</span>
          <span class="text-[10px] text-slate-400">Pendiente: falta costo en el pipeline (Fase 2)</span>
        </div>
      </div>

      <!-- Real vs. Predicción ML (Random Forest, Model Registry MLflow) -->
      @if (prediccion()) {
        <app-forecast-comparison-card [prediccion]="prediccion()!"></app-forecast-comparison-card>
      } @else if (errorPrediccion()) {
        <div class="rounded-2xl bg-white p-5 border border-rose-200 shadow-xs text-xs text-rose-600">
          <i class="fa-solid fa-triangle-exclamation mr-1.5"></i>
          No se pudo cargar la predicción del ML Service ({{ errorPrediccion() }}).
        </div>
      }

      <!-- Main Business Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        @if (chartTendencia()) {
          <app-business-chart [chartData]="chartTendencia()!"></app-business-chart>
        }
        @if (chartTopProductos()) {
          <app-business-chart [chartData]="chartTopProductos()!"></app-business-chart>
        }
      </div>

      <!-- Departamentos & Clientes que más consumen -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        @if (chartDepartamentos()) {
          <app-business-chart [chartData]="chartDepartamentos()!"></app-business-chart>
        }

        <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-[#0d3393]"></span>
              Clientes que Más Consumen
            </h3>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {{ periodoLabel() }}
            </span>
          </div>
          <p class="text-xs text-slate-500 mb-4">Ordenados por cantidad de productos distintos comprados en el mes.</p>

          @if (topClientes().length) {
            <div class="space-y-2 flex-1">
              @for (c of topClientes(); track c.cliente) {
                <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
                  <div class="min-w-0 pr-2">
                    <span class="font-bold text-slate-900 block truncate">{{ c.cliente }}</span>
                    <span class="text-slate-400 text-[10px]">{{ c.departamento }} · {{ c.productos_distintos }} productos distintos</span>
                  </div>
                  <strong class="text-[#0d3393] font-bold whitespace-nowrap">S/ {{ c.total_soles | number:'1.2-2' }}</strong>
                </div>
              }
            </div>
          } @else {
            <p class="text-xs text-slate-400 text-center py-8">Sin ventas registradas en {{ periodoLabel() }}.</p>
          }
        </div>
      </div>

      <!-- Bloqueado hasta Fase 2: margen y consumo por línea/categoría -->
      <div class="rounded-2xl bg-slate-50 p-5 border border-dashed border-slate-300 flex items-center gap-3">
        <i class="fa-solid fa-lock text-slate-400 text-lg"></i>
        <div>
          <span class="text-xs font-bold text-slate-500 block">Margen y consumo por línea/categoría de producto — pendiente (Fase 2)</span>
          <span class="text-[11px] text-slate-400">
            Requiere que el batch extraiga la categoría (OITB de SAP) y el costo de venta, que hoy no vienen en el SP de extracción.
            El mapa de departamentos de arriba sí es real; lo que falta es cruzarlo con "qué línea consume más" cada departamento.
          </span>
        </div>
      </div>

      <!-- Executive Insights Section (SIMULADO -- ver nota) -->
      <div class="space-y-4 pt-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-sparkles text-amber-500"></i>
              Insights Estratégicos Detectados
            </h2>
            <p class="text-xs text-slate-500">
              Análisis automatizado de oportunidades comerciales, márgenes y alertas operativas.
            </p>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
            Simulado — aún no conectado a un motor de insights real
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (insight of insights(); track insight.id) {
            <app-insight-card
              [insight]="insight"
              (askAi)="navigateToChat($event)"
            ></app-insight-card>
          }
        </div>
      </div>
    </div>
  `
})
export class GerenciaDashboardComponent {
  private readonly dataService = inject(GerenciaDataService);
  private readonly reportingService = inject(ReportingService);
  private readonly chatService = inject(GerenciaChatService);
  private readonly prediccionService = inject(PrediccionService);
  private readonly router = inject(Router);

  // Insights: sigue siendo contenido simulado (no hay todavía un motor de
  // IA que genere estos hallazgos sobre datos reales) -- ver badge "Simulado"
  // en el template. Documentación empresarial (getBusinessDocuments) tampoco
  // se toca acá, es una feature aparte (RAG futuro, ver README).
  protected readonly insights = signal<InsightCard[]>([]);

  protected readonly prediccion = signal<PrediccionProximoMes | null>(null);
  protected readonly errorPrediccion = signal<string | null>(null);

  // ============================================================
  // Reporte gerencial (backend/reporting, /gerencia/*) -- reemplaza los
  // KPIs y gráficos mockeados que había antes en este dashboard.
  // ============================================================

  private readonly hoy = new Date();
  protected readonly filtroAnio = signal<number>(this.hoy.getFullYear());
  protected readonly filtroMes = signal<number>(this.hoy.getMonth() + 1);

  protected readonly cargandoReporte = signal<boolean>(true);
  protected readonly errorReporte = signal<string | null>(null);

  protected readonly tendenciaAnio = signal<VentasMes[]>([]);
  protected readonly topProductos = signal<ProductoGerencia[]>([]);
  protected readonly topClientes = signal<ClienteTopGerencia[]>([]);
  protected readonly departamentos = signal<DepartamentoVentas[]>([]);
  protected readonly ticketPromedioActual = signal<number | null>(null);
  protected readonly ticketPromedioAnterior = signal<number | null>(null);

  protected readonly periodoLabel = computed(() => {
    const fecha = new Date(this.filtroAnio(), this.filtroMes() - 1, 1);
    const texto = fecha.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  private readonly ventasMesActual = computed(
    () => this.tendenciaAnio().find((m) => m.mes === this.filtroMes())?.total_soles ?? 0
  );

  // null cuando el mes anterior cae en otro año (enero) -- la tendencia solo
  // trae el anio filtrado, evitar un segundo fetch para ese caso borde.
  private readonly ventasMesAnterior = computed<number | null>(() => {
    if (this.filtroMes() === 1) return null;
    return this.tendenciaAnio().find((m) => m.mes === this.filtroMes() - 1)?.total_soles ?? null;
  });

  protected readonly kpis = computed<KpiMetric[]>(() => {
    const ventasActual = this.ventasMesActual();
    const ventasAnterior = this.ventasMesAnterior();
    const ventasCambio = this.calcularCambioPorcentual(ventasActual, ventasAnterior);

    const ticketActual = this.ticketPromedioActual();
    const ticketAnterior = this.ticketPromedioAnterior();
    const ticketCambio = this.calcularCambioPorcentual(ticketActual, ticketAnterior);

    return [
      {
        id: 'kpi-ventas-mes',
        title: 'Ventas Mensuales Totales',
        value: `S/ ${this.formatoMiles(ventasActual)}`,
        subtitle: this.periodoLabel(),
        numericValue: ventasActual,
        unit: 'S/',
        changePercent: ventasCambio.valor,
        changeType: ventasCambio.tipo,
        comparisonLabel: ventasCambio.tipo === 'neutral' ? 'sin comparación disponible' : 'vs mes anterior',
        icon: 'fa-solid fa-chart-line',
        colorTheme: 'blue'
      },
      {
        id: 'kpi-ticket-promedio',
        title: 'Ticket Promedio por Cliente',
        value: ticketActual !== null ? `S/ ${this.formatoMiles(ticketActual)}` : '—',
        subtitle: 'Promedio de venta por cliente en el mes',
        numericValue: ticketActual ?? 0,
        unit: 'S/',
        changePercent: ticketCambio.valor,
        changeType: ticketCambio.tipo,
        comparisonLabel: ticketCambio.tipo === 'neutral' ? 'sin comparación disponible' : 'vs mes anterior',
        icon: 'fa-solid fa-receipt',
        colorTheme: 'amber'
      }
    ];
  });

  protected readonly chartTendencia = computed<BusinessChartData | null>(() => {
    const meses = this.tendenciaAnio();
    if (!meses.length) return null;
    const nombresMes = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    return {
      id: 'chart-tendencia-ventas',
      title: `Evolución de Ventas (${this.filtroAnio()})`,
      subtitle: 'Total de ventas por mes, datos reales del Data Warehouse',
      type: 'line',
      labels: meses.map((m) => nombresMes[m.mes - 1]),
      datasets: [
        {
          label: 'Ventas (S/)',
          data: meses.map((m) => m.total_soles),
          borderColor: '#0d3393',
          backgroundColor: 'rgba(13, 51, 147, 0.12)',
          fill: true,
          tension: 0.3,
          borderWidth: 3
        }
      ]
    };
  });

  protected readonly chartTopProductos = computed<BusinessChartData | null>(() => {
    const productos = this.topProductos();
    if (!productos.length) return null;
    return {
      id: 'chart-top-productos-gerencia',
      title: 'Top Productos por Facturación',
      subtitle: this.periodoLabel(),
      type: 'bar',
      labels: productos.map((p) => this.truncar(p.producto, 30)),
      datasets: [
        {
          label: 'Facturación (S/)',
          data: productos.map((p) => p.total_soles),
          backgroundColor: '#0d3393',
          borderWidth: 0
        }
      ]
    };
  });

  protected readonly chartDepartamentos = computed<BusinessChartData | null>(() => {
    const deps = this.departamentos();
    if (!deps.length) return null;
    return {
      id: 'chart-departamentos',
      title: 'Ventas por Departamento',
      subtitle: `${this.periodoLabel()} — ranking, no mapa geográfico (ver nota)`,
      type: 'bar',
      labels: deps.map((d) => d.departamento),
      datasets: [
        {
          label: 'Ventas (S/)',
          data: deps.map((d) => d.total_soles),
          backgroundColor: '#ef0606',
          borderWidth: 0
        }
      ],
      summaryNote: 'Ranking por departamento -- un mapa geográfico de Perú es una mejora visual pendiente, no bloqueada por datos.'
    };
  });

  constructor() {
    this.cargarTodo();
  }

  protected mesAnterior() {
    this.moverMes(-1);
    this.cargarReportePeriodo();
  }

  protected mesSiguiente() {
    this.moverMes(1);
    this.cargarReportePeriodo();
  }

  protected navigateToChat(prompt: string) {
    this.chatService.sendMessage(prompt);
    this.router.navigate(['/gerencia/chat']);
  }

  private moverMes(delta: number) {
    let mes = this.filtroMes() + delta;
    let anio = this.filtroAnio();
    if (mes < 1) {
      mes = 12;
      anio -= 1;
    } else if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    this.filtroMes.set(mes);
    this.filtroAnio.set(anio);
  }

  private async cargarTodo() {
    this.cargandoReporte.set(true);
    this.errorReporte.set(null);
    try {
      await Promise.all([this.cargarReportePeriodo(), this.cargarTendencia()]);
    } finally {
      this.cargandoReporte.set(false);
    }
    this.cargarPrediccion();
    this.dataService.getExecutiveInsights().subscribe((data) => this.insights.set(data));
  }

  /** Recarga todo lo que depende de anio/mes (KPIs, top productos/clientes, mapa). */
  private async cargarReportePeriodo() {
    this.cargandoReporte.set(true);
    try {
      const anio = this.filtroAnio();
      const mes = this.filtroMes();
      const mesAnteriorInfo = this.mesAnteriorDe(anio, mes);

      const [productos, clientes, deps, ticket, ticketAnterior, tendencia] = await Promise.all([
        this.reportingService.getTopProductosGerencia(anio, mes, 'desc', 6),
        this.reportingService.getTopClientesGerencia(anio, mes, 6),
        this.reportingService.getMapaDepartamentos(anio, mes),
        this.reportingService.getTicketPromedio(anio, mes),
        mesAnteriorInfo
          ? this.reportingService.getTicketPromedio(mesAnteriorInfo.anio, mesAnteriorInfo.mes)
          : Promise.resolve(null),
        // La tendencia se recarga solo si cambió el año (ver cargarTendencia);
        // acá se refresca siempre que cambia el mes/anio para no desincronizar
        // el KPI de "ventas mensuales" con el filtro visible.
        this.reportingService.getTendenciaVentas(anio)
      ]);

      this.topProductos.set(productos.productos);
      this.topClientes.set(clientes.clientes);
      this.departamentos.set(deps.departamentos);
      this.ticketPromedioActual.set(ticket.ticket_promedio);
      this.ticketPromedioAnterior.set(ticketAnterior?.ticket_promedio ?? null);
      this.tendenciaAnio.set(tendencia.meses);
      this.errorReporte.set(null);
    } catch (err) {
      this.errorReporte.set(this.mensajeErrorReporte());
    } finally {
      this.cargandoReporte.set(false);
    }
  }

  private async cargarTendencia() {
    try {
      const tendencia = await this.reportingService.getTendenciaVentas(this.filtroAnio());
      this.tendenciaAnio.set(tendencia.meses);
    } catch {
      // Ya se maneja el error general en cargarReportePeriodo(); esta carga
      // inicial en paralelo evita que la tendencia quede vacía en el primer render.
    }
  }

  private cargarPrediccion() {
    this.prediccionService.getPrediccionProximoMes(30).subscribe({
      next: (pred) => this.prediccion.set(pred),
      error: (err) => this.errorPrediccion.set(err?.status ? `HTTP ${err.status}` : 'sin conexión')
    });
  }

  private mesAnteriorDe(anio: number, mes: number): { anio: number; mes: number } | null {
    if (mes === 1) return { anio: anio - 1, mes: 12 };
    return { anio, mes: mes - 1 };
  }

  private calcularCambioPorcentual(
    actual: number | null,
    anterior: number | null
  ): { valor: number; tipo: 'increase' | 'decrease' | 'neutral' } {
    if (actual === null || anterior === null || anterior === 0) {
      return { valor: 0, tipo: 'neutral' };
    }
    const variacion = ((actual - anterior) / anterior) * 100;
    return {
      valor: Math.round(variacion * 10) / 10,
      tipo: variacion > 0 ? 'increase' : variacion < 0 ? 'decrease' : 'neutral'
    };
  }

  private mensajeErrorReporte(): string {
    return 'No se pudo cargar el reporte gerencial. Verifica que backend/reporting esté corriendo en ' +
      'localhost:8093 y que tu usuario tenga rol GERENCIA.';
  }

  private formatoMiles(valor: number): string {
    return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
  }

  private truncar(texto: string, max: number): string {
    return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
  }
}
