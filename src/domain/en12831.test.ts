import { DEFAULT_CATALOG } from './catalog';
import { buildingLoad, characteristicDimension, elementLoss, groundUequiv } from './en12831';
import { computeProject, defaultBuilding, defaultSettings, newProject, offerTotals } from './project';
import { quickBuildingParams, quickGeometry, quickToDetailed } from './quickModel';
import { capacityAt, evaluateModel } from './selection';
import type { BuildingParams, Room } from './types';

const b: BuildingParams = { ...defaultBuilding(), deltaUtb: 0, n50: 0 };

describe('Трансмисиски загуби', () => {
  it('надворешен ѕид: Φ = A·U·ΔT', () => {
    const r = elementLoss({ id: 'w', kind: 'wall', boundary: 'exterior', label: '', area: 100, u: 0.3 }, 20, -15, 12, b, 5);
    expect(r.h).toBeCloseTo(30);
    expect(r.phi).toBeCloseTo(1050);
  });

  it('термички мостови се додаваат на U', () => {
    const r = elementLoss(
      { id: 'w', kind: 'wall', boundary: 'exterior', label: '', area: 100, u: 0.3 },
      20, -15, 12, { ...b, deltaUtb: 0.1 }, 5,
    );
    expect(r.h).toBeCloseTo(40);
  });

  it('негреан простор се множи со b_u', () => {
    const r = elementLoss({ id: 'c', kind: 'roof', boundary: 'unheated', label: '', area: 50, u: 0.4, bu: 0.5 }, 20, -15, 12, b, 5);
    expect(r.h).toBeCloseTo(10);
  });

  it('соседен простор: Φ = A·U·(θint − θadj)', () => {
    const r = elementLoss(
      { id: 'a', kind: 'wall', boundary: 'adjacent', label: '', area: 10, u: 1.0, thetaAdj: 15 },
      20, -15, 12, b, 5,
    );
    expect(r.phi).toBeCloseTo(50);
  });

  it('тло: EN ISO 13370 дава U_equiv помал од U на конструкцијата', () => {
    const bp = characteristicDimension(120, 44);
    const ueq = groundUequiv(0.6, bp);
    expect(ueq).toBeGreaterThan(0.2);
    expect(ueq).toBeLessThan(0.6);
  });
});

describe('Вентилациски загуби', () => {
  const room: Room = {
    id: 'r', name: 'Дневна', type: 'living', area: 25, height: 2.6, thetaInt: 20, nMin: 0.5,
    elements: [{ id: 'w', kind: 'window', boundary: 'exterior', label: '', area: 4, u: 1.4 }],
  };

  it('Φ_V = 0.34 · n_min · V · ΔT кога доминира минималната размена', () => {
    const res = buildingLoad([room], -15, 12, b);
    expect(res.phiV).toBeCloseTo(0.34 * 0.5 * 65 * 35);
  });

  it('рекуперација ја намалува вентилационата загуба', () => {
    const nat = buildingLoad([room], -15, 12, b).phiV;
    const rec = buildingLoad([room], -15, 12, { ...b, ventilation: 'mvhr', mvhrEfficiency: 0.8 }).phiV;
    expect(rec).toBeCloseTo(nat * 0.2);
  });
});

describe('Брз режим – реалистична куќа', () => {
  it('120 m², средна изолација, Скопје → 50–100 W/m²', () => {
    const s = defaultSettings();
    const p = newProject(s);
    const c = computeProject(p, s);
    expect(c.thetaE).toBe(-15);
    expect(c.load.specific).toBeGreaterThan(50);
    expect(c.load.specific).toBeLessThan(100);
  });

  it('подобра изолација → помало оптоварување', () => {
    const s = defaultSettings();
    const p = newProject(s);
    const med = computeProject(p, s).load.phiHL;
    const good = computeProject({ ...p, quick: { ...p.quick, insulation: 'good' } }, s).load.phiHL;
    expect(good).toBeLessThan(med);
  });

  it('геометрија: периметар на квадрат 100 m² = 40 m', () => {
    const p = newProject(defaultSettings());
    const g = quickGeometry({ ...p.quick, area: 100, floors: 1, shape: 'square' });
    expect(g.perimeter).toBeCloseTo(40);
  });
});

describe('Детален режим', () => {
  it('копија од брз режим дава исто оптоварување', () => {
    const s = defaultSettings();
    const p = newProject(s);
    const quick = computeProject(p, s).load.phiHL;
    const det = computeProject({ ...p, mode: 'detailed', rooms: quickToDetailed(p.quick), building: quickBuildingParams(p.quick, p.building) }, s).load.phiHL;
    expect(Math.abs(det - quick) / quick).toBeLessThan(0.001);
  });

  it('без внесени A_g / P, загубите кон тло сепак се пресметуваат', () => {
    const s = defaultSettings();
    const p = newProject(s);
    const withGeo = computeProject({ ...p, mode: 'detailed', rooms: quickToDetailed(p.quick), building: quickBuildingParams(p.quick, p.building) }, s);
    const noGeo = computeProject({ ...p, mode: 'detailed', rooms: quickToDetailed(p.quick) }, s);
    expect(noGeo.load.breakdown.floor).toBeGreaterThan(0);
    expect(noGeo.load.breakdown.floor).toBeCloseTo(withGeo.load.breakdown.floor, -1);
  });
});

describe('Избор на пумпа', () => {
  const m = DEFAULT_CATALOG.find((x) => x.id === 'mdv-8')!;
  const sys = newProject(defaultSettings()).system;

  it('интерполација на капацитет', () => {
    expect(capacityAt(m, 7, 35)).toBeCloseTo(8.0);
    expect(capacityAt(m, -7, 35)).toBeCloseTo(6.5);
    expect(capacityAt(m, -11, 35)).toBeCloseTo((6.5 + 5.3) / 2);
    expect(capacityAt(m, -30, 35)).toBe(0);
  });

  it('повисоко напојување → помал капацитет', () => {
    expect(capacityAt(m, -7, 55)).toBeLessThan(capacityAt(m, -7, 35));
  });

  it('бивалентна точка е помеѓу θ_e и θ_int кога пумпата не покрива', () => {
    const ev = evaluateModel(m, 8, -15, 20, sys);
    expect(ev.monovalent).toBe(false);
    expect(ev.bivalentPoint!).toBeGreaterThan(-15);
    expect(ev.bivalentPoint!).toBeLessThan(20);
    expect(ev.backupKw).toBeCloseTo(8 - 5.3);
  });

  it('препорака за секој бренд ја покрива потребата', () => {
    const s = defaultSettings();
    const c = computeProject(newProject(s), s);
    for (const r of c.recommendations) {
      expect(r.best).not.toBeNull();
      if (!r.insufficient) expect(r.best!.capAtDesign).toBeGreaterThanOrEqual(c.requiredKw);
    }
  });
});

describe('Понуда', () => {
  it('ДДВ 18% и попуст', () => {
    const t = offerTotals([{ id: '1', description: '', unit: '', qty: 2, unitPrice: 100 }], 10, 18);
    expect(t.net).toBeCloseTo(180);
    expect(t.total).toBeCloseTo(212.4);
  });
});
