import { Component, OnInit } from '@angular/core';
import { Chart, LinearScale, CategoryScale, LineController, BarController, PointElement, LineElement, BarElement, Tooltip } from 'chart.js';
import { DataService } from '../../../services/data.service';
import { Device } from '../../../models/device.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

Chart.register(
  LinearScale,
  CategoryScale,
  LineController,
  BarController,
  PointElement,
  LineElement,
  BarElement,
  Tooltip // Registrar el plugin de tooltips
);

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-statistics.component.html',
  styleUrls: ['./admin-statistics.component.css']
})
export class AdminStatisticsComponent implements OnInit {
  dispositivos: Device[] = [];
  selectedDeviceId: number | null = null;
  selectedInterval = '8h';
  datos: any[] = [];
  private charts: Chart[] = [];

  public chartConfigs = [
    { 
      key: 'avg_TempCon', 
      label: 'Temp. Congelador (°C)',
      type: 'line' as const,
      borderColor: '#FF6384',
      backgroundColor: 'rgba(255, 99, 132, 0.2)'
    },
    { 
      key: 'avg_TempRef', 
      label: 'Temp. Refrigerador (°C)',
      type: 'line' as const,
      borderColor: '#36A2EB',
      backgroundColor: 'rgba(54, 162, 235, 0.2)'
    },
    { 
      key: 'avg_TempAmb', 
      label: 'Temp. Ambiente (°C)',
      type: 'line' as const,
      borderColor: '#FFCE56',
      backgroundColor: 'rgba(255, 206, 86, 0.2)'
    },
    { 
      key: 'avg_HumAmb', 
      label: 'Humedad (%)',
      type: 'bar' as const,
      borderColor: '#4BC0C0',
      backgroundColor: 'rgba(75, 192, 192, 0.2)'
    },
    { 
      key: 'avg_EnerCon', 
      label: 'Energía (kWh)',
      type: 'line' as const,
      borderColor: '#9966FF',
      backgroundColor: 'rgba(153, 102, 255, 0.2)'
    },
    { 
      key: 'count_aperturas_con', 
      label: 'Aperturas Cong.',
      type: 'bar' as const,
      borderColor: '#FF9F40',
      backgroundColor: 'rgba(255, 159, 64, 0.2)'
    },
    { 
      key: 'count_aperturas_ref', 
      label: 'Aperturas Ref.',
      type: 'bar' as const,
      borderColor: '#47CC47',
      backgroundColor: 'rgba(71, 204, 71, 0.2)'
    }
  ];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadDevices();
  }

  private loadDevices(): void {
    this.dataService.getDispositivos().subscribe({
      next: (list: Device[]) => {
        this.dispositivos = list;
        const defaultDevice = list.find(d => d.status === 'online') || list[0];
        this.selectedDeviceId = defaultDevice?.id;
        if (this.selectedDeviceId) this.cargarDatos();
      },
      error: (err) => console.error('Error cargando dispositivos:', err)
    });
  }

  cargarDatos(): void {
    if (!this.selectedDeviceId || !this.selectedInterval) return;

    this.dataService.getEstadisticas(this.selectedDeviceId, this.selectedInterval)
      .subscribe({
        next: (data) => this.handleChartData(data),
        error: (err) => this.handleChartError(err)
      });
  }

  private handleChartData(data: any[]): void {
    this.datos = data;
    this.destroyExistingCharts();
    this.renderCharts(data);
  }

  private handleChartError(err: Error): void {
    console.error('Error al cargar estadísticas:', err.message);
    this.datos = [];
    this.destroyExistingCharts();
  }

  private destroyExistingCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  private formatXAxisLabels(labels: string[]): string[] {
    return labels.map(label => {
      const date = new Date(label);
      
      if (this.selectedInterval === '8h') {
        return date.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      
      if (this.selectedInterval === '7d') {
        return date.toLocaleDateString('es-ES', {
          weekday: 'long'
        }).replace(/(^\w{1})|(\s+\w{1})/g, letra => letra.toUpperCase());
      }

      return label;
    });
  }

  private renderCharts(datos: any[]): void {
    if (!datos.length) return;

    const rawLabels = datos.map(r => r.hora_bloque || r.dia);
    const formattedLabels = this.formatXAxisLabels(rawLabels);

    setTimeout(() => {
      this.chartConfigs.forEach(config => {
        const canvas = document.getElementById(`chart-${config.key}`) as HTMLCanvasElement;
        if (canvas) {
          const existingChart = this.charts.find(ch => ch.canvas === canvas);
          existingChart?.destroy();
          
          const newChart = this.createChart(canvas, formattedLabels, config, datos);
          this.charts.push(newChart);
        }
      });
    }, 100);
  }

  private createChart(canvas: HTMLCanvasElement, labels: string[], config: any, data: any[]): Chart {
    return new Chart(canvas, {
      type: config.type,
      data: {
        labels,
        datasets: [{
          label: config.label,
          data: data.map(r => r[config.key]),
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor,
          borderWidth: 2,
          tension: 0.4,
          fill: config.type === 'line',
          pointRadius: config.type === 'line' ? 3 : 0,
          borderJoinStyle: 'round',
          cubicInterpolationMode: 'monotone'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false,
          axis: 'x'
        },
        scales: {
          y: {
            type: 'linear',
            beginAtZero: true,
            ticks: {
              color: '#333',
              font: { weight: '500' }
            },
            grid: {
              color: '#eee',
              drawTicks: false
            },
            border: {
              color: '#ddd'
            }
          },
          x: {
            type: 'category',
            ticks: {
              callback: (value: string | number, index: number) => labels[index] || '',
              color: '#333',
              font: { 
                weight: '500',
                size: 12
              },
              maxRotation: 45,
              minRotation: 45
            },
            grid: { display: false },
            border: { color: '#ddd' }
          }
        },
        plugins: {
        tooltip: {
        enabled: true,
        mode: 'index',
        callbacks: {
          title: (items: any[]) => items[0]?.label || '', 
          label: (context: any) => {                       
            const label = context.dataset.label || '';
            const value = context.parsed.y ?? context.raw;
            return `${label}: ${Number(value).toFixed(2)}`; // toFixed con F mayúscula
          }
        },
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 4,
            displayColors: false
          }
        }
      }
    });
  }
}