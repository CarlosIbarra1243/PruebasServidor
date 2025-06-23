import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
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
}
