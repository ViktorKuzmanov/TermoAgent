/**
 * Пресметка на проектно топлинско оптоварување според EN 12831-1
 * (поедноставен метод по простории).
 *
 *   Φ_HL,i = Φ_T,i + Φ_V,i + Φ_RH,i
 *   Φ_T,i  = (H_T,ie + H_T,iue + H_T,ig + H_T,ij) · (θ_int,i − θ_e)
 *   Φ_V,i  = 0.34 · V̇_i · (θ_int,i − θ_e)
 *   Φ_RH,i = A_i · f_RH
 *
 * Загубите кон тло се пресметуваат преку еквивалентен U според EN ISO 13370.
 */
import { SHIELDING_E } from './presets';
import type { BuildingElement, BuildingParams, ElementKind, Room } from './types';

/** Топлински капацитет на воздух ρ·c_p [Wh/m³K] */
export const AIR_HEAT_CAPACITY = 0.34;
/** Корекциски фактор за годишна варијација на температура (EN 12831) */
export const F_G1 = 1.45;
/** Топлинска спроводливост на тло (глина/тиња) [W/mK] */
export const LAMBDA_GROUND = 2.0;
const R_SI_FLOOR = 0.17;
const R_SE = 0.04;
/** Дебелина на надворешен ѕид за EN ISO 13370 [m] */
const WALL_THICKNESS = 0.3;

export interface ElementResult {
  element: BuildingElement;
  /** Коефициент на топлински загуби H [W/K] */
  h: number;
  /** Топлински загуби Φ [W] */
  phi: number;
  /** Ефективен U што е користен [W/m²K] */
  uEff: number;
}

export interface RoomResult {
  room: Room;
  volume: number;
  deltaT: number;
  elements: ElementResult[];
  hT: number;
  phiT: number;
  /** Проток на воздух [m³/h] */
  vFlow: number;
  vInf: number;
  vMin: number;
  phiV: number;
  phiRH: number;
  phiHL: number;
  /** Специфично оптоварување [W/m²] */
  specific: number;
}

export interface Breakdown {
  wall: number;
  window: number;
  door: number;
  roof: number;
  floor: number;
  ventilation: number;
  reheat: number;
}

export interface HeatLoadResult {
  rooms: RoomResult[];
  thetaE: number;
  thetaMe: number;
  area: number;
  volume: number;
  phiT: number;
  phiV: number;
  phiRH: number;
  /** Вкупно проектно топлинско оптоварување [W] */
  phiHL: number;
  specific: number;
  /** Вкупен H (трансмисија + вентилација) [W/K] */
  hTotal: number;
  /** Пондерирана внатрешна температура [°C] */
  thetaIntAvg: number;
  breakdown: Breakdown;
  bPrime: number;
}

/** Карактеристична димензија на подот B' = A_g / (0.5 · P) */
export function characteristicDimension(groundArea: number, perimeter: number): number {
  if (groundArea <= 0) return 0;
  if (perimeter <= 0) return 1000;
  return groundArea / (0.5 * perimeter);
}

/**
 * Еквивалентен U на под на тло (EN ISO 13370, плоча на тло).
 * @param uFloor U на подната конструкција без тлото [W/m²K]
 */
export function groundUequiv(uFloor: number, bPrime: number): number {
  if (uFloor <= 0 || bPrime <= 0) return 0;
  const rf = Math.max(0, 1 / uFloor - R_SI_FLOOR - R_SE);
  const dt = WALL_THICKNESS + LAMBDA_GROUND * (R_SI_FLOOR + rf + R_SE);
  if (dt < bPrime) {
    return ((2 * LAMBDA_GROUND) / (Math.PI * bPrime + dt)) * Math.log((Math.PI * bPrime) / dt + 1);
  }
  return LAMBDA_GROUND / (0.457 * bPrime + dt);
}

