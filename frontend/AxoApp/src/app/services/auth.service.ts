// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/auth';

  constructor(private http: HttpClient) {}


  // Petición HTTP para el registro de usuarios
  register(user: { email: string; password: string; nombre: string; telefono: string; fechaNacimiento: string; genero: string; rol: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  // Petición HTTP para validar credenciales de usuario y almacenar JWT
  login(credentials: { email: string; password: string }): Observable<any> {

    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('rol', response.rol.toString());
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRol(): number | null {
    const rol = localStorage.getItem('rol');
    return rol ? parseInt(rol) : null;
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
  }
}