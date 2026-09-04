import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SidebarItemComponent, SidebarItem } from '../sidebar-item/sidebar-item.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, SidebarItemComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  readonly authService = inject(AuthService);

  items = input<SidebarItem[]>([]);
  selectedId = input<string>('');
  isCollapsed = input<boolean>(false);

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

