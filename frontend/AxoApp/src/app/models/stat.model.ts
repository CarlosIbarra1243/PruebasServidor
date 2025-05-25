// src/app/models/stat.model.ts
export interface Stat {
  hora_bloque?: string;
  dia?: string;
  avg_TempCon: number;
  avg_TempRef: number;
  avg_TempAmb: number;
  avg_HumAmb: number;
  avg_EnerCon: number;
  count_aperturas_con: number;
  count_aperturas_ref: number;
}
