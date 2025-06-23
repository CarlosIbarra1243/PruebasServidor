import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceService } from '../../../services/device.service'; // Asegúrate de ajustar la ruta al servicio
import { FormsModule } from '@angular/forms';
import { v4 as uuidv4 } from 'uuid';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-device',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-device.component.html',
  styleUrls: ['./add-device.component.css']
})
export class AddDeviceComponent {
  device = { nombre: '', modelo: '' };

  constructor(private deviceService: DeviceService, private router: Router) {}

  onSubmit() {
    this.deviceService.addDevice(this.device).subscribe(() => {
      Swal.fire({
        title: "¡Éxito!",
        text: "¡Se ha añadido tu dispositivo correctamente!",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
      this.router.navigate(['/admin/dashboard']).then(() => {
        location.reload();
      });
      });
    }, error => {
      console.error('Error al agregar dispositivo:', error);
    });
  }

  onCancel() {
    this.router.navigate(['/admin/dashboard']);
  }
}