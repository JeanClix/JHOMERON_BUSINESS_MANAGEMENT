import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminUserService } from '../../../../core/services/admin-user.service';
import { AdminUser } from '../../../../core/models/admin-user.model';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList implements OnInit {
  private adminUserService = inject(AdminUserService);

  users = signal<AdminUser[]>([]);
  errorMessage = signal<string | null>(null);

  // El panel de administración es para gestionar Vendedores y Gerencia --
  // la cuenta ADMIN (quien administra el sistema) no se lista ni se edita
  // desde acá, ni se puede crear un nuevo usuario con ese rol (ver
  // user-form.html: el select de rol ya no ofrece "Administrador").
  protected readonly usuariosVisibles = computed(() => this.users().filter((u) => u.role !== 'ADMIN'));

  ngOnInit() {
    this.cargar();
  }

  private cargar() {
    this.errorMessage.set(null);
    this.adminUserService.listar().subscribe({
      next: (data) => this.users.set(data),
      error: (err) => {
        this.errorMessage.set(
          err?.status === 0
            ? 'No se pudo conectar con el Admin Service (¿está corriendo en el puerto 8092?).'
            : 'No se pudieron cargar los usuarios.'
        );
      }
    });
  }

  eliminar(user: AdminUser) {
    if (!confirm(`¿Eliminar al usuario "${user.username}"? Esta acción no se puede deshacer.`)) return;

    this.adminUserService.eliminar(user.id).subscribe({
      next: () => this.users.update((list) => list.filter((u) => u.id !== user.id)),
      error: () => this.errorMessage.set('No se pudo eliminar el usuario.')
    });
  }
}
