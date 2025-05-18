import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-home',
  imports: [CommonModule],
  templateUrl: './user-home.component.html',
  styleUrl: './user-home.component.css'
})
export class UserHomeComponent implements OnInit {
  userId: number | null = null;
  userData: any = null;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
  ){}

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
