import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavGroup } from '../../../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  isSidebarCollapsed = signal<boolean>(false);

  adminNavGroups: NavGroup[] = [
    {
      groupLabel: 'Administración',
      items: [
        {
          id: 'users',
          label: 'Usuarios',
          route: '/admin/users',
          icon: 'fa-solid fa-users',
        },
        {
          id: 'documentos',
          label: 'Documentos de Contexto',
          route: '/admin/documentos',
          icon: 'fa-solid fa-book-bookmark',
        },
        {
          id: 'consumo-ia',
          label: 'Consumo de IA',
          route: '/admin/consumo-ia',
          icon: 'fa-solid fa-chart-column',
        }
      ]
    }
  ];

  toggleSidebarCollapse() {
    this.isSidebarCollapsed.update(v => !v);
  }
}
