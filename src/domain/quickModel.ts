/**
 * Брз режим: од основни податоци за објектот (површина, катност, изолација)
 * се генерира поедноставена обвивка како една зона, која потоа оди низ
 * истата EN 12831 пресметка.
 */
import { getInsulation, SHAPES } from './presets';
import type { BuildingElement, BuildingParams, QuickInput, Room } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Додаток на височина за меѓукатна конструкција [m] */
const SLAB_THICKNESS = 0.3;
const DOOR_AREA = 2.1;

export interface QuickGeometry {
  footprint: number;
  width: number;
  length: number;
  perimeter: number;
  wallGross: number;
  windowArea: number;
  doorArea: number;
  wallNet: number;
}

export function quickGeometry(q: QuickInput): QuickGeometry {
  const floors = Math.max(1, Math.round(q.floors));
  const footprint = Math.max(0, q.area) / floors;
  const ratio = SHAPES.find((s) => s.id === q.shape)?.ratio ?? 1;
  const width = Math.sqrt(footprint / ratio);
  const length = width * ratio;
  const share = Math.min(100, Math.max(0, q.exteriorWallShare)) / 100;
  const perimeter = 2 * (width + length) * share;
  const wallGross = perimeter * (q.storeyHeight + SLAB_THICKNESS) * floors;
  const windowArea = (Math.max(0, q.area) * Math.max(0, q.windowRatio)) / 100;
  const doorArea = Math.max(0, q.doors) * DOOR_AREA;
  const wallNet = Math.max(0, wallGross - windowArea - doorArea);
  return { footprint, width, length, perimeter, wallGross, windowArea, doorArea, wallNet };
}

export function quickRooms(q: QuickInput): Room[] {
  const ins = getInsulation(q.insulation);
  const g = quickGeometry(q);
  const els: BuildingElement[] = [
    { id: 'q-wall', kind: 'wall', boundary: 'exterior', label: 'Надворешни ѕидови', area: g.wallNet, u: ins.uWall },
    { id: 'q-win', kind: 'window', boundary: 'exterior', label: 'Прозорци и балконски врати', area: g.windowArea, u: ins.uWindow },
  ];
  if (g.doorArea > 0)
    els.push({ id: 'q-door', kind: 'door', boundary: 'exterior', label: 'Влезна врата', area: g.doorArea, u: ins.uDoor });

  switch (q.roofType) {
    case 'flat':
      els.push({ id: 'q-roof', kind: 'roof', boundary: 'exterior', label: 'Рамен покрив', area: g.footprint, u: ins.uRoof });
      break;
    case 'pitched_heated':
      els.push({ id: 'q-roof', kind: 'roof', boundary: 'exterior', label: 'Кос покрив (греано поткровје)', area: g.footprint * 1.2, u: ins.uRoof });
      break;
    case 'cold_attic':
      els.push({ id: 'q-roof', kind: 'roof', boundary: 'unheated', label: 'Таван кон ладно поткровје', area: g.footprint, u: ins.uRoof, bu: 0.9 });
      break;
    case 'heated':
      break;
  }

  switch (q.floorType) {
    case 'ground':
      els.push({ id: 'q-floor', kind: 'floor', boundary: 'ground', label: 'Под на тло', area: g.footprint, u: ins.uFloor });
      break;
    case 'basement':
      els.push({ id: 'q-floor', kind: 'floor', boundary: 'unheated', label: 'Под над негреан подрум', area: g.footprint, u: ins.uFloor, bu: 0.5 });
      break;
    case 'exterior':
      els.push({ id: 'q-floor', kind: 'floor', boundary: 'exterior', label: 'Под над надворешен воздух', area: g.footprint, u: ins.uFloor });
      break;
    case 'heated':
      break;
  }

  return [
    {
      id: 'quick',
      name: 'Цел објект',
      type: 'living',
      area: Math.max(0, q.area),
      height: q.storeyHeight,
      thetaInt: q.thetaInt,
      nMin: 0.5,
      elements: els,
    },
  ];
}

/** Во брз режим површината и периметарот за тло се изведуваат од геометријата. */
export function quickBuildingParams(q: QuickInput, b: BuildingParams): BuildingParams {
  const g = quickGeometry(q);
  return { ...b, groundArea: g.footprint, exposedPerimeter: g.perimeter };
}

/** Претвора брз модел во простории за детален режим (почетна точка за уредување). */
export function quickToDetailed(q: QuickInput): Room[] {
  return quickRooms(q).map((r) => ({
    ...r,
    id: uid(),
    name: 'Објект (од брз режим)',
    elements: r.elements.map((e) => ({ ...e, id: uid(), area: Math.round(e.area * 100) / 100 })),
  }));
}
