import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { BusinessChartComponent } from '../../../../shared/components/business-chart/business-chart.component';
import { InsightCardComponent } from '../../../../shared/components/insight-card/insight-card.component';

@Component({
  selector: 'app-gerencia-analisis',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    BusinessChartComponent,
    InsightCardComponent
  ],
  template: `
    <div class="space-y-6">
      <!-- Top Action Bar & Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-black uppercase tracking-wider text-[#0d3393] bg-[#0d3393]/10 px-2.5 py-0.5 rounded">
              ANÁLISIS DE GERENCIA DEEPWIKI
            </span>
            @if (chatService.processingStage() === 'completed') {
              <span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                <i class="fa-solid fa-circle-check text-xs"></i> Análisis completado
              </span>
            }
          </div>

          <h1 class="text-xl md:text-2xl font-black text-slate-900 leading-tight">
            {{ chatService.activeAnalysis()?.query || 'Analizando información...' }}
          </h1>

          <span class="text-xs text-slate-400 font-mono">
            Generado: {{ chatService.activeAnalysis()?.timestamp || 'En proceso...' }}
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            (click)="chatService.resetToDashboard()"
            class="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2 text-xs font-bold transition-all shadow-2xs flex items-center gap-2"
          >
            <i class="fa-solid fa-arrow-left text-[#0d3393]"></i>
            <span>Volver al Dashboard</span>
          </button>
        </div>
      </div>

      <!-- Processing Status Banner (If loading) -->
      @if (chatService.processingStage() !== 'completed') {
        <div class="rounded-2xl bg-white p-8 border border-slate-200 shadow-xs text-center space-y-4">
          <div class="flex justify-center">
            <div class="h-12 w-12 rounded-2xl bg-[#0d3393] text-white flex items-center justify-center text-xl shadow-md">
              <i class="fa-solid fa-robot animate-spin"></i>
            </div>
          </div>

          <div class="space-y-1">
            <h3 class="text-base font-extrabold text-slate-900">
              {{ chatService.processingMessage() }}
            </h3>
            <p class="text-xs text-slate-500">
              Sintetizando indicadores, gráficos e hallazgos estratégicos para la toma de decisiones.
            </p>
          </div>

          <!-- Progress Bar simulation -->
          <div class="max-w-md mx-auto h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-[#0d3393] transition-all duration-300"
              [style.width]="getStageProgressWidth()"
            ></div>
          </div>
        </div>
      } @else if (chatService.activeAnalysis(); as res) {
        
        <!-- 1. Executive Summary Callout -->
        <div class="rounded-2xl bg-gradient-to-br from-[#0c2461] to-[#0d3393] p-6 text-white shadow-md space-y-3">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-quote-left text-amber-400 text-base"></i>
            <span class="text-xs font-bold uppercase tracking-wider text-amber-300">Resumen Ejecutivo</span>
          </div>

          <p class="text-xs md:text-sm font-medium leading-relaxed text-slate-100">
            {{ res.summary }}
          </p>
        </div>

        <!-- 2. KPIs Cards Row -->
        @if (res.kpis?.length) {
          <div class="space-y-2">
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Indicadores Relevantes
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (kpi of res.kpis; track kpi.id) {
                <app-kpi-card [metric]="kpi"></app-kpi-card>
              }
            </div>
          </div>
        }

        <!-- 3. Dynamic Chart Component (Chart.js) -->
        @if (res.chart) {
          <div class="space-y-2">
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Visualización de Datos
            </h3>
            <app-business-chart [chartData]="res.chart"></app-business-chart>
          </div>
        }

        <!-- 4. Data Summary Table -->
        @if (res.table) {
          <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <i class="fa-solid fa-table-cells text-[#0d3393]"></i>
                {{ res.table.title }}
              </h3>
              @if (res.table.subtitle) {
                <p class="text-xs text-slate-500">{{ res.table.subtitle }}</p>
              }
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-700">
                <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-y border-slate-200">
                  <tr>
                    @for (col of res.table.columns; track col.key) {
                      <th [class]="'px-3 py-2.5 text-' + (col.align || 'left')">
                        {{ col.label }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (row of res.table.rows; track $index) {
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      @for (col of res.table.columns; track col.key) {
                        <td [class]="'px-3 py-3 font-medium text-' + (col.align || 'left')">
                          @if (col.isCurrency) {
                            <span class="font-bold text-slate-900">S/ {{ row[col.key].toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</span>
                          } @else if (col.isBadge) {
                            <span class="rounded-md bg-indigo-50 border border-indigo-100 text-[#0d3393] px-2 py-0.5 text-[10px] font-bold">
                              {{ row[col.key] }}
                            </span>
                          } @else {
                            {{ row[col.key] }}
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- 5. Executive Insights & Recommendations -->
        @if (res.insights?.length || res.recommendations?.length) {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            @if (res.insights?.length) {
              <div class="space-y-4">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Insights Estratégicos
                </h3>
                @for (ins of res.insights; track ins.id) {
                  <app-insight-card [insight]="ins"></app-insight-card>
                }
              </div>
            }

            @if (res.recommendations?.length) {
              <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs space-y-3">
                <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <i class="fa-solid fa-list-check text-emerald-600"></i>
                  Recomendaciones de Acción Gerencial
                </h3>
                <ul class="space-y-2 text-xs text-slate-700">
                  @for (rec of res.recommendations; track rec) {
                    <li class="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <i class="fa-solid fa-circle-check text-emerald-500 text-xs mt-0.5 shrink-0"></i>
                      <span class="font-medium">{{ rec }}</span>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        }

        <!-- 6. Query History Bar -->
        <div class="pt-4 border-t border-slate-200 space-y-2">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Historial de Consultas Realizadas en la Sesión:
          </span>
          <div class="flex flex-wrap gap-2">
            @for (hQuery of chatService.queryHistory(); track hQuery) {
              <button
                type="button"
                (click)="chatService.submitQuery(hQuery)"
                class="rounded-xl border border-slate-200 bg-white hover:bg-[#0d3393] hover:text-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors shadow-2xs"
              >
                {{ hQuery }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class GerenciaAnalisisComponent {
  chatService = inject(GerenciaChatService);

  getStageProgressWidth(): string {
    switch (this.chatService.processingStage()) {
      case 'analyzing_query': return '25%';
      case 'fetching_data': return '50%';
      case 'preparing_analysis': return '75%';
      case 'generating_visualization': return '90%';
      case 'completed': return '100%';
      default: return '10%';
    }
  }
}
