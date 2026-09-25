import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ConsumoIaService } from '../../../core/services/consumo-ia.service';
import { ConsumoIaChat, ConsumoIaResponse, ConsumoIaUsuario } from '../../../core/models/consumo-ia.model';

const SIN_IDENTIFICAR = 'sin-identificar';

/**
 * Filtro temporal: solo empleados con cuenta en el sistema (usuario y nombre
 * resueltos contra la tabla usuarios). Oculta los chats "sin identificar"
 * (gerencia antes de registrar el usuario) y los de vendedores de prueba sin
 * cuenta -- siguen en ai.consulta_log, solo no se muestran.
 */
function tieneCuenta(u: Pick<ConsumoIaUsuario, 'clave' | 'usuario' | 'nombre'>): boolean {
  return u.clave !== SIN_IDENTIFICAR && u.usuario !== null && u.nombre !== null;
}

@Component({
  selector: 'app-consumo-ia',
  standalone: true,
  templateUrl: './consumo-ia.html',
  styleUrl: './consumo-ia.css',
})
export class ConsumoIa implements OnInit {
  private consumoIaService = inject(ConsumoIaService);

  protected readonly periodos = [7, 30, 90];

  datos = signal<ConsumoIaResponse | null>(null);
  dias = signal<number>(30);
  chatAbierto = signal<number | null>(null);
  cargando = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  /** `datos` con el filtro de tieneCuenta aplicado y los totales recalculados sobre lo visible. */
  protected readonly visible = computed<ConsumoIaResponse | null>(() => {
    const d = this.datos();
    if (!d) return null;
    const porUsuario = d.porUsuario.filter(tieneCuenta);
    const claves = new Set(porUsuario.map((u) => u.clave));
    const suma = (campo: 'preguntas' | 'tokensEntrada' | 'tokensSalida' | 'costoEstimadoUsd' | 'preguntasSinTokens') =>
      porUsuario.reduce((total, u) => total + u[campo], 0);
    return {
      ...d,
      porUsuario,
      chats: d.chats.filter((c) => claves.has(c.clave)),
      totales: {
        preguntas: suma('preguntas'),
        tokensEntrada: suma('tokensEntrada'),
        tokensSalida: suma('tokensSalida'),
        costoEstimadoUsd: Math.round(suma('costoEstimadoUsd') * 10_000) / 10_000,
        preguntasSinTokens: suma('preguntasSinTokens'),
      },
    };
  });

  private readonly formatoCompacto = new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 });
  private readonly formatoEntero = new Intl.NumberFormat('es-PE');

  ngOnInit() {
    this.cargar();
  }

  cambiarPeriodo(dias: number) {
    this.dias.set(dias);
    this.cargar();
  }

  alternarChat(chat: ConsumoIaChat) {
    this.chatAbierto.update((id) => (id === chat.id ? null : chat.id));
  }

  private cargar() {
    this.cargando.set(true);
    this.errorMessage.set(null);
    this.consumoIaService.obtener(this.dias()).subscribe({
      next: (data) => {
        this.datos.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMessage.set(
          err?.status === 0
            ? 'No se pudo conectar con el Admin Service (¿está corriendo en el puerto 8092?).'
            : 'No se pudo cargar el consumo de IA.'
        );
      }
    });
  }

  protected nombreDe(item: { clave: string; nombre: string | null; usuario: string | null }): string {
    if (item.clave === SIN_IDENTIFICAR) return 'Sin identificar';
    return item.nombre ?? item.usuario ?? item.clave;
  }

  /** Segunda línea bajo el nombre: el usuario de login, o por qué no se sabe quién fue. */
  protected detalleDe(item: { clave: string; nombre: string | null; usuario: string | null }): string | null {
    if (item.clave === SIN_IDENTIFICAR) return 'Gerencia/Admin, antes de registrar el usuario';
    if (item.nombre && item.usuario) return item.usuario;
    if (!item.usuario) return 'Vendedor sin cuenta en el sistema';
    return null;
  }

  protected compacto(n: number): string {
    return this.formatoCompacto.format(n);
  }

  protected entero(n: number | null): string {
    return n === null ? '—' : this.formatoEntero.format(n);
  }

  protected usd(n: number): string {
    return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
  }

  protected fecha(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  }
}
