/**
 * Избор на топлинска пумпа: капацитет при проектна надворешна температура,
 * бивалентна точка, потребен дополнителен греач и препорака по бренд.
 */
import { BRANDS } from './catalog';
import type { Brand, HeatPumpModel, SystemParams } from './types';

/** Корекција на капацитет за температура на напојување (типично ≈ −0.7 %/K над W35). */
export function flowTempFactor(flowTemp: number): number {
  return Math.max(0.6, 1 - 0.007 * Math.max(0, flowTemp - 35));
}

/** Капацитет на пумпата [kW] при надворешна температура θ и напојување flowTemp. */
export function capacityAt(m: HeatPumpModel, theta: number, flowTemp: number): number {
  if (theta < m.minOutdoorTemp) return 0;
  const pts: [number, number][] = [
    [-15, m.capAm15],
    [-7, m.capAm7],
    [2, m.capA2],
    [7, m.capA7],
  ];
  let cap: number;
  if (theta <= pts[0][0]) {
    const [[x0, y0], [x1, y1]] = [pts[0], pts[1]];
    cap = y0 + ((y1 - y0) / (x1 - x0)) * (theta - x0);
  } else if (theta >= pts[3][0]) {
    cap = pts[3][1];
  } else {
    let i = 0;
    while (theta > pts[i + 1][0]) i++;
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    cap = y0 + ((y1 - y0) / (x1 - x0)) * (theta - x0);
  }
  return Math.max(0, cap) * flowTempFactor(flowTemp);
}

/** SCOP интерполиран според температурата на напојување. */
export function scopAt(m: HeatPumpModel, flowTemp: number): number {
  const t = Math.min(1, Math.max(0, (flowTemp - 35) / 20));
  return m.scop35 + (m.scop55 - m.scop35) * t;
}

export interface ModelEvaluation {
  model: HeatPumpModel;
  /** Капацитет при θ_e [kW] */
  capAtDesign: number;
  /** Покриеност на потребната моќност при θ_e [%] */
  coverage: number;
  /** Бивалентна точка [°C] или null ако е моновалентен */
  bivalentPoint: number | null;
  /** Потребен дополнителен греач при θ_e [kW] */
  backupKw: number;
  monovalent: boolean;
  scop: number;
  suitable: boolean;
  issues: string[];
  oversized: boolean;
}

/**
 * @param requiredKw потребна моќност при θ_e [kW]
 * @param thetaRef референтна внатрешна температура за линијата на оптоварување
 */
export function evaluateModel(
  m: HeatPumpModel,
  requiredKw: number,
  thetaE: number,
  thetaRef: number,
  sys: SystemParams,
): ModelEvaluation {
  const issues: string[] = [];
  if (sys.flowTemp > m.maxFlowTemp) issues.push(`Макс. напојување ${m.maxFlowTemp} °C < ${sys.flowTemp} °C`);
  if (thetaE < m.minOutdoorTemp) issues.push(`Работен опсег до ${m.minOutdoorTemp} °C`);
  if (sys.phasePref !== 'any' && m.phase && m.phase !== sys.phasePref)
    issues.push(`Напојување ${m.phase === '1' ? 'монофазно' : 'трофазно'}`);

  const capAtDesign = capacityAt(m, thetaE, sys.flowTemp);
  const coverage = requiredKw > 0 ? (capAtDesign / requiredKw) * 100 : 0;
  const load = (theta: number) =>
    thetaRef - thetaE > 0 ? (requiredKw * (thetaRef - theta)) / (thetaRef - thetaE) : 0;

  let bivalentPoint: number | null = null;
  const monovalent = capAtDesign >= requiredKw;
  if (!monovalent && requiredKw > 0) {
    // g(θ) = капацитет − оптоварување; бараме нула помеѓу θ_e и θ_ref
    let lo = thetaE;
    let hi = thetaRef;
    const g = (t: number) => capacityAt(m, t, sys.flowTemp) - load(t);
    if (g(hi) > 0) {
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (g(mid) >= 0) hi = mid;
        else lo = mid;
      }
      bivalentPoint = hi;
    } else {
      bivalentPoint = thetaRef;
    }
  }
  const backupKw = Math.max(0, requiredKw - capAtDesign);
  const minCov = sys.minCoverage;
  const suitable = issues.length === 0 && coverage >= minCov;
  const oversized = coverage > 160;
  return {
    model: m,
    capAtDesign,
    coverage,
    bivalentPoint,
    backupKw,
    monovalent,
    scop: scopAt(m, sys.flowTemp),
    suitable,
    issues,
    oversized,
  };
}

export interface BrandRecommendation {
  brand: Brand;
  best: ModelEvaluation | null;
  /** Следна поголема големина (алтернатива) */
  next: ModelEvaluation | null;
  all: ModelEvaluation[];
  /** Нема модел што ја покрива минималната покриеност */
  insufficient: boolean;
}

export function recommend(
  catalog: HeatPumpModel[],
  requiredKw: number,
  thetaE: number,
  thetaRef: number,
  sys: SystemParams,
): BrandRecommendation[] {
  return BRANDS.map((brand) => {
    const all = catalog
      .filter((m) => m.brand === brand)
      .map((m) => evaluateModel(m, requiredKw, thetaE, thetaRef, sys))
      .sort((a, b) => a.capAtDesign - b.capAtDesign || a.model.capA7 - b.model.capA7);
    const compatible = all.filter((e) => e.issues.length === 0);
    const idx = compatible.findIndex((e) => e.suitable);
    if (idx >= 0) {
      return { brand, best: compatible[idx], next: compatible[idx + 1] ?? null, all, insufficient: false };
    }
    const largest = compatible[compatible.length - 1] ?? null;
    return { brand, best: largest, next: null, all, insufficient: true };
  });
}
