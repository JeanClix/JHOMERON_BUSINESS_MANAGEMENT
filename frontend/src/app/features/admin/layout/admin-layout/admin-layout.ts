import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavGroup } from '../../../shared/components/sidebar/sidebar.component';

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
        }
      ]
    }
  ];

  toggleSidebarCollapse() {
    this.isSidebarCollapsed.update(v => !v);
  }
}
