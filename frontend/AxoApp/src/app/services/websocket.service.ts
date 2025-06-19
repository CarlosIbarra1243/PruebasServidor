import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { DeviceData } from '../admin/pages/dashboard/admin-dashboard.component'; // Ajusta la ruta según tu estructura

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket;
  private _isConnected: boolean = false;
  private connectionStatus = new Subject<boolean>();
  private selectedDeviceId: number | null = null; // ID de dispositivo seleccionado

  constructor(private authService: AuthService) {
    this.socket = io('https://www.proyectoaxo.site', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      this._isConnected = true;
      this.connectionStatus.next(true);
      console.log('Conectado al servidor WebSocket a las', new Date().toLocaleString('es-MX', { timeZone: 'America/Phoenix' }));
      this.subscribeToAuthenticatedUser();
    });

    this.socket.on('disconnect', () => {
      this._isConnected = false;
      this.connectionStatus.next(false);
      console.log('Desconectado del servidor WebSocket a las', new Date().toLocaleString('es-MX', { timeZone: 'America/Phoenix' }));
    });
  }

  private subscribeToAuthenticatedUser(): void {
    const userId = this.authService.getUserId();
    if (userId) {
      this.socket.emit('subscribe', userId, (response: any) => {
        if (response.error) {
          console.error('Error al suscribirse:', response.error);
        }
      });
    } else {
      console.warn('No se pudo obtener el ID del usuario autenticado');
    }
  }

  // Método para suscribirse a un dispositivo específico
  subscribeToDevice(deviceId: number): void {
    if (this.selectedDeviceId !== deviceId) {
      this.selectedDeviceId = deviceId;
      this.socket.emit('subscribe_device', deviceId, (response: any) => {
        if (response.error) {
          console.error('Error al suscribirse al dispositivo:', response.error);
        }
      });
    }
  }

  // Observable para definir el evento que recibe un nuevo dato
  onNewData(): Observable<DeviceData> {
    return new Observable<DeviceData>(observer => {
      this.socket.on('nuevo_dato', (data: DeviceData) => {
        // Solo procesa datos si coinciden con el dispositivo seleccionado
        if (data.dispositivo_id === this.selectedDeviceId) {
          observer.next(data);
        }
      });
    });
  }

  onEstadoDispositivo(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('estado_dispositivo', (data: any) => {
        if (data.dispositivo_id === this.selectedDeviceId) {
          observer.next(data);
        }
      });
    });
  }

  onAlarmaPuerta(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('alarma_puerta', (data: any) => {
        if (data.dispositivo_id === this.selectedDeviceId) {
          observer.next(data);
        }
      });
    });
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  onGlobalStatus(): Observable<{ [key: number]: string }> {
    return new Observable(observer => {
      this.socket.on('estado_global', (data: { [key: number]: string }) => {
        observer.next(data);
      });
    });
  }

  get isConnected(): boolean {
    return this._isConnected;
  }
}