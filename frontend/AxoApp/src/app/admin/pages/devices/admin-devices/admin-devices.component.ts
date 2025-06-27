import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertService } from '../../../../services/alert.service';
import { Device } from '../../../../models/models'; 
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-devices',
  templateUrl: './admin-devices.component.html',
  styleUrls: ['./admin-devices.component.css'],
  standalone: true,
  imports: [CommonModule, RouterOutlet]
})
export class AdminDevicesComponent implements OnInit, OnDestroy {
  devices: Device[] = [];
  private subscriptions: Subscription[] = [];

  constructor(private alertService: AlertService) {}

  ngOnInit(): void {
    const sub = this.alertService.getDevices().subscribe({
      next: (devices) => {
        this.devices = devices;
      },
      error: (err) => {
        console.error('Error al cargar dispositivos:', err);
      }
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}