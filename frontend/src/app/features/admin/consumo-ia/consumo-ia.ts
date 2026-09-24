import { Component, OnInit, inject, signal } from '@angular/core';
import { ConsumoIaService } from '../../../core/services/consumo-ia.service';
import { ConsumoIaChat, ConsumoIaResponse } from '../../../core/models/consumo-ia.model';

const SIN_IDENTIFICAR = 'sin-identificar';

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
