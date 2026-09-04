import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen w-full bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-outfit relative overflow-hidden">
      <!-- Background Ambient Glow & Patterns -->
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-[#0c3c98]/40 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-[#ef0606]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none"></div>

      <div class="w-full max-w-5xl bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">
        
        <!-- LEFT / BRAND SHOWCASE PANEL -->
        <div class="lg:col-span-5 bg-gradient-to-br from-[#0c3c98] via-[#0b2b7a] to-[#081f5c] p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div class="absolute top-0 right-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <!-- Brand Header -->
          <div class="space-y-6">
            <div class="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/10">
              <span class="w-2 h-2 rounded-full bg-[#ef0606] animate-pulse"></span>
              <span class="text-xs font-bold tracking-wider text-slate-200 uppercase">Portal Corporativo</span>
            </div>

            <div class="space-y-2">
              <img src="logo-white.png" alt="Pinturas JHOMERON" class="h-12 w-auto object-contain drop-shadow-md" />
              <p class="text-sm text-blue-100/80 font-normal leading-relaxed pt-2">
                Sistema Integral de Gestión Comercial, Inteligencia Operativa y Red de Distribución.
              </p>
            </div>
          </div>

          <!-- Feature Highlights -->
          <div class="my-8 space-y-4">
            <div class="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div class="h-9 w-9 rounded-xl bg-[#ef0606] flex items-center justify-center text-white shrink-0 shadow-md">
                <i class="fa-solid fa-chart-pie text-sm"></i>
              </div>
              <div class="text-xs">
                <div class="font-bold text-white">Módulo de Gerencia Hub</div>
                <div class="text-blue-100/70">KPIs en tiempo real, DeepWiki y asistente IA de directiva.</div>
              </div>
            </div>

            <div class="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div class="h-9 w-9 rounded-xl bg-blue-500/30 flex items-center justify-center text-blue-200 shrink-0 border border-blue-400/20">
                <i class="fa-solid fa-cart-shopping text-sm"></i>
              </div>
              <div class="text-xs">
                <div class="font-bold text-white">Módulo de Ventas & Marina</div>
                <div class="text-blue-100/70">Catálogo técnico epóxico, proformas express y pedidos.</div>
              </div>
            </div>
          </div>

          <!-- Footer Note -->
          <div class="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200/60 font-medium">
            <span>© 2026 Pinturas Jhomeron S.A.C.</span>
            <span class="flex items-center gap-1">
              <i class="fa-solid fa-shield-check text-emerald-400"></i> Seguro SSL
            </span>
          </div>
        </div>

        <!-- RIGHT / AUTHENTICATION FORM PANEL -->
        <div class="lg:col-span-7 p-8 sm:p-10 lg:p-12 bg-slate-900/60 flex flex-col justify-center">
          <div class="max-w-md w-full mx-auto space-y-6">
            
            <!-- Form Header -->
            <div class="space-y-2">
              <div class="inline-flex items-center gap-2 text-xs font-semibold text-[#ef0606] uppercase tracking-wider">
                <i class="fa-solid fa-lock"></i>
                <span>Capa de Autenticación</span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Iniciar Sesión</h2>
              <p class="text-xs sm:text-sm text-slate-400">
                Ingrese sus credenciales corporativas para ser redirigido a su área de trabajo asignada.
              </p>
            </div>

            <!-- Error Banner -->
            @if (errorMessage()) {
              <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 animate-fade-in">
                <i class="fa-solid fa-circle-exclamation text-base text-rose-400 shrink-0"></i>
                <span class="flex-1 font-medium">{{ errorMessage() }}</span>
                <button type="button" (click)="errorMessage.set('')" class="text-rose-400 hover:text-rose-200">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            }

            <!-- Success Notification -->
            @if (successMessage()) {
              <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 animate-fade-in">
                <i class="fa-solid fa-circle-check text-base text-emerald-400 shrink-0"></i>
                <span class="flex-1 font-medium">{{ successMessage() }}</span>
                <i class="fa-solid fa-spinner fa-spin text-emerald-400"></i>
              </div>
            }

            <!-- Login Form -->
            <form (ngSubmit)="onSubmit()" class="space-y-4">
              <!-- Username or Email Field -->
              <div class="space-y-1.5">
                <label for="username" class="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Usuario o Correo
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i class="fa-solid fa-user text-sm"></i>
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    [(ngModel)]="username"
                    placeholder="ej. gerencia o ventas"
                    class="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0c3c98] focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <!-- Password Field -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label for="password" class="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Contraseña
                  </label>
                  <span class="text-[11px] text-slate-500">Sensible a mayúsculas</span>
                </div>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i class="fa-solid fa-key text-sm"></i>
                  </div>
                  <input
                    id="password"
                    name="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    [(ngModel)]="password"
                    placeholder="••••••••"
                    class="w-full pl-10 pr-11 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0c3c98] focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    (click)="showPassword.update(v => !v)"
                    class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                    [title]="showPassword() ? 'Ocultar contraseña' : 'Ver contraseña'"
                  >
                    <i [class]="'fa-solid ' + (showPassword() ? 'fa-eye-slash' : 'fa-eye')"></i>
                  </button>
                </div>
              </div>

              <!-- Submit Button -->
              <button
                type="submit"
                [disabled]="isLoading()"
                class="w-full py-3.5 px-4 bg-gradient-to-r from-[#0c3c98] to-[#ef0606] hover:from-[#0b2f77] hover:to-[#d60505] text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-900/30 hover:shadow-red-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                @if (isLoading()) {
                  <i class="fa-solid fa-spinner fa-spin"></i>
                  <span>Verificando credenciales...</span>
                } @else {
                  <i class="fa-solid fa-arrow-right-to-bracket"></i>
                  <span>Ingresar al Sistema</span>
                }
              </button>
            </form>

            <!-- DEMO QUICK ACCESS / TEST ACCOUNTS (Solución para pruebas rápidas) -->
            <div class="pt-6 border-t border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  ⚡ Accesos Rápidos de Prueba
                </span>
                <span class="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                  Un solo clic
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- Direct Gerencia Login Button -->
                <button
                  type="button"
                  (click)="loginAs('gerencia')"
                  class="p-3 rounded-xl bg-slate-800/90 hover:bg-[#0c3c98]/30 border border-slate-700 hover:border-[#0c3c98] text-left transition-all group flex flex-col justify-between gap-2 cursor-pointer"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-white group-hover:text-blue-300 flex items-center gap-1.5">
                      <i class="fa-solid fa-chart-line text-amber-400"></i>
                      Gerencia
                    </span>
                    <span class="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                      CEO / KPIs
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono">
                    gerencia <span class="text-slate-600">/</span> admin
                  </div>
                  <div class="text-[10px] text-blue-400 flex items-center gap-1 pt-1 font-semibold group-hover:underline">
                    <span>Ingresar a Gerencia</span>
                    <i class="fa-solid fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
                  </div>
                </button>

                <!-- Direct Ventas Login Button -->
                <button
                  type="button"
                  (click)="loginAs('ventas')"
                  class="p-3 rounded-xl bg-slate-800/90 hover:bg-[#ef0606]/20 border border-slate-700 hover:border-[#ef0606]/50 text-left transition-all group flex flex-col justify-between gap-2 cursor-pointer"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-white group-hover:text-red-300 flex items-center gap-1.5">
                      <i class="fa-solid fa-cart-shopping text-[#ef0606]"></i>
                      Ventas
                    </span>
                    <span class="text-[10px] bg-red-500/20 text-red-300 font-bold px-1.5 py-0.5 rounded">
                      Comercial
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono">
                    ventas <span class="text-slate-600">/</span> ventas
                  </div>
                  <div class="text-[10px] text-rose-400 flex items-center gap-1 pt-1 font-semibold group-hover:underline">
                    <span>Ingresar a Ventas</span>
                    <i class="fa-solid fa-arrow-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
                  </div>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Form states
  username = '';
  password = '';
  showPassword = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  /**
   * Ejecuta el login manual procesando el formulario.
   */
  onSubmit(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage.set('Por favor ingrese su usuario y contraseña.');
      return;
    }

    this.isLoading.set(true);

    // Simular una ligera latencia de autenticación para UX fluida
    setTimeout(() => {
      const response = this.authService.login({
        usernameOrEmail: this.username,
        password: this.password
      });

      this.isLoading.set(false);

      if (response.success && response.user) {
        const destLabel = response.user.role === 'gerencia' ? 'Gerencia Hub' : 'Ventas Comercial';
        this.successMessage.set(`Acceso autorizado. Redirigiendo a ${destLabel}...`);

        const targetRoute = this.authService.getDefaultRouteForRole(response.user.role);
        setTimeout(() => {
          this.router.navigate([targetRoute]);
        }, 400);
      } else {
        this.errorMessage.set(
          response.error || 'Credenciales incorrectas. Verifique los datos o use los accesos rápidos de prueba.'
        );
      }
    }, 450);
  }

  /**
   * Facilita acceso inmediato con las credenciales demo.
   */
  loginAs(role: 'gerencia' | 'ventas'): void {
    if (role === 'gerencia') {
      this.username = 'gerencia';
      this.password = 'admin';
    } else {
      this.username = 'ventas';
      this.password = 'ventas';
    }
    this.onSubmit();
  }
}
