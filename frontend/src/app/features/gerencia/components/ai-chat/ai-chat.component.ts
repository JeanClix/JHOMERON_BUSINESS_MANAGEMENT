import { Component, ElementRef, ViewChild, inject, signal, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';
import { ChatMessageComponent } from './chat-message.component';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatMessageComponent],
  template: `
    <div class="rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
      <!-- Header Bar -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0d3393] to-[#0b2670] text-white shadow-xs">
            <i class="fa-solid fa-robot text-sm"></i>
          </div>
          <div>
            <h3 class="text-sm font-extrabold text-slate-900 leading-tight">
              Asistente de Inteligencia Gerencial Jhomeron AI
            </h3>
            <div class="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
              <span class="flex items-center gap-1 text-emerald-600 font-bold">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Modelo Conectado (Spring AI Ready)
              </span>
              <span>•</span>
              <span>Análisis & Documentos RAG</span>
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

      <!-- Preset Prompts Carousel / Grid -->
      <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Consultas Rápidas:</span>
        @for (prompt of chatService.getPresetPrompts(); track prompt.id) {
          <button
            type="button"
            (click)="sendUserQuery(prompt.prompt)"
            class="shrink-0 rounded-xl bg-white border border-slate-200 hover:border-[#0d3393] hover:text-[#0d3393] px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5"
          >
            <i [class]="prompt.icon + ' text-[#0d3393] text-xs'"></i>
            <span>{{ prompt.title }}</span>
          </button>
        }
      </div>

      <!-- Messages Scroll Area -->
      <div #scrollContainer class="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#f8fafc]/50">
        @for (msg of chatService.messages(); track msg.id) {
          <app-chat-message
            [message]="msg"
            (selectFollowUp)="sendUserQuery($event)"
          ></app-chat-message>
        }

        @if (isLoading()) {
          <div class="flex items-center gap-3 text-xs text-slate-500 mb-4 bg-white p-3.5 rounded-2xl border border-slate-200 w-fit shadow-2xs">
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d3393] text-white">
              <i class="fa-solid fa-robot text-xs animate-spin"></i>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-[#0d3393]">Procesando consulta gerencial</span>
              <span class="flex gap-1">
                <span class="h-1.5 w-1.5 rounded-full bg-[#0d3393] animate-bounce"></span>
                <span class="h-1.5 w-1.5 rounded-full bg-[#0d3393] animate-bounce [animation-delay:0.2s]"></span>
                <span class="h-1.5 w-1.5 rounded-full bg-[#0d3393] animate-bounce [animation-delay:0.4s]"></span>
              </span>
            </div>
          </div>
        }
      </div>

      <!-- Input Bar -->
      <div class="p-4 border-t border-slate-200 bg-white">
        <form (ngSubmit)="onSubmit()" class="flex items-center gap-2">
          <div class="relative flex-1">
            <input
              type="text"
              [(ngModel)]="userInputText"
              name="userInputText"
              [disabled]="isLoading()"
              placeholder="Realiza una pregunta sobre ventas, márgenes, tendencias o documentos..."
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0d3393] focus:bg-white focus:outline-none transition-colors pr-10"
            />
            <i class="fa-solid fa-sparkles text-[#0d3393] absolute right-3 top-1/2 -translate-y-1/2 text-xs"></i>
          </div>

          <button
            type="submit"
            [disabled]="!userInputText.trim() || isLoading()"
            class="rounded-xl bg-[#0d3393] hover:bg-[#0b2670] disabled:opacity-50 text-white px-5 py-3 text-xs font-bold transition-all shadow-xs flex items-center gap-2"
          >
            <span>Enviar</span>
            <i class="fa-solid fa-paper-plane text-xs"></i>
          </button>
        </form>
        <p class="text-[10px] text-slate-400 text-center mt-2">
          Asistente impulsado por IA de Jhomeron. Arquitectura desacoplada lista para Spring AI / RAG Enterprise.
        </p>
      </div>
    </div>
  `
})
export class AiChatComponent implements AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  chatService = inject(GerenciaChatService);
  userInputText = '';
  isLoading = signal<boolean>(false);

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  onSubmit() {
    if (this.userInputText.trim() && !this.isLoading()) {
      const query = this.userInputText.trim();
      this.userInputText = '';
      this.sendUserQuery(query);
    }
  }

  sendUserQuery(query: string) {
    this.isLoading.set(true);
    this.chatService.sendMessage(query).subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private scrollToBottom() {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }
}
