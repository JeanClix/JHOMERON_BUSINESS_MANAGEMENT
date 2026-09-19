import { Component, EventEmitter, Output, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrediccionProximoMes } from '../../../core/models/prediccion.model';

/**
 * Tarjeta única que compara "mes pasado (real)" vs "próximo mes (predicción ML)",
 * ambos derivados de la misma respuesta del ML Service para que nunca queden
 * desincronizados entre sí.
 */
@Component({
  selector: 'app-forecast-comparison-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
            <i class="fa-solid fa-brain text-xs"></i>
          </div>
          <h3 class="text-sm font-extrabold text-slate-900">Pronóstico de Ventas</h3>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            (click)="explain.emit()"
            title="Preguntarle a la IA sobre esta predicción"
            class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-[#0d3393] hover:text-white transition-colors"
          >
            <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
          </button>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            Modelo Real (MLflow)
          </span>
        </div>
      </div>

      <div class="px-5 pt-3 text-[10px] text-slate-400">
        <i class="fa-solid fa-database text-[9px] mr-1"></i>
        Datos reales hasta <strong class="text-slate-500">{{ prediccion().fecha_datos_hasta }}</strong>
        @if (prediccion().periodo_prediccion) {
          · prediciendo <strong class="text-slate-500">{{ prediccion().periodo_prediccion }}</strong>
        }
      </div>

      <!-- Dos secciones lado a lado -->
      <div class="grid grid-cols-2 divide-x divide-slate-100">
        <!-- Sección: mes pasado (real) -->
        <div class="p-5 space-y-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <i class="fa-solid fa-clock-rotate-left text-[9px]"></i> Mes Pasado (Real)
          </span>
          <div class="text-xl md:text-2xl font-black text-slate-900">{{ valorMesPasado() }}</div>
          <span class="text-[10px] text-slate-400">{{ prediccion().backtest?.backtest_periodo }}</span>
        </div>

        <!-- Sección: predicción próximo mes -->
        <div class="p-5 space-y-1 bg-indigo-50/30">
          <span class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i> Próximo Mes (Predicción)
          </span>
          <div class="text-xl md:text-2xl font-black text-[#0d3393]">{{ valorPrediccion() }}</div>
          <span class="text-[10px] text-slate-500">
            Random Forest v{{ prediccion().modelo_version }} · {{ prediccion().productos_considerados }} productos
          </span>
        </div>
      </div>

      <!-- Footer: variación entre ambas -->
      <div class="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1.5 text-xs">
        @if (variacion() !== null) {
          <i [class]="'fa-solid text-xs ' + (variacion()! >= 0 ? 'fa-arrow-trend-up text-emerald-600' : 'fa-arrow-trend-down text-rose-600')"></i>
          <span [class]="'font-bold ' + (variacion()! >= 0 ? 'text-emerald-600' : 'text-rose-600')">
            {{ variacion()! >= 0 ? '+' : '' }}{{ variacion() }}%
          </span>
          <span class="text-slate-500">proyectado vs. el mes anterior real</span>
        }
      </div>
    </div>
  `
})
export class ForecastComparisonCardComponent {
  prediccion = input.required<PrediccionProximoMes>();
  @Output() explain = new EventEmitter<void>();

  valorMesPasado = computed(() => {
    const real = this.prediccion().backtest?.backtest_real_soles;
    return real != null ? `S/ ${real.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : 'Sin dato';
  });

  valorPrediccion = computed(() =>
    `S/ ${this.prediccion().prediccion_total_soles.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
  );

  variacion = computed(() => {
    const real = this.prediccion().backtest?.backtest_real_soles;
    if (!real) return null;
    return Math.round(((this.prediccion().prediccion_total_soles - real) / real) * 1000) / 10;
  });
}
