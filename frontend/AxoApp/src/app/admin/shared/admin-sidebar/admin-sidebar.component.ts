import { Component, EventEmitter, HostListener, OnInit, Output } from '@angular/core';
import { sidebarData } from './nav-data';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgClass } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

import Swal from 'sweetalert2'

interface SidebarToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-admin-sidebar',
  imports: [RouterLink, NgClass, RouterLinkActive, CommonModule],
  templateUrl: './admin-sidebar.component.html',
  styleUrl: './admin-sidebar.component.css'
})
export class AdminSidebarComponent implements OnInit {
  @Output() onToggleSidebar: EventEmitter<SidebarToggle> = new EventEmitter();
  collapsed = false;
  screenWidth = 0;
  navData = sidebarData.map(item => ({...item, isHover: false}));
  isLogoutHover = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.screenWidth = window.innerWidth;
    if(this.screenWidth <= 768) {
      this.collapsed = false;
      this.onToggleSidebar.emit({collapsed: this.collapsed, screenWidth: this.screenWidth})
    }
  }

  ngOnInit(): void {
      this.screenWidth = window.innerWidth;
  }


  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.onToggleSidebar.emit({collapsed: this.collapsed, screenWidth: this.screenWidth});
  }

  closeSidebar(): void {
    this.collapsed = false;
    this.onToggleSidebar.emit({collapsed: this.collapsed, screenWidth: this.screenWidth});
  }

  logout() {
    Swal.fire({
      title: "¿Seguro que deseas salir?",
      text: "Piensa en tus refrigeradores, ¡te necesitan!",
      imageUrl: 'images/duo.png',
      imageHeight: 120,
      imageWidth: 180,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "¡Sí, ya vámonos!",
      cancelButtonText: "No, cambié de opinión..."
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: "¡Sesión cerrada!",
          text: "Nos vemos pronto.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.authService.logout();
          this.router.navigate(['/auth']);
        });
      }
    });
  }
}
