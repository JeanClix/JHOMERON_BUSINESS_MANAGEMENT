import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AI_SERVICE_BASE_URL } from '../config/ai-service.config';
import { AiChatApiResponse, VentasChatMessage, VentasPresetPrompt } from '../models/ai-service.model';
import { BusinessChartData } from '../models/chart.model';
import { buildChartFromDatos } from '../utils/chart-from-datos';
import { AuthService } from './auth.service';

/**
 * Chat de ventas conectado al AI Service real (backend/intelligence/ai).
 * A diferencia de GerenciaChatService (que hoy simula respuestas), este
 * servicio consume /chat vía HTTP y solo trabaja con datos reales del
 * Data Warehouse (Text-to-SQL sobre ai.v_ventas_vendedor -- /chat exige el
 * JWT del vendedor y el propio AI Service fuerza el filtro por vendedor del
 * lado del servidor, nunca confía en lo que escriba el LLM, ver README de
 * backend/intelligence/ai).
 */
@Injectable({
  providedIn: 'root'
})
export class VentasAiChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly messagesSignal = signal<VentasChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      content:
        'Hola, soy tu **Asistente de Ventas Jhomeron AI**. Puedo responder preguntas reales sobre tus ventas, ' +
        'clientes, productos y desempeño por vendedor consultando directamente el Data Warehouse. Prueba una de las preguntas frecuentes o escribe la tuya.',
      timestamp: this.now()
    }
  ]);

  public readonly messages = this.messagesSignal.asReadonly();
  public readonly isLoading = signal<boolean>(false);

  // Preguntas frecuentes en primera persona -- /chat siempre responde sobre
  // LAS VENTAS DEL VENDEDOR LOGUEADO (ver ai.v_ventas_vendedor), nunca de
  // toda la empresa, así que el input rápido debe reflejar eso en vez de
  // preguntar "vendimos" como si fuera un dato de gerencia.
  private readonly presetPrompts: VentasPresetPrompt[] = [
    {
      id: 'p-mes',
      icon: 'fa-solid fa-calendar-days',
      label: 'Vendido este mes',
      prompt: '¿Cuánto llevo vendido este mes?'
    },
    {
      id: 'p-anio',
      icon: 'fa-solid fa-chart-line',
      label: 'Vendido este año',
      prompt: '¿Cuánto llevo vendido este año?'
    },
    {
      id: 'p-top-productos',
      icon: 'fa-solid fa-trophy',
      label: 'Mis productos top',
      prompt: '¿Cuáles son mis 5 productos más vendidos por total en soles?'
    },
    {
      id: 'p-tendencia',
      icon: 'fa-solid fa-chart-area',
      label: 'Mi tendencia',
      prompt: '¿Cómo viene mi tendencia de ventas en los últimos 6 meses?'
    },
    {
      id: 'p-clientes-top',
      icon: 'fa-solid fa-building',
      label: 'Mis clientes top',
      prompt: '¿Cuáles son mis 5 clientes con mayor monto de compra?'
    }
  ];

  getPresetPrompts(): VentasPresetPrompt[] {
    return this.presetPrompts;
  }

  async sendMessage(pregunta: string): Promise<void> {
    const trimmed = pregunta.trim();
    if (!trimmed || this.isLoading()) return;

    // Se captura ANTES de agregar el mensaje nuevo -- es lo que ya se habló,
    // sin incluir la pregunta actual (ver AiChatRequest.historial). Los
    // mensajes de error no se mandan de vuelta al LLM, no aportan contexto real.
    const historial = this.messagesSignal()
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.sender, content: m.content }));

    this.messagesSignal.update((msgs) => [
      ...msgs,
      { id: `usr-${Date.now()}`, sender: 'user', content: trimmed, timestamp: this.now() }
    ]);

    this.isLoading.set(true);
    try {
      const respuesta = await firstValueFrom(
        this.http.post<AiChatApiResponse>(
          `${AI_SERVICE_BASE_URL}/chat`,
          { pregunta: trimmed, historial },
          { headers: this.authHeaders() }
        )
      );

      // El SQL ejecutado no se muestra en la UI del vendedor (no le aporta
      // nada, ver decisión del producto) -- queda solo en consola para poder
      // depurar una respuesta rara sin tener que ir a ai.consulta_log.
      if (respuesta.sql_generado) {
        console.log('[Asistente de Ventas] SQL ejecutado:', respuesta.sql_generado, `(${respuesta.filas_retornadas} filas)`);
      }

      this.messagesSignal.update((msgs) => [
        ...msgs,
        {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          content: respuesta.respuesta,
          timestamp: this.now(),
          sqlGenerado: respuesta.sql_generado,
          filasRetornadas: respuesta.filas_retornadas,
          datos: respuesta.datos
        }
      ]);
    } catch (err: any) {
      this.messagesSignal.update((msgs) => [
        ...msgs,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          content: this.mensajeError(err),
          timestamp: this.now(),
          isError: true
        }
      ]);
    } finally {
      this.isLoading.set(false);
    }
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
      return (
        'No pude conectar con el Asistente de Ventas. Verifica que el AI Service esté corriendo en ' +
        `${AI_SERVICE_BASE_URL} (backend/intelligence/ai).`
      );
    }
    return 'Ocurrió un error consultando el asistente. Intenta de nuevo en unos segundos.';
  }

  clearHistory(): void {
    this.messagesSignal.set([
      {
        id: 'msg-welcome',
        sender: 'assistant',
        content: 'Conversación reiniciada. ¿Sobre qué dato de ventas quieres preguntar?',
        timestamp: this.now()
      }
    ]);
  }

  /** Ver core/utils/chart-from-datos.ts -- compartido con GerenciaChatService. */
  buildChartFromDatos(datos: Record<string, unknown>[] | null | undefined): BusinessChartData | null {
    return buildChartFromDatos(datos);
  }

  private now(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
