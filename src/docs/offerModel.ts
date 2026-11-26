/**
 * Структура на понудата (независна од формат). Ја користат и HTML/PDF прегледот и Word генераторот.
 */
import { dateMk, fmt, money } from '../format';
import type { Breakdown } from '../domain/en12831';
import { BOUNDARIES, BREAKDOWN_LABELS, EMITTERS, getInsulation } from '../domain/presets';
import { offerTotals, type ProjectComputation } from '../domain/project';
import type { CompanyInfo, Project, Settings } from '../domain/types';
import { capacityChartSvg } from './chart';

export type Align = 'l' | 'r' | 'c';

export type Block =
  | { t: 'h'; text: string; level: 1 | 2 }
  | { t: 'p'; text: string; bold?: boolean; muted?: boolean; small?: boolean }
  | { t: 'kv'; rows: [string, string][] }
  | { t: 'table'; head: string[]; rows: string[][]; align?: Align[]; foot?: string[][]; widths?: number[]; small?: boolean }
  | { t: 'chart'; svg: string; caption?: string }
  | { t: 'pagebreak' }
  | { t: 'signatures'; items: { title: string; name: string }[] };

export interface OfferModel {
  company: CompanyInfo;
  number: string;
  date: string;
  validUntil: string;
  recipient: string[];
  subject: string;
  blocks: Block[];
  totalText: string;
}

