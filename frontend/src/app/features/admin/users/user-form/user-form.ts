import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AdminUserService } from '../../../../core/services/admin-user.service';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css',
})
export class UserForm implements OnInit {
  private fb = inject(FormBuilder);
  private adminUserService = inject(AdminUserService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isSaving = signal(false);
  errorMessage = signal<string | null>(null);
  editId = signal<number | null>(null);

  userForm = this.fb.group({
    name: ['', Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
    role: ['VENDEDOR', Validators.required],
    area: [''],
    location: [''],
    description: ['']
  });

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editId.set(id);
      // En edición la contraseña es opcional (vacío = no cambiarla)
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();

      this.adminUserService.obtener(id).subscribe({
        next: (user) => {
          this.userForm.patchValue({
            name: user.name,
            username: user.username,
            role: user.role,
            area: user.area || '',
            location: user.location || '',
            description: user.description || ''
          });
        },
        error: () => this.errorMessage.set('No se pudo cargar el usuario a editar.')
      });
    }
  }

  onSubmit() {
    if (this.userForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const valores = this.userForm.value;
    const payload = {
      username: valores.username!,
      name: valores.name!,
      role: valores.role! as any,
      area: valores.area || undefined,
      location: valores.location || undefined,
      description: valores.description || undefined,
      ...(valores.password ? { password: valores.password } : {})
    };

    const id = this.editId();
    const peticion = id
      ? this.adminUserService.actualizar(id, payload)
      : this.adminUserService.crear(payload as any);

    peticion.subscribe({
      next: () => this.router.navigate(['/admin/users']),
      error: (err) => {
        this.isSaving.set(false);
        if (err?.status === 409) {
          this.errorMessage.set('Ya existe un usuario con ese nombre de usuario.');
        } else if (err?.status === 0) {
          this.errorMessage.set('No se pudo conectar con el Admin Service (¿está corriendo en el puerto 8092?).');
        } else {
          this.errorMessage.set(err?.error?.error || 'No se pudo guardar el usuario.');
        }
      }
    });
  }
}
