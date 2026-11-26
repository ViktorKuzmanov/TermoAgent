import type { Breakdown } from './en12831';
import type {
  Boundary,
  Climate,
  ElementKind,
  EmitterType,
  FloorType,
  InsulationPreset,
  RoofType,
  RoomTypeId,
  Shape,
  Shielding,
} from './types';

/**
 * Климатски податоци за градови во Р. С. Македонија.
 * ВНИМАНИЕ: ориентациски вредности. Пред употреба во проекти проверете ги
 * со важечкиот правилник / национален прилог. Може да се уредуваат во Поставки.
 */
export const DEFAULT_CLIMATES: Climate[] = [
  { id: 'skopje', name: 'Скопје', thetaE: -15, thetaMe: 12.5, hdd: 2600 },
  { id: 'kumanovo', name: 'Куманово', thetaE: -16, thetaMe: 11.8, hdd: 2800 },
  { id: 'tetovo', name: 'Тетово', thetaE: -16, thetaMe: 11.6, hdd: 2900 },
  { id: 'gostivar', name: 'Гостивар', thetaE: -18, thetaMe: 10.5, hdd: 3200 },
  { id: 'bitola', name: 'Битола', thetaE: -18, thetaMe: 11.0, hdd: 3100 },
  { id: 'prilep', name: 'Прилеп', thetaE: -18, thetaMe: 10.9, hdd: 3100 },
  { id: 'ohrid', name: 'Охрид', thetaE: -13, thetaMe: 11.4, hdd: 2900 },
  { id: 'struga', name: 'Струга', thetaE: -13, thetaMe: 11.3, hdd: 2950 },
  { id: 'resen', name: 'Ресен', thetaE: -16, thetaMe: 10.5, hdd: 3150 },
  { id: 'kicevo', name: 'Кичево', thetaE: -18, thetaMe: 10.0, hdd: 3300 },
  { id: 'debar', name: 'Дебар', thetaE: -14, thetaMe: 11.8, hdd: 2850 },
  { id: 'veles', name: 'Велес', thetaE: -14, thetaMe: 13.0, hdd: 2450 },
  { id: 'stip', name: 'Штип', thetaE: -15, thetaMe: 12.8, hdd: 2500 },
  { id: 'kocani', name: 'Кочани', thetaE: -15, thetaMe: 12.5, hdd: 2550 },
  { id: 'sv_nikole', name: 'Свети Николе', thetaE: -15, thetaMe: 12.0, hdd: 2700 },
  { id: 'strumica', name: 'Струмица', thetaE: -14, thetaMe: 12.5, hdd: 2500 },
  { id: 'radovis', name: 'Радовиш', thetaE: -15, thetaMe: 12.4, hdd: 2600 },
  { id: 'kavadarci', name: 'Кавадарци', thetaE: -13, thetaMe: 13.4, hdd: 2350 },
  { id: 'negotino', name: 'Неготино', thetaE: -12, thetaMe: 13.6, hdd: 2300 },
  { id: 'gevgelija', name: 'Гевгелија', thetaE: -10, thetaMe: 14.5, hdd: 2000 },
  { id: 'kratovo', name: 'Кратово', thetaE: -17, thetaMe: 10.5, hdd: 3200 },
  { id: 'kriva_palanka', name: 'Крива Паланка', thetaE: -18, thetaMe: 9.8, hdd: 3400 },
  { id: 'delcevo', name: 'Делчево', thetaE: -18, thetaMe: 9.6, hdd: 3400 },
  { id: 'berovo', name: 'Берово', thetaE: -20, thetaMe: 8.6, hdd: 3700 },
  { id: 'krusevo', name: 'Крушево', thetaE: -18, thetaMe: 8.5, hdd: 3800 },
  { id: 'mavrovo', name: 'Маврово', thetaE: -22, thetaMe: 6.0, hdd: 4500 },
];

export const INSULATION_PRESETS: InsulationPreset[] = [
  {
    id: 'none',
    label: 'Без изолација',
    description: 'Објект пред 1980, ѕид од тула без изолација, стари дрвени прозорци',
    uWall: 1.6,
    uWindow: 3.0,
    uDoor: 3.0,
    uRoof: 1.5,
    uFloor: 1.2,
    n50: 8,
  },
  {
    id: 'poor',
    label: 'Слаба изолација',
    description: 'Објект 1980–2000, 2–3 cm изолација, двојно стакло',
    uWall: 1.0,
    uWindow: 2.8,
    uDoor: 2.5,
    uRoof: 0.9,
    uFloor: 0.9,
    n50: 6,
  },
  {
    id: 'medium',
    label: 'Средна изолација',
    description: '5 cm стиропор/фасада, PVC/ALU прозорци со двослојно стакло',
    uWall: 0.6,
    uWindow: 1.8,
    uDoor: 2.0,
    uRoof: 0.5,
    uFloor: 0.6,
    n50: 4,
  },
  {
    id: 'good',
    label: 'Добра изолација',
    description: 'Нов објект, 8–10 cm фасада, Low-E стакло, изолиран покрив',
    uWall: 0.35,
    uWindow: 1.4,
    uDoor: 1.6,
    uRoof: 0.25,
    uFloor: 0.4,
    n50: 3,
  },
  {
    id: 'excellent',
    label: 'Нискоенергетски',
    description: '15+ cm фасада, трослојно стакло, херметичен објект',
    uWall: 0.2,
    uWindow: 1.0,
    uDoor: 1.2,
    uRoof: 0.15,
    uFloor: 0.25,
    n50: 1.5,
  },
];

export const getInsulation = (id: string): InsulationPreset =>
  INSULATION_PRESETS.find((p) => p.id === id) ?? INSULATION_PRESETS[2];