export function elementLoss(
  el: BuildingElement,
  thetaInt: number,
  thetaE: number,
  thetaMe: number,
  b: BuildingParams,
  bPrime: number,
): ElementResult {
  const dT = thetaInt - thetaE;
  const area = Math.max(0, el.area || 0);
  const u = Math.max(0, el.u || 0);
  let h = 0;
  let uEff = u;
  switch (el.boundary) {
    case 'exterior':
      uEff = u + b.deltaUtb;
      h = area * uEff;
      break;
    case 'unheated': {
      const bu = el.bu ?? 0.5;
      uEff = (u + b.deltaUtb) * bu;
      h = area * uEff;
      break;
    }
    case 'ground': {
      const fg2 = dT > 0 ? Math.max(0, (thetaInt - thetaMe) / dT) : 0;
      const gw = b.groundwaterShallow ? 1.15 : 1.0;
      const ueq = groundUequiv(u, bPrime);
      uEff = F_G1 * fg2 * ueq * gw;
      h = area * uEff;
      break;
    }
    case 'adjacent': {
      const tAdj = el.thetaAdj ?? thetaInt;
      const f = dT > 0 ? (thetaInt - tAdj) / dT : 0;
      uEff = u * f;
      h = area * uEff;
      break;
    }
  }
  return { element: el, h, phi: h * dT, uEff };
}

export function roomLoad(
  room: Room,
  thetaE: number,
  thetaMe: number,
  b: BuildingParams,
  bPrime: number,
): RoomResult {
  const deltaT = room.thetaInt - thetaE;
  const elements = room.elements.map((el) => elementLoss(el, room.thetaInt, thetaE, thetaMe, b, bPrime));
  const hT = elements.reduce((s, e) => s + e.h, 0);
  const phiT = hT * deltaT;

  const volume = Math.max(0, room.area) * Math.max(0, room.height);
  const openings = room.elements.filter(
    (e) => e.boundary === 'exterior' && (e.kind === 'window' || e.kind === 'door') && e.area > 0,
  ).length;
  const eTable = SHIELDING_E[b.shielding];
  const e = openings === 0 ? 0 : openings === 1 ? eTable.single : eTable.multi;
  const epsilon = 1.0;
  const vInf = 2 * volume * b.n50 * e * epsilon;
  const vMin = room.nMin * volume;
  const vFlow =
    b.ventilation === 'mvhr' ? vInf + vMin * (1 - clamp(b.mvhrEfficiency, 0, 0.95)) : Math.max(vInf, vMin);
  const phiV = AIR_HEAT_CAPACITY * vFlow * deltaT;
  const phiRH = Math.max(0, room.area) * Math.max(0, b.reheat);
  const phiHL = phiT + phiV + phiRH;
  return {
    room,
    volume,
    deltaT,
    elements,
    hT,
    phiT,
    vFlow,
    vInf,
    vMin,
    phiV,
    phiRH,
    phiHL,
    specific: room.area > 0 ? phiHL / room.area : 0,
  };
}

export function buildingLoad(
  rooms: Room[],
  thetaE: number,
  thetaMe: number,
  b: BuildingParams,
): HeatLoadResult {
  // Ако A_g / P не се внесени, се проценуваат од елементите кон тло (квадратна основа).
  const groundSum = sum(rooms.flatMap((r) => r.elements.filter((e) => e.boundary === 'ground' && e.kind === 'floor').map((e) => e.area)));
  const ag = b.groundArea > 0 ? b.groundArea : groundSum;
  const perim = b.exposedPerimeter > 0 ? b.exposedPerimeter : 4 * Math.sqrt(ag);
  const bPrime = characteristicDimension(ag, perim);
  const results = rooms.map((r) => roomLoad(r, thetaE, thetaMe, b, bPrime));
  const area = sum(results.map((r) => r.room.area));
  const volume = sum(results.map((r) => r.volume));
  const phiT = sum(results.map((r) => r.phiT));
  const phiV = sum(results.map((r) => r.phiV));
  const phiRH = sum(results.map((r) => r.phiRH));
  const phiHL = phiT + phiV + phiRH;
  const thetaIntAvg =
    area > 0 ? sum(results.map((r) => r.room.thetaInt * r.room.area)) / area : 20;
  const dT = thetaIntAvg - thetaE;
  const hTotal = dT > 0 ? (phiT + phiV) / dT : 0;

  const breakdown: Breakdown = { wall: 0, window: 0, door: 0, roof: 0, floor: 0, ventilation: phiV, reheat: phiRH };
  for (const r of results) for (const e of r.elements) breakdown[e.element.kind as ElementKind] += e.phi;

  return {
    rooms: results,
    thetaE,
    thetaMe,
    area,
    volume,
    phiT,
    phiV,
    phiRH,
    phiHL,
    specific: area > 0 ? phiHL / area : 0,
    hTotal,
    thetaIntAvg,
    breakdown,
    bPrime,
  };
}

export const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
