import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { RouterLink, RouterModule } from '@angular/router';
import { AlertService } from '../../../../services/alert.service';
import { Device } from '../../../../models/models';
import { CommonModule } from '@angular/common';

import Swal from 'sweetalert2';
import { DeviceService } from '../../../../services/device.service';

@Component({
  selector: 'app-list-device',
  templateUrl: './list-device.component.html',
  styleUrls: ['./list-device.component.css'],
  standalone: true,
  imports: [RouterModule, CommonModule, RouterLink]
})
export class ListDeviceComponent implements OnInit, OnDestroy {
  devices: Device[] = [];
  private subscriptions: Subscription[] = [];

  constructor(private alertService: AlertService, private deviceService: DeviceService) {}

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

  loadDevices(): void {
    this.deviceService.getDevices().subscribe({
      next: (devices) => {
        this.devices = devices;
      },
      error: (err) => {
        console.error('Error al cargar dispositivos:', err);
      }
    });
  }

  onDelete(deviceId: number): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción eliminará el dispositivo de la lista. ¿Deseas continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
      customClass: {
        confirmButton: 'swal2-custom-confirm',
        cancelButton: 'swal2-custom-cancel'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.deviceService.updateDeviceState(deviceId, '0').subscribe({
          next: () => {
            // Recargar la lista de dispositivos tras la actualización
            this.loadDevices();
            Swal.fire({
              title: 'Éxito',
              text: 'El dispositivo ha sido eliminado.',
              icon: 'success',
              confirmButtonText: 'OK',
              customClass: {
                confirmButton: 'swal2-custom-confirm'
              }
            });
          },
          error: (err) => {
            console.error('Error al actualizar el estado:', err);
            Swal.fire({
              title: 'Error',
              text: 'No fue posible eliminar el dispositivo.',
              icon: 'error',
              confirmButtonText: 'OK',
              customClass: {
                confirmButton: 'swal2-custom-confirm'
              }
            });
          }
        });
      }
    });
  }
}