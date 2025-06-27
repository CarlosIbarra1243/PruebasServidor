import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Device, Alert } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private apiUrl = '/auth';

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getDevices(): Observable<Device[]> {
    return this.http.get<Device[]>(`${this.apiUrl}/devices`, { headers: this.getHeaders() });
  }

  getAlertsByDevice(deviceId: number): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.apiUrl}/alertas?deviceId=${deviceId}&sort=desc`, { headers: this.getHeaders() });
  }

  getAllAlerts(): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.apiUrl}/alertas`, { headers: this.getHeaders() });
  }

  getUltimasAlertas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/alertas/ultimas/10`, { headers: this.getHeaders() });
  }
}