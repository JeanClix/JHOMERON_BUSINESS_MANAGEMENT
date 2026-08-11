import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InsightCard } from '../../../core/models/insight.model';

@Component({
  selector: 'app-insight-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs hover:border-[#0d3393]/40 transition-all duration-200 flex flex-col justify-between space-y-4">
      <div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <span [class]="'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ' + insight().impactBadgeColor">
            {{ insight().impactLevel }}
          </span>
          <span class="text-[11px] text-slate-400 font-medium">
            {{ insight().date }}
          </span>
        </div>

        <h4 class="text-sm font-extrabold text-slate-900 leading-snug">
          {{ insight().title }}
        </h4>

        <p class="text-xs text-slate-600 mt-2 leading-relaxed">
          {{ insight().description }}
        </p>
      </div>

      <div class="space-y-3 pt-3 border-t border-slate-100">
        <div class="rounded-xl bg-slate-50 p-3 border border-slate-100 flex items-start gap-2 text-xs">
          <i class="fa-solid fa-lightbulb text-amber-500 mt-0.5 shrink-0"></i>
          <div>
            <span class="font-bold text-slate-800">Recomendación Gerencial: </span>
            <span class="text-slate-600">{{ insight().recommendation }}</span>
          </div>
        </div>

        @if (insight().actionPrompt) {
          <button
            type="button"
            (click)="onAskAi(insight().actionPrompt!)"
            class="w-full rounded-xl bg-[#0d3393]/10 hover:bg-[#0d3393] text-[#0d3393] hover:text-white px-3 py-2 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <i class="fa-solid fa-robot text-xs group-hover:scale-110 transition-transform"></i>
            <span>Consultar con IA Gerencial</span>
          </button>
        }
      </div>
    </div>
  `
})
export class InsightCardComponent {
  insight = input.required<InsightCard>();
  askAi = output<string>();

  onAskAi(prompt: string) {
    this.askAi.emit(prompt);
  }
}
