// src/app/models/device.model.ts
export interface Device {
  id: number;
  nombre: string;
  status?: 'online' | 'offline' | string;
}

