import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessDocument } from '../../../../core/models/document.model';

@Component({
  selector: 'app-document-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rounded-2xl bg-white p-5 border border-slate-200 shadow-xs flex flex-col h-full space-y-4">
      <!-- Search & Title -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <i class="fa-solid fa-book-bookmark text-[#0d3393]"></i>
            Base de Conocimiento DeepWiki
          </h3>
          <span class="text-[10px] font-bold bg-[#0d3393]/10 text-[#0d3393] px-2 py-0.5 rounded">
            {{ filteredDocuments().length }} docs
          </span>
        </div>

        <div class="relative">
          <input
            type="text"
            placeholder="Buscar por título, tag o concepto..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0d3393] focus:bg-white focus:outline-none transition-colors"
          />
          <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-xs"></i>
        </div>
      </div>

      <!-- Categories Filter Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
        @for (cat of categories; track cat.id) {
          <button
            type="button"
            (click)="selectedCategory.set(cat.id)"
            [class]="'shrink-0 rounded-lg px-2.5 py-1 font-semibold transition-all duration-150 ' +
              (selectedCategory() === cat.id ? 'bg-[#0d3393] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')"
          >
            {{ cat.label }}
          </button>
        }
      </div>

      <!-- Document Index Tree List -->
      <div class="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        @for (doc of filteredDocuments(); track doc.id) {
          <div
            (click)="selectDocument.emit(doc)"
            [class]="'group cursor-pointer rounded-xl p-3.5 border transition-all duration-200 text-left ' +
              (selectedId() === doc.id ? 'bg-[#0d3393]/5 border-[#0d3393] shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80')"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#0d3393] bg-[#0d3393]/10 px-2 py-0.5 rounded">
                {{ doc.categoryLabel }}
              </span>
              <span class="text-[10px] text-slate-400 font-medium shrink-0">
                <i class="fa-regular fa-clock mr-1"></i>{{ doc.readingTime }}
              </span>
            </div>

            <h4 class="text-xs font-bold text-slate-900 mt-2 group-hover:text-[#0d3393] transition-colors leading-snug">
              {{ doc.title }}
            </h4>

            <p class="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-normal">
              {{ doc.summary }}
            </p>

            <div class="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-2">
              <span>{{ doc.author }}</span>
              <span>v{{ doc.version }}</span>
            </div>
          </div>
        } @empty {
          <div class="p-8 text-center text-slate-400 text-xs">
            <i class="fa-solid fa-file-circle-xmark text-2xl mb-2 text-slate-300 block"></i>
            No se encontraron documentos con los filtros seleccionados.
          </div>
        }
      </div>
    </div>
  `
})
export class DocumentExplorerComponent {
  documents = input.required<BusinessDocument[]>();
  selectedId = input<string>('');
  selectDocument = output<BusinessDocument>();

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('all');

  categories = [
    { id: 'all', label: 'Todos' },
    { id: 'lineas-producto', label: 'Líneas Marina' },
    { id: 'politicas', label: 'Políticas & Créditos' },
    { id: 'financiero', label: 'Financiero' },
    { id: 'procesos', label: 'Procesos Planta' }
  ];

  filteredDocuments = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    return this.documents().filter(doc => {
      const matchCat = cat === 'all' || doc.category === cat;
      const matchQuery = !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.tags.some(t => t.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  });
}
