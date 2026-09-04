import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, LoginCredentials, User, UserRole } from '../models/auth.model';

const STORAGE_KEY = 'jhomeron_auth_user';

interface RegisteredAccount {
  user: User;
  allowedUsernames: string[];
  allowedPasswords: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);

  // Cuentas de demostración preconfiguradas
  private readonly demoAccounts: RegisteredAccount[] = [
    {
      user: {
        id: 'usr-gerencia-01',
        username: 'gerencia',
        email: 'gerencia@jhomeron.com',
        name: 'Dirección General',
        role: 'gerencia',
        roleLabel: 'Dirección Gerencial',
        title: 'CEO / Dirección Comercial',
        area: 'Centro Inteligente de Decisiones',
        avatarInitials: 'DG'
      },
      allowedUsernames: ['gerencia', 'gerencia@jhomeron.com', 'admin', 'admin@jhomeron.com', 'director'],
      allowedPasswords: ['admin', 'admin123', 'gerencia', 'gerencia123', 'jhomeron2026']
    },
    {
      user: {
        id: 'usr-ventas-01',
        username: 'ventas',
        email: 'ventas@jhomeron.com',
        name: 'Carlos Mendoza',
        role: 'ventas',
        roleLabel: 'Asesor Técnico Comercial',
        title: 'Vendedor Comercial',
        area: 'Asignado: Lima Norte',
        avatarInitials: 'CM'
      },
      allowedUsernames: ['ventas', 'ventas@jhomeron.com', 'vendedor', 'vendedor@jhomeron.com', 'carlos'],
      allowedPasswords: ['ventas', 'ventas123', '123456', 'vendedor123', 'jhomeron2026']
    }
  ];

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userRole = computed(() => this.currentUser()?.role ?? null);
  readonly isGerencia = computed(() => this.currentUser()?.role === 'gerencia');
  readonly isVentas = computed(() => this.currentUser()?.role === 'ventas');

  /**
   * Intenta iniciar sesión con las credenciales proporcionadas.
   */
  login(credentials: LoginCredentials): AuthResponse {
    const rawIdentifier = (credentials.usernameOrEmail || '').trim().toLowerCase();
    const rawPassword = (credentials.password || '').trim();

    if (!rawIdentifier || !rawPassword) {
      return {
        success: false,
        error: 'Por favor complete todos los campos requeridos.'
      };
    }

    const matchedAccount = this.demoAccounts.find(account => {
      const matchUsername = account.allowedUsernames.some(
        u => u.toLowerCase() === rawIdentifier
      );
      const matchPassword = account.allowedPasswords.includes(rawPassword);
      return matchUsername && matchPassword;
    });

    if (!matchedAccount) {
      return {
        success: false,
        error: 'Credenciales inválidas. Compruebe el usuario o contraseña ingresados.'
      };
    }

    const user = matchedAccount.user;
    this.saveUser(user);
    this.currentUser.set(user);

    return {
      success: true,
      user
    };
  }

  /**
   * Cierra la sesión activa y redirige a la pantalla de login.
   */
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Retorna la ruta inicial predeterminada según el rol del usuario.
   */
  getDefaultRouteForRole(role: UserRole): string {
    return role === 'gerencia' ? '/gerencia/dashboard' : '/ventas';
  }

  private loadStoredUser(): User | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as User;
      if (parsed && parsed.role && (parsed.role === 'gerencia' || parsed.role === 'ventas')) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }

  private saveUser(user: User): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } catch (err) {
        console.error('Error saving user session', err);
      }
    }
  }
}
