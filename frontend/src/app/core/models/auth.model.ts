export type UserRole = 'gerencia' | 'ventas' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  title: string;
  area: string;
  /** "Lima" o "Provincia: <departamentos>" (ver User.location en el panel admin). */
  location: string;
  avatarInitials: string;
  /**
   * JWT emitido por backend/admin (POST /api/auth/login). Se reenvia como
   * "Authorization: Bearer <token>" a backend/reporting y a
   * /recomendaciones/reactivacion de backend/intelligence/ai -- ambos
   * derivan el vendedor/rol del token, nunca de un parametro que mande el
   * cliente. Ver ReportingService.
   */
  token: string;
}

export interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}
