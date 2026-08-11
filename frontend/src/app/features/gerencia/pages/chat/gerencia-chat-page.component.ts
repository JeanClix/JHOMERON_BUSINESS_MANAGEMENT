import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiChatComponent } from '../../components/ai-chat/ai-chat.component';

@Component({
  selector: 'app-gerencia-chat-page',
  standalone: true,
  imports: [CommonModule, AiChatComponent],
  template: `
    <div class="h-[calc(100vh-140px)] min-h-[500px]">
      <app-ai-chat></app-ai-chat>
    </div>
  `
})
export class GerenciaChatPageComponent {}
