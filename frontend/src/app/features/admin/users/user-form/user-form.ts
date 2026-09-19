import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AdminUserService } from '../../../../core/services/admin-user.service';

/**
 * Departamentos reales que aparecen en dwh.dim_cliente.departamento (ver
 * consulta usada al crear vendedores). Solo se listan los de PROVINCIA --
 * Lima es la zona por defecto y no necesita elegirse de esta lista.
 */
const DEPARTAMENTOS_PROVINCIA = [
  { codigo: 'ANC', nombre: 'Áncash' },
  { codigo: 'ARE', nombre: 'Arequipa' },
  { codigo: 'CUS', nombre: 'Cusco' },
  { codigo: 'ICA', nombre: 'Ica' },
  { codigo: 'JUN', nombre: 'Junín' },
  { codigo: 'LA', nombre: 'La Libertad' },
  { codigo: 'LAM', nombre: 'Lambayeque' },
  { codigo: 'PIU', nombre: 'Piura' }
];

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

  protected readonly departamentosProvincia = DEPARTAMENTOS_PROVINCIA;

  isSaving = signal(false);
  errorMessage = signal<string | null>(null);
  editId = signal<number | null>(null);

  // Sincronizado a mano con el control `role` (ver onRoleChange) porque el
  // template necesita reaccionar a su valor (mostrar/ocultar los campos de
  // vendedor) y un FormControl plano no dispara change detection por sí solo.
  protected readonly esVendedor = signal(true);

  // La "Ubicación" no es un input libre: es la zona donde vende el vendedor
  // (Lima o Provincia + qué departamentos), para que quede relacionada con
  // los valores reales de dwh.dim_cliente.departamento -- ver
  // construirLocation(). El string final se manda al backend en `location`.
  protected readonly departamentosSeleccionados = signal<Set<string>>(new Set());

  userForm = this.fb.group({
    name: ['', Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
    role: ['VENDEDOR', Validators.required],
    zona: ['LIMA'],
    activo: [true],
    description: [''],
    // Debe copiarse EXACTO desde dwh.dim_vendedor.empleado_venta -- ver
    // deuda técnica en backend/reporting/README.md. Un typo rompe el join
    // silenciosamente (el vendedor ve "0 ventas", no un error).
    vendedorNombreSap: ['']
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
            activo: user.activo,
            description: user.description || '',
            vendedorNombreSap: user.vendedorNombreSap || ''
          });
          this.esVendedor.set(user.role === 'VENDEDOR');
          this.aplicarLocationExistente(user.location || '');
        },
        error: () => this.errorMessage.set('No se pudo cargar el usuario a editar.')
      });
    }
  }

  protected onRoleChange(valor: string) {
    this.esVendedor.set(valor === 'VENDEDOR');
  }

  protected toggleDepartamento(codigo: string) {
    const actual = new Set(this.departamentosSeleccionados());
    if (actual.has(codigo)) {
      actual.delete(codigo);
    } else {
      actual.add(codigo);
    }
    this.departamentosSeleccionados.set(actual);
  }

  onSubmit() {
    if (this.userForm.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const valores = this.userForm.value;
    const esVendedor = valores.role === 'VENDEDOR';
    const payload = {
      username: valores.username!,
      name: valores.name!,
      role: valores.role! as any,
      // Zona de venta solo aplica a VENDEDOR -- gerencia/admin ven toda la
      // empresa, no tiene sentido asignarles "Lima" por defecto.
      location: esVendedor ? this.construirLocation() : undefined,
      description: valores.description || undefined,
      ...(this.editId() ? { activo: valores.activo ?? true } : {}),
      ...(esVendedor ? { vendedorNombreSap: valores.vendedorNombreSap?.trim() || undefined } : {}),
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

  /** Traduce zona + departamentos elegidos a un string legible para `location`. */
  private construirLocation(): string {
    if (this.userForm.value.zona !== 'PROVINCIA') return 'Lima';
    const codigos = Array.from(this.departamentosSeleccionados());
    if (!codigos.length) return 'Provincia';
    const nombres = codigos
      .map((c) => this.departamentosProvincia.find((d) => d.codigo === c)?.nombre ?? c)
      .join(', ');
    return `Provincia: ${nombres}`;
  }

  /** Inverso de construirLocation() -- reconstruye zona/departamentos al editar un vendedor existente. */
  private aplicarLocationExistente(location: string) {
    const valor = location.trim();
    if (!valor || valor.toLowerCase() === 'lima') {
      this.userForm.patchValue({ zona: 'LIMA' });
      return;
    }
    this.userForm.patchValue({ zona: 'PROVINCIA' });
    const match = valor.match(/Provincia:\s*(.+)/i);
    if (match) {
      const nombres = match[1].split(',').map((n) => n.trim());
      const codigos = this.departamentosProvincia
        .filter((d) => nombres.includes(d.nombre))
        .map((d) => d.codigo);
      this.departamentosSeleccionados.set(new Set(codigos));
    }
  }
}
