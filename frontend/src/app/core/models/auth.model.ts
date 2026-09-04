export type UserRole = 'gerencia' | 'ventas';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  title: string;
  area: string;
  avatarInitials: string;
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
