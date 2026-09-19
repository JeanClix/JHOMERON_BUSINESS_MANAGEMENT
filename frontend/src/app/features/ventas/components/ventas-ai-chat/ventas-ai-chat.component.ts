import { Component, ElementRef, ViewChild, computed, inject, signal, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasAiChatService } from '../../../../core/services/ventas-ai-chat.service';
import { VentasChatMessage } from '../../../../core/models/ai-service.model';
import { BusinessChartComponent } from '../../../../shared/components/business-chart/business-chart.component';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';

/**
 * Chat del vendedor conectado al AI Service real (Python/FastAPI) sobre el
 * Data Warehouse de ventas. Sustituye el input estático que existía antes
 * en la pestaña "Asistente Técnico IA" -- ver ventas.component.html.
 *
 * Layout de dos columnas (estilo DeepWiki): la conversación va a la
 * izquierda, y el gráfico de la respuesta activa se ve aparte a la derecha en
 * desktop -- el panel empieza vacío y solo se llena cuando el vendedor toca
 * "Mostrar panel de detalle" en una respuesta que trajo un gráfico (no todas
 * lo traen, ver chartFor()). En mobile no hay espacio para el panel, así que
 * el gráfico se muestra inline en la burbuja. El SQL ejecutado NO se muestra
 * acá (no le aporta nada al vendedor) -- queda como console.log en el
 * servicio para poder depurar sin tener que ir a ai.consulta_log.
 */
