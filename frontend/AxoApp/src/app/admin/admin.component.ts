import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidebarComponent } from './shared/admin-sidebar/admin-sidebar.component';
import { AdminBodyComponent } from './body/admin-body.component';

interface SidebarToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-admin',
  imports: [AdminSidebarComponent, AdminBodyComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent {
  isSidebarCollapsed = false;
  screenWidth = 0;


  onToggleSidebar(data: SidebarToggle): void {
    this.screenWidth = data.screenWidth;
    this.isSidebarCollapsed = data.collapsed;
  }
}
