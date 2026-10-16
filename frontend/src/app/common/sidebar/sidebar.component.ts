import { Component, computed, inject, input, output } from '@angular/core';
import { SidebarItemComponent, SidebarItem } from '../sidebar-item/sidebar-item.component';
import { AuthService } from '../../core/services/auth.service';

export interface SidebarItemGroup {
  label: string;
  items: SidebarItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [SidebarItemComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  readonly authService = inject(AuthService);

  items = input<SidebarItem[]>([]);
  selectedId = input<string>('');
  isCollapsed = input<boolean>(false);
  // Título de la primera sección cuando los items no traen groupLabel propio
  // (comportamiento anterior, ver sidebar-item.component.ts: SidebarItem.groupLabel).
  defaultGroupLabel = input<string>('Herramientas de Venta');

  // Agrupa items consecutivos por groupLabel -- los que no lo traen caen en
  // defaultGroupLabel, para no romper a quien ya usa el sidebar plano.
  protected groups = computed<SidebarItemGroup[]>(() => {
    const grupos: SidebarItemGroup[] = [];
    for (const item of this.items()) {
      const label = item.groupLabel || this.defaultGroupLabel();
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.label === label) {
        ultimo.items.push(item);
      } else {
        grupos.push({ label, items: [item] });
      }
    }
    return grupos;
  });

  selectedIdChange = output<string>();
  toggleCollapse = output<void>();

  onItemSelect(id: string) {
    this.selectedIdChange.emit(id);
  }

  onToggleCollapse() {
    this.toggleCollapse.emit();
  }

  onLogout() {
    this.authService.logout();
  }
}