@Component({
  selector: 'app-ventas-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, BusinessChartComponent, MarkdownPipe],
  template: `
    <div class="flex flex-col lg:flex-row gap-4 h-[calc(100vh-220px)] min-h-[560px]">
      <!-- Chat -->
      <div class="flex-1 min-w-0 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0d3393] to-[#0b2670] text-white shadow-xs">
              <i class="fa-solid fa-paint-roller text-sm"></i>
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-slate-900 leading-tight">Asistente de Ventas Jhomeron AI</h3>
              <div class="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                <span class="flex items-center gap-1 text-emerald-600 font-bold">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Conectado al Data Warehouse real
                </span>
                <span>•</span>
                <span>Solo tus ventas</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="limpiar()"
              class="rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors shadow-2xs"
              title="Borrar la conversación actual"
            >
              <i class="fa-solid fa-trash-can mr-1.5 text-xs"></i>Limpiar
            </button>
            <button
              type="button"
              (click)="nuevoChat()"
              class="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors shadow-2xs"
              title="Empezar una conversación nueva"
            >
              <i class="fa-solid fa-plus mr-1.5 text-xs text-[#0d3393]"></i>Nuevo Chat
            </button>
          </div>
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
                <i [class]="msg.sender === 'user' ? 'fa-solid fa-user-tie' : 'fa-solid fa-paint-roller'"></i>
              </div>

              <div
                [class]="'max-w-[85%] rounded-2xl p-4 shadow-xs space-y-3 ' +
                (msg.sender === 'user' ? 'bg-[#0d3393] text-white rounded-tr-none' : 'bg-white border text-slate-800 rounded-tl-none ' +
                  (esActivo(msg) ? 'border-[#0d3393] ring-2 ring-[#0d3393]/20' : 'border-slate-200'))"
              >
                <div class="flex items-center justify-between gap-4 text-[10px] opacity-75 border-b border-current/10 pb-1">
                  <span class="font-bold uppercase tracking-wider">
                    {{ msg.sender === 'user' ? 'Vendedor' : 'Asistente de Ventas AI' }}
                  </span>
                  <span>{{ msg.timestamp }}</span>
                </div>

                @if (msg.sender === 'assistant') {
                  <div class="leading-relaxed font-sans prose prose-sm prose-slate max-w-none prose-table:text-xs prose-th:bg-slate-50" [innerHTML]="msg.content | markdown"></div>
                } @else {
                  <div class="whitespace-pre-wrap leading-relaxed font-sans">{{ msg.content }}</div>
                }

                <!-- Indicador "ver detalle" (desktop: abre el panel de al lado)
                     -- solo aparece si realmente hay un gráfico que mostrar,
                     no por cualquier respuesta con datos/SQL. -->
                @if (msg.sender === 'assistant' && chartFor(msg)) {
                  <button
                    type="button"
                    (click)="seleccionar(msg)"
                    class="hidden lg:flex items-center gap-1.5 text-[10px] font-bold pt-1 hover:underline"
                    [class]="esActivo(msg) ? 'text-[#0d3393]' : 'text-slate-400'"
                  >
                    <i class="fa-solid fa-chart-simple"></i>
                    <span>Mostrar panel de detalle →</span>
                  </button>
                }

                <!-- Mobile: sin panel lateral, el gráfico va inline (el SQL no
                     se muestra al vendedor, ver console.log en el servicio). -->
                @if (chartFor(msg)) {
                  <div class="lg:hidden pt-2 border-t border-current/10">
                    <app-business-chart [chartData]="chartFor(msg)!" height="220px"></app-business-chart>
                  </div>
                }
              </div>
            </div>
          }

          @if (chatService.isLoading()) {
            <div class="flex items-center gap-3 text-xs text-slate-500 bg-white p-3.5 rounded-2xl border border-slate-200 w-fit shadow-2xs">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d3393] text-white">
                <i class="fa-solid fa-paint-roller text-xs animate-pulse"></i>
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
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0d3393] focus:bg-white focus:outline-none transition-colors pr-10"
              />
              <i class="fa-solid fa-sparkles text-[#0d3393] absolute right-3.5 top-1/2 -translate-y-1/2 text-sm"></i>
            </div>

            <button
              type="submit"
              [disabled]="!userInputText.trim() || chatService.isLoading()"
              class="rounded-xl bg-[#0d3393] hover:bg-[#0b2670] disabled:opacity-50 text-white px-6 py-3.5 text-sm font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <span>Enviar</span>
              <i class="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </form>
          <p class="text-[10px] text-slate-400 text-center mt-2">
            Respuestas basadas en tus datos reales del Data Warehouse (puede tardar unos segundos).
          </p>
        </div>
      </div>

      <!-- Panel de detalle (desktop): escondido por defecto (w-0), se
           "descomprime" con una transición de ancho cuando el vendedor toca
           "Mostrar panel de detalle" en una respuesta con gráfico. -->
      <div
        [class]="'hidden lg:flex shrink-0 flex-col rounded-2xl bg-white border shadow-xs overflow-hidden transition-all duration-300 ease-in-out ' +
          (mensajeDetalle() ? 'lg:w-[380px] border-slate-200 opacity-100' : 'lg:w-0 border-transparent opacity-0 pointer-events-none')"
      >
        <div class="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
          <div class="min-w-0">
            <h4 class="text-sm font-extrabold text-slate-900 flex items-center gap-2 whitespace-nowrap">
              <i class="fa-solid fa-chart-simple text-[#0d3393]"></i> Detalle de la respuesta
            </h4>
          </div>
          <button
            type="button"
            (click)="cerrarDetalle()"
            class="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Cerrar panel de detalle"
          >
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4 min-w-[380px]">
          @if (mensajeDetalle(); as detalle) {
            <div class="leading-relaxed text-sm text-slate-700 prose prose-sm prose-slate max-w-none prose-table:text-xs prose-th:bg-slate-50" [innerHTML]="detalle.content | markdown"></div>

            @if (chartFor(detalle); as chart) {
              <app-business-chart [chartData]="chart" height="260px"></app-business-chart>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class VentasAiChatComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  chatService = inject(VentasAiChatService);
  userInputText = '';

  private readonly chartCache = new Map<string, ReturnType<VentasAiChatService['buildChartFromDatos']>>();

  // El panel de detalle empieza vacío y solo se abre cuando el vendedor toca
  // "Mostrar panel de detalle" en una respuesta puntual -- no sigue
  // automáticamente la última respuesta.
  private readonly selectedMessageId = signal<string | null>(null);

  protected readonly mensajeDetalle = computed<VentasChatMessage | null>(() => {
    const seleccionado = this.selectedMessageId();
    if (!seleccionado) return null;
    return this.chatService.messages().find((m) => m.id === seleccionado) ?? null;
  });

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
    // Cierra el panel de detalle al hacer una pregunta nueva -- si el
    // vendedor quiere ver el gráfico de la respuesta que llegue, toca
    // "Mostrar panel de detalle" de nuevo.
    this.selectedMessageId.set(null);
    this.chatService.sendMessage(query);
  }

  /** Toggle: si ya está abierto en esta respuesta, lo cierra; si no, lo abre. */
  seleccionar(msg: VentasChatMessage) {
    this.selectedMessageId.set(this.esActivo(msg) ? null : msg.id);
  }

  cerrarDetalle() {
    this.selectedMessageId.set(null);
  }

  esActivo(msg: VentasChatMessage): boolean {
    return this.mensajeDetalle()?.id === msg.id;
  }

  limpiar() {
    this.selectedMessageId.set(null);
    this.chatService.clearHistory();
  }

  /** Igual que "Limpiar" pero además vacía el caché de gráficos y cierra el
   * panel de detalle -- un reinicio completo, no solo el mensaje visible. */
  nuevoChat() {
    this.selectedMessageId.set(null);
    this.chartCache.clear();
    this.chatService.clearHistory();
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
