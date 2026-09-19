import { BusinessChartData } from '../models/chart.model';

/**
 * Heurística para convertir filas de datos crudos (de cualquier consulta del
 * AI Service, ai.v_ventas/ai.v_ventas_vendedor u otras vistas agregadas) en
 * un gráfico de barras: usa la primera columna no-numérica como etiqueta y
 * la primera columna numérica como valor. Solo tiene sentido con listados
 * (2+ filas); un solo valor agregado (ej. "total ventas") no genera gráfico.
 *
 * Compartida entre VentasAiChatService y GerenciaChatService para que ambos
 * chats (vendedor y gerencia) rendericen gráficos con el mismo criterio.
 */
export function buildChartFromDatos(datos: Record<string, unknown>[] | null | undefined): BusinessChartData | null {
  if (!datos || datos.length < 2) return null;

  const primera = datos[0];
  const columnas = Object.keys(primera);

  const esNumerica = (col: string) => datos.every((fila) => toNumber(fila[col]) !== null);

  const colValor = columnas.find(esNumerica);
  const colEtiqueta = columnas.find((c) => c !== colValor && !esNumerica(c));

  if (!colValor || !colEtiqueta) return null;

  const filas = datos.slice(0, 15);

  return {
    id: `chart-${Date.now()}`,
    title: tituloDesdeColumna(colValor),
    type: 'bar',
    labels: filas.map((f) => truncar(String(f[colEtiqueta] ?? '—'), 28)),
    datasets: [
      {
        label: tituloDesdeColumna(colValor),
        data: filas.map((f) => toNumber(f[colValor]) ?? 0),
        backgroundColor: '#0d3393',
        borderWidth: 1
      }
    ]
  };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function tituloDesdeColumna(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}
