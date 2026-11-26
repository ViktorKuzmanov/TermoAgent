/**
 * Склопување на целата пресметка за еден проект + стандардни вредности.
 */
import { DEFAULT_CATALOG } from './catalog';
import { buildingLoad, type HeatLoadResult } from './en12831';
import { estimateEnergy, type EnergyEstimate } from './energy';
import { DEFAULT_CLIMATES, getInsulation } from './presets';
import { quickBuildingParams, quickRooms, uid } from './quickModel';
import { evaluateModel, recommend, type BrandRecommendation, type ModelEvaluation } from './selection';
import type { BuildingParams, Climate, HeatPumpModel, LineItem, Project, Room, Settings } from './types';

export function defaultSettings(): Settings {
  return {
    company: {
      name: 'Енерго Систем',
      address: 'Булевар Србија бр. 2, 1000 Скопје',
      phone: '+389 2 2770 790 · +389 2 2700 602',
      email: 'office@energosistem.com.mk',
      web: 'www.energosistem.com.mk',
      taxId: '',
      bankAccount: '',
      logoDataUrl: null,
    },
    defaultEngineer: '',
    currency: 'ден.',
    vatPct: 18,
    paymentTerms: '50% аванс при нарачка, 50% по завршена монтажа и пуштање во работа.',
    deliveryTerms: 'Испорака и монтажа до 15 работни дена од уплата на аванс, во зависност од залиха.',
    warrantyTerms:
      'Гаранција според условите на производителот, со овластен сервис на Енерго Систем. Гаранција за изведени работи: 2 години.',
    installationPrice: 0,
    hydraulicKitPrice: 0,
    electricalPrice: 0,
    energyPrices: { electricity: 7.5, oil: 85, pellets: 18, wood: 4500 },
    gainFactor: 0.8,
    dhwKwPerPerson: 0.25,
    dhwLitersPerPerson: 50,
    catalog: DEFAULT_CATALOG,
    climates: DEFAULT_CLIMATES,
    offerCounter: 1,
  };
}

export function defaultBuilding(): BuildingParams {
  return {
    n50: getInsulation('medium').n50,
    shielding: 'moderate',
    ventilation: 'natural',
    mvhrEfficiency: 0.8,
    deltaUtb: 0.1,
    reheat: 0,
    groundArea: 0,
    exposedPerimeter: 0,
    groundwaterShallow: false,
  };
}

export function newProject(s: Settings): Project {
  const now = new Date();
  const year = now.getFullYear();
  return {
    id: uid(),
    name: 'Нов проект',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    client: { name: '', contactPerson: '', address: '', phone: '', email: '' },
    site: { address: '', climateId: 'skopje', thetaEOverride: null, objectType: 'Семејна куќа' },
    mode: 'quick',
    quick: {
      area: 120,
      floors: 1,
      storeyHeight: 2.7,
      shape: 'rect',
      windowRatio: 15,
      insulation: 'medium',
      exteriorWallShare: 100,
      floorType: 'ground',
      roofType: 'cold_attic',
      thetaInt: 20,
      doors: 1,
    },
    rooms: [],
    building: defaultBuilding(),
    system: {
      emitter: 'floor',
      flowTemp: 35,
      dhwEnabled: true,
      persons: 4,
      dhwAddToLoad: true,
      phasePref: 'any',
      minCoverage: 100,
    },
    selectedModelId: null,
    offer: {
      number: `${String(s.offerCounter).padStart(3, '0')}/${year}`,
      date: now.toISOString().slice(0, 10),
      validityDays: 15,
      subject: 'Понуда за систем за греење со топлинска пумпа',
      intro:
        'Почитувани, врз основа на доставените податоци за објектот и извршената пресметка на топлинско оптоварување според EN 12831-1, Ви ја доставуваме следната понуда за систем за греење со топлинска пумпа воздух–вода.',
      items: [],
      discountPct: 0,
      includeAnnex: true,
      includeAlternatives: true,
      includeEnergy: true,
      notes: '',
      engineer: s.defaultEngineer,
    },
  };
}

