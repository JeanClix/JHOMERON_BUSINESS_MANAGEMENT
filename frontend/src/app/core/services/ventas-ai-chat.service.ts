import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AI_SERVICE_BASE_URL } from '../config/ai-service.config';
import { AiChatApiResponse, VentasChatMessage, VentasPresetPrompt } from '../models/ai-service.model';
import { BusinessChartData } from '../models/chart.model';

/**
 * Chat de ventas conectado al AI Service real (backend/intelligence/ai).
 * A diferencia de GerenciaChatService (que hoy simula respuestas), este
 * servicio consume /chat vía HTTP y solo trabaja con datos reales del
 * Data Warehouse (Text-to-SQL, ver ai.v_ventas / ai.v_ventas_mensual_departamento).
 */
@Injectable({
  providedIn: 'root'
})
export class VentasAiChatService {
  private readonly http = inject(HttpClient);

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

  // Preguntas frecuentes alineadas a los campos reales del modelo estrella
  // (departamento, vendedor/empleado_venta, producto) -- ver ai.v_ventas.
  private readonly presetPrompts: VentasPresetPrompt[] = [
    {
      id: 'p-mis-ventas',
      icon: 'fa-solid fa-chart-line',
      label: 'Total de ventas',
      prompt: '¿Cuánto vendimos en total en soles?'
    },
    {
      id: 'p-top-productos',
      icon: 'fa-solid fa-trophy',
      label: 'Top productos',
      prompt: '¿Cuáles son los 5 productos más vendidos por total en soles?'
    },
    {
      id: 'p-por-departamento',
      icon: 'fa-solid fa-map-location-dot',
      label: 'Ventas por departamento',
      prompt: '¿Cómo se distribuyen las ventas por departamento?'
    },
    {
      id: 'p-mejor-vendedor',
      icon: 'fa-solid fa-medal',
      label: 'Ranking de vendedores',
      prompt: '¿Qué vendedor tuvo mayor monto de ventas?'
    },
    {
      id: 'p-clientes-top',
      icon: 'fa-solid fa-building',
      label: 'Top clientes',
      prompt: '¿Cuáles son los 5 clientes con mayor monto de compra?'
    }
  ];

  getPresetPrompts(): VentasPresetPrompt[] {
    return this.presetPrompts;
  }

  async sendMessage(pregunta: string): Promise<void> {
    const trimmed = pregunta.trim();
    if (!trimmed || this.isLoading()) return;

    this.messagesSignal.update((msgs) => [
      ...msgs,
      { id: `usr-${Date.now()}`, sender: 'user', content: trimmed, timestamp: this.now() }
    ]);

    this.isLoading.set(true);
    try {
      const respuesta = await firstValueFrom(
        this.http.post<AiChatApiResponse>(`${AI_SERVICE_BASE_URL}/chat`, { pregunta: trimmed })
      );

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
    } catch (err) {
      this.messagesSignal.update((msgs) => [
        ...msgs,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          content:
            'No pude conectar con el Asistente de Ventas. Verifica que el AI Service esté corriendo en ' +
            `${AI_SERVICE_BASE_URL} (backend/intelligence/ai).`,
          timestamp: this.now(),
          isError: true
        }
      ]);
    } finally {
      this.isLoading.set(false);
    }
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

  /**
   * Heurística para convertir filas de datos (ai.v_ventas / vistas agregadas)
   * en un gráfico de barras: usa la primera columna no-numérica como etiqueta
   * y la primera columna numérica como valor. Solo tiene sentido con listados
   * (2+ filas); un solo valor agregado (ej. "total ventas") no genera gráfico.
   */
  buildChartFromDatos(datos: Record<string, unknown>[] | null | undefined): BusinessChartData | null {
    if (!datos || datos.length < 2) return null;

    const primera = datos[0];
    const columnas = Object.keys(primera);

    const esNumerica = (col: string) => datos.every((fila) => this.toNumber(fila[col]) !== null);

    const colValor = columnas.find(esNumerica);
    const colEtiqueta = columnas.find((c) => c !== colValor && !esNumerica(c));

    if (!colValor || !colEtiqueta) return null;

    const filas = datos.slice(0, 15);

    return {
      id: `chart-${Date.now()}`,
      title: this.tituloDesdeColumna(colValor),
      type: 'bar',
      labels: filas.map((f) => this.truncar(String(f[colEtiqueta] ?? '—'), 28)),
      datasets: [
        {
          label: this.tituloDesdeColumna(colValor),
          data: filas.map((f) => this.toNumber(f[colValor]) ?? 0),
          backgroundColor: '#0d3393',
          borderWidth: 1
        }
      ]
    };
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  }

  private tituloDesdeColumna(col: string): string {
    return col
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private truncar(texto: string, max: number): string {
    return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
  }

  private now(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
