/**
 * Дијаграм капацитет на пумпа vs. топлинско оптоварување (SVG string),
 * се користи и во апликацијата и во Word документот (конвертиран во PNG).
 */
import { capacityAt } from '../domain/selection';
import type { HeatPumpModel } from '../domain/types';

export interface ChartInput {
  model: HeatPumpModel;
  requiredKw: number;
  thetaE: number;
  thetaRef: number;
  flowTemp: number;
  bivalentPoint: number | null;
}

export const CHART_W = 640;
export const CHART_H = 300;

export function capacityChartSvg(c: ChartInput): string {
  const W = CHART_W;
  const H = CHART_H;
  const m = { l: 48, r: 16, t: 16, b: 40 };
  const xMin = Math.min(-20, Math.floor(c.thetaE - 3));
  const xMax = 16;
  const load = (t: number) => Math.max(0, (c.requiredKw * (c.thetaRef - t)) / Math.max(1, c.thetaRef - c.thetaE));
  const caps: [number, number][] = [];
  for (let t = Math.max(xMin, c.model.minOutdoorTemp); t <= xMax; t += 0.5) caps.push([t, capacityAt(c.model, t, c.flowTemp)]);
  const yMaxRaw = Math.max(load(xMin), ...caps.map((p) => p[1]), 1);
  const step = yMaxRaw > 20 ? 5 : yMaxRaw > 8 ? 2 : 1;
  const yMax = Math.ceil((yMaxRaw * 1.08) / step) * step;
  const X = (t: number) => m.l + ((t - xMin) / (xMax - xMin)) * (W - m.l - m.r);
  const Y = (v: number) => H - m.b - (v / yMax) * (H - m.t - m.b);

  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  // мрежа
  for (let v = 0; v <= yMax; v += step) {
    parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e8ee" stroke-width="1"/>`);
    parts.push(`<text x="${m.l - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="#5b6773">${v}</text>`);
  }
  for (let t = Math.ceil(xMin / 5) * 5; t <= xMax; t += 5) {
    parts.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${H - m.b}" stroke="#eef1f5" stroke-width="1"/>`);
    parts.push(`<text x="${X(t)}" y="${H - m.b + 16}" font-size="11" text-anchor="middle" fill="#5b6773">${t}</text>`);
  }
  parts.push(`<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" font-size="11" text-anchor="middle" fill="#5b6773">Надворешна температура [°C]</text>`);
  parts.push(`<text x="12" y="${(m.t + H - m.b) / 2}" font-size="11" text-anchor="middle" fill="#5b6773" transform="rotate(-90 12 ${(m.t + H - m.b) / 2})">kW</text>`);

  // проектна температура
  parts.push(`<line x1="${X(c.thetaE)}" x2="${X(c.thetaE)}" y1="${m.t}" y2="${H - m.b}" stroke="#9aa5b1" stroke-dasharray="4 4"/>`);
  parts.push(`<text x="${X(c.thetaE) + 4}" y="${m.t + 12}" font-size="11" fill="#5b6773">θe = ${c.thetaE} °C</text>`);

  // недостиг (backup) – засенчено
  const deficit: string[] = [];
  for (const [t, cap] of caps) if (load(t) > cap && t <= c.thetaRef) deficit.push(`${X(t)},${Y(cap)}`);
  if (deficit.length > 1) {
    const rev: string[] = [];
    for (let i = caps.length - 1; i >= 0; i--) {
      const [t, cap] = caps[i];
      if (load(t) > cap && t <= c.thetaRef) rev.push(`${X(t)},${Y(load(t))}`);
    }
    parts.push(`<polygon points="${[...deficit, ...rev].join(' ')}" fill="#f28c28" fill-opacity="0.18"/>`);
  }

  // оптоварување
  parts.push(
    `<line x1="${X(xMin)}" y1="${Y(load(xMin))}" x2="${X(Math.min(xMax, c.thetaRef))}" y2="${Y(load(Math.min(xMax, c.thetaRef)))}" stroke="#c0392b" stroke-width="2.5"/>`,
  );
  // капацитет
  parts.push(
    `<polyline points="${caps.map(([t, v]) => `${X(t)},${Y(v)}`).join(' ')}" fill="none" stroke="#0b3a66" stroke-width="2.5"/>`,
  );

  if (c.bivalentPoint !== null && c.bivalentPoint > xMin && c.bivalentPoint < xMax) {
    const bp = c.bivalentPoint;
    parts.push(`<circle cx="${X(bp)}" cy="${Y(load(bp))}" r="5" fill="#f28c28" stroke="#fff" stroke-width="2"/>`);
    parts.push(
      `<text x="${X(bp) + 8}" y="${Y(load(bp)) - 8}" font-size="11" font-weight="600" fill="#a65c12">Бивалентна точка ${bp.toFixed(1)} °C</text>`,
    );
  }

  // легенда
  const lx = W - m.r - 230;
  parts.push(`<rect x="${lx}" y="${m.t}" width="230" height="44" rx="4" fill="#ffffff" stroke="#e3e8ee"/>`);
  parts.push(`<line x1="${lx + 10}" x2="${lx + 34}" y1="${m.t + 15}" y2="${m.t + 15}" stroke="#0b3a66" stroke-width="2.5"/>`);
  parts.push(`<text x="${lx + 40}" y="${m.t + 19}" font-size="11" fill="#1d2833">Капацитет ${c.model.model} (W${c.flowTemp})</text>`);
  parts.push(`<line x1="${lx + 10}" x2="${lx + 34}" y1="${m.t + 32}" y2="${m.t + 32}" stroke="#c0392b" stroke-width="2.5"/>`);
  parts.push(`<text x="${lx + 40}" y="${m.t + 36}" font-size="11" fill="#1d2833">Потребна моќност на објектот</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">${parts.join('')}</svg>`;
}

/** Конвертира SVG во PNG (за вметнување во Word). */
export async function svgToPng(svg: string, scale = 2): Promise<Uint8Array> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('SVG не може да се вчита'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = CHART_W * scale;
    canvas.height = CHART_H * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, CHART_W, CHART_H);
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG'))), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
