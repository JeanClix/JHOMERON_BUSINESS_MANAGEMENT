import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="'flex gap-3 text-xs mb-4 ' + (message().sender === 'user' ? 'flex-row-reverse' : 'flex-row')">
      <!-- Avatar -->
      <div [class]="'h-8 w-8 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs ' +
        (message().sender === 'user' ? 'bg-[#ef0606] text-white' : 'bg-[#0d3393] text-white')">
        @if (message().sender === 'user') {
          <i class="fa-solid fa-user-tie"></i>
        } @else {
          <i class="fa-solid fa-robot"></i>
        }
      </div>

      <!-- Bubble Content -->
      <div [class]="'max-w-[85%] rounded-2xl p-4 shadow-xs space-y-3 ' +
        (message().sender === 'user' ? 'bg-[#0d3393] text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none')">
        
        <div class="flex items-center justify-between gap-4 text-[10px] opacity-75 border-b border-current/10 pb-1">
          <span class="font-bold uppercase tracking-wider">
            {{ message().sender === 'user' ? 'Gerente / Usuario' : 'Inteligencia Jhomeron AI' }}
          </span>
          <span>{{ message().timestamp }}</span>
        </div>

        <!-- Content formatted -->
        <div class="whitespace-pre-wrap leading-relaxed font-sans prose prose-slate max-w-none">
          {{ message().content }}
        </div>

        <!-- Key Data Points Badges -->
        @if (message().keyDataPoints?.length) {
          <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            @for (dp of message().keyDataPoints; track dp.label) {
              <div class="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-800 flex items-center gap-1.5 border border-slate-200">
                <span class="text-[#0d3393]">{{ dp.label }}:</span>
                <span class="text-slate-900 font-extrabold">{{ dp.value }}</span>
              </div>
            }
          </div>
        }

        <!-- Sources Citations -->
        @if (message().sources?.length) {
          <div class="pt-2 border-t border-slate-100 space-y-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Fuentes & Referencias Consultadas:
            </span>
            <div class="flex flex-wrap gap-1.5">
              @for (src of message().sources; track src.title) {
                <span class="rounded bg-indigo-50 border border-indigo-100 text-[#0d3393] px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                  <i class="fa-solid fa-link text-[9px]"></i>
                  {{ src.title }}
                </span>
              }
            </div>
          </div>
        }

        <!-- Suggested Follow Ups -->
        @if (message().suggestedFollowUps?.length && message().sender === 'assistant') {
          <div class="pt-3 border-t border-slate-100 space-y-1.5">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Preguntas de seguimiento sugeridas:
            </span>
            <div class="flex flex-wrap gap-1.5">
              @for (fu of message().suggestedFollowUps; track fu) {
                <button
                  type="button"
                  (click)="onFollowUpClick(fu)"
                  class="rounded-lg border border-slate-200 bg-slate-50 hover:bg-[#0d3393] hover:text-white text-slate-700 px-2.5 py-1 text-[11px] font-medium transition-colors text-left"
                >
                  {{ fu }} ➔
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class ChatMessageComponent {
  message = input.required<ChatMessage>();
  selectFollowUp = output<string>();

  onFollowUpClick(prompt: string) {
    this.selectFollowUp.emit(prompt);
  }
}
