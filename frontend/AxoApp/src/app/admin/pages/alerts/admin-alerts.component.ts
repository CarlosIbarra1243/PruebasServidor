import { Component, OnInit, HostListener } from '@angular/core';
import { AlertService } from '../../../services/alert.service';
import { Device, Alert } from '../../../models/models';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-alerts',
  templateUrl: './admin-alerts.component.html',
  styleUrls: ['./admin-alerts.component.css'],
  imports: [CommonModule, FormsModule]
})
export class AdminAlertsComponent implements OnInit {
  devices: Device[] = [];
  selectedDevice: Device | null = null;
  alerts: Alert[] = [];
  paginatedAlerts: Alert[] = [];
  displayedColumns: string[] = ['id', 'fecha', 'hora', 'tipo', 'descripcion', 'origen', 'estado'];
  private subscriptions: Subscription[] = [];
  startDate: string = '';
  endDate: string = '';

  currentPage: number = 1;
  pageSize: number = 10;
  pageSizes: number[] = [5, 10, 25, 50];
  totalPages: number = 1;
  isDesktopView: boolean = true; 

  constructor(private alertService: AlertService) {
    console.log('AdminAlertsComponent creado');
    this.checkScreenSize(); // Verifica el tamaño al iniciar
  }

  ngOnInit(): void {
    console.log('AdminAlertsComponent initialized');
    const sub = this.alertService.getDevices().subscribe(devices => {
      this.devices = devices;
    });
    this.subscriptions.push(sub);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isDesktopView = window.innerWidth > 768; 
  }

  selectDevice(device: Device): void {
    this.selectedDevice = device;
    this.currentPage = 1; 
    const sub = this.alertService.getAlertsByDevice(device.id).subscribe(alerts => {
      this.alerts = alerts;
      if (this.startDate && this.endDate) {
        this.filterAlerts();
      } else {
        this.updatePagination();
      }
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    console.log('AdminAlertsComponent destroyed');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.alerts.length / this.pageSize);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedAlerts = this.alerts.slice(startIndex, endIndex);
  }

  changePageSize(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    if (selectElement) {
      this.pageSize = +selectElement.value; 
      this.currentPage = 1;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  }

  onDateChange(): void {
    this.currentPage = 1; 
    this.updatePagination();
  }

  filterAlerts(): void {
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate).setHours(0, 0, 0, 0);
      const end = new Date(this.endDate).setHours(23, 59, 59, 999);
      console.log('Adjusted Start:', new Date(start), 'Adjusted End:', new Date(end));

      const filteredAlerts = this.alerts.filter(alert => {
        try {
          const alertDateStr = this.formatDate(alert.fecha);
          const alertDate = new Date(alertDateStr).getTime();
          const isWithinRange = alertDate >= start && alertDate <= end;
          console.log(`Alert (formatted): ${alertDateStr}, Start: ${new Date(start)}, End: ${new Date(end)}, Within Range: ${isWithinRange}`);
          return isWithinRange;
        } catch (e) {
          console.error(`Error processing date ${alert.fecha}:`, e);
          return false;
        }
      });
      console.log('Filtered alerts count:', filteredAlerts.length, 'Dates:', filteredAlerts.map(a => a.fecha));
      this.alerts = filteredAlerts;
      this.currentPage = 1; 
      this.updatePagination();
    } else if (!this.startDate && !this.endDate) {
      // Restaurar todas las alertas
      if (this.selectedDevice) {
        const sub = this.alertService.getAlertsByDevice(this.selectedDevice.id).subscribe(alerts => {
          console.log('Restored alerts count:', alerts.length, 'Dates:', alerts.map(a => a.fecha));
          this.alerts = alerts;
          this.updatePagination();
        });
        this.subscriptions.push(sub);
      }
    }
  }
  resetFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1; 
    if (this.selectedDevice) {
      const sub = this.alertService.getAlertsByDevice(this.selectedDevice.id).subscribe(alerts => {
        this.alerts = alerts;
        this.updatePagination();
      });
      this.subscriptions.push(sub);
    }
  }
}