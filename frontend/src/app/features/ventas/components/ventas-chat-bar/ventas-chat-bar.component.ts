import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VentasAiChatService } from '../../../../core/services/ventas-ai-chat.service';

/**
 * Barra de consulta rápida al asistente, fija abajo en el Dashboard y la
 * Cartera del vendedor -- equivalente a app-gerencia-chat-bar. Manda la
 * pregunta al mismo VentasAiChatService que usa el módulo "Asistente de
 * Ventas IA" y emite `enviada` para que ventas.component cambie a ese
 * módulo, donde se ve la respuesta (con su gráfico) y se puede seguir la
 * conversación.
 */
@Component({
  selector: 'app-ventas-chat-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="sticky bottom-0 z-30 w-full pointer-events-none">
      <div class="h-8 w-full bg-gradient-to-b from-transparent via-[#f8fafc]/40 to-[#f8fafc]/90 backdrop-blur-md -mb-3 pointer-events-none"></div>

      <div class="pointer-events-auto w-full bg-white/90 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-12px_30px_-5px_rgba(15,23,42,0.08)] px-4 md:px-6 py-3.5 space-y-2.5">
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
          @if (chatService.isLoading()) {
            <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d3393]/10 text-[#0d3393] font-extrabold text-[11px] animate-pulse border border-[#0d3393]/20">
              <i class="fa-solid fa-spinner animate-spin"></i>
              <span>Consultando tus ventas...</span>
            </div>
          } @else {
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
              Consultas Frecuentes:
            </span>
            @for (prompt of chatService.getPresetPrompts(); track prompt.id) {
              <button
                type="button"
                (click)="enviar(prompt.prompt)"
                class="shrink-0 rounded-full bg-slate-100/90 hover:bg-[#0d3393] hover:text-white text-slate-700 border border-slate-200/80 px-3 py-1 text-[11px] font-semibold transition-all duration-150 flex items-center gap-1.5 shadow-2xs"
              >
                <i [class]="prompt.icon + ' text-[10px]'"></i>
                <span>{{ prompt.label }}</span>
              </button>
            }
          }
        </div>

        <form (ngSubmit)="enviar(consulta)" class="flex items-center gap-2.5">
          <div class="relative flex-1">
            <input
              type="text"
              [(ngModel)]="consulta"
              name="consulta"
              [disabled]="chatService.isLoading()"
              placeholder="Pregunta al asistente... (ej. ¿Cuánto llevo vendido este mes?)"
              aria-label="Pregunta al asistente de ventas"
              class="w-full rounded-2xl border border-slate-300/80 bg-slate-50/80 pl-11 pr-4 py-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-[#0d3393] focus:bg-white focus:outline-none transition-colors shadow-2xs"
            />
            <i class="fa-solid fa-paint-roller text-[#0d3393] absolute left-4 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true"></i>
          </div>

          <button
            type="submit"
            [disabled]="!consulta.trim() || chatService.isLoading()"
            class="rounded-2xl bg-[#0d3393] hover:bg-[#0b2670] disabled:opacity-50 text-white px-6 py-3.5 text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center gap-2 shrink-0"
          >
            <span>Consultar</span>
            <i class="fa-solid fa-paper-plane text-sm" aria-hidden="true"></i>
          </button>
        </form>
      </div>
    </div>
  `
})
export class VentasChatBarComponent {
  protected readonly chatService = inject(VentasAiChatService);

  /** Se emite al mandar una consulta: el padre cambia al módulo del asistente. */
  @Output() enviada = new EventEmitter<void>();

  protected consulta = '';

  protected enviar(pregunta: string) {
    const texto = pregunta.trim();
    if (!texto || this.chatService.isLoading()) return;
    this.consulta = '';
    this.enviada.emit();
    void this.chatService.sendMessage(texto);
  }
}
