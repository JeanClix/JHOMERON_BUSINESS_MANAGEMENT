export type AdminUserRole = 'ADMIN' | 'GERENCIA' | 'VENDEDOR';

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  description?: string;
  area?: string;
  location?: string;
  role: AdminUserRole;
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
}
