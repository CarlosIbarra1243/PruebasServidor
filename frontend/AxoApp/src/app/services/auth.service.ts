// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {jwtDecode} from 'jwt-decode';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/auth';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
  }

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

getUserId(): number | null {
    const token = this.getToken();
    if (token) {
      try {
        const decodedToken: { id: number; rol: number } = jwtDecode(token);
        return decodedToken.id;
      } catch (error) {
        console.error('Error decodificando token:', error);
        return null;
      }
    }
    return null;
  }

getUserData(): Observable<any> {
    const userId = this.getUserId();
    if (userId) {
      return this.http.get(`http://localhost:3000/api/user/${userId}`, { headers: this.getHeaders() });
    }
    return new Observable(observer => {
      observer.error(new Error('ID de usuario no disponible'));
      observer.complete();
    });
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
  }
}