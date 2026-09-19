import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GerenciaDataService } from '../../../../core/services/gerencia-data.service';
import { InsightCard } from '../../../../core/models/insight.model';
import { InsightCardComponent } from '../../../../shared/components/insight-card/insight-card.component';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';

@Component({
  selector: 'app-gerencia-insights',
  standalone: true,
  imports: [CommonModule, InsightCardComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2.5 py-0.5 rounded">
            INTELLIGENCE HUB
          </span>
          <h1 class="text-2xl font-black text-slate-900 mt-1">
            Insights Estratégicos & Reportes Operativos
          </h1>
          <p class="text-xs text-slate-500">
            Hallazgos de mercado, monitoreo de margen bruto por línea y recomendaciones de acción para la toma de decisiones.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="selectedCategory.set('all')"
            [class]="'px-3 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (selectedCategory() === 'all' ? 'bg-[#0d3393] text-white' : 'bg-slate-100 text-slate-600')"
          >
            Todos
          </button>
          <button
            type="button"
            (click)="selectedCategory.set('marina')"
            [class]="'px-3 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (selectedCategory() === 'marina' ? 'bg-[#0d3393] text-white' : 'bg-slate-100 text-slate-600')"
          >
            Línea Marina
          </button>
          <button
            type="button"
            (click)="selectedCategory.set('rentabilidad')"
            [class]="'px-3 py-1.5 rounded-xl text-xs font-bold transition-all ' +
              (selectedCategory() === 'rentabilidad' ? 'bg-[#0d3393] text-white' : 'bg-slate-100 text-slate-600')"
          >
            Rentabilidad
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (insight of filteredInsights(); track insight.id) {
          <app-insight-card
            [insight]="insight"
            (verDetalle)="chatService.mostrarInsight($event)"
          ></app-insight-card>
        }
      </div>
    </div>
  `
})
export class GerenciaInsightsComponent implements OnInit {
  private dataService = inject(GerenciaDataService);
  protected chatService = inject(GerenciaChatService);

  insights = signal<InsightCard[]>([]);
  selectedCategory = signal<string>('all');

  filteredInsights = computed(() => {
    const cat = this.selectedCategory();
    return this.insights().filter(i => cat === 'all' || i.category === cat);
  });

  ngOnInit() {
    this.dataService.getExecutiveInsights().subscribe(data => this.insights.set(data));
  }
}
