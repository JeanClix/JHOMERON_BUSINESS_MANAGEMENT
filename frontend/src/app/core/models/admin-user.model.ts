export type AdminUserRole = 'ADMIN' | 'GERENCIA' | 'VENDEDOR';

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  description?: string;
  area?: string;
  location?: string;
  role: AdminUserRole;
  // Un usuario inactivo no puede iniciar sesión pero conserva su historial
  // (nunca se borra) -- ver AuthController.java.
  activo: boolean;
  // Solo aplican a role='VENDEDOR' -- ver backend/admin/.../User.java.
  metaMensual?: number | null;
  metaSemanal?: number | null;
  // Debe copiarse EXACTO desde dwh.dim_vendedor.empleado_venta -- ver
  // deuda técnica en backend/reporting/README.md.
  vendedorNombreSap?: string | null;
}

/** Payload de creación/edición. `password` es opcional en edición (vacío = no cambiar). */
export interface AdminUserPayload {
  username: string;
  password?: string;
  name: string;
  role: AdminUserRole;
  area?: string;
  location?: string;
  description?: string;
  activo?: boolean;
  metaMensual?: string;
  metaSemanal?: string;
  vendedorNombreSap?: string;
}

/** Body de PUT /api/admin/users/meta-vendedores -- actualiza a TODOS los vendedores de una vez. */
export interface MetaVendedoresPayload {
  metaMensual?: string;
  metaSemanal?: string;
}
