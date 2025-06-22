export interface Device {
  id: number;
  nombre: string;
}

export interface Alert {
  id: number;
  dispositivo_id: number;
  fecha: string;
  hora: string;
  tipo: string;
  descripcion: string;
  origen: string;
  estado: string;
}