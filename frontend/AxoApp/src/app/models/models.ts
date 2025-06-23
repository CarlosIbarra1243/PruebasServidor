export interface Device {
  id: number;
  nombre: string;
  modelo: string;
  api_key: string;
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