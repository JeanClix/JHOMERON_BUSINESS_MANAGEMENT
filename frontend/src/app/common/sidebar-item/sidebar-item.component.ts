import { Component, input, output } from '@angular/core';

export interface SidebarItem {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon?: string;
  badge?: string;
  badgeColor?: string;
  // Agrupa visualmente los items en el sidebar (ver sidebar.component.html):
  // items consecutivos con el mismo groupLabel quedan bajo un mismo título de
  // sección, como en el sidebar de Gerencia (NavGroup). Opcional -- sin esto
  // el sidebar se ve como una lista plana (comportamiento anterior).
  groupLabel?: string;
}

@Component({
  selector: 'app-sidebar-item',
  standalone: true,
  templateUrl: './sidebar-item.component.html',
  styleUrls: ['./sidebar-item.component.css']
})
export class SidebarItemComponent {
  item = input.required<SidebarItem>();
  isSelected = input<boolean>(false);
  isCollapsed = input<boolean>(false);
  select = output<string>();

  handleSelect() {
    this.select.emit(this.item().id);
  }
}
