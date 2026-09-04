import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', component: class {} }])]
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should authenticate gerencia successfully and set role to gerencia', () => {
    const result = service.login({
      usernameOrEmail: 'gerencia',
      password: 'admin'
    });

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe('gerencia');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isGerencia()).toBe(true);
    expect(service.isVentas()).toBe(false);
    expect(service.getDefaultRouteForRole('gerencia')).toBe('/gerencia/dashboard');
  });

  it('should authenticate ventas successfully and set role to ventas', () => {
    const result = service.login({
      usernameOrEmail: 'ventas',
      password: 'ventas'
    });

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe('ventas');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isVentas()).toBe(true);
    expect(service.isGerencia()).toBe(false);
    expect(service.getDefaultRouteForRole('ventas')).toBe('/ventas');
  });

  it('should reject invalid credentials', () => {
    const result = service.login({
      usernameOrEmail: 'usuario_invalido',
      password: 'wrongpassword'
    });

    expect(result.success).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should logout and clear current user', () => {
    service.login({
      usernameOrEmail: 'gerencia',
      password: 'admin'
    });
    expect(service.isAuthenticated()).toBe(true);

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });
});
