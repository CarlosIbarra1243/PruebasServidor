import { Component, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebSocketService } from '../../../services/websocket.service';
import { AuthService } from '../../../services/auth.service';
import { Chart } from 'chart.js';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Subscription } from 'rxjs';

// Interfaz para las gráficas de un dispositivo
interface DeviceCharts {
  tempConChart: Chart | null;
  tempRefChart: Chart | null;
  tempAmbChart: Chart | null;
  humAmbChart: Chart | null;
  enerConChart: Chart | null;
  puerConChart: Chart | null;
  puerRefChart: Chart | null;
}

// Interfaz para los datos recibidos del WebSocket y backend
export interface DeviceData {
  dispositivo_id: number;
  fecha: string;
  hora: string;
  TempCon: number | string;
  TempRef: number | string;
  TempAmb: number | string;
  HumAmb: number | string;
  EnerCon: number | string;
  PuerCon: number | string;
  PuerRef: number | string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  animations: [
    trigger('notificationState', [
      state('hidden', style({ opacity: 0, transform: 'translateX(120%)' })),
      state('visible', style({ opacity: 1, transform: 'translateX(0)' })),
      transition('hidden => visible', animate('0.3s ease-in')),
      transition('visible => hidden', animate('0.3s ease-out'))
    ])
  ]
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  usuarioId: number | null = null;
  dispositivos: any[] = [];
  selectedDeviceId: number | null = null;
  deviceCharts: Map<number, DeviceCharts> = new Map();
  maxDataPoints: number = 10; // Número máximo de puntos en las gráficas
  notificacion: any = { mostrar: false, tipo: '', fechaHora: '', dispositivo: '', descripcion: '', estado: '' };
  private timeoutAlarma: any;
  private subscriptions: Subscription[] = []; // Para manejar suscripciones
  errorMessage: string | null = null; // Para mostrar errores al usuario

  constructor(
    public websocketService: WebSocketService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioId = this.authService.getUserId();
    if (this.usuarioId) {
      this.loadDevices();
      this.setupSubscriptions();
    } else {
      console.error('Usuario no autenticado');
    }
  }

  ngAfterViewInit(): void {
    if (this.selectedDeviceId) {
      this.loadHistoricalData(this.selectedDeviceId);
    }
  }

  // Se ejecuta al destruir el componente
  ngOnDestroy(): void {
    // Limpia todas las suscripciones y el estado
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = []; // Reinicia el array de suscripciones
    if (this.timeoutAlarma) {
      clearTimeout(this.timeoutAlarma);
    }
    this.deviceCharts.clear(); // Limpia las gráficas
    this.selectedDeviceId = null; // Reinicia la selección del dispositivo
    this.dispositivos = []; // Reinicia la lista de dispositivos
  }

