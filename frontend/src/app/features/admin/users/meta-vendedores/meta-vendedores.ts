import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AdminUserService } from '../../../../core/services/admin-user.service';
import { AdminUser } from '../../../../core/models/admin-user.model';

/**
 * Vista dedicada para fijar la meta mensual/semanal de TODOS los vendedores
 * a la vez -- la meta es una sola para todo el equipo (no una por vendedor),
 * así que no tiene sentido editarla uno por uno desde user-form. Este
 * cambio queda automáticamente alineado con el dashboard del vendedor
 * (backend/reporting: /vendedores/me/cuota) porque ambos leen las mismas
 * columnas meta_mensual/meta_semanal de la tabla usuarios -- no hay un
 * valor "global" separado que sincronizar, el bulk-update escribe
 * directamente en cada fila de vendedor.
 */
@Component({
  selector: 'app-meta-vendedores',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './meta-vendedores.html'
})
export class MetaVendedores implements OnInit {
  private adminUserService = inject(AdminUserService);
  private router = inject(Router);

  vendedores = signal<AdminUser[]>([]);
  cargando = signal(true);
  errorMessage = signal<string | null>(null);

  metaMensual: string = '';
  metaSemanal: string = '';
  aplicando = signal(false);

  // La meta debería ser la misma para todos los vendedores hoy -- si al
  // cargar aparecen valores distintos entre ellos, es una señal de que
  // alguien la cambió a mano para uno solo antes de que existiera esta
  // vista (deuda técnica, no un error de esta pantalla).
  metaInconsistente = signal(false);

  ngOnInit() {
    this.cargar();
  }

  private cargar() {
    this.cargando.set(true);
    this.adminUserService.listar().subscribe({
      next: (data) => {
        const vendedores = data.filter((u) => u.role === 'VENDEDOR');
        this.vendedores.set(vendedores);

        const mensuales = new Set(vendedores.map((v) => v.metaMensual ?? null));
        const semanales = new Set(vendedores.map((v) => v.metaSemanal ?? null));
        this.metaInconsistente.set(mensuales.size > 1 || semanales.size > 1);

        const primero = vendedores[0];
        this.metaMensual = primero?.metaMensual != null ? String(primero.metaMensual) : '';
        this.metaSemanal = primero?.metaSemanal != null ? String(primero.metaSemanal) : '';
        this.cargando.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los vendedores.');
        this.cargando.set(false);
      }
    });
  }

  aplicar() {
    if (!this.metaMensual && !this.metaSemanal) return;
    const cantidad = this.vendedores().length;
    if (!confirm(`Esto va a cambiar la meta de TODOS los vendedores (${cantidad} en total). ¿Continuar?`)) {
      return;
    }

    this.aplicando.set(true);
    this.errorMessage.set(null);
    this.adminUserService
      .actualizarMetaVendedores({
        metaMensual: this.metaMensual || undefined,
        metaSemanal: this.metaSemanal || undefined
      })
      .subscribe({
        next: () => {
          this.aplicando.set(false);
          this.router.navigate(['/admin/users']);
        },
        error: () => {
          this.errorMessage.set('No se pudo actualizar la meta.');
          this.aplicando.set(false);
        }
      });
  }
}
