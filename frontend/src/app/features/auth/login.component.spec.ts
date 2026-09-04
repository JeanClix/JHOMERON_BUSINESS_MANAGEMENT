import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'gerencia/dashboard', component: class {} },
          { path: 'ventas', component: class {} },
          { path: 'login', component: class {} }
        ])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the login component', () => {
    expect(component).toBeTruthy();
  });

  it('should show error when submitting empty fields', () => {
    component.username = '';
    component.password = '';
    component.onSubmit();
    expect(component.errorMessage()).toContain('Por favor ingrese su usuario y contraseña');
  });

  it('should set credentials and trigger login when loginAs is called with gerencia', () => {
    vi.useFakeTimers();
    const loginSpy = vi.spyOn(authService, 'login');
    component.loginAs('gerencia');

    expect(component.username).toBe('gerencia');
    expect(component.password).toBe('admin');

    vi.advanceTimersByTime(500);
    expect(loginSpy).toHaveBeenCalledWith({
      usernameOrEmail: 'gerencia',
      password: 'admin'
    });
    vi.useRealTimers();
  });

  it('should set credentials and trigger login when loginAs is called with ventas', () => {
    vi.useFakeTimers();
    const loginSpy = vi.spyOn(authService, 'login');
    component.loginAs('ventas');

    expect(component.username).toBe('ventas');
    expect(component.password).toBe('ventas');

    vi.advanceTimersByTime(500);
    expect(loginSpy).toHaveBeenCalledWith({
      usernameOrEmail: 'ventas',
      password: 'ventas'
    });
    vi.useRealTimers();
  });
});