export function buildOfferModel(p: Project, s: Settings, c: ProjectComputation): OfferModel {
  const o = p.offer;
  const cur = s.currency;
  const L = c.load;
  const sel = c.selected;
  const blocks: Block[] = [];
  let n = 0;
  const h = (text: string) => blocks.push({ t: 'h', text: `${++n}. ${text}`, level: 1 });

  const valid = new Date(o.date);
  valid.setDate(valid.getDate() + o.validityDays);

  blocks.push({ t: 'p', text: o.intro });

  // 1. Објект
  h('Податоци за објектот');
  const emitter = EMITTERS.find((e) => e.id === p.system.emitter)?.label ?? '';
  const objRows: [string, string][] = [
    ['Тип на објект', p.site.objectType],
    ['Локација', p.site.address && p.site.address.includes(c.climate.name) ? p.site.address : [p.site.address, c.climate.name].filter(Boolean).join(', ')],
    ['Проектна надворешна температура θe', `${c.thetaE} °C`],
    ['Грејна површина / волумен', `${fmt(L.area, 1)} m² / ${fmt(L.volume, 0)} m³`],
  ];
  if (p.mode === 'quick') {
    const ins = getInsulation(p.quick.insulation);
    objRows.push(['Катност', `${p.quick.floors} ${p.quick.floors === 1 ? 'кат' : 'ката'}, светла височина ${fmt(p.quick.storeyHeight, 2)} m`]);
    objRows.push(['Топлинска изолација', `${ins.label} (${ins.description})`]);
  } else {
    objRows.push(['Пресметка', `По простории – ${L.rooms.length} простории`]);
  }
  objRows.push(['Внатрешна проектна температура', `${fmt(L.thetaIntAvg, 1)} °C (пондерирана)`]);
  objRows.push(['Грејни тела / напојување', `${emitter}, ${p.system.flowTemp} °C`]);
  objRows.push(['Санитарна топла вода', p.system.dhwEnabled ? `Да, ${p.system.persons} лица` : 'Не']);
  blocks.push({ t: 'kv', rows: objRows });

  // 2. Оптоварување
  h('Пресметка на топлинско оптоварување (EN 12831-1)');
  const pct = (x: number) => `${fmt((x / Math.max(1, L.phiHL)) * 100, 0)} %`;
  blocks.push({
    t: 'table',
    head: ['Компонента', 'Моќност [kW]', 'Удел'],
    align: ['l', 'r', 'r'],
    widths: [60, 20, 20],
    rows: [
      ['Трансмисиони загуби Φ_T', fmt(L.phiT / 1000, 2), pct(L.phiT)],
      ['Вентилациони загуби Φ_V', fmt(L.phiV / 1000, 2), pct(L.phiV)],
      ...(L.phiRH > 0 ? [['Загревање по прекин Φ_RH', fmt(L.phiRH / 1000, 2), pct(L.phiRH)]] : []),
    ],
    foot: [
      ['Проектно топлинско оптоварување Φ_HL', fmt(L.phiHL / 1000, 2), '100 %'],
      ...(c.dhwKw > 0 ? [['Додаток за санитарна топла вода', fmt(c.dhwKw, 2), '']] : []),
      ['Потребна моќност на топлинската пумпа', fmt(c.requiredKw, 2), ''],
    ],
  });
  blocks.push({ t: 'p', text: `Специфично топлинско оптоварување: ${fmt(L.specific, 1)} W/m².`, bold: true });
  const bk = (Object.keys(L.breakdown) as (keyof Breakdown)[]).filter((k) => L.breakdown[k] > 0.5);
  blocks.push({
    t: 'table',
    head: ['Загуби по елементи', 'kW', 'Удел'],
    align: ['l', 'r', 'r'],
    widths: [60, 20, 20],
    small: true,
    rows: bk.map((k) => [BREAKDOWN_LABELS[k], fmt(L.breakdown[k] / 1000, 2), pct(L.breakdown[k])]),
  });

  // 3. Предложен систем
  h('Предложен систем');
  if (sel) {
    const m = sel.model;
    blocks.push({
      t: 'p',
      text: `За објектот предлагаме топлинска пумпа воздух–вода ${m.brand} ${m.series}, модел ${m.model}. ${
        sel.monovalent
          ? `Пумпата самостојно го покрива целото потребно оптоварување и при проектна температура од ${c.thetaE} °C (моновалентен режим).`
          : `Пумпата покрива ${fmt(sel.coverage, 0)} % од потребната моќност при ${c.thetaE} °C; под бивалентната точка од ${fmt(
              sel.bivalentPoint ?? 0,
              1,
            )} °C се вклучува дополнителниот електричен греач (≈ ${fmt(sel.backupKw, 1)} kW).`
      }`,
    });
    blocks.push({
      t: 'kv',
      rows: [
        ['Производител / серија', `${m.brand} ${m.series}`],
        ['Модел (надворешна единица)', m.model],
        ['Тип / разладно средство', `${m.type === 'split' ? 'Сплит систем' : 'Моноблок'} / ${m.refrigerant}`],
        ...(m.phase ? ([['Напојување', m.phase === '1' ? '1~ 230 V' : '3~ 400 V']] as [string, string][]) : []),
        ['Номинален капацитет (A7/W35)', `${fmt(m.capA7, 1)} kW, COP ${fmt(m.copA7W35, 2)}`],
        [`Капацитет при ${c.thetaE} °C / W${p.system.flowTemp}`, `${fmt(sel.capAtDesign, 2)} kW (${fmt(sel.coverage, 0)} % покриеност)`],
        ['Сезонски коефициент SCOP', fmt(sel.scop, 2)],
        ['Макс. температура на напојување', `${m.maxFlowTemp} °C`],
        ['Работен опсег до', `${m.minOutdoorTemp} °C`],
        ...(m.indoorUnit ? ([['Внатрешна единица', m.indoorUnit]] as [string, string][]) : []),
        ...(p.system.dhwEnabled && m.tank ? ([['Бојлер за ТСВ', m.tank]] as [string, string][]) : []),
      ],
    });
    blocks.push({
      t: 'chart',
      svg: capacityChartSvg({
        model: m,
        requiredKw: c.requiredKw,
        thetaE: c.thetaE,
        thetaRef: L.thetaIntAvg,
        flowTemp: p.system.flowTemp,
        bivalentPoint: sel.bivalentPoint,
      }),
      caption: 'Капацитет на топлинската пумпа наспроти потребната моќност на објектот',
    });
  } else {
    blocks.push({ t: 'p', text: 'Не е избран модел на топлинска пумпа.', muted: true });
  }

  if (o.includeAlternatives) {
    const alts = c.recommendations.filter((r) => r.best && r.best.model.id !== sel?.model.id);
    if (alts.length) {
      blocks.push({ t: 'h', text: 'Алтернативни решенија', level: 2 });
      blocks.push({
        t: 'table',
        head: ['Производител', 'Модел', `Капацитет при ${c.thetaE} °C`, 'Покриеност', 'SCOP', 'Цена (без ДДВ)'],
        align: ['l', 'l', 'r', 'r', 'r', 'r'],
        widths: [20, 26, 16, 12, 10, 16],
        small: true,
        rows: alts.map((r) => [
          r.brand,
          r.best!.model.model,
          `${fmt(r.best!.capAtDesign, 2)} kW`,
          `${fmt(r.best!.coverage, 0)} %`,
          fmt(r.best!.scop, 2),
          r.best!.model.price ? money(r.best!.model.price, cur) : 'на барање',
        ]),
      });
    }
  }

  // 4. Енергија
  if (o.includeEnergy && c.energy) {
    const e = c.energy;
    h('Проценка на годишна потрошувачка и трошоци');
    blocks.push({
      t: 'p',
      text: `Проценета годишна потреба од топлина: ${fmt(e.heatingKwh, 0)} kWh за греење${
        e.dhwKwh > 0 ? ` и ${fmt(e.dhwKwh, 0)} kWh за санитарна топла вода` : ''
      }. Споредба на годишните трошоци за различни извори на енергија:`,
    });
    blocks.push({
      t: 'table',
      head: ['Систем', 'Годишна потрошувачка', `Трошок / година`],
      align: ['l', 'r', 'r'],
      widths: [46, 27, 27],
      rows: e.options.map((x, i) => [i === 0 ? `${x.label} – предлог` : x.label, x.consumption, money(x.cost, cur)]),
    });
    if (e.savingVsOil > 0)
      blocks.push({ t: 'p', text: `Проценета годишна заштеда во однос на котел на нафта: ${money(e.savingVsOil, cur)}${cur.endsWith('.') ? '' : '.'}`, bold: true });
    blocks.push({
      t: 'p',
      small: true,
      muted: true,
      text: `Проценката е ориентациска (метод на степен-денови, HDD ${c.climate.hdd} K·d, корекција ${s.gainFactor}), со цени: струја ${fmt(
        s.energyPrices.electricity,
        2,
      )} ${cur}/kWh, нафта ${fmt(s.energyPrices.oil, 2)} ${cur}/l, пелети ${fmt(s.energyPrices.pellets, 2)} ${cur}/kg, дрва ${fmt(
        s.energyPrices.wood,
        0,
      )} ${cur}/m³. Реалната потрошувачка зависи од навиките на корисниците и временските услови.`,
    });
  }

  // 5. Цена
  h('Спецификација и цена');
  const t = offerTotals(o.items, o.discountPct, s.vatPct);
  const foot: string[][] = [['', 'Вкупно без ДДВ', '', '', '', money(t.subtotal, cur)]];
  if (o.discountPct > 0) {
    foot.push(['', `Попуст ${fmt(o.discountPct, 1)} %`, '', '', '', `− ${money(t.discount, cur)}`]);
    foot.push(['', 'Основица за ДДВ', '', '', '', money(t.net, cur)]);
  }
  foot.push(['', `ДДВ ${fmt(s.vatPct, 0)} %`, '', '', '', money(t.vat, cur)]);
  foot.push(['', 'ВКУПНО ЗА ПЛАЌАЊЕ', '', '', '', money(t.total, cur)]);
  blocks.push({
    t: 'table',
    head: ['Бр.', 'Опис', 'Ед. мерка', 'Кол.', 'Ед. цена', 'Износ'],
    align: ['c', 'l', 'c', 'r', 'r', 'r'],
    widths: [6, 46, 10, 8, 15, 15],
    rows: o.items.map((it, i) => [
      String(i + 1),
      it.description,
      it.unit,
      fmt(it.qty, it.qty % 1 ? 2 : 0),
      money(it.unitPrice, cur),
      money(it.qty * it.unitPrice, cur),
    ]),
    foot,
  });

  // 6. Услови
  h('Услови');
  blocks.push({
    t: 'kv',
    rows: [
      ['Важност на понудата', `${o.validityDays} дена (до ${dateMk(valid.toISOString())})`],
      ['Начин на плаќање', s.paymentTerms],
      ['Испорака и монтажа', s.deliveryTerms],
      ['Гаранција', s.warrantyTerms],
    ],
  });
  if (o.notes.trim()) blocks.push({ t: 'p', text: o.notes });

  blocks.push({
    t: 'signatures',
    items: [
      { title: 'Изготвил', name: o.engineer || '____________________' },
      { title: `За ${s.company.name}`, name: '____________________' },
    ],
  });

  // Прилог
  if (o.includeAnnex) {
    blocks.push({ t: 'pagebreak' });
    blocks.push({ t: 'h', text: 'Прилог 1 – Пресметка на топлинско оптоварување според EN 12831-1', level: 1 });
    blocks.push({
      t: 'kv',
      rows: [
        ['Надворешна проектна температура θe', `${c.thetaE} °C`],
        ['Средна годишна температура θm,e', `${c.climate.thetaMe} °C`],
        ['Додаток за термички мостови ΔU_TB', `${c.building.deltaUtb} W/m²K`],
        ['Херметичност n50', `${c.building.n50} 1/h`],
        ['Вентилација', c.building.ventilation === 'mvhr' ? `Механичка со рекуперација (η = ${fmt(c.building.mvhrEfficiency * 100, 0)} %)` : 'Природна'],
        ['Под на тло (EN ISO 13370)', L.bPrime > 0 && L.bPrime < 1000 ? `A_g = ${fmt(c.building.groundArea, 1)} m², P = ${fmt(c.building.exposedPerimeter, 1)} m, B' = ${fmt(L.bPrime, 2)} m` : '–'],
      ],
    });
    blocks.push({ t: 'h', text: 'Оптоварување по простории', level: 2 });
    blocks.push({
      t: 'table',
      head: ['Просторија', 'A [m²]', 'θint [°C]', 'Φ_T [W]', 'Φ_V [W]', 'Φ_RH [W]', 'Φ_HL [W]', 'W/m²'],
      align: ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
      widths: [28, 9, 9, 11, 11, 10, 12, 10],
      small: true,
      rows: L.rooms.map((r) => [
        r.room.name,
        fmt(r.room.area, 1),
        fmt(r.room.thetaInt, 0),
        fmt(r.phiT),
        fmt(r.phiV),
        fmt(r.phiRH),
        fmt(r.phiHL),
        fmt(r.specific, 1),
      ]),
      foot: [['Вкупно', fmt(L.area, 1), '', fmt(L.phiT), fmt(L.phiV), fmt(L.phiRH), fmt(L.phiHL), fmt(L.specific, 1)]],
    });
    blocks.push({ t: 'h', text: 'Трансмисиони загуби по елементи', level: 2 });
    blocks.push({
      t: 'table',
      head: ['Просторија', 'Елемент', 'Граничи со', 'A [m²]', 'U', 'U_eff', 'H [W/K]', 'Φ [W]'],
      align: ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'r'],
      widths: [16, 22, 18, 9, 8, 9, 9, 9],
      small: true,
      rows: L.rooms.flatMap((r) =>
        r.elements.map((e) => [
          r.room.name,
          e.element.label,
          BOUNDARIES.find((b) => b.id === e.element.boundary)?.label ?? '',
          fmt(e.element.area, 2),
          fmt(e.element.u, 2),
          fmt(e.uEff, 3),
          fmt(e.h, 2),
          fmt(e.phi),
        ]),
      ),
    });
    blocks.push({
      t: 'p',
      small: true,
      muted: true,
      text: 'Φ_T = Σ(A·U_eff)·(θint − θe); за надворешни елементи U_eff = U + ΔU_TB; за негреани простори се применува b_u; за под на тло U_eff = f_g1·f_g2·U_equiv·G_w (EN ISO 13370). Φ_V = 0.34·V̇·(θint − θe), V̇ = max(V̇_inf, n_min·V).',
    });
  }

  const recipient = [p.client.name, p.client.contactPerson && `н/р ${p.client.contactPerson}`, p.client.address, p.client.phone, p.client.email].filter(
    Boolean,
  ) as string[];

  return {
    company: s.company,
    number: o.number,
    date: dateMk(o.date),
    validUntil: dateMk(valid.toISOString()),
    recipient,
    subject: [o.subject, p.site.address].filter(Boolean).join(' – '),
    blocks,
    totalText: money(t.total, cur),
  };
}
