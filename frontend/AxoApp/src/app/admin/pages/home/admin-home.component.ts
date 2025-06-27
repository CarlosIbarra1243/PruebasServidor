import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

import Swal from 'sweetalert2'
import { DataService } from '../../../services/data.service';
import { AlertService } from '../../../services/alert.service';


interface SidebarToggle {
  screenWidth: number;
  collapsed: boolean;
}

@Component({
  selector: 'app-admin-home',
  imports: [CommonModule],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.css'
})
export class AdminHomeComponent implements OnInit {
  userId: number | null = null;
  userData: any = null;
  errorMessage: string | null = null;
  ultimoDato: any = null;
  ultimasAlertas: any[] = [];

  isSidebarCollapsed = false;
  screenWidth = 0;

  onToggleSidebar(data: SidebarToggle): void {
    this.screenWidth = data.screenWidth;
    this.isSidebarCollapsed = data.collapsed;
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private dataService: DataService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
      this.userId = this.authService.getUserId();
      this.loadUserData();
      this.loadUltimoDato();
      this.cargarUltimasAlertas();
  }

  loadUserData() {
    this.authService.getUserData().subscribe({
      next: (data) => {
        this.userData = data;
        this.errorMessage = null;
      },
      error: (err) => {
        console.error('Error obteniendo información del usuario', err);
        this.errorMessage = 'No se pudieron obtener los datos del usuario';
      }
    });
  }

  loadUltimoDato(): void {
    this.dataService.getUltimoNodocentral().subscribe({
      next: (data) => {
        this.ultimoDato = data;
      },
      error: (err) => {
        console.error('Error al cargar el último dato:', err);
      }
    });
  }

  cargarUltimasAlertas(): void {
    this.alertService.getUltimasAlertas().subscribe({
      next: (data) => {
        this.ultimasAlertas = data;
      },
      error: (err) => {
        console.error('Error al cargar las últimas alertas:', err);
      }
    });
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
