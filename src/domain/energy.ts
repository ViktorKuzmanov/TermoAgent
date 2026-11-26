/**
 * Ориентациска проценка на годишна потрошувачка и трошоци (метод на степен-денови).
 * Не е дел од EN 12831 – служи за споредба во понудата.
 */
import type { Settings } from './types';

export interface EnergyEstimate {
  /** Годишна потреба од топлина за греење [kWh] */
  heatingKwh: number;
  /** Годишна потреба за ТСВ [kWh] */
  dhwKwh: number;
  totalKwh: number;
  scop: number;
  /** Потрошена струја од топлинската пумпа [kWh] */
  hpElectricKwh: number;
  options: { label: string; consumption: string; cost: number }[];
  /** Годишна заштеда во однос на нафта */
  savingVsOil: number;
}

const OIL_KWH_PER_L = 10.0;
const OIL_EFF = 0.88;
const PELLET_KWH_PER_KG = 4.8;
const PELLET_EFF = 0.85;
/** Огревно дрво (бука, суво) ≈ 1 400 kWh/m³ (просторен метар) */
const WOOD_KWH_PER_M3 = 1400;
const WOOD_EFF = 0.65;

export function estimateEnergy(
  hTotal: number,
  hdd: number,
  dhwEnabled: boolean,
  persons: number,
  scop: number,
  s: Settings,
): EnergyEstimate {
  const heatingKwh = (hTotal * hdd * 24 * s.gainFactor) / 1000;
  // 1.163 Wh/(l·K), загревање од 10 на 45 °C (ΔT = 35 K)
  const dhwKwh = dhwEnabled ? (persons * s.dhwLitersPerPerson * 365 * 1.163 * 35) / 1000 : 0;
  const totalKwh = heatingKwh + dhwKwh;
  const safeScop = scop > 0 ? scop : 1;
  const hpElectricKwh = totalKwh / safeScop;
  const p = s.energyPrices;
  const oilL = totalKwh / (OIL_KWH_PER_L * OIL_EFF);
  const pelletKg = totalKwh / (PELLET_KWH_PER_KG * PELLET_EFF);
  const woodM3 = totalKwh / (WOOD_KWH_PER_M3 * WOOD_EFF);
  const fmt = (x: number) => Math.round(x).toLocaleString('mk-MK');
  const options = [
    { label: `Топлинска пумпа (SCOP ${safeScop.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, consumption: `${fmt(hpElectricKwh)} kWh струја`, cost: hpElectricKwh * p.electricity },
    { label: 'Електричен котел / греалки', consumption: `${fmt(totalKwh)} kWh струја`, cost: totalKwh * p.electricity },
    { label: 'Котел на нафта', consumption: `${fmt(oilL)} l`, cost: oilL * p.oil },
    { label: 'Котел на пелети', consumption: `${fmt(pelletKg)} kg`, cost: pelletKg * p.pellets },
    { label: 'Котел на дрва', consumption: `${woodM3.toLocaleString('mk-MK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`, cost: woodM3 * p.wood },
  ];
  return {
    heatingKwh,
    dhwKwh,
    totalKwh,
    scop: safeScop,
    hpElectricKwh,
    options,
    savingVsOil: options[2].cost - options[0].cost,
  };
}
