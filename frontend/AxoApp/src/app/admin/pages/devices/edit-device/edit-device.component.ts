import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DeviceService } from '../../../../services/device.service';
import Swal from 'sweetalert2';
import { Device } from '../../../../models/models';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-edit-device',
  standalone: true,
  templateUrl: './edit-device.component.html',
  styleUrls: ['./edit-device.component.css'],
  imports:[FormsModule, CommonModule]
})
export class EditDeviceComponent implements OnInit {
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
          // Rellenar los campos manualmente
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

onSubmit(event: Event) {
    if (this.device.id) {
      const updatedDevice: Device = {
        ...this.device,
        nombre: this.nameInput.nativeElement.value,
        modelo: this.modelInput.nativeElement.value
      };
      this.deviceService.updateDevice(updatedDevice).subscribe({
        next: (response) => {
          Swal.fire({
            title: "¡Éxito!",
            text: "¡Se ha actualizado el dispositivo correctamente!",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
          }).then(() => {
            this.router.navigate(['/admin/devices/list']);
          });
        },
        error: (err) => {
          console.error('Error al actualizar el dispositivo:', err);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo actualizar el dispositivo. ' + (err.status ? `Código: ${err.status} - ${err.message}` : 'Verifica los permisos o conexión.'),
            icon: 'error',
            confirmButtonText: 'OK'
          });
        },
      });
    } else {
      console.error('No se encontró ID del dispositivo');
    }
  }


  onCancel() {
    this.router.navigate(['/admin/devices']);
  }
}