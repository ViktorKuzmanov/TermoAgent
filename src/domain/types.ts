// Основни типови за пресметка на топлинско оптоварување (EN 12831-1) и избор на топлинска пумпа.

export type Boundary = 'exterior' | 'unheated' | 'ground' | 'adjacent';
export type ElementKind = 'wall' | 'window' | 'door' | 'roof' | 'floor';

export interface BuildingElement {
  id: string;
  kind: ElementKind;
  boundary: Boundary;
  label: string;
  /** Површина [m²] */
  area: number;
  /** Коефициент на топлинска спроводливост U [W/m²K] (за под на тло: U на конструкцијата) */
  u: number;
  /** Фактор на намалување b_u за негреан простор (0–1) */
  bu?: number;
  /** Температура на соседен простор [°C] (за boundary = 'adjacent') */
  thetaAdj?: number;
}

export type RoomTypeId =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'wc'
  | 'hall'
  | 'office'
  | 'staircase'
  | 'other';

export interface Room {
  id: string;
  name: string;
  type: RoomTypeId;
  /** Нето подна површина [m²] */
  area: number;
  /** Светла височина [m] */
  height: number;
  /** Внатрешна проектна температура [°C] */
  thetaInt: number;
  /** Минимална размена на воздух [1/h] */
  nMin: number;
  elements: BuildingElement[];
}

export type Shielding = 'none' | 'moderate' | 'heavy';

export interface BuildingParams {
  /** Херметичност n50 [1/h] */
  n50: number;
  shielding: Shielding;
  ventilation: 'natural' | 'mvhr';
  /** Ефикасност на рекуперација (0–1) */
  mvhrEfficiency: number;
  /** Додаток за термички мостови ΔU_TB [W/m²K] */
  deltaUtb: number;
  /** Фактор за загревање по прекин f_RH [W/m²] */
  reheat: number;
  /** Површина на под на тло A_g [m²] (за EN ISO 13370) */
  groundArea: number;
  /** Изложен периметар P [m] */
  exposedPerimeter: number;
  /** Подземна вода поплитко од 1 m (G_w = 1.15) */
  groundwaterShallow: boolean;
}

export interface Climate {
  id: string;
  name: string;
  /** Надворешна проектна температура θ_e [°C] */
  thetaE: number;
  /** Средна годишна надворешна температура θ_m,e [°C] */
  thetaMe: number;
  /** Степен-денови HDD (20/12) [K·d] */
  hdd: number;
}

export type InsulationId = 'none' | 'poor' | 'medium' | 'good' | 'excellent';

export interface InsulationPreset {
  id: InsulationId;
  label: string;
  description: string;
  uWall: number;
  uWindow: number;
  uDoor: number;
  uRoof: number;
  uFloor: number;
  n50: number;
}

export type FloorType = 'ground' | 'basement' | 'exterior' | 'heated';
export type RoofType = 'flat' | 'pitched_heated' | 'cold_attic' | 'heated';
export type Shape = 'square' | 'rect' | 'elongated';

export interface QuickInput {
  /** Грејна површина [m²] */
  area: number;
  floors: number;
  /** Светла височина на кат [m] */
  storeyHeight: number;
  shape: Shape;
  /** Застаклување како % од подната површина */
  windowRatio: number;
  insulation: InsulationId;
  /** Удел на ѕидови кон надвор (%) – за стан/двојна куќа < 100 */
  exteriorWallShare: number;
  floorType: FloorType;
  roofType: RoofType;
  thetaInt: number;
  doors: number;
}

export type EmitterType = 'floor' | 'fancoil' | 'radiators_lt' | 'radiators';

export interface SystemParams {
  emitter: EmitterType;
  /** Проектна температура на напојување [°C] */
  flowTemp: number;
  dhwEnabled: boolean;
  persons: number;
  /** Додаток за ТСВ во потребната моќност */
  dhwAddToLoad: boolean;
  phasePref: 'any' | '1' | '3';
  /** Минимална покриеност на оптоварувањето при θ_e (%) */
  minCoverage: number;
}

export type Brand = 'MDV' | 'Mitsubishi Electric' | 'Vaillant';

export interface HeatPumpModel {
  id: string;
  brand: Brand;
  series: string;
  /** Шифра / модел (надворешна единица) */
  model: string;
  type: 'split' | 'monoblock';
  refrigerant: string;
  phase?: '1' | '3';
  /** Капацитет при W35 на различни надворешни температури [kW] */
  capA7: number;
  capA2: number;
  capAm7: number;
  capAm15: number;
  copA7W35: number;
  scop35: number;
  scop55: number;
  maxFlowTemp: number;
  minOutdoorTemp: number;
  noiseDb?: number;
  /** Препорачана внатрешна единица / хидробокс */
  indoorUnit?: string;
  indoorUnitPrice?: number | null;
  /** Препорачан бојлер за ТСВ */
  tank?: string;
  tankPrice?: number | null;
  price: number | null;
  note?: string;
}

export interface LineItem {
  id: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
}

export interface OfferData {
  number: string;
  date: string;
  validityDays: number;
  subject: string;
  intro: string;
  items: LineItem[];
  discountPct: number;
  includeAnnex: boolean;
  includeAlternatives: boolean;
  includeEnergy: boolean;
  notes: string;
  engineer: string;
}

export interface ClientInfo {
  name: string;
  contactPerson: string;
  address: string;
  phone: string;
  email: string;
}

export interface SiteInfo {
  address: string;
  climateId: string;
  /** Рачно пребришување на θ_e */
  thetaEOverride: number | null;
  objectType: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  client: ClientInfo;
  site: SiteInfo;
  mode: 'quick' | 'detailed';
  quick: QuickInput;
  rooms: Room[];
  building: BuildingParams;
  system: SystemParams;
  selectedModelId: string | null;
  offer: OfferData;
}

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  web: string;
  taxId: string;
  bankAccount: string;
  logoDataUrl: string | null;
}

export interface EnergyPrices {
  /** Струја [валута/kWh] */
  electricity: number;
  /** Нафта екстра лесна [валута/l] */
  oil: number;
  /** Пелети [валута/kg] */
  pellets: number;
  /** Огревно дрво [валута/m³] */
  wood: number;
}

export interface Settings {
  company: CompanyInfo;
  defaultEngineer: string;
  currency: string;
  vatPct: number;
  paymentTerms: string;
  deliveryTerms: string;
  warrantyTerms: string;
  installationPrice: number;
  hydraulicKitPrice: number;
  electricalPrice: number;
  energyPrices: EnergyPrices;
  /** Корекција за внатрешни/сончеви добивки и прекини во греење */
  gainFactor: number;
  /** Додаток за ТСВ по лице [kW] */
  dhwKwPerPerson: number;
  /** Потрошувачка на топла вода по лице [l/ден] */
  dhwLitersPerPerson: number;
  catalog: HeatPumpModel[];
  climates: Climate[];
  offerCounter: number;
}
