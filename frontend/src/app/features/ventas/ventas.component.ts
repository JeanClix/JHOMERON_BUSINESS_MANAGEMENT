import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SidebarComponent } from '../../common/sidebar/sidebar.component';
import { SidebarItem } from '../../common/sidebar-item/sidebar-item.component';

export interface JhomeronProduct {
  id: string;
  name: string;
  category: 'epoxico' | 'acabado-alquidico' | 'acabado-caucho';
  categoryLabel: string;
  line: string;
  description: string;
  presentation: string;
  code: string;
  imageIcon: string;
  stock: number;
  priceGalon: number;
  featured?: boolean;
}

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent],
  templateUrl: './ventas.component.html'
})
export class VentasComponent {
  // Navigation & UI Signals
  protected readonly isSidebarCollapsed = signal<boolean>(false);
  protected readonly isMobileMenuOpen = signal<boolean>(false);
  protected readonly searchQuery = signal<string>('');
  protected readonly selectedFilterCategory = signal<string>('all');
  
  // Cotizador Rápido State
  protected readonly cotizAreaM2 = signal<number>(150);
  protected readonly cotizManos = signal<number>(2);

  // Jhomeron Internal Sales Portal Modules
  protected readonly sidebarItems = signal<SidebarItem[]>([
    {
      id: 'dashboard',
      label: 'Dashboard Ventas',
      subtitle: 'Resumen de metas y KPIs',
      description: 'Panel ejecutivo de avance de cuotas de venta, comisiones acumuladas y alertas del día.',
      icon: 'fa-solid fa-chart-line',
      badge: 'Hoy',
      badgeColor: 'bg-[#ef0606]'
    },
    {
      id: 'marina',
      label: 'Línea Marina',
      subtitle: 'Stock & Fichas técnicas',
      description: 'Catálogo técnico de recubrimientos epóxicos, alquídicos y antifouling para barcos e instalaciones marineras.',
      icon: 'fa-solid fa-anchor',
      badge: 'Top Venta',
      badgeColor: 'bg-[#0d3393]'
    },
    {
      id: 'cotizador',
      label: 'Generador Proformas',
      subtitle: 'Cotización e imprevistos',
      description: 'Calculadora rápida de rendimientos por m², emisión de proforma express para enviar por WhatsApp.',
      icon: 'fa-solid fa-[#ef0606] fa-calculator',
      badge: 'Rápido',
      badgeColor: 'bg-emerald-600'
    },
    {
      id: 'clientes',
      label: 'Cartera de Clientes',
      subtitle: 'Cuentas y créditos',
      description: 'Directorio de clientes asignados, saldo de crédito disponible, historial de facturas y visitas.',
      icon: 'fa-solid fa-address-book'
    },
    {
      id: 'asistente_ia',
      label: 'Asistente Técnico IA',
      subtitle: 'Sistemas de pintado',
      description: 'Asistente de inteligencia artificial para recomendar el esquema de pintado según ambiente y tipo de superficie.',
      icon: 'fa-solid fa-robot'
    }
  ]);

  // Catalog Products for Línea Marina
  protected readonly marinaProducts = signal<JhomeronProduct[]>([
    {
      id: 'mar-01',
      name: 'Primer Epóxico Marino Poliamida 2K',
      category: 'epoxico',
      categoryLabel: 'Epóxico',
      line: 'Línea Marina',
      description: 'Imprimante anticorrosivo de alta adherencia para cascos de acero y estructuras expuestas a inmersión marina constante.',
      presentation: 'Juego 1 Galón (Base + Catalizador)',
      code: 'JHM-MAR-EPOX01',
      imageIcon: 'fa-solid fa-[#0d3393] fa-shield-halved',
      stock: 45,
      priceGalon: 145.00,
      featured: true
    },
    {
      id: 'mar-02',
      name: 'Acabado Alquídico Marino Brillo Superior',
      category: 'acabado-alquidico',
      categoryLabel: 'Acabado Alquídico',
      line: 'Línea Marina',
      description: 'Esmalte sintético marino formulado con resinas modificadas para superestructuras y cubiertas de barcos.',
      presentation: 'Envase 1 Galón / Balde 5 Galones',
      code: 'JHM-MAR-ALQ02',
      imageIcon: 'fa-solid fa-brush',
      stock: 120,
      priceGalon: 88.50
    },
    {
      id: 'mar-03',
      name: 'Antifouling Caucho Clorado Anti-incrustante',
      category: 'acabado-caucho',
      categoryLabel: 'Acabado Caucho Clorado',
      line: 'Línea Marina',
      description: 'Pintura anti-incrustante marina de acción prolongada contra moluscos, caracolillo y algas en la obra viva.',
      presentation: 'Juego 1 Galón',
      code: 'JHM-MAR-CAU03',
      imageIcon: 'fa-solid fa-ship',
      stock: 32,
      priceGalon: 210.00,
      featured: true
    },
    {
      id: 'mar-04',
      name: 'Esmalte Epóxico Bituminoso Inmersión',
      category: 'epoxico',
      categoryLabel: 'Epóxico',
      line: 'Línea Marina',
      description: 'Recubrimiento epóxico brea de carbón de altísima resistencia al agua de mar y petróleo en tanques de lastre.',
      presentation: 'Juego de 1 Galón',
      code: 'JHM-MAR-BIT04',
      imageIcon: 'fa-solid fa-droplet',
      stock: 18,
      priceGalon: 165.00
    }
  ]);

  protected readonly selectedId = signal<string>('dashboard');

  protected readonly selectedItem = computed(() =>
    this.sidebarItems().find((item) => item.id === this.selectedId())
  );

  protected readonly filteredProducts = computed(() => {
    const filter = this.selectedFilterCategory();
    const query = this.searchQuery().toLowerCase().trim();
    return this.marinaProducts().filter((prod) => {
      const matchCategory = filter === 'all' || prod.category === filter;
      const matchQuery = !query || prod.name.toLowerCase().includes(query) || prod.description.toLowerCase().includes(query) || prod.code.toLowerCase().includes(query);
      return matchCategory && matchQuery;
    });
  });

  // Calculadora de Galones para el Vendedor
  protected readonly galonesEstimados = computed(() => {
    const m2 = this.cotizAreaM2();
    const manos = this.cotizManos();
    const totalGalones = Math.ceil((m2 * manos) / 35);
    return totalGalones;
  });

  protected onSelectedIdChange(id: string) {
    this.selectedId.set(id);
    this.isMobileMenuOpen.set(false);
  }

  protected toggleSidebarCollapse() {
    this.isSidebarCollapsed.update((v) => !v);
  }

  protected toggleMobileMenu() {
    this.isMobileMenuOpen.update((v) => !v);
  }

  protected setFilterCategory(cat: string) {
    this.selectedFilterCategory.set(cat);
  }

  protected onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  protected onAreaInput(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.cotizAreaM2.set(val > 0 ? val : 1);
  }

  protected onManosInput(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.cotizManos.set(val > 0 ? val : 1);
  }
}
