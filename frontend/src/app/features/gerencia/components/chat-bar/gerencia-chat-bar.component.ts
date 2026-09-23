import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GerenciaChatService } from '../../../../core/services/gerencia-chat.service';

@Component({
  selector: 'app-gerencia-chat-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sticky bottom-0 z-30 w-full pointer-events-none">
      <!-- Top Soft Blur & Gradient Fade Transition -->
      <div class="h-8 w-full bg-gradient-to-b from-transparent via-[#f8fafc]/40 to-[#f8fafc]/90 backdrop-blur-md -mb-3 pointer-events-none"></div>

      <!-- Elevated Chat Container with Glassmorphism Blur -->
      <div class="pointer-events-auto w-full bg-white/90 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-12px_30px_-5px_rgba(15,23,42,0.08)] px-4 md:px-6 py-3.5 space-y-2.5">
        <!-- Top Row: Processing Status Indicator OR Query History Chips -->
        <div class="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs">
          @if (chatService.isChatLoading()) {
            <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d3393]/10 text-[#0d3393] font-extrabold text-[11px] animate-pulse border border-[#0d3393]/20">
              <i class="fa-solid fa-spinner animate-spin"></i>
              <span>Consultando el Data Warehouse...</span>
            </div>
          } @else {
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                Consultas Frecuentes:
              </span>

              @for (prompt of chatService.getPresetPrompts(); track prompt.id) {
                <button
                  type="button"
                  (click)="onSelectQuery(prompt.prompt)"
                  [disabled]="isBusy()"
                  class="shrink-0 rounded-full bg-slate-100/90 hover:bg-[#0d3393] hover:text-white text-slate-700 border border-slate-200/80 px-3 py-1 text-[11px] font-semibold transition-all duration-150 flex items-center gap-1.5 shadow-2xs backdrop-blur-xs"
                >
                  <i [class]="prompt.icon + ' text-[10px]'"></i>
                  <span>{{ prompt.title }}</span>
                </button>
              }
            </div>
          }

          <!-- Back to Main Dashboard Button -->
          @if (chatService.messages().length > 1) {
            <button
              type="button"
              (click)="chatService.resetToDashboard()"
              class="shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1 text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 shadow-2xs"
            >
              <i class="fa-solid fa-house text-[#0d3393]"></i>
              <span>Ver Dashboard Principal</span>
            </button>
          }
        </div>

        <!-- Main Input Bar -->
        <form (ngSubmit)="onFormSubmit()" class="flex items-center gap-2.5">
          <div class="relative flex-1">
            <input
              type="text"
              [(ngModel)]="queryInput"
              name="queryInput"
              [disabled]="isBusy()"
              placeholder="Pregunta a Gerencia... (ej. ¿Cómo están las ventas este mes?)"
              class="w-full rounded-2xl border border-slate-300/80 bg-slate-50/80 backdrop-blur-xs pl-11 pr-4 py-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-[#0d3393] focus:bg-white focus:outline-none transition-colors shadow-2xs"
            />
            <i class="fa-solid fa-sparkles text-[#0d3393] absolute left-4 top-1/2 -translate-y-1/2 text-sm"></i>
          </div>

          <button
            type="submit"
            [disabled]="!queryInput.trim() || isBusy()"
            class="rounded-2xl bg-[#0d3393] hover:bg-[#0b2670] disabled:opacity-50 text-white px-6 py-3.5 text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center gap-2 shrink-0"
          >
            <span>Consultar</span>
            <i class="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </form>
      </div>
    </div>
  `
})
export class GerenciaChatBarComponent {
  chatService = inject(GerenciaChatService);
  queryInput = '';

  isBusy(): boolean {
    return this.chatService.isChatLoading();
  }

  onFormSubmit() {
    if (this.queryInput.trim() && !this.isBusy()) {
      const q = this.queryInput.trim();
      this.queryInput = '';
      this.chatService.submitQuery(q);
    }
  }

  onSelectQuery(prompt: string) {
    if (!this.isBusy()) {
      this.chatService.submitQuery(prompt);
    }
  }
}
