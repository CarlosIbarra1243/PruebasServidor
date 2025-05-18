import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';


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

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
      this.userId = this.authService.getUserId();
      this.loadUserData();
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

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }
}
