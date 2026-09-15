import { Component, ElementRef, ViewChild, inject, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasAiChatService } from '../../../../core/services/ventas-ai-chat.service';
import { BusinessChartComponent } from '../../../../shared/components/business-chart/business-chart.component';

/**
 * Chat del vendedor conectado al AI Service real (Python/FastAPI) sobre el
 * Data Warehouse de ventas. Sustituye el input estático que existía antes
 * en la pestaña "Asistente Técnico IA" -- ver ventas.component.html.
 */
@Component({
  selector: 'app-ventas-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, BusinessChartComponent],
  template: `
    <div class="rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col h-[calc(100vh-220px)] min-h-[520px] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0d3393] to-[#0b2670] text-white shadow-xs">
            <i class="fa-solid fa-robot text-sm"></i>
          </div>
          <div>
            <h3 class="text-sm font-extrabold text-slate-900 leading-tight">Asistente de Ventas Jhomeron AI</h3>
            <div class="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
              <span class="flex items-center gap-1 text-emerald-600 font-bold">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Conectado al Data Warehouse real
              </span>
              <span>•</span>
              <span>Text-to-SQL</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          (click)="chatService.clearHistory()"
          class="rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors shadow-2xs"
          title="Borrar conversación"
        >
          <i class="fa-solid fa-trash-can mr-1.5 text-xs"></i>Limpiar
        </button>
      </div>

      <!-- Chips de preguntas frecuentes -->
      <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Preguntas Frecuentes:</span>
        @for (prompt of chatService.getPresetPrompts(); track prompt.id) {
          <button
            type="button"
            (click)="sendQuery(prompt.prompt)"
            [disabled]="chatService.isLoading()"
            class="shrink-0 rounded-full bg-white border border-slate-200 hover:border-[#0d3393] hover:text-[#0d3393] px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <i [class]="prompt.icon + ' text-[#0d3393] text-xs'"></i>
            <span>{{ prompt.label }}</span>
          </button>
        }
      </div>

      <!-- Mensajes -->
      <div #scrollContainer class="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#f8fafc]/50 space-y-4">
        @for (msg of chatService.messages(); track msg.id) {
          <div [class]="'flex gap-3 text-xs ' + (msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row')">
            <div [class]="'h-8 w-8 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs ' +
              (msg.sender === 'user' ? 'bg-[#ef0606] text-white' : (msg.isError ? 'bg-rose-500 text-white' : 'bg-[#0d3393] text-white'))">
              <i [class]="msg.sender === 'user' ? 'fa-solid fa-user-tie' : 'fa-solid fa-robot'"></i>
            </div>

            <div [class]="'max-w-[85%] rounded-2xl p-4 shadow-xs space-y-3 ' +
              (msg.sender === 'user' ? 'bg-[#0d3393] text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none')">

              <div class="flex items-center justify-between gap-4 text-[10px] opacity-75 border-b border-current/10 pb-1">
                <span class="font-bold uppercase tracking-wider">
                  {{ msg.sender === 'user' ? 'Vendedor' : 'Asistente de Ventas AI' }}
                </span>
                <span>{{ msg.timestamp }}</span>
              </div>

              <div class="whitespace-pre-wrap leading-relaxed font-sans prose prose-slate max-w-none">{{ msg.content }}</div>

              <!-- Auto-gráfico cuando la respuesta trae un listado -->
              @if (chartFor(msg)) {
                <div class="pt-2 border-t border-current/10">
                  <app-business-chart [chartData]="chartFor(msg)!" height="220px"></app-business-chart>
                </div>
              }

              <!-- Traza del SQL ejecutado (transparencia de dónde vino el dato) -->
              @if (msg.sqlGenerado) {
                <details class="pt-2 border-t border-current/10 text-[11px]">
                  <summary class="cursor-pointer font-bold text-slate-500 hover:text-[#0d3393]">
                    Ver consulta SQL ejecutada ({{ msg.filasRetornadas }} filas)
                  </summary>
                  <pre class="mt-1.5 rounded-lg bg-slate-900 text-emerald-300 p-2.5 overflow-x-auto text-[10px]">{{ msg.sqlGenerado }}</pre>
                </details>
              }
            </div>
          </div>
        }

        @if (chatService.isLoading()) {
          <div class="flex items-center gap-3 text-xs text-slate-500 bg-white p-3.5 rounded-2xl border border-slate-200 w-fit shadow-2xs">
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d3393] text-white">
              <i class="fa-solid fa-robot text-xs animate-spin"></i>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-[#0d3393]">Consultando el Data Warehouse</span>
              <span class="flex gap-1">
                <span class="h-1.5 w-1.5 rounded-full bg-[#0d3393] animate-bounce"></span>
                <span class="h-1.5 w-1.5 rounded-full bg-[#0d3393] animate-bounce [animation-delay:0.2s]"></span>
                <span class="h-1.5 w-1.5 rounded-full bg-[#0d3393] animate-bounce [animation-delay:0.4s]"></span>
              </span>
            </div>
          </div>
        }
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-slate-200 bg-white">
        <form (ngSubmit)="onSubmit()" class="flex items-center gap-2">
          <div class="relative flex-1">
            <input
              type="text"
              [(ngModel)]="userInputText"
              name="userInputText"
              [disabled]="chatService.isLoading()"
              placeholder="Pregunta sobre tus ventas, clientes o productos..."
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0d3393] focus:bg-white focus:outline-none transition-colors pr-10"
            />
            <i class="fa-solid fa-sparkles text-[#0d3393] absolute right-3 top-1/2 -translate-y-1/2 text-xs"></i>
          </div>

          <button
            type="submit"
            [disabled]="!userInputText.trim() || chatService.isLoading()"
            class="rounded-xl bg-[#0d3393] hover:bg-[#0b2670] disabled:opacity-50 text-white px-5 py-3 text-xs font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <span>Enviar</span>
            <i class="fa-solid fa-paper-plane text-xs"></i>
          </button>
        </form>
        <p class="text-[10px] text-slate-400 text-center mt-2">
          Respuestas basadas en datos reales del Data Warehouse (puede tardar unos segundos).
        </p>
      </div>
    </div>
  `
})
export class VentasAiChatComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  chatService = inject(VentasAiChatService);
  userInputText = '';

  private readonly chartCache = new Map<string, ReturnType<VentasAiChatService['buildChartFromDatos']>>();

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  onSubmit() {
    const query = this.userInputText.trim();
    if (!query || this.chatService.isLoading()) return;
    this.userInputText = '';
    this.sendQuery(query);
  }

  sendQuery(query: string) {
    this.chatService.sendMessage(query);
  }

  chartFor(msg: { id: string; datos?: Record<string, unknown>[] | null }) {
    if (!this.chartCache.has(msg.id)) {
      this.chartCache.set(msg.id, this.chatService.buildChartFromDatos(msg.datos));
    }
    return this.chartCache.get(msg.id) ?? null;
  }

  private scrollToBottom() {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch {}
  }
}
