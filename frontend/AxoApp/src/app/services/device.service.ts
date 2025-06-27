import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Device } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private apiUrl = '/auth';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  addDevice(device:any): Observable<any> {
    return this.http.post(`${this.apiUrl}/addDevice`, device, { headers: this.getHeaders()}).pipe(tap(() => console.log('¡Dispositivo agregado exitosamente!'))
  );
  }

  getDevices(): Observable<any[]> {
    return this.http.get<Device[]>(`${this.apiUrl}/devices`, { headers: this.getHeaders() }).pipe(
      tap(devices => console.log('Dispositivos obtenidos:',devices))
    );
  }

getDevice(id: number): Observable<Device> {
    return this.http.get<Device>(`${this.apiUrl}/devices/${id}`, { headers: this.getHeaders() }).pipe(
      tap(device => console.log('Dispositivo obtenido:', device)),
      catchError(error => {
        console.error('Error al obtener el dispositivo:', error);
        throw error;
      })
    );
  }

  updateDevice(device: Device): Observable<Device> {
    const url = `${this.apiUrl}/editDevice/${device.id}`;
    return this.http.post<Device>(url, device, { headers: this.getHeaders() }).pipe(
      tap((response) => console.log('Respuesta del servidor:', response)),
      catchError(error => {
        console.error('Error en la solicitud HTTP:', error);
        throw error;
      })
    );
  }

  validatePassword(deviceId: number, password: string): Observable<{ isValid: boolean }> {
  return this.http.post<{ isValid: boolean }>(`${this.apiUrl}/validatePassword`, { deviceId, password }, { headers: this.getHeaders() }).pipe(
    tap(response => console.log('Validación de contraseña:', response)),
    catchError(error => {
      console.error('Error al validar contraseña:', error);
      throw error;
    })
  );
  
}
updateDeviceState(deviceId: number, estado: string): Observable<any> {
    const url = `${this.apiUrl}/deactivateDevice/${deviceId}`;
    return this.http.post(url, { estado }, { headers: this.getHeaders() }).pipe(
      tap(() => console.log('Estado del dispositivo actualizado')),
      catchError(error => {
        console.error('Error al actualizar el estado:', error);
        throw error;
      })
    );
  }
}
