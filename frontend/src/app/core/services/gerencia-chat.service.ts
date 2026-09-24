import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, from, Observable } from 'rxjs';
import { AI_SERVICE_BASE_URL } from '../config/ai-service.config';
import { AiChatApiResponse } from '../models/ai-service.model';
import { AiAnalysisResponse, ProcessingStage, ChatMessage, ChatPresetPrompt } from '../models/chat.model';
import { InsightCard } from '../models/insight.model';
import { AuthService } from './auth.service';

/**
 * Chat de Gerencia conectado al AI Service real (backend/intelligence/ai,
 * modo GERENCIA/ADMIN: vendedor=None, ve agregados de toda la empresa --
 * ver resolve_chat_identity en backend/intelligence/ai/src/auth.py). Mismo
 * criterio que VentasAiChatService, pero además antepone un resumen del
 * estado actual del dashboard a cada pregunta (ver setDashboardContext), para
 * que "explícame esta tarjeta" tenga con qué responder sin que el usuario
 * tenga que repetir los números que ya está viendo en pantalla.
 */
@Injectable({
  providedIn: 'root'
})
export class GerenciaChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Signals for DeepWiki Query Flow
  public readonly processingStage = signal<ProcessingStage>('idle');
  public readonly processingMessage = signal<string>('');
  public readonly activeAnalysis = signal<AiAnalysisResponse | null>(null);
  public readonly queryHistory = signal<string[]>([
    '¿Cómo están las ventas este mes?',
    '¿Cuáles son los productos más vendidos?',
    'Compara las ventas de este mes con el anterior',
    'Explícame el comportamiento de las ventas'
  ]);

  // Resumen del dashboard visible ahora mismo (ver gerencia-dashboard.component.ts,
  // que lo mantiene actualizado con un effect()) -- se antepone a cada pregunta
  // que se manda al AI Service, nunca se muestra tal cual al usuario.
  private dashboardContext = '';

  // Preset Quick Prompts
  private readonly presetPrompts: ChatPresetPrompt[] = [
    {
      id: 'p-sales-month',
      icon: 'fa-solid fa-chart-line',
      title: 'Ventas del Mes',
      prompt: '¿Cómo están las ventas este mes?',
      category: 'ventas'
    },
    {
      id: 'p-top-products',
      icon: 'fa-solid fa-trophy',
      title: 'Productos Top',
      prompt: '¿Cuáles son los productos más vendidos?',
      category: 'marina'
    },
    {
      id: 'p-period-comp',
      icon: 'fa-solid fa-[#0d3393] fa-arrow-right-arrow-left',
      title: 'Comparativa de Períodos',
      prompt: 'Compara las ventas de este mes con el anterior',
      category: 'ventas'
    },
    {
      id: 'p-trend-behavior',
      icon: 'fa-solid fa-lightbulb',
      title: 'Análisis de Comportamiento',
      prompt: 'Explícame el comportamiento de las ventas',
      category: 'rentabilidad'
    }
  ];

  private readonly TEXTO_BIENVENIDA =
    `¡Hola! Soy el **Asistente de IA para Gerencia** 🤖.\n` +
    `Puedo responder preguntas reales sobre las ventas, clientes y productos de toda la empresa, consultando directamente el Data Warehouse. También puedo explicarte cualquier tarjeta del dashboard -- usa el botón de "explicar" que aparece en cada una.`;

  private mensajeBienvenida(): ChatMessage {
    return {
      id: `msg-welcome-${Date.now()}`,
      sender: 'assistant',
      content: this.TEXTO_BIENVENIDA,
      timestamp: this.now()
    };
  }

  // Chat de mensajes (vista /gerencia/chat, ver AiChatComponent) -- arranca
  // con el saludo, y clearHistory()/nuevoChat() vuelven acá (no lo dejan en
  // blanco, ver comentario de esos métodos más abajo).
  private readonly messagesSignal = signal<ChatMessage[]>([this.mensajeBienvenida()]);
  public readonly messages = this.messagesSignal.asReadonly();
  public readonly isChatLoading = signal<boolean>(false);

  constructor(private router: Router) {}

  getPresetPrompts(): ChatPresetPrompt[] {
    return this.presetPrompts;
  }

  /** Ver comentario de `dashboardContext` arriba. */
  setDashboardContext(contexto: string): void {
    this.dashboardContext = contexto;
  }

  /**
   * Punto de entrada único para "hacerle una pregunta a gerencia" desde
   * cualquier lado (barra de chat sticky, chips de preguntas frecuentes,
   * botones "explicar" de las tarjetas del dashboard): navega a la
   * conversación real (/gerencia/chat) y la manda por sendMessage(), que ya
   * mantiene el historial de la charla -- antes esto navegaba a
   * /gerencia/analisis y usaba un "slot" de una sola respuesta que se
   * reemplazaba en cada pregunta nueva, lo que hacía parecer que el chat
   * "se reiniciaba" y perdía el contexto de lo ya hablado.
   */
  async submitQuery(queryText: string): Promise<void> {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    if (!this.queryHistory().includes(trimmed)) {
      this.queryHistory.update(history => [trimmed, ...history]);
    }

    this.router.navigate(['/gerencia/chat']);
    // sendMessage() ya antepone el contexto del dashboard (buildPreguntaConContexto)
    // antes de mandar la pregunta al AI Service -- acá solo se pasa el texto
    // visible, para que la burbuja del chat muestre la pregunta tal cual la
    // escribió el usuario, no el contexto interno que viaja aparte.
    await firstValueFrom(this.sendMessage(trimmed));
  }

  /**
   * Muestra el detalle de una oportunidad (ver Insights Estratégicos) usando
   * el mini-dashboard YA CALCULADO en el backend (widgetTipo/widgetPayload,
   * ver insights.py) -- a propósito NO llama al AI Service: el objetivo de
   * persistir los insights es justamente no gastar tokens en cada clic.
   */
  mostrarInsight(insight: InsightCard): void {
    this.activeAnalysis.set({
      id: `insight-detalle-${insight.id}`,
      query: insight.title,
      timestamp: this.now(),
      summary: `${insight.description}\n\n**Recomendación gerencial:** ${insight.recommendation}`,
      kpis: insight.widgetTipo === 'kpi_row' ? insight.widgetPayload?.kpis : undefined,
      chart: insight.widgetTipo === 'bar_chart' ? insight.widgetPayload?.chart : undefined
    });
    this.processingStage.set('completed');
    this.processingMessage.set('✓ Análisis completado');
    this.router.navigate(['/gerencia/analisis']);
  }

  resetToDashboard(): void {
    this.processingStage.set('idle');
    this.activeAnalysis.set(null);
    this.router.navigate(['/gerencia/dashboard']);
  }

  /**
   * Chat de mensajes de página completa (/gerencia/chat, ver AiChatComponent)
   * -- a diferencia de submitQuery() (que resuelve UNA pregunta a la vez y
   * navega a /gerencia/analisis), este método mantiene una conversación real
   * en `messages()`: agrega la pregunta, llama al AI Service directamente, y
   * agrega la respuesta real (o el error) a la misma lista. No navega a
   * ningún lado.
   */
  sendMessage(userQuery: string): Observable<ChatMessage> {
    const trimmed = userQuery.trim();

    // Ver AiChatRequest.historial -- se captura ANTES de agregar el mensaje
    // nuevo, y se excluye el saludo inicial (no es un turno real de la
    // conversación, es un mensaje fijo de bienvenida).
    const historial = this.messagesSignal()
      .filter((m) => !m.id.startsWith('msg-welcome'))
      .map((m) => ({ role: m.sender, content: m.content }));

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      content: trimmed,
      timestamp: this.now()
    };
    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    this.isChatLoading.set(true);

    const promise = (async (): Promise<ChatMessage> => {
      let aiMsg: ChatMessage;
      try {
        const respuesta = await firstValueFrom(
          this.http.post<AiChatApiResponse>(
            `${AI_SERVICE_BASE_URL}/chat`,
            { pregunta: this.buildPreguntaConContexto(trimmed), historial },
            { headers: this.authHeaders() }
          )
        );
        aiMsg = { id: `ai-${Date.now()}`, sender: 'assistant', content: respuesta.respuesta, timestamp: this.now() };
      } catch (err) {
        aiMsg = { id: `err-${Date.now()}`, sender: 'assistant', content: this.mensajeError(err), timestamp: this.now() };
      }
      this.messagesSignal.update(msgs => [...msgs, aiMsg]);
      this.isChatLoading.set(false);
      return aiMsg;
    })();

    return from(promise);
  }

  /** Limpia la respuesta actual de /gerencia/analisis y reinicia la
   * conversación de /gerencia/chat al saludo inicial (nunca la deja en
   * blanco) -- conserva el historial de preguntas hechas en la sesión (los
   * chips), para eso está `nuevoChat()`, que además borra ese historial. */
  clearHistory(): void {
    this.processingStage.set('idle');
    this.processingMessage.set('');
    this.activeAnalysis.set(null);
    this.messagesSignal.set([this.mensajeBienvenida()]);
  }

  /** Reinicio completo: limpia la respuesta actual Y el historial de
   * preguntas de la sesión (los chips de "consultas recientes"). */
  nuevoChat(): void {
    this.clearHistory();
    this.queryHistory.set([]);
  }

  private buildPreguntaConContexto(pregunta: string): string {
    if (!this.dashboardContext) return pregunta;
    return (
      `[Contexto: esto es lo que gerencia está viendo ahora mismo en su dashboard -- usalo como referencia, ` +
      `pero confirma cifras exactas con ejecutar_sql si la pregunta lo requiere]\n${this.dashboardContext}\n\n` +
      `[Pregunta de gerencia]\n${pregunta}`
    );
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.currentUser()?.token;
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private mensajeError(err: any): string {
    if (err?.status === 401 || err?.status === 403) {
      return 'Tu sesión no tiene permiso para usar el asistente. Vuelve a iniciar sesión e intenta de nuevo.';
    }
    if (err?.status === 0) {
      return `No pude conectar con el Asistente de Gerencia. Verifica que el AI Service esté corriendo en ${AI_SERVICE_BASE_URL} (backend/intelligence/ai).`;
    }
    return 'Ocurrió un error consultando el asistente. Intenta de nuevo en unos segundos.';
  }

  private now(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
