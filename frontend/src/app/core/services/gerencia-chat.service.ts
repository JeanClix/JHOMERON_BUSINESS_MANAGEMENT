import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AI_SERVICE_BASE_URL } from '../config/ai-service.config';
import { AiChatApiResponse } from '../models/ai-service.model';
import { AiAnalysisResponse, ProcessingStage, ChatMessage, ChatPresetPrompt } from '../models/chat.model';
import { InsightCard } from '../models/insight.model';
import { buildChartFromDatos } from '../utils/chart-from-datos';
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

  // Initial Chat History
  private readonly messagesSignal = signal<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      content: `¡Hola! Soy el **Asistente de IA para Gerencia** 🤖.
Puedo responder preguntas reales sobre las ventas, clientes y productos de toda la empresa, consultando directamente el Data Warehouse. También puedo explicarte cualquier tarjeta del dashboard -- usa el botón de "explicar" que aparece en cada una.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  public readonly messages = this.messagesSignal.asReadonly();

  constructor(private router: Router) {}

  getPresetPrompts(): ChatPresetPrompt[] {
    return this.presetPrompts;
  }

  /** Ver comentario de `dashboardContext` arriba. */
  setDashboardContext(contexto: string): void {
    this.dashboardContext = contexto;
  }

  /**
   * Envía la pregunta al AI Service real y navega a la vista de análisis
   * mientras se resuelve. El resumen del dashboard (si hay uno cargado) va
   * antepuesto a la pregunta del usuario, nunca reemplazándola.
   */
  async submitQuery(queryText: string): Promise<void> {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    if (!this.queryHistory().includes(trimmed)) {
      this.queryHistory.update(history => [trimmed, ...history]);
    }

    this.processingStage.set('analyzing_query');
    this.processingMessage.set('🤖 Analizando consulta...');
    this.router.navigate(['/gerencia/analisis']);

    this.processingStage.set('fetching_data');
    this.processingMessage.set('🤖 Consultando el Data Warehouse...');

    const timestamp = this.now();
    try {
      const respuesta = await firstValueFrom(
        this.http.post<AiChatApiResponse>(
          `${AI_SERVICE_BASE_URL}/chat`,
          { pregunta: this.buildPreguntaConContexto(trimmed) },
          { headers: this.authHeaders() }
        )
      );

      this.processingStage.set('generating_visualization');
      this.processingMessage.set('🤖 Generando visualización...');

      const chart = buildChartFromDatos(respuesta.datos) ?? undefined;
      this.activeAnalysis.set({
        id: `analysis-${Date.now()}`,
        query: trimmed,
        timestamp,
        summary: respuesta.respuesta,
        chart
      });
      this.processingStage.set('completed');
      this.processingMessage.set('✓ Análisis completado');
    } catch (err: any) {
      this.activeAnalysis.set({
        id: `analysis-${Date.now()}`,
        query: trimmed,
        timestamp,
        summary: this.mensajeError(err)
      });
      this.processingStage.set('completed');
      this.processingMessage.set('✗ Error consultando el asistente');
    }
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

  /** Chat de mensajes (para la vista de chat de página completa, /gerencia/chat). */
  sendMessage(userQuery: string): Observable<ChatMessage> {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      content: userQuery,
      timestamp: timeStr
    };
    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    this.submitQuery(userQuery);

    const responseMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'assistant',
      content: `Análisis en camino para: **"${userQuery}"** -- revisa la vista de Análisis.`,
      timestamp: timeStr
    };
    return of(responseMsg).pipe(delay(300));
  }

  clearHistory(): void {
    this.queryHistory.set([
      '¿Cómo están las ventas este mes?',
      '¿Cuáles son los productos más vendidos?',
      'Compara las ventas de este mes con el anterior',
      'Explícame el comportamiento de las ventas'
    ]);
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
