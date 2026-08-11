import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GerenciaDataService } from '../../../../core/services/gerencia-data.service';
import { KpiMetric } from '../../../../core/models/kpi.model';
import { BusinessChartData } from '../../../../core/models/chart.model';
import { InsightCard } from '../../../../core/models/insight.model';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { BusinessChartComponent } from '../../../../shared/components/business-chart/business-chart.component';
import { InsightCardComponent } from '../../../../shared/components/insight-card/insight-card.component';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';

@Component({
  selector: 'app-gerencia-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    BusinessChartComponent,
    InsightCardComponent
  ],
  template: `
    <div class="space-y-6">
      <!-- Executive Welcome Banner -->
      <div class="rounded-2xl bg-gradient-to-r from-[#0c2461] via-[#0d3393] to-[#1e40af] p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Resumen Gerencial Agosto 2026
            </span>
            <span class="text-[10px] text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full">
              Datos Mock Realistas
            </span>
          </div>

          <h1 class="text-2xl md:text-3xl font-black tracking-tight text-white">
            Panel Ejecutivo de Inteligencia & Decisiones
          </h1>

          <p class="text-xs text-slate-200 max-w-2xl leading-relaxed">
            Consolidado estratégico de ventas, márgenes por línea de producto, rendimiento por plaza y hallazgos generados por el algoritmo de inteligencia empresarial Jhomeron.
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

      <!-- Executive KPIs Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (kpi of kpis(); track kpi.id) {
          <app-kpi-card [metric]="kpi"></app-kpi-card>
        }
      </div>

      <!-- Main Business Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        @if (chartSales()) {
          <app-business-chart [chartData]="chartSales()!"></app-business-chart>
        }
        @if (chartCategory()) {
          <app-business-chart [chartData]="chartCategory()!"></app-business-chart>
        }
      </div>

      <!-- Secondary Charts Grid: Top Products & Zone Radar -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        @if (chartProducts()) {
          <app-business-chart [chartData]="chartProducts()!"></app-business-chart>
        }
        @if (chartZone()) {
          <app-business-chart [chartData]="chartZone()!"></app-business-chart>
        }
      </div>

      <!-- Executive Insights Section -->
      <div class="space-y-4 pt-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <i class="fa-solid fa-sparkles text-amber-500"></i>
              Insights Estratégicos Detectados
            </h2>
            <p class="text-xs text-slate-500">
              Análisis automatizado de oportunidades comerciales, márgenes y alertas operativas.
            </p>
          </div>
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
export class GerenciaDashboardComponent implements OnInit {
  private dataService = inject(GerenciaDataService);
  private chatService = inject(GerenciaChatService);
  private router = inject(Router);

  kpis = signal<KpiMetric[]>([]);
  chartSales = signal<BusinessChartData | null>(null);
  chartCategory = signal<BusinessChartData | null>(null);
  chartProducts = signal<BusinessChartData | null>(null);
  chartZone = signal<BusinessChartData | null>(null);
  insights = signal<InsightCard[]>([]);

  ngOnInit() {
    this.dataService.getExecutiveKpis().subscribe(data => this.kpis.set(data));
    this.dataService.getMonthlySalesChart().subscribe(data => this.chartSales.set(data));
    this.dataService.getCategoryDistributionChart().subscribe(data => this.chartCategory.set(data));
    this.dataService.getTopProductsChart().subscribe(data => this.chartProducts.set(data));
    this.dataService.getZoneComparisonChart().subscribe(data => this.chartZone.set(data));
    this.dataService.getExecutiveInsights().subscribe(data => this.insights.set(data));
  }

  navigateToChat(prompt: string) {
    this.chatService.sendMessage(prompt);
    this.router.navigate(['/gerencia/chat']);
  }
}