export interface RoomTypePreset {
  id: RoomTypeId;
  label: string;
  thetaInt: number;
  nMin: number;
}

/** Внатрешни проектни температури и минимална размена на воздух (EN 12831-1, типични вредности). */
export const ROOM_TYPES: RoomTypePreset[] = [
  { id: 'living', label: 'Дневна соба', thetaInt: 20, nMin: 0.5 },
  { id: 'bedroom', label: 'Спална соба', thetaInt: 20, nMin: 0.5 },
  { id: 'kitchen', label: 'Кујна', thetaInt: 20, nMin: 1.5 },
  { id: 'bathroom', label: 'Бања', thetaInt: 24, nMin: 1.5 },
  { id: 'wc', label: 'WC', thetaInt: 20, nMin: 1.5 },
  { id: 'hall', label: 'Ходник', thetaInt: 18, nMin: 0.5 },
  { id: 'office', label: 'Канцеларија', thetaInt: 20, nMin: 1.0 },
  { id: 'staircase', label: 'Скалишта', thetaInt: 15, nMin: 0.5 },
  { id: 'other', label: 'Друго', thetaInt: 20, nMin: 0.5 },
];

export const getRoomType = (id: RoomTypeId): RoomTypePreset =>
  ROOM_TYPES.find((r) => r.id === id) ?? ROOM_TYPES[0];

export const ELEMENT_KINDS: { id: ElementKind; label: string }[] = [
  { id: 'wall', label: 'Ѕид' },
  { id: 'window', label: 'Прозорец' },
  { id: 'door', label: 'Врата' },
  { id: 'roof', label: 'Покрив / таван' },
  { id: 'floor', label: 'Под' },
];

export const BOUNDARIES: { id: Boundary; label: string }[] = [
  { id: 'exterior', label: 'Кон надвор' },
  { id: 'unheated', label: 'Кон негреан простор' },
  { id: 'ground', label: 'Кон тло' },
  { id: 'adjacent', label: 'Кон соседен простор (друга θ)' },
];

/** Фактори на намалување b_u за негреани простори (EN 12831-1, Анекс B – типични вредности). */
export const BU_PRESETS: { label: string; value: number }[] = [
  { label: 'Подрум без прозорци / надворешни врати', value: 0.5 },
  { label: 'Подрум со прозорци / надворешни врати', value: 0.8 },
  { label: 'Простор со 1 надворешен ѕид', value: 0.4 },
  { label: 'Простор со 2+ надворешни ѕида, без врати', value: 0.5 },
  { label: 'Простор со 2+ надворешни ѕида, со врати', value: 0.6 },
  { label: 'Простор со 3 надворешни ѕида', value: 0.8 },
  { label: 'Поткровје, добро проветрено (непокриен покрив)', value: 1.0 },
  { label: 'Поткровје, покрив со изолација/обвивка', value: 0.8 },
  { label: 'Затворено поткровје без изолација', value: 0.9 },
];

export const SHIELDING: { id: Shielding; label: string }[] = [
  { id: 'none', label: 'Без заштита (отворен терен, повисоки катови)' },
  { id: 'moderate', label: 'Умерена заштита (населено место)' },
  { id: 'heavy', label: 'Голема заштита (центар на град, шума)' },
];

/** Коефициент на заштита e (EN 12831:2003, Табела D.8) */
export const SHIELDING_E: Record<Shielding, { single: number; multi: number }> = {
  none: { single: 0.03, multi: 0.05 },
  moderate: { single: 0.02, multi: 0.03 },
  heavy: { single: 0.01, multi: 0.02 },
};

export const EMITTERS: { id: EmitterType; label: string; flowTemp: number }[] = [
  { id: 'floor', label: 'Подно греење', flowTemp: 35 },
  { id: 'fancoil', label: 'Фенкоилери', flowTemp: 45 },
  { id: 'radiators_lt', label: 'Нискотемпературни радијатори', flowTemp: 45 },
  { id: 'radiators', label: 'Класични радијатори', flowTemp: 55 },
];

export const FLOOR_TYPES: { id: FloorType; label: string }[] = [
  { id: 'ground', label: 'Под на тло' },
  { id: 'basement', label: 'Над негреан подрум/гаража' },
  { id: 'exterior', label: 'Над надворешен воздух (пасаж, конзола)' },
  { id: 'heated', label: 'Над греан простор (без загуби)' },
];

export const ROOF_TYPES: { id: RoofType; label: string }[] = [
  { id: 'cold_attic', label: 'Таван кон ладно поткровје' },
  { id: 'pitched_heated', label: 'Кос покрив над греано поткровје' },
  { id: 'flat', label: 'Рамен покрив' },
  { id: 'heated', label: 'Над греан простор (без загуби)' },
];

export const SHAPES: { id: Shape; label: string; ratio: number }[] = [
  { id: 'square', label: 'Компактна (≈ квадрат)', ratio: 1 },
  { id: 'rect', label: 'Правоаголна (1 : 1.5)', ratio: 1.5 },
  { id: 'elongated', label: 'Издолжена (1 : 2.5)', ratio: 2.5 },
];

export const OBJECT_TYPES = [
  'Семејна куќа',
  'Стан во зграда',
  'Двојна / низна куќа',
  'Деловен простор',
  'Викендица',
  'Друго',
];

export const BREAKDOWN_LABELS: Record<keyof Breakdown, string> = {
  wall: 'Ѕидови',
  window: 'Прозорци',
  door: 'Врати',
  roof: 'Покрив / таван',
  floor: 'Под',
  ventilation: 'Вентилација',
  reheat: 'Загревање по прекин',
};