export interface ProjectComputation {
  climate: Climate;
  thetaE: number;
  rooms: Room[];
  building: BuildingParams;
  load: HeatLoadResult;
  /** Додаток за ТСВ [kW] */
  dhwKw: number;
  /** Потребна моќност при θ_e [kW] */
  requiredKw: number;
  recommendations: BrandRecommendation[];
  selected: ModelEvaluation | null;
  energy: EnergyEstimate | null;
}

export function getClimate(s: Settings, id: string): Climate {
  return s.climates.find((c) => c.id === id) ?? s.climates[0] ?? DEFAULT_CLIMATES[0];
}

export function computeProject(p: Project, s: Settings): ProjectComputation {
  const climate = getClimate(s, p.site.climateId);
  const thetaE = p.site.thetaEOverride ?? climate.thetaE;
  const rooms = p.mode === 'quick' ? quickRooms(p.quick) : p.rooms;
  const building = p.mode === 'quick' ? quickBuildingParams(p.quick, p.building) : p.building;
  const load = buildingLoad(rooms, thetaE, climate.thetaMe, building);
  const dhwKw = p.system.dhwEnabled && p.system.dhwAddToLoad ? p.system.persons * s.dhwKwPerPerson : 0;
  const requiredKw = load.phiHL / 1000 + dhwKw;
  const recommendations = recommend(s.catalog, requiredKw, thetaE, load.thetaIntAvg, p.system);
  const model = s.catalog.find((m) => m.id === p.selectedModelId);
  const selected = model ? evaluateModel(model, requiredKw, thetaE, load.thetaIntAvg, p.system) : null;
  const energy = selected
    ? estimateEnergy(load.hTotal, climate.hdd, p.system.dhwEnabled, p.system.persons, selected.scop, s)
    : null;
  return { climate, thetaE, rooms, building, load, dhwKw, requiredKw, recommendations, selected, energy };
}

/** Генерира ставки за понудата од избраниот модел. */
export function buildLineItems(model: HeatPumpModel, p: Project, s: Settings, ev: ModelEvaluation | null): LineItem[] {
  const items: LineItem[] = [
    {
      id: uid(),
      description: `Топлинска пумпа воздух–вода ${model.brand} ${model.series}, модел ${model.model}, ${model.capA7.toFixed(1)} kW (A7/W35), ${model.refrigerant}`,
      unit: 'компл.',
      qty: 1,
      unitPrice: model.price ?? 0,
    },
  ];
  if (model.indoorUnit)
    items.push({ id: uid(), description: model.indoorUnit, unit: 'ком.', qty: 1, unitPrice: model.indoorUnitPrice ?? 0 });
  if (p.system.dhwEnabled && model.tank)
    items.push({ id: uid(), description: `Бојлер за санитарна топла вода – ${model.tank}`, unit: 'ком.', qty: 1, unitPrice: model.tankPrice ?? 0 });
  if (ev && ev.backupKw > 0.2)
    items.push({
      id: uid(),
      description: `Дополнителен електричен греач (бивалентен режим) ≈ ${Math.ceil(ev.backupKw)} kW`,
      unit: 'ком.',
      qty: 1,
      unitPrice: 0,
    });
  items.push(
    {
      id: uid(),
      description: 'Хидрауличен прибор: бафер резервоар, експанзиона сад, вентили, филтер, изолирани цевки',
      unit: 'компл.',
      qty: 1,
      unitPrice: s.hydraulicKitPrice,
    },
    { id: uid(), description: 'Електрично поврзување и управување', unit: 'компл.', qty: 1, unitPrice: s.electricalPrice },
    { id: uid(), description: 'Монтажа, полнење, пуштање во работа и обука на корисникот', unit: 'компл.', qty: 1, unitPrice: s.installationPrice },
  );
  return items;
}

export interface OfferTotals {
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
}

export function offerTotals(items: LineItem[], discountPct: number, vatPct: number): OfferTotals {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = (subtotal * Math.max(0, discountPct)) / 100;
  const net = subtotal - discount;
  const vat = (net * vatPct) / 100;
  return { subtotal, discount, net, vat, total: net + vat };
}
