import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

export interface GerenciaNavGroup {
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
  selector: 'app-gerencia-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside
      [class]="'flex h-full flex-col justify-between bg-[#0c2461] text-white transition-all duration-300 select-none shadow-xl border-r border-[#091b4a] ' +
        (isCollapsed() ? 'w-20' : 'w-72')"
    >
      <div>
        <!-- LOGO & BRAND -->
        <div class="p-4 flex items-center justify-between border-b border-white/10">
          <div class="flex items-center gap-3 overflow-hidden">
            <img src="logo-white.png" alt="Logo JHOMERON" class="h-8 object-contain" />
            @if (!isCollapsed()) {
              <div class="flex flex-col">
                <span class="text-xs font-black tracking-wider text-white uppercase">JHOMERON</span>
                <span class="text-[9px] font-bold text-amber-400 uppercase tracking-widest">GERENCIA HUB</span>
              </div>
            }
          </div>
        </div>

        <!-- MODULE SWITCHER (Ventas vs Gerencia) -->
        <div class="p-3 border-b border-white/10">
          @if (!isCollapsed()) {
            <div class="rounded-xl bg-white/10 p-1 flex gap-1 text-xs">
              <a
                routerLink="/ventas"
                class="flex-1 py-1.5 px-2 rounded-lg font-bold text-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
              >
                <i class="fa-solid fa-cart-shopping text-xs"></i> Ventas
              </a>
              <a
                routerLink="/gerencia/dashboard"
                class="flex-1 py-1.5 px-2 rounded-lg font-bold text-center bg-[#ef0606] text-white shadow-xs flex items-center justify-center gap-1"
              >
                <i class="fa-solid fa-chart-pie text-xs"></i> Gerencia
              </a>
            </div>
          } @else {
            <a
              routerLink="/ventas"
              class="flex h-9 w-9 mx-auto items-center justify-center rounded-xl bg-white/10 text-white hover:bg-[#ef0606] transition-colors"
              title="Ir al Módulo de Ventas"
            >
              <i class="fa-solid fa-cart-shopping text-xs"></i>
            </a>
          }
        </div>

        <!-- NAVIGATION GROUPS -->
        <nav class="space-y-6 p-4">
          @for (group of navGroups; track group.groupLabel) {
            <div class="space-y-2">
              @if (!isCollapsed()) {
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-300/70 block px-2">
                  {{ group.groupLabel }}
                </span>
              }

              <div class="space-y-1">
                @for (item of group.items; track item.id) {
                  <a
                    [routerLink]="item.route"
                    routerLinkActive="bg-white/15 text-white shadow-sm border-l-4 border-[#ef0606]"
                    [routerLinkActiveOptions]="{ exact: item.route === '/gerencia/dashboard' }"
                    class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <i [class]="item.icon + ' text-sm shrink-0 w-5 text-center group-hover:scale-110 transition-transform text-slate-300 group-hover:text-white'"></i>
                    
                    @if (!isCollapsed()) {
                      <span class="truncate flex-1">{{ item.label }}</span>
                      @if (item.badge) {
                        <span [class]="'text-[9px] font-extrabold px-1.5 py-0.5 rounded ' + (item.badgeColor || 'bg-emerald-500 text-white')">
                          {{ item.badge }}
                        </span>
                      }
                    }
                  </a>
                }
              </div>
            </div>
          }
        </nav>
      </div>

      <!-- FOOTER PROFILE & COLLAPSE -->
      <div class="p-4 border-t border-white/10 space-y-3">
        <div class="flex" [class.justify-end]="!isCollapsed()" [class.justify-center]="isCollapsed()">
          <button
            type="button"
            (click)="toggleCollapse.emit()"
            class="hidden md:flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-[#ef0606] transition-colors"
            [title]="isCollapsed() ? 'Expandir barra lateral' : 'Colapsar barra lateral'"
          >
            <i [class]="'fa-solid text-xs ' + (isCollapsed() ? 'fa-chevron-right' : 'fa-chevron-left')"></i>
          </button>
        </div>

        @if (!isCollapsed()) {
          <div class="rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-xs flex items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ef0606] to-[#c70505] text-xs font-extrabold text-white shadow-xs">
              <i class="fa-solid fa-user-tie"></i>
            </div>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-xs font-extrabold text-white">Dirección Gerencial</span>
              <span class="truncate text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                CEO / Gerente Comercial
              </span>
            </div>
          </div>
        } @else {
          <div class="flex justify-center">
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ef0606] text-xs text-white" title="Perfil Gerencial">
              <i class="fa-solid fa-user-tie"></i>
            </div>
          </div>
        }
      </div>
    </aside>
  `
})
export class GerenciaSidebarComponent {
  isCollapsed = input<boolean>(false);
  toggleCollapse = output<void>();

  navGroups: GerenciaNavGroup[] = [
    {
      groupLabel: 'Centro de Decisiones',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard Ejecutivo',
          route: '/gerencia/dashboard',
          icon: 'fa-solid fa-chart-line',
          badge: 'KPIs',
          badgeColor: 'bg-[#ef0606] text-white'
        },
        {
          id: 'documentacion',
          label: 'Base Conocimiento DeepWiki',
          route: '/gerencia/documentacion',
          icon: 'fa-solid fa-book-bookmark',
          badge: 'Docs',
          badgeColor: 'bg-indigo-500 text-white'
        }
      ]
    },
    {
      groupLabel: 'Inteligencia empresarial',
      items: [
        {
          id: 'chat',
          label: 'Asistente IA Gerencial',
          route: '/gerencia/chat',
          icon: 'fa-solid fa-robot',
          badge: 'IA',
          badgeColor: 'bg-emerald-500 text-white'
        },
        {
          id: 'insights',
          label: 'Insights & Reportes',
          route: '/gerencia/insights',
          icon: 'fa-solid fa-lightbulb'
        }
      ]
    }
  ];
}
