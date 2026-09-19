import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, LoginCredentials, User, UserRole } from '../models/auth.model';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userRole = computed(() => this.currentUser()?.role ?? null);
  readonly isGerencia = computed(() => this.currentUser()?.role === 'gerencia');
  readonly isVentas = computed(() => this.currentUser()?.role === 'ventas');

  /**
   * Intenta iniciar sesión con las credenciales proporcionadas.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const rawIdentifier = (credentials.usernameOrEmail || '').trim();
    const rawPassword = (credentials.password || '').trim();

    if (!rawIdentifier || !rawPassword) {
      return {
        success: false,
        error: 'Por favor complete todos los campos requeridos.'
      };
    }

    try {
       const res = await firstValueFrom(
         this.http.post<any>('http://localhost:8092/api/auth/login', {
           username: rawIdentifier,
           password: rawPassword
         })
       );

       // Mapeo explicito (no un simple toLowerCase()): el rol que devuelve
       // admin es 'VENDEDOR', que no coincide en texto con el UserRole
       // 'ventas' que usa el resto del frontend (rutas, roleGuard,
       // isVentas()) -- un toLowerCase() ciego dejaba 'vendedor' !== 'ventas'
       // y rompia isVentas() en silencio.
       const role = this.mapearRol(res.role);

       const user: User = {
          id: res.id ? res.id.toString() : '0',
          username: res.username,
          email: res.username + '@jhomeron.com',
          name: res.name,
          role,
          roleLabel: res.role,
          title: res.description || 'Usuario del sistema',
          area: res.area || 'General',
          avatarInitials: res.name ? res.name.charAt(0).toUpperCase() : 'U',
          token: res.token
       };

       this.saveUser(user);
       this.currentUser.set(user);

       return {
         success: true,
         user
       };
    } catch (err: any) {
       console.error('Login error', err);
       return {
         success: false,
         error: 'Credenciales inválidas. Compruebe el usuario o contraseña ingresados.'
       };
    }
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
  getDefaultRouteForRole(role: string): string {
    return role === 'gerencia' ? '/gerencia/dashboard' : role === 'admin' ? '/admin' : '/ventas';
  }

  private loadStoredUser(): User | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as User;
      if (parsed && parsed.role) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }

  /** 'VENDEDOR' (admin) -> 'ventas' (frontend), 'GERENCIA' -> 'gerencia', 'ADMIN' -> 'admin'. */
  private mapearRol(rolBackend: string | undefined): UserRole {
    switch ((rolBackend || '').toUpperCase()) {
      case 'GERENCIA':
        return 'gerencia';
      case 'ADMIN':
        return 'admin';
      case 'VENDEDOR':
      default:
        return 'ventas';
    }
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
