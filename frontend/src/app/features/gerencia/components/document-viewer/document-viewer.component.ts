import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { BusinessDocument } from '../../../../core/models/document.model';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (document()) {
      <div class="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs flex flex-col h-full overflow-y-auto space-y-6 custom-scrollbar">
        <!-- Header -->
        <div class="border-b border-slate-200 pb-5 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-[#0d3393] bg-[#0d3393]/10 px-2.5 py-1 rounded-md">
                {{ document()!.categoryLabel }}
              </span>
              <span class="text-xs text-slate-400 font-mono">Actualizado: {{ document()!.version }}</span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="editDoc.emit(document()!)"
                class="rounded-xl bg-white border border-slate-200 hover:border-[#0d3393] hover:text-[#0d3393] text-slate-600 px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <i class="fa-solid fa-pen text-xs"></i>
                <span>Editar</span>
              </button>
              <button
                type="button"
                (click)="deactivateDoc.emit(document()!)"
                class="rounded-xl bg-white border border-slate-200 hover:border-red-400 hover:text-red-600 text-slate-600 px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <i class="fa-solid fa-trash text-xs"></i>
                <span>Desactivar</span>
              </button>
              @if (mostrarBotonIA()) {
                <button
                  type="button"
                  (click)="onAskAi()"
                  class="rounded-xl bg-[#0d3393] hover:bg-[#0b2670] text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                >
                  <i class="fa-solid fa-robot text-xs"></i>
                  <span>Consultar IA sobre este doc</span>
                </button>
              }
            </div>
          </div>

          <h2 class="text-xl md:text-2xl font-black text-slate-900 leading-tight">
            {{ document()!.title }}
          </h2>

          <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
            <span><i class="fa-solid fa-user-pen mr-1.5 text-slate-400"></i>{{ document()!.author }}</span>
            <span><i class="fa-solid fa-calendar-days mr-1.5 text-slate-400"></i>{{ document()!.lastUpdated }}</span>
            <span><i class="fa-regular fa-clock mr-1.5 text-slate-400"></i>Lectura: {{ document()!.readingTime }}</span>
          </div>

          <!-- Tags -->
          <div class="flex flex-wrap gap-1.5 pt-1">
            @for (tag of document()!.tags; track tag) {
              <span class="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                #{{ tag }}
              </span>
            }
          </div>
        </div>

        <!-- Key Takeaways Callout -->
        @if (document()!.keyTakeaways?.length) {
          <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-2">
            <h4 class="text-xs font-bold text-amber-900 flex items-center gap-2 uppercase tracking-wider">
              <i class="fa-solid fa-bolt text-amber-600"></i>
              Puntos Clave / Key Takeaways
            </h4>
            <ul class="space-y-1 text-xs text-amber-950 font-medium list-disc list-inside">
              @for (point of document()!.keyTakeaways; track point) {
                <li>{{ point }}</li>
              }
            </ul>
          </div>
        }

        <!-- Table of Contents Outline -->
        @if (document()!.outline?.length) {
          <div class="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Índice del Documento
            </span>
            <div class="flex flex-wrap gap-3 text-xs font-semibold text-[#0d3393]">
              @for (item of document()!.outline; track item.id) {
                <span class="hover:underline cursor-pointer">
                  • {{ item.title }}
                </span>
              }
            </div>
          </div>
        }

        <!-- Formatted Document Content -->
        <div class="prose prose-slate max-w-none text-xs leading-relaxed text-slate-700 space-y-4" [innerHTML]="contenidoHtml()">
        </div>
      </div>
    } @else {
      <div class="rounded-2xl bg-white p-12 border border-slate-200 text-center text-slate-400 space-y-3">
        <i class="fa-solid fa-file-lines text-4xl text-slate-300"></i>
        <p class="text-sm font-semibold">Selecciona un documento de la base de conocimiento para visualizarlo.</p>
      </div>
    }
  `
})
export class DocumentViewerComponent {
  private readonly sanitizer = inject(DomSanitizer);

  document = input<BusinessDocument | null>(null);
  // ADMIN llega a esta misma vista (ver gerencia-documentacion.component.ts,
  // montada también en /admin/documentos) pero no tiene chat de IA -- ese
  // botón navega a /gerencia/chat, ruta bloqueada para ADMIN por roleGuard.
  mostrarBotonIA = input<boolean>(true);
  askAiAboutDoc = output<BusinessDocument>();
  editDoc = output<BusinessDocument>();
  deactivateDoc = output<BusinessDocument>();

  // El contenido viene en markdown (ver rag.documento.contenido) -- se
  // renderiza a HTML y se sanitiza con DOMPurify antes de insertarlo
  // (defensa en profundidad: marked puede pasar HTML crudo tal cual si el
  // markdown original lo trae, y este contenido lo sube gente de la
  // empresa, no un sistema controlado). El sanitizer de Angular en
  // [innerHTML] es una segunda capa, no la única.
  protected contenidoHtml = computed<SafeHtml>(() => {
    const contenido = this.document()?.content ?? '';
    const html = marked.parse(contenido, { async: false }) as string;
    const limpio = DOMPurify.sanitize(html);
    return this.sanitizer.bypassSecurityTrustHtml(limpio);
  });

  onAskAi() {
    if (this.document()) {
      this.askAiAboutDoc.emit(this.document()!);
    }
  }
}
