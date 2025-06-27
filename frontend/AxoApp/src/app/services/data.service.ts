import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { AuthService } from './auth.service'; 

@Injectable({ providedIn: 'root' })
export class DataService {
  private socket: Socket;

  constructor(
    private http: HttpClient,
    private authService: AuthService 
  ) {
    const userId = this.authService.getUserId(); // Obtener ID del usuario
    this.socket = io('https://www.proyectoaxo.site');
    
    this.socket.on('connect', () => {
      if (userId !== null) {
        this.socket.emit('subscribe', userId); // Usar ID del usuario
      } else {
        console.error('Usuario no autenticado al conectar socket');
      }
    });
  }

  getDispositivos(): Observable<any> {
    const userId = this.authService.getUserId();
    if (!userId) {
      return throwError(() => new Error('Usuario no autenticado'));
    }
    return this.http.get(`/api/dispositivos?usuarioId=${userId}`);
  }

  getEstadisticas(deviceId: number, intervalo: string, start?: string, end?: string): Observable<any> {
    const userId = this.authService.getUserId();
    if (!userId) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    let params: any = { deviceId, intervalo };
    if (intervalo === 'custom' && start && end) {
      params.start = start;
      params.end = end;
    }

    return this.http.get<any[]>(`/api/estadisticas`, {
      params
    }).pipe(
      catchError((error) => {
        console.error(`Error en dispositivo ${deviceId}:`, error);
        return throwError(() => new Error('Error cargando estadísticas'));
      })
    );
  }

  getSocket(): Socket {
    return this.socket;
  }
}