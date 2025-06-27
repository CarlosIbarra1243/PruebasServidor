import { Component, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DeviceService } from '../../../../services/device.service';
import { Device } from '../../../../models/models';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-view-device',
  imports: [CommonModule],
  templateUrl: './view-device.component.html',
  styleUrl: './view-device.component.css'
})
export class ViewDeviceComponent {
device: Device = { id: 0, nombre: '', modelo: '', api_key: '' };
  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;
  @ViewChild('modelInput') modelInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private deviceService: DeviceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.deviceService.getDevice(id).subscribe({
        next: (device) => {
          this.device = { ...device };
          if (this.nameInput && this.modelInput) {
            this.nameInput.nativeElement.value = device.nombre || '';
            this.modelInput.nativeElement.value = device.modelo || '';
          }
        },
        error: (err) => {
          console.error('Error al cargar el dispositivo:', err);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo cargar el dispositivo. ' + (err.status ? `Código: ${err.status}` : 'Verifica la conexión.'),
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
    }
  }

  onBack() {
    this.router.navigate(['/admin/devices/list']);
  }

  showApiKeyModal() {
    Swal.fire({
      title: 'Verificar Contraseña',
      input: 'password',
      inputLabel: 'Ingresa tu contraseña',
      inputPlaceholder: 'Contraseña',
      showCancelButton: true,
      confirmButtonText: 'Verificar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      preConfirm: async (password) => {
        if (!password) {
          Swal.showValidationMessage('Por favor, ingresa una contraseña');
          return;
        }

        const isValid = await this.validatePassword(password);
        if (!isValid) {
          Swal.showValidationMessage('Contraseña incorrecta. Por favor, intenta de nuevo.');
          return;
        }
        return true; // Se acepta la confirmación
      }
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'API Key',
          html: `
            <p>La API Key del dispositivo es:</p>
            <div style="font-weight: bold; font-size: 1.2rem; margin-top: 10px; background: #f0f0f0; padding: 10px; border-radius: 6px;">
              ${this.device.api_key}
            </div>
          `,
          icon: 'info',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  private validatePassword(password: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.deviceService.validatePassword(this.device.id, password).subscribe({
        next: (response) => resolve(response.isValid),
        error: () => resolve(false)
      });
    });
  }
}
