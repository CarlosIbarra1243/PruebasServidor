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
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AdminAlertsComponent implements OnInit {
  devices: Device[] = [];
  selectedDevice: Device | null = null;
  alerts: Alert[] = [];
  paginatedAlerts: Alert[] = [];
  private subscriptions: Subscription[] = [];
  startDate: string = '';
  endDate: string = '';

  currentPage: number = 1;
  pageSize: number = 10;
  pageSizes: number[] = [5, 10, 25, 50];
  totalPages: number = 1;
  isDesktopView: boolean = true;

  constructor(private alertService: AlertService) {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    const subDevices = this.alertService.getDevices().subscribe(devices => {
      this.devices = devices;
    });
    this.subscriptions.push(subDevices);

    this.selectedDevice = null;
    const subAlerts = this.alertService.getAllAlerts().subscribe(alerts => {
      this.alerts = alerts;
      this.updatePagination();
    });
    this.subscriptions.push(subAlerts);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isDesktopView = window.innerWidth > 768;
  }

  selectDevice(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const deviceId = Number(selectElement.value);
    if (deviceId === 0) {
      this.selectedDevice = null;
      const sub = this.alertService.getAllAlerts().subscribe(alerts => {
        this.alerts = alerts;
        if (this.startDate && this.endDate) {
          this.filterAlerts();
        } else {
          this.updatePagination();
        }
      });
      this.subscriptions.push(sub);
    } else {
      this.selectedDevice = this.devices.find(device => device.id === deviceId) || null;
      if (this.selectedDevice) {
        this.currentPage = 1;
        const sub = this.alertService.getAlertsByDevice(this.selectedDevice.id).subscribe(alerts => {
          this.alerts = alerts;
          if (this.startDate && this.endDate) {
            this.filterAlerts();
          } else {
            this.updatePagination();
          }
        });
        this.subscriptions.push(sub);
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.alerts.length / this.pageSize);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages || 1;
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
      const filteredAlerts = this.alerts.filter(alert => {
        const alertDate = new Date(alert.fecha).getTime();
        return alertDate >= start && alertDate <= end;
      });
      this.alerts = filteredAlerts;
      this.currentPage = 1;
      this.updatePagination();
    } else if (!this.startDate && !this.endDate && !this.selectedDevice) {
      const sub = this.alertService.getAllAlerts().subscribe(alerts => {
        this.alerts = alerts;
        this.updatePagination();
      });
      this.subscriptions.push(sub);
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
    } else {
      const sub = this.alertService.getAllAlerts().subscribe(alerts => {
        this.alerts = alerts;
        this.updatePagination();
      });
      this.subscriptions.push(sub);
    }
  }

  getDeviceName(deviceId: number): string {
    const device = this.devices.find(d => d.id === deviceId);
    return device ? device.nombre : 'Desconocido';
  }
}