import { Component, input, output } from '@angular/core';
import { SidebarItemComponent, SidebarItem } from '../sidebar-item/sidebar-item.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [SidebarItemComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
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
}
