import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-gerencia-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8 shadow-2xs">
      <!-- Left: Mobile menu button & Breadcrumb -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          (click)="toggleMobileMenu.emit()"
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[#0c2461] hover:bg-[#0c2461] hover:text-white md:hidden transition-colors"
          title="Abrir menú"
        >
          <i class="fa-solid fa-bars text-sm"></i>
        </button>

        <div class="flex items-center gap-2">
          <span class="text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded tracking-wider uppercase">
            GERENCIA HUB
          </span>
          <span class="text-xs text-slate-300">/</span>
          <span class="text-xs font-bold text-slate-700">Centro Inteligente de Decisiones</span>
        </div>
      </div>

      <!-- Right: Search & Actions -->
      <div class="flex items-center gap-4">
        <div class="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
          <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Planta & Ventas Operativas (100%)</span>
        </div>

        <a
          routerLink="/ventas"
          class="hidden sm:flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 text-xs font-bold transition-colors"
        >
          <i class="fa-solid fa-store text-[#0d3393]"></i>
          <span>Ir a Ventas</span>
        </a>

        <!-- User Profile Avatar -->
        <div class="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0c2461] text-white font-extrabold text-xs shadow-2xs">
            DG
          </div>
          <div class="hidden md:flex flex-col">
            <span class="text-xs font-extrabold text-slate-900 leading-tight">Dirección General</span>
            <span class="text-[10px] text-slate-500 font-semibold">Jhomeron Enterprise</span>
          </div>
        </div>
      </div>
    </header>
  `
})
export class GerenciaHeaderComponent {
  toggleMobileMenu = output<void>();
}
