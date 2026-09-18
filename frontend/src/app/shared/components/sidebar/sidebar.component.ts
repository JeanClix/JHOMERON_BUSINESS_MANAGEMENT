import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface NavGroup {
  groupLabel: string;
  items: {
    id: string;
    label: string;
    route: string;
    icon: string;
    badge?: string;
    badgeColor?: string;
  }[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside
      [class]="'flex h-full flex-col justify-between bg-[#0c3c98] rounded-r-2xl text-white transition-all duration-300 select-none shadow-xl border-r border-[#0b2670] ' +
        (isCollapsed() ? 'w-20' : 'w-72')"
    >
      <!-- HEADER / LOGO -->
      <div>
        <div class="relative mb-3 p-3 flex w-full items-center" [class.min-h-[3rem]]="!isCollapsed()" [class.h-10]="isCollapsed()">
          <div class="flex w-full items-center overflow-hidden" [class.h-auto]="!isCollapsed()"
            [class.justify-start]="!isCollapsed()" [class.h-full]="isCollapsed()" [class.justify-center]="isCollapsed()">
            <img src="logo-white.png" alt="Logo JHOMERON" class="block object-contain transition-all duration-300"
              [class.w-full]="!isCollapsed()" [class.h-auto]="!isCollapsed()" [class.max-w-full]="!isCollapsed()"
              [class.h-8]="isCollapsed()" [class.w-auto]="isCollapsed()" [class.max-w-[90%]]="isCollapsed()" />
          </div>
        </div>

        <!-- MODULE SWITCHER -->
        <div class="mb-4 px-3">
          @if (!isCollapsed()) {
            <div class="rounded-xl bg-white/10 p-1 flex gap-1 text-xs">
              <a
                routerLink="/ventas"
                class="flex-1 py-1.5 px-2 rounded-lg font-bold text-center text-slate-200 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
              >
                <i class="fa-solid fa-cart-shopping text-xs"></i> Ventas
              </a>
              <a
                [routerLink]="moduleRoute()"
                class="flex-1 py-1.5 px-2 rounded-lg font-bold text-center bg-[#ef0606] text-white shadow-xs flex items-center justify-center gap-1"
              >
                <i [class]="moduleIcon() + ' text-amber-400 text-xs'"></i> {{ moduleName() }}
              </a>
            </div>
          } @else {
            <a
              [routerLink]="moduleRoute()"
              class="flex h-9 w-9 mx-auto items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 hover:bg-[#ef0606] hover:text-white transition-colors"
              [title]="'Ir a ' + moduleName()"
            >
              <i [class]="moduleIcon() + ' text-xs'"></i>
            </a>
          }
        </div>

        <!-- NAVEGACIÓN -->
        <nav class="space-y-4 px-4">
          @for (group of navGroups(); track group.groupLabel) {
            <div>
              @if (!isCollapsed()) {
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-200 opacity-80"> {{ group.groupLabel }} </span>
                  <span class="rounded bg-[#ef0606] px-2 py-0.5 text-[9px] font-bold text-white shadow-xs uppercase"> {{ moduleName() }} </span>
                </div>
              }

              <div class="space-y-1.5">
                @for (item of group.items; track item.id) {
                  <a
                    [routerLink]="item.route"
                    routerLinkActive="active-nav-item bg-[#ef0606] text-white shadow-md font-semibold"
                    [routerLinkActiveOptions]="{ exact: item.route === moduleRoute() }"
                    class="group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-200 select-none text-slate-100 hover:bg-white/10 hover:text-white font-medium"
                    [class.justify-center]="isCollapsed()"
                    [title]="isCollapsed() ? item.label : ''"
                  >
                    <!-- Icon Container -->
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base transition-colors duration-150 bg-white/10 text-white group-[.active-nav-item]:bg-white group-[.active-nav-item]:text-[#ef0606] group-hover:bg-[#ef0606] group-hover:text-white">
                      <i [class]="item.icon + ' fa-font-solid'"></i>
                    </div>

                    <!-- Label & Subtitle -->
                    @if (!isCollapsed()) {
                      <div class="flex flex-1 flex-col overflow-hidden min-w-0">
                        <div class="flex items-center justify-between gap-1.5">
                          <span class="truncate text-xs font-bold tracking-tight">{{ item.label }}</span>
                          @if (item.badge) {
                            <span [class]="'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ' + (item.badgeColor || 'bg-[#ef0606] text-white')">
                              {{ item.badge }}
                            </span>
                          }
                        </div>
                        <span class="truncate text-[11px] font-normal group-[.active-nav-item]:text-slate-100 text-slate-300">
                          Acceder a módulo
                        </span>
                      </div>
                    }
                  </a>
                }
              </div>
            </div>
          }
        </nav>
      </div>

      <!-- FOOTER / PERFIL DEL USUARIO -->
      <div class="mt-auto flex flex-col gap-3 border-t border-white/10 pt-3 pb-4 px-4">
        <!-- Botón Collapse -->
        <div class="flex" [class.justify-end]="!isCollapsed()" [class.justify-center]="isCollapsed()">
          <button type="button" (click)="toggleCollapse.emit()"
            class="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-[#ef0606] transition-colors"
            [title]="isCollapsed() ? 'Expandir barra lateral' : 'Colapsar barra lateral'">
            <i [class]="'fa-solid text-xs ' + (isCollapsed() ? 'fa-chevron-right' : 'fa-chevron-left')"></i>
          </button>
        </div>
        @if (!isCollapsed()) {
          <div class="rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ef0606] text-xs font-bold text-white shadow-xs">
                {{ authService.currentUser()?.name?.charAt(0) || 'U' }}
              </div>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-xs font-bold text-white">{{ authService.currentUser()?.name || 'Usuario' }}</span>
                <span class="flex items-center gap-1 truncate text-[11px] font-semibold text-emerald-300">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> {{ authService.currentUser()?.role || 'Rol' }}
                </span>
              </div>
            </div>

            <!-- Botón Cerrar Sesión -->
            <button
              type="button"
              (click)="authService.logout()"
              class="mt-2.5 w-full flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-rose-600/80 text-rose-200 hover:text-white text-xs font-semibold border border-white/10 hover:border-rose-500/50 transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <i class="fa-solid fa-right-from-bracket text-xs"></i>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ef0606] text-xs font-bold text-white shadow-xs"
              [title]="authService.currentUser()?.name || 'Perfil'">
              {{ authService.currentUser()?.name?.charAt(0) || 'U' }}
            </div>
            <button
              type="button"
              (click)="authService.logout()"
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-rose-300 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <i class="fa-solid fa-right-from-bracket text-xs"></i>
            </button>
          </div>
        }
      </div>
    </aside>
  `
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  
  isCollapsed = input<boolean>(false);
  moduleName = input<string>('Módulo');
  moduleIcon = input<string>('fa-solid fa-cube');
  moduleRoute = input<string>('/');
  navGroups = input<NavGroup[]>([]);
  
  toggleCollapse = output<void>();
}
