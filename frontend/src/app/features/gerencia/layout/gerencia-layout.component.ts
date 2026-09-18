import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavGroup } from '../../../shared/components/sidebar/sidebar.component';
import { GerenciaHeaderComponent } from './gerencia-header.component';
import { GerenciaChatBarComponent } from '../components/chat-bar/gerencia-chat-bar.component';

@Component({
  selector: 'app-gerencia-layout',
  standalone: true,
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    GerenciaHeaderComponent,
    GerenciaChatBarComponent
  ],
  template: `
    <div class="min-h-screen bg-[#f8fafc] text-slate-900 flex font-outfit selection:bg-[#0d3393] selection:text-white">
      
      <!-- DESKTOP SIDEBAR -->
      <div class="hidden md:block shrink-0 h-screen sticky top-0 z-30">
        <app-sidebar
          [isCollapsed]="isSidebarCollapsed()"
          [navGroups]="gerenciaNavGroups"
          moduleName="Gerencia"
          moduleIcon="fa-solid fa-chart-pie"
          moduleRoute="/gerencia/dashboard"
          (toggleCollapse)="toggleSidebarCollapse()"
        ></app-sidebar>
      </div>

      <!-- MOBILE OFF-CANVAS DRAWER -->
      @if (isMobileMenuOpen()) {
        <div class="fixed inset-0 z-50 flex md:hidden">
          <div
            class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            (click)="toggleMobileMenu()"
          ></div>

          <div class="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 bg-[#0c2461]">
            <button
              type="button"
              (click)="toggleMobileMenu()"
              class="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
            <app-sidebar
              [isCollapsed]="false"
              [navGroups]="gerenciaNavGroups"
              moduleName="Gerencia"
              moduleIcon="fa-solid fa-chart-pie"
              moduleRoute="/gerencia/dashboard"
            ></app-sidebar>
          </div>
        </div>
      }

      <!-- MAIN CONTENT AREA -->
      <div class="flex-1 flex flex-col min-w-0 h-screen bg-[#f8fafc] overflow-hidden">
        <app-gerencia-header
          (toggleMobileMenu)="toggleMobileMenu()"
        ></app-gerencia-header>

        <!-- SCROLLABLE WORKSPACE CONTENT -->
        <main class="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
          <router-outlet></router-outlet>
        </main>

        <!-- FIXED BOTTOM GERENCIA QUERY BAR (DEEPWIKI STYLE) -->
        <app-gerencia-chat-bar></app-gerencia-chat-bar>
      </div>
    </div>
  `
})
export class GerenciaLayoutComponent {
  isSidebarCollapsed = signal<boolean>(false);
  isMobileMenuOpen = signal<boolean>(false);

  gerenciaNavGroups: NavGroup[] = [
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
    },
    {
      groupLabel: 'Administración',
      items: [
        {
          id: 'admin-panel',
          label: 'Panel de Administración',
          route: '/admin',
          icon: 'fa-solid fa-users-cog',
          badge: 'Nuevo',
          badgeColor: 'bg-blue-500 text-white'
        }
      ]
    }
  ];

  toggleSidebarCollapse() {
    this.isSidebarCollapsed.update(v => !v);
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }
}