  private loadDevices(): void {
    this.errorMessage = null;
    const sub = this.authService.getDevices().subscribe({
      next: (devices: any) => {
        this.dispositivos = devices.map((device: { status: any; lastSeen: string | number | Date; }) => ({
          ...device,
          status: device.status || 'offline',
          lastSeen: device.lastSeen ? new Date(device.lastSeen) : new Date() // Usa la fecha de la API o la actual
        }));
        this.cdr.detectChanges();
        if (this.dispositivos.length > 0 && !this.selectedDeviceId) {
          this.selectDevice(this.dispositivos[0].id);
        }
      },
      error: (err: any) => {
        console.error('Error al cargar dispositivos:', err);
        this.errorMessage = 'Error al cargar los dispositivos. Por favor, intenta de nuevo o recarga la página.';
        this.dispositivos = [];
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.push(sub);
  }

  selectDevice(deviceId: number): void {
    if (this.selectedDeviceId !== deviceId) {
      this.selectedDeviceId = deviceId;
      this.websocketService.subscribeToDevice(deviceId); // Notifica al WebSocketService
      this.loadHistoricalData(deviceId); 
    }
  }

  // Carga datos históricos
  private loadHistoricalData(deviceId: number): void {
    const sub = this.authService.getRecentData(deviceId).subscribe({
      next: (data: DeviceData[]) => {
        this.createDeviceChart(deviceId, data);
      },
      error: (err: any) => {
        console.error('Error al cargar datos históricos:', err);
        this.createDeviceChart(deviceId, []);
      }
    });
    this.subscriptions.push(sub);
  }

  // Método para construir una gráfica
  private createDeviceChart(deviceId: number, historicalData: DeviceData[] = []): void {
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#e9ecef' },
          ticks: { color: '#212529' },
          title: { display: true, text: 'Valor', color: '#212529', font: { size: 12 } }
        },
        x: {
          grid: { color: '#e9ecef' },
          ticks: { color: '#212529', maxTicksLimit: 10, maxRotation: 0, padding: 5 },
          title: { display: true, text: 'Fecha y Hora (DD/MM/YY HH:MM)', color: '#212529', font: { size: 12 } }
        }
      },
      plugins: {
        legend: { labels: { color: '#212529', font: { size: 14 } } },
        title: { display: true, text: 'Gráfica', color: '#212529', font: { size: 16 } }
      }
    };

    const labelToFieldMap: { [key: string]: keyof DeviceData } = {
      'Temperatura Congelador (°C)': 'TempCon',
      'Temperatura Refrigerador (°C)': 'TempRef',
      'Temperatura Ambiente (°C)': 'TempAmb',
      'Humedad Ambiente (%)': 'HumAmb',
      'Energía Consumida (kWh)': 'EnerCon',
      'Puerta Congelador': 'PuerCon',
      'Puerta Refrigerador': 'PuerRef'
    };

    const createChart = (id: string, label: string, color: string, data: DeviceData[]): Chart | null => {
      const canvas = document.getElementById(id) as HTMLCanvasElement | null;
      if (!canvas) {
        console.error(`Canvas with ID ${id} not found`);
        return null;
      }
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();

      const field = labelToFieldMap[label];
      if (!field) {
        console.error(`No se encontró mapeo para la etiqueta: ${label}`);
        return null;
      }

      const labels = data.map(d => {
        const dateTimeString = `${d.fecha.split('T')[0]}T${d.hora}`;
        const date = new Date(dateTimeString);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
                 date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        }
        return 'Invalid';
      }).slice(-this.maxDataPoints);

      const values = data.map(d => {
        const value = d[field];
        return typeof value === 'string' ? parseFloat(value) || null : (typeof value === 'number' ? value : null);
      }).slice(-this.maxDataPoints);

      const chartTitle = `Gráfica de ${label}`;
      const optionsWithTitle = {
        ...chartOptions,
        plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: chartTitle } }
      };

      return new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{ label, data: values, borderColor: color, backgroundColor: `${color}20`, borderWidth: 2, pointRadius: 3, tension: 0.4 }]
        },
        options: optionsWithTitle
      });
    };

    // Construcción de gráficas
    const charts: DeviceCharts = {
      tempConChart: createChart(`tempCon-${deviceId}`, 'Temperatura Congelador (°C)', '#007bff', historicalData),
      tempRefChart: createChart(`tempRef-${deviceId}`, 'Temperatura Refrigerador (°C)', '#17a2b8', historicalData),
      tempAmbChart: createChart(`tempAmb-${deviceId}`, 'Temperatura Ambiente (°C)', '#ffc107', historicalData),
      humAmbChart: createChart(`humAmb-${deviceId}`, 'Humedad Ambiente (%)', '#28a745', historicalData),
      enerConChart: createChart(`enerCon-${deviceId}`, 'Energía Consumida (kWh)', '#fd7e14', historicalData),
      puerConChart: createChart(`puerCon-${deviceId}`, 'Puerta Congelador', '#6c757d', historicalData),
      puerRefChart: createChart(`puerRef-${deviceId}`, 'Puerta Refrigerador', '#20c997', historicalData)
    };

    if (Object.values(charts).every(chart => chart !== null)) {
      this.deviceCharts.set(deviceId, charts);
    } else {
      console.error(`Failed to create all charts for device ${deviceId}`);
    }
  }

  private updateDeviceCharts(deviceId: number, data: DeviceData): void {
    const charts = this.deviceCharts.get(deviceId);
    if (!charts) {
      console.warn(`No charts initialized for device ${deviceId}`);
      return;
    }
    const combinedDate = new Date(`${data.fecha.split('T')[0]}T${data.hora}`);
    const label = combinedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
                  combinedDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    this.updateChart(charts.tempConChart, label, data.TempCon);
    this.updateChart(charts.tempRefChart, label, data.TempRef);
    this.updateChart(charts.tempAmbChart, label, data.TempAmb);
    this.updateChart(charts.humAmbChart, label, data.HumAmb);
    this.updateChart(charts.enerConChart, label, data.EnerCon);
    this.updateChart(charts.puerConChart, label, data.PuerCon);
    this.updateChart(charts.puerRefChart, label, data.PuerRef);
  }

  private updateChart(chart: Chart | null, label: string, value: any): void {
    if (chart && chart.data && chart.data.labels && chart.data.datasets[0].data) {
      const numericValue = typeof value === 'string' ? parseFloat(value) || null : (typeof value === 'number' ? value : null);

      if (chart.data.labels.length >= this.maxDataPoints) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.data.labels.push(label);
      chart.data.datasets[0].data.push(numericValue);
      chart.update();
    } else {
      console.warn('Chart data structure is incomplete or null:', chart);
    }
  }

  private updateDeviceStatus(data: any): void {
    const index = this.dispositivos.findIndex(d => d.id === data.id);
    if (index !== -1) {
      this.dispositivos[index] = {
        ...this.dispositivos[index],
        status: data.status,
        lastSeen: data.lastSeen ? new Date(data.lastSeen) : new Date()
      };
    } else {
      this.dispositivos.push({
        ...data,
        status: data.status,
        lastSeen: data.lastSeen ? new Date(data.lastSeen) : new Date()
      });
    }
    this.cdr.detectChanges();
  }
  

  private mostrarNotificacion(data: any): void {
    this.notificacion = {
      mostrar: true,
      tipo: data.tipo,
      fechaHora: `${data.fecha} ${data.hora}`,
      dispositivo: `Dispositivo: ${data.dispositivo_nombre}`,
      descripcion: data.descripcion,
      estado: data.estado.toLowerCase()
    };

    if (data.estado === 'Pendiente') {
      clearTimeout(this.timeoutAlarma);
      this.timeoutAlarma = setTimeout(() => this.cerrarNotificacion(), 8000);
    }
  }

  cerrarNotificacion(): void {
    this.notificacion.mostrar = false;
  }

  get selectedDeviceName(): string | undefined {
    return this.dispositivos.find(d => d.id === this.selectedDeviceId)?.nombre;
  }

  getChartTitle(chartId: string): string {
    const titles: { [key: string]: string } = {
      'tempCon': 'Temperatura Congelador (°C)',
      'tempRef': 'Temperatura Refrigerador (°C)',
      'tempAmb': 'Temperatura Ambiente (°C)',
      'humAmb': 'Humedad Ambiente (%)',
      'enerCon': 'Energía Consumida (kWh)',
      'puerCon': 'Puerta Congelador',
      'puerRef': 'Puerta Refrigerador'
    };
    return `Gráfica de ${titles[chartId] || 'Desconocido'}`;
  }

  private setupSubscriptions(): void {
    const estadoSub = this.websocketService.onEstadoDispositivo().subscribe(data => {
      this.updateDeviceStatus(data);
    });
    const newDataSub = this.websocketService.onNewData().subscribe((data: DeviceData) => {
      const index = this.dispositivos.findIndex(d => d.id === data.dispositivo_id);
      if (index !== -1) {
        this.dispositivos[index].lastSeen = new Date(); // Actualiza lastSeen con cada dato
        if (this.selectedDeviceId === data.dispositivo_id) {
          this.updateDeviceCharts(data.dispositivo_id, data);
        }
      }
      this.cdr.detectChanges();
    });
    const alarmaSub = this.websocketService.onAlarmaPuerta().subscribe(data => {
      this.mostrarNotificacion(data);
    });
    this.subscriptions.push(estadoSub, newDataSub, alarmaSub);
  }

  // Método para recargar manualmente los dispositivos
  reloadDevices(): void {
    this.loadDevices();
  }

  isDeviceConnected(device: any): boolean {
    return device.status === 'online'; 
  }
}