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
    <div class="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-outfit relative overflow-hidden">
      <!-- Background Ambient Glow & Patterns -->
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-[#0c3c98]/40 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-[#ef0606]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none"></div>

      <div class="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">

        <!-- LEFT / BRAND SHOWCASE PANEL -- mismo azul sólido que el sidebar
             (bg-[#0c3c98]), para que el login se sienta parte del mismo
             sistema y no de un "portal" con tema aparte. -->
        <div class="lg:col-span-5 bg-[#0c3c98] rounded-3xl lg:rounded-l-3xl lg:rounded-r-none flex flex-col justify-between relative overflow-hidden">
          <div class="absolute top-0 right-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

          <div>
            <!-- Logo como cabecera real de esta sección: banda a todo el
                 ancho, pegada al borde superior, no una imagen "contenida"
                 dentro del padding del panel. -->
            <div class="w-full bg-black/10 border-b border-white/10">
              <img src="logo-white.png" alt="Pinturas JHOMERON" class="block w-full h-auto object-contain drop-shadow-md" />
            </div>

            <div class="px-8 sm:px-10 pt-6 space-y-6">
              <div class="inline-flex items-center gap-2 bg-[#ef0606] px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs">
                <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                <span class="uppercase tracking-wider">Portal Corporativo</span>
              </div>

              <p class="text-sm text-blue-100/80 font-normal leading-relaxed">
                Sistema Integral de Gestión Comercial, Inteligencia Operativa y Red de Distribución.
              </p>
            </div>
          </div>

          <!-- Feature Highlights -->
          <div class="px-8 sm:px-10 my-8 space-y-4">
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
                <div class="font-bold text-white">Módulo de Ventas</div>
                <div class="text-blue-100/70">Catálogo técnico epóxico, proformas express y pedidos.</div>
              </div>
            </div>
          </div>

          <!-- Footer Note -->
          <div class="px-8 sm:px-10 pb-8 sm:pb-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200/60 font-medium">
            <span>© 2026 Pinturas Jhomeron S.A.C.</span>
            <span class="flex items-center gap-1">
              <i class="fa-solid fa-shield-check text-emerald-400"></i> Seguro SSL
            </span>
          </div>
        </div>

        <!-- RIGHT / AUTHENTICATION FORM PANEL -- fondo blanco, igual al resto
             de la app (ventas, gerencia, admin ya son todos tema claro). -->
        <div class="lg:col-span-7 p-8 sm:p-10 lg:p-12 bg-white flex flex-col justify-center">
          <div class="max-w-md w-full mx-auto space-y-6">

            <!-- Form Header -->
            <div class="space-y-2">
              <div class="inline-flex items-center gap-2 text-xs font-bold text-[#ef0606] uppercase tracking-wider">
                <i class="fa-solid fa-lock"></i>
                <span>Capa de Autenticación</span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Iniciar Sesión</h2>
              <p class="text-xs sm:text-sm text-slate-500">
                Ingrese sus credenciales corporativas para ser redirigido a su área de trabajo asignada.
              </p>
            </div>

            <!-- Error Banner -->
            @if (errorMessage()) {
              <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3 animate-fade-in">
                <i class="fa-solid fa-circle-exclamation text-base text-rose-500 shrink-0"></i>
                <span class="flex-1 font-medium">{{ errorMessage() }}</span>
                <button type="button" (click)="errorMessage.set('')" class="text-rose-400 hover:text-rose-600">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            }

            <!-- Success Notification -->
            @if (successMessage()) {
              <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-3 animate-fade-in">
                <i class="fa-solid fa-circle-check text-base text-emerald-500 shrink-0"></i>
                <span class="flex-1 font-medium">{{ successMessage() }}</span>
                <i class="fa-solid fa-spinner fa-spin text-emerald-500"></i>
              </div>
            }

            <!-- Login Form -->
            <form (ngSubmit)="onSubmit()" class="space-y-4">
              <!-- Username or Email Field -->
              <div class="space-y-1.5">
                <label for="username" class="block text-xs font-bold uppercase tracking-wider text-slate-600">
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
                    class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0c3c98] focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <!-- Password Field -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label for="password" class="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Contraseña
                  </label>
                  <span class="text-[11px] text-slate-400">Sensible a mayúsculas</span>
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
                    class="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0c3c98] focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    (click)="showPassword.update(v => !v)"
                    class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
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
  async onSubmit(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage.set('Por favor ingrese su usuario y contraseña.');
      return;
    }

    this.isLoading.set(true);

    const response = await this.authService.login({
      usernameOrEmail: this.username,
      password: this.password
    });

    this.isLoading.set(false);

    if (response.success && response.user) {
      const destLabel = response.user.role === 'gerencia' ? 'Gerencia Hub' : response.user.role === 'admin' ? 'Admin Panel' : 'Ventas Comercial';
      this.successMessage.set(`Acceso autorizado. Redirigiendo a ${destLabel}...`);

      const targetRoute = this.authService.getDefaultRouteForRole(response.user.role);
      setTimeout(() => {
        this.router.navigate([targetRoute]);
      }, 400);
    } else {
      this.errorMessage.set(
        response.error || 'Credenciales incorrectas. Verifique los datos.'
      );
    }
  }

}
