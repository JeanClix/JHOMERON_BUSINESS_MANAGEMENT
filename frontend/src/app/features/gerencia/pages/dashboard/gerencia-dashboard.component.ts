import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GerenciaDataService } from '../../../../core/services/gerencia-data.service';
import { ReportingService } from '../../../../core/services/reporting.service';
import { KpiMetric } from '../../../../core/models/kpi.model';
import { BusinessChartData } from '../../../../core/models/chart.model';
import { InsightCard } from '../../../../core/models/insight.model';
import {
  ClienteEnRiesgo,
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
import { PrediccionProximoMes, ProductoProyectado } from '../../../../core/models/prediccion.model';

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

      <!-- Filtro de período: mes / año + navegación (mismo patrón que el dashboard de Vendedores) -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
        <div class="flex items-center gap-2">
          <button
            (click)="setPeriodoModo('mes')"
            [class]="
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ' +
              (periodoModo() === 'mes' ? 'bg-[#0d3393] text-white' : 'bg-slate-200 text-slate-700')
            "
          >
            Por Mes
          </button>
          <button
            (click)="setPeriodoModo('anio')"
            [class]="
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ' +
              (periodoModo() === 'anio' ? 'bg-[#0d3393] text-white' : 'bg-slate-200 text-slate-700')
            "
          >
            Por Año
          </button>
          @if (cargandoReporte()) {
            <i class="fa-solid fa-circle-notch fa-spin text-[#0d3393] text-sm ml-1"></i>
          }
        </div>

        <div class="flex items-center gap-2">
          <button
            (click)="periodoAnterior()"
            [disabled]="!puedePeriodoAnterior()"
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#0d3393] hover:bg-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
            [title]="puedePeriodoAnterior() ? 'Período anterior' : 'No hay datos antes de este período'"
          >
            <i class="fa-solid fa-chevron-left text-xs"></i>
          </button>
          <span class="text-xs font-bold text-slate-900 min-w-[10rem] text-center">{{ periodoLabel() }}</span>
          <button
            (click)="periodoSiguiente()"
            [disabled]="!puedePeriodoSiguiente()"
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#0d3393] hover:bg-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
            [title]="puedePeriodoSiguiente() ? 'Período siguiente' : 'Ese período todavía no comienza'"
          >
            <i class="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>
      </div>

      <!-- Executive KPIs Grid (datos reales de backend/reporting) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (kpi of kpis(); track kpi.id) {
          <app-kpi-card [metric]="kpi" [explainable]="true" (explain)="explicarCarta(kpi.title)"></app-kpi-card>
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
        <app-forecast-comparison-card
          [prediccion]="prediccion()!"
          (explain)="explicarCarta('Pronóstico de Ventas del próximo mes')"
        ></app-forecast-comparison-card>
      } @else if (errorPrediccion()) {
        <div class="rounded-2xl bg-white p-5 border border-rose-200 shadow-xs text-xs text-rose-600">
          <i class="fa-solid fa-triangle-exclamation mr-1.5"></i>
          No se pudo cargar la predicción del ML Service ({{ errorPrediccion() }}).
        </div>
      }

      <!-- Main Business Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        @if (chartTendencia()) {
          <app-business-chart [chartData]="chartTendencia()!" [explainable]="true" (explain)="explicarCarta('Evolución de Ventas del año')"></app-business-chart>
        }
        @if (chartTopProductos()) {
          <app-business-chart [chartData]="chartTopProductos()!" [explainable]="true" (explain)="explicarCarta('Top Productos por Facturación')"></app-business-chart>
        }
      </div>

      <!-- Departamentos & Clientes que más consumen -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        @if (chartDepartamentos()) {
          <app-business-chart [chartData]="chartDepartamentos()!" [explainable]="true" (explain)="explicarCarta('Ventas por Departamento')"></app-business-chart>
        }

        <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-[#0d3393]"></span>
              Clientes que Más Consumen
            </h3>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                (click)="explicarCarta('Clientes que Más Consumen')"
                title="Preguntarle a la IA sobre esta lista"
                class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-[#0d3393] hover:text-white transition-colors"
              >
                <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              </button>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {{ periodoLabel() }}
              </span>
            </div>
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

      <!-- ML: productos con caída proyectada & clientes en riesgo -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-[#ef0606]"></span>
              Productos con Caída Proyectada
            </h3>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                (click)="explicarCarta('Productos con Caída Proyectada (predicción ML)')"
                title="Preguntarle a la IA sobre esta proyección"
                class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-[#0d3393] hover:text-white transition-colors"
              >
                <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              </button>
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                ML
              </span>
            </div>
          </div>
          <p class="text-xs text-slate-500 mb-4">
            Predicción próximos 30 días vs. nivel actual (Random Forest, ver tarjeta de pronóstico arriba). Solo caída: el
            ranking de crecimiento del modelo aún no es confiable para productos de bajo volumen.
          </p>

          @if (errorProductosProyectados()) {
            <p class="text-xs text-rose-500 text-center py-8">No se pudo cargar la proyección ({{ errorProductosProyectados() }}).</p>
          } @else if (productosCaidaProyectada().length) {
            <div class="space-y-2 flex-1">
              @for (p of productosCaidaProyectada(); track p.codigo_producto) {
                <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
                  <div class="min-w-0 pr-2">
                    <span class="font-bold text-slate-900 block truncate">{{ p.producto }}</span>
                    <span class="text-slate-400 text-[10px]">
                      S/ {{ p.ventas_actuales_soles | number:'1.0-0' }} actual → S/ {{ p.prediccion_soles | number:'1.0-0' }} proyectado
                    </span>
                  </div>
                  <strong class="text-[#ef0606] font-bold whitespace-nowrap">{{ p.cambio_pct }}%</strong>
                </div>
              }
            </div>
          } @else {
            <p class="text-xs text-slate-400 text-center py-8">Sin caídas proyectadas relevantes por ahora.</p>
          }
        </div>

        <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-[#ef0606]"></span>
              Clientes en Riesgo de Inactividad
            </h3>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                (click)="explicarCarta('Clientes en Riesgo de Inactividad')"
                title="Preguntarle a la IA sobre esta lista"
                class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-[#0d3393] hover:text-white transition-colors"
              >
                <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              </button>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {{ totalClientesEnRiesgo() }} en total
              </span>
            </div>
          </div>
          <p class="text-xs text-slate-500 mb-4">Entre 30 y 50 días sin comprar (cualquier vendedor), con historial real de compra.</p>

          @if (clientesEnRiesgo().length) {
            <div class="space-y-2 flex-1">
              @for (c of clientesEnRiesgo(); track c.ruc) {
                <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
                  <div class="min-w-0 pr-2">
                    <span class="font-bold text-slate-900 block truncate">{{ c.cliente }}</span>
                    <span class="text-slate-400 text-[10px]">{{ c.departamento }} · {{ c.dias_desde_ultima_compra }} días sin comprar</span>
                  </div>
                  <strong class="text-[#0d3393] font-bold whitespace-nowrap">S/ {{ c.total_soles_historico | number:'1.0-0' }}</strong>
                </div>
              }
            </div>
          } @else {
            <p class="text-xs text-slate-400 text-center py-8">Sin clientes en riesgo por ahora.</p>
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

      <!-- Executive Insights Section -- generados por el AI Service una vez
           por período (ver insights.py), no en cada visita. -->
      <div class="space-y-4 pt-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-sparkles text-amber-500"></i>
              Oportunidades de Mejora Detectadas por IA
            </h2>
            <p class="text-xs text-slate-500">
              Se actualizan automáticamente el 1° de cada mes; puedes forzar una actualización cuando quieras.
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            @if (insights().length) {
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                Generado: {{ insights()[0].date }}
              </span>
            }
            <button
              type="button"
              (click)="actualizarInsights()"
              [disabled]="actualizandoInsights()"
              class="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 px-3 py-1.5 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
            >
              <i class="fa-solid fa-arrows-rotate text-[#0d3393]" [class.fa-spin]="actualizandoInsights()"></i>
              <span>{{ actualizandoInsights() ? 'Actualizando...' : 'Actualizar ahora' }}</span>
            </button>
          </div>
        </div>

        @if (errorInsights()) {
          <p class="text-xs text-rose-500">No se pudieron cargar las oportunidades ({{ errorInsights() }}).</p>
        } @else if (!insights().length) {
          <p class="text-xs text-slate-400 text-center py-8 bg-white rounded-2xl border border-slate-200">
            Aún no se generaron oportunidades para este período. Usa "Actualizar ahora" para generarlas.
          </p>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            @for (insight of insights(); track insight.id) {
              <app-insight-card
                [insight]="insight"
                (verDetalle)="chatService.mostrarInsight($event)"
              ></app-insight-card>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class GerenciaDashboardComponent {
  private readonly dataService = inject(GerenciaDataService);
  private readonly reportingService = inject(ReportingService);
  protected readonly chatService = inject(GerenciaChatService);
  private readonly prediccionService = inject(PrediccionService);
  private readonly router = inject(Router);

  // Insights: reales, generados por el AI Service una vez por período (ver
  // insights.py) -- este componente solo los lee/dispara su regeneración,
  // nunca llama al LLM directamente. Documentación empresarial
  // (getBusinessDocuments) no se toca acá, es una feature aparte (RAG
  // futuro, ver README).
  protected readonly insights = signal<InsightCard[]>([]);
  protected readonly errorInsights = signal<string | null>(null);
  protected readonly actualizandoInsights = signal<boolean>(false);

  protected readonly prediccion = signal<PrediccionProximoMes | null>(null);
  protected readonly errorPrediccion = signal<string | null>(null);

  // Productos con mayor caída proyectada (ML) -- ver nota en
  // intelligence/ml/service/main.py sobre por qué no se muestra "crecimiento"
  // (el ranking de crecimiento es poco confiable para productos de bajo
  // volumen reciente y arrastra líneas que no son productos reales, ej.
  // "VENTA DE CAMIONETA"; la caída sí es consistente y accionable).
  protected readonly productosCaidaProyectada = signal<ProductoProyectado[]>([]);
  protected readonly errorProductosProyectados = signal<string | null>(null);

  // Clientes en riesgo de inactividad, a nivel empresa (backend/reporting,
  // /gerencia/clientes-en-riesgo) -- mismo criterio que la reactivación del
  // vendedor individual, agregado.
  protected readonly clientesEnRiesgo = signal<ClienteEnRiesgo[]>([]);
  protected readonly totalClientesEnRiesgo = signal<number>(0);
  protected readonly montoEnRiesgo = signal<number>(0);

  // ============================================================
  // Reporte gerencial (backend/reporting, /gerencia/*) -- reemplaza los
  // KPIs y gráficos mockeados que había antes en este dashboard.
  // ============================================================

  private readonly hoy = new Date();
  protected readonly filtroAnio = signal<number>(this.hoy.getFullYear());
  protected readonly filtroMes = signal<number>(this.hoy.getMonth() + 1);

  // MIN(fecha) real en dwh.fact_ventas (mismo límite que el dashboard de
  // ventas, ver ventas.component.ts) -- no se puede navegar a un mes que
  // empiece antes de esto porque no hay datos cargados, ni a un mes que
  // todavía no haya empezado respecto a hoy.
  private readonly limiteInferiorDatos = new Date(2024, 0, 11);

  protected readonly puedeMesAnterior = computed(() => {
    const mesAnterior = this.filtroMes() === 1 ? 12 : this.filtroMes() - 1;
    const anioAnterior = this.filtroMes() === 1 ? this.filtroAnio() - 1 : this.filtroAnio();
    const ultimoDiaMesAnterior = new Date(anioAnterior, mesAnterior, 0);
    return ultimoDiaMesAnterior >= this.limiteInferiorDatos;
  });

  protected readonly puedeMesSiguiente = computed(() => {
    const mesSiguiente = this.filtroMes() === 12 ? 1 : this.filtroMes() + 1;
    const anioSiguiente = this.filtroMes() === 12 ? this.filtroAnio() + 1 : this.filtroAnio();
    const primerDiaMesSiguiente = new Date(anioSiguiente, mesSiguiente - 1, 1);
    return primerDiaMesSiguiente <= this.hoy;
  });

  protected readonly puedeAnioAnterior = computed(() => this.filtroAnio() > this.limiteInferiorDatos.getFullYear());
  protected readonly puedeAnioSiguiente = computed(() => this.filtroAnio() < this.hoy.getFullYear());

  // Genéricas que usa el template (una sola flecha, según el modo activo).
  protected readonly puedePeriodoAnterior = computed(() =>
    this.periodoModo() === 'anio' ? this.puedeAnioAnterior() : this.puedeMesAnterior()
  );
  protected readonly puedePeriodoSiguiente = computed(() =>
    this.periodoModo() === 'anio' ? this.puedeAnioSiguiente() : this.puedeMesSiguiente()
  );


  protected readonly cargandoReporte = signal<boolean>(true);
  protected readonly errorReporte = signal<string | null>(null);

  protected readonly tendenciaAnio = signal<VentasMes[]>([]);
  // Solo se llena en modo "año" (ver cargarReportePeriodo) -- año anterior
  // completo, para poder comparar el total del año contra el anterior.
  protected readonly tendenciaAnioAnterior = signal<VentasMes[]>([]);
  protected readonly topProductos = signal<ProductoGerencia[]>([]);
  protected readonly topClientes = signal<ClienteTopGerencia[]>([]);
  protected readonly departamentos = signal<DepartamentoVentas[]>([]);
  protected readonly ticketPromedioActual = signal<number | null>(null);
  protected readonly ticketPromedioAnterior = signal<number | null>(null);

  // Igual que en el dashboard de Vendedores (ver ventas.component.ts):
  // "mes" compara contra el mes anterior, "año" contra el año anterior --
  // son dos vistas independientes del mismo período, no un dato adicional.
  protected readonly periodoModo = signal<'mes' | 'anio'>('mes');

  protected readonly periodoLabel = computed(() => {
    if (this.periodoModo() === 'anio') return `${this.filtroAnio()}`;
    const fecha = new Date(this.filtroAnio(), this.filtroMes() - 1, 1);
    const texto = fecha.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });

  private readonly ventasPeriodoActual = computed(() => {
    if (this.periodoModo() === 'anio') {
      return this.tendenciaAnio().reduce((acc, m) => acc + m.total_soles, 0);
    }
    return this.tendenciaAnio().find((m) => m.mes === this.filtroMes())?.total_soles ?? 0;
  });

  // null cuando no hay con qué comparar: en modo mes, si el mes anterior cae
  // en otro año (enero); en modo año, si todavía no se cargó el año anterior.
  private readonly ventasPeriodoAnterior = computed<number | null>(() => {
    if (this.periodoModo() === 'anio') {
      const meses = this.tendenciaAnioAnterior();
      return meses.length ? meses.reduce((acc, m) => acc + m.total_soles, 0) : null;
    }
    if (this.filtroMes() === 1) return null;
    return this.tendenciaAnio().find((m) => m.mes === this.filtroMes() - 1)?.total_soles ?? null;
  });

  protected readonly kpis = computed<KpiMetric[]>(() => {
    const ventasActual = this.ventasPeriodoActual();
    const ventasAnterior = this.ventasPeriodoAnterior();
    const ventasCambio = this.calcularCambioPorcentual(ventasActual, ventasAnterior);
    const etiquetaComparacion = this.periodoModo() === 'anio' ? 'vs año anterior' : 'vs mes anterior';

    const ticketActual = this.ticketPromedioActual();
    const ticketAnterior = this.ticketPromedioAnterior();
    const ticketCambio = this.calcularCambioPorcentual(ticketActual, ticketAnterior);

    return [
      {
        id: 'kpi-ventas-mes',
        title: this.periodoModo() === 'anio' ? 'Ventas del Año' : 'Ventas Mensuales Totales',
        value: `S/ ${this.formatoMiles(ventasActual)}`,
        subtitle: this.periodoLabel(),
        numericValue: ventasActual,
        unit: 'S/',
        changePercent: ventasCambio.valor,
        changeType: ventasCambio.tipo,
        comparisonLabel: ventasCambio.tipo === 'neutral' ? 'sin comparación disponible' : etiquetaComparacion,
        icon: 'fa-solid fa-chart-line',
        colorTheme: 'blue'
      },
      {
        id: 'kpi-ticket-promedio',
        title: 'Ticket Promedio por Cliente',
        value: ticketActual !== null ? `S/ ${this.formatoMiles(ticketActual)}` : '—',
        subtitle: this.periodoModo() === 'anio' ? 'Promedio de venta por cliente en el año' : 'Promedio de venta por cliente en el mes',
        numericValue: ticketActual ?? 0,
        unit: 'S/',
        changePercent: ticketCambio.valor,
        changeType: ticketCambio.tipo,
        comparisonLabel: ticketCambio.tipo === 'neutral' ? 'sin comparación disponible' : etiquetaComparacion,
        icon: 'fa-solid fa-receipt',
        colorTheme: 'amber'
      },
      {
        id: 'kpi-clientes-en-riesgo',
        title: 'Clientes en Riesgo de Inactividad',
        value: `${this.totalClientesEnRiesgo()}`,
        subtitle: `S/ ${this.formatoMiles(this.montoEnRiesgo())} en historial de compra en juego`,
        numericValue: this.totalClientesEnRiesgo(),
        changePercent: 0,
        changeType: 'neutral',
        comparisonLabel: '30-50 días sin comprar, toda la empresa',
        icon: 'fa-solid fa-user-clock',
        colorTheme: 'red'
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

    // Mantiene al chat de gerencia al tanto de lo que se está viendo en este
    // dashboard ahora mismo (ver GerenciaChatService.setDashboardContext) --
    // se re-ejecuta solo cuando cambia algo que efectivamente se lee acá
    // adentro, no en cada render.
    effect(() => {
      this.chatService.setDashboardContext(this.buildContextoTexto());
    });
  }

  /** Cambia entre filtrar por mes o por año completo -- igual que el toggle
   * "Por Mes / Por Semana" del dashboard de Vendedores, cada modo trae sus
   * propios datos (ver cargarReportePeriodo). */
  protected setPeriodoModo(modo: 'mes' | 'anio') {
    if (this.periodoModo() === modo) return;
    this.periodoModo.set(modo);
    this.cargarReportePeriodo();
  }

  protected periodoAnterior() {
    if (!this.puedePeriodoAnterior()) return;
    if (this.periodoModo() === 'anio') {
      this.filtroAnio.update((a) => a - 1);
    } else {
      this.moverMes(-1);
    }
    this.cargarReportePeriodo();
  }

  protected periodoSiguiente() {
    if (!this.puedePeriodoSiguiente()) return;
    if (this.periodoModo() === 'anio') {
      this.filtroAnio.update((a) => a + 1);
    } else {
      this.moverMes(1);
    }
    this.cargarReportePeriodo();
  }

  protected navigateToChat(prompt: string) {
    this.chatService.submitQuery(prompt);
  }

  /** Botón "explicar" de cada tarjeta -- ver effect() del constructor: el
   * contexto del dashboard ya viaja antepuesto, acá solo hace falta decir
   * QUÉ tarjeta se está preguntando. */
  protected explicarCarta(nombreTarjeta: string) {
    this.chatService.submitQuery(`Explícame la tarjeta "${nombreTarjeta}" que estoy viendo en el dashboard.`);
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
    this.cargarProductosProyectados();
    this.cargarClientesEnRiesgo();
    this.cargarInsights();
  }

  private cargarInsights() {
    this.errorInsights.set(null);
    this.dataService.getExecutiveInsights().subscribe({
      next: (data) => this.insights.set(data),
      error: (err) => this.errorInsights.set(err?.status ? `HTTP ${err.status}` : 'sin conexión')
    });
  }

  protected actualizarInsights() {
    this.actualizandoInsights.set(true);
    this.errorInsights.set(null);
    this.dataService.regenerarInsights().subscribe({
      next: (data) => {
        this.insights.set(data);
        this.actualizandoInsights.set(false);
      },
      error: (err) => {
        this.errorInsights.set(err?.status ? `HTTP ${err.status}` : 'sin conexión');
        this.actualizandoInsights.set(false);
      }
    });
  }

  /** Recarga todo lo que depende de anio/mes (KPIs, top productos/clientes, mapa). */
  private async cargarReportePeriodo() {
    this.cargandoReporte.set(true);
    try {
      const anio = this.filtroAnio();
      const esAnio = this.periodoModo() === 'anio';
      // mes=undefined -> los endpoints agregan todo el año (ver
      // backend/reporting/src/routers/gerencia.py y ReportingService).
      const mes = esAnio ? undefined : this.filtroMes();
      const mesAnteriorInfo = esAnio ? null : this.mesAnteriorDe(anio, this.filtroMes());

      const [productos, clientes, deps, ticket, ticketAnterior, tendencia, tendenciaAnterior] = await Promise.all([
        this.reportingService.getTopProductosGerencia(anio, mes, 'desc', 6),
        this.reportingService.getTopClientesGerencia(anio, mes, 6),
        this.reportingService.getMapaDepartamentos(anio, mes),
        this.reportingService.getTicketPromedio(anio, mes),
        esAnio
          ? this.reportingService.getTicketPromedio(anio - 1)
          : mesAnteriorInfo
            ? this.reportingService.getTicketPromedio(mesAnteriorInfo.anio, mesAnteriorInfo.mes)
            : Promise.resolve(null),
        // La tendencia se recarga solo si cambió el año (ver cargarTendencia);
        // acá se refresca siempre que cambia el mes/anio para no desincronizar
        // el KPI de "ventas mensuales" con el filtro visible.
        this.reportingService.getTendenciaVentas(anio),
        esAnio ? this.reportingService.getTendenciaVentas(anio - 1) : Promise.resolve(null)
      ]);

      this.topProductos.set(productos.productos);
      this.topClientes.set(clientes.clientes);
      this.departamentos.set(deps.departamentos);
      this.ticketPromedioActual.set(ticket.ticket_promedio);
      this.ticketPromedioAnterior.set(ticketAnterior?.ticket_promedio ?? null);
      this.tendenciaAnio.set(tendencia.meses);
      this.tendenciaAnioAnterior.set(tendenciaAnterior?.meses ?? []);
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

  private cargarProductosProyectados() {
    this.prediccionService.getProductosProyectados(30, 6).subscribe({
      next: (res) => this.productosCaidaProyectada.set(res.mayor_caida_proyectada),
      error: (err) => this.errorProductosProyectados.set(err?.status ? `HTTP ${err.status}` : 'sin conexión')
    });
  }

  private async cargarClientesEnRiesgo() {
    try {
      const res = await this.reportingService.getClientesEnRiesgoGerencia(6);
      this.clientesEnRiesgo.set(res.clientes);
      this.totalClientesEnRiesgo.set(res.total_clientes_en_riesgo);
      this.montoEnRiesgo.set(res.monto_en_riesgo_soles);
    } catch {
      // Silencioso: no es el reporte principal del dashboard, no vale la pena
      // un banner de error propio -- el KPI simplemente queda en 0.
    }
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

  /**
   * Resumen en texto plano de lo que gerencia está viendo AHORA en este
   * dashboard -- se le pasa al AI Service como contexto de cada pregunta
   * (ver GerenciaChatService.setDashboardContext). Deliberadamente compacto
   * (listas, no prosa) para no inflar el prompt de más.
   */
  private buildContextoTexto(): string {
    const lineas: string[] = [`Período visible: ${this.periodoLabel()}.`];

    const kpisActuales = this.kpis();
    if (kpisActuales.length) {
      lineas.push('KPIs:');
      for (const kpi of kpisActuales) {
        lineas.push(`- ${kpi.title}: ${kpi.value}${kpi.subtitle ? ` (${kpi.subtitle})` : ''}`);
      }
    }

    if (this.prediccion()) {
      const p = this.prediccion()!;
      lineas.push(
        `Predicción ML próximo mes: S/ ${p.prediccion_total_soles.toLocaleString('es-PE')} ` +
        `(datos reales hasta ${p.fecha_datos_hasta}, modelo Random Forest v${p.modelo_version}).`
      );
    }

    if (this.topProductos().length) {
      const top3 = this.topProductos().slice(0, 3).map((p) => `${p.producto} (S/ ${Math.round(p.total_soles)})`);
      lineas.push(`Top productos del mes: ${top3.join(', ')}.`);
    }

    if (this.departamentos().length) {
      const top3 = this.departamentos().slice(0, 3).map((d) => `${d.departamento} (S/ ${Math.round(d.total_soles)})`);
      lineas.push(`Top departamentos por ventas: ${top3.join(', ')}.`);
    }

    if (this.topClientes().length) {
      const top3 = this.topClientes().slice(0, 3).map((c) => c.cliente);
      lineas.push(`Clientes que más consumen: ${top3.join(', ')}.`);
    }

    if (this.productosCaidaProyectada().length) {
      const top3 = this.productosCaidaProyectada().slice(0, 3).map((p) => `${p.producto} (${p.cambio_pct}%)`);
      lineas.push(`Productos con caída proyectada (ML): ${top3.join(', ')}.`);
    }

    if (this.totalClientesEnRiesgo() > 0) {
      lineas.push(
        `Clientes en riesgo de inactividad: ${this.totalClientesEnRiesgo()} en total, ` +
        `S/ ${Math.round(this.montoEnRiesgo())} en historial de compra en juego.`
      );
    }

    return lineas.join('\n');
  }
}
