import { Component, EventEmitter, Input, Output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiMetric } from '../../../core/models/kpi.model';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group relative rounded-2xl bg-white p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        <!-- Top header bar: Title & Icon -->
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider line-clamp-1">
            {{ metric().title }}
          </span>
          <div class="flex items-center gap-1.5 shrink-0">
            @if (explainable) {
              <button
                type="button"
                (click)="explain.emit()"
                title="Preguntarle a la IA sobre este dato"
                class="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:bg-[#0d3393] hover:text-white transition-colors"
              >
                <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              </button>
            }
            <div [class]="getThemeIconClass(metric().colorTheme)">
              <i [class]="metric().icon + ' text-xs'"></i>
            </div>
          </div>
        </div>

        <!-- Big Numeric Value -->
        <div class="flex items-baseline gap-2 mb-1">
          <span class="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            {{ metric().value }}
          </span>
          @if (metric().badge) {
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {{ metric().badge }}
            </span>
          }
        </div>
      </div>

      <!-- Footer Trend Indicator -->
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div class="flex items-center gap-1 font-bold" [ngClass]="{
          'text-emerald-600': metric().changeType === 'increase',
          'text-rose-600': metric().changeType === 'decrease',
          'text-slate-500': metric().changeType === 'neutral'
        }">
          @if (metric().changeType === 'increase') {
            <i class="fa-solid fa-arrow-trend-up text-xs"></i>
            <span>+{{ metric().changePercent }}%</span>
          } @else if (metric().changeType === 'decrease') {
            <i class="fa-solid fa-arrow-trend-down text-xs"></i>
            <span>{{ metric().changePercent }}%</span>
          } @else {
            <span>{{ metric().changePercent }}%</span>
          }
          <span class="text-slate-400 font-normal ml-1">{{ metric().comparisonLabel }}</span>
        </div>

        @if (metric().subtitle) {
          <span class="text-[10px] text-slate-400 font-medium truncate max-w-[120px]" [title]="metric().subtitle">
            {{ metric().subtitle }}
          </span>
        }
      </div>
    </div>
  `
})
export class KpiCardComponent {
  metric = input.required<KpiMetric>();
  @Input() explainable = false;
  @Output() explain = new EventEmitter<void>();

  getThemeIconClass(theme: string): string {
    const base = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ';
    switch (theme) {
      case 'blue': return base + 'bg-[#0d3393]/10 text-[#0d3393]';
      case 'red': return base + 'bg-[#ef0606]/10 text-[#ef0606]';
      case 'emerald': return base + 'bg-emerald-500/10 text-emerald-600';
      case 'indigo': return base + 'bg-indigo-500/10 text-indigo-600';
      case 'amber': return base + 'bg-amber-500/10 text-amber-600';
      default: return base + 'bg-slate-100 text-slate-700';
    }
  }
}
