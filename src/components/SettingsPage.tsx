import { useState } from 'react';
import { DEFAULT_CATALOG } from '../domain/catalog';
import { DEFAULT_CLIMATES } from '../domain/presets';
import { uid } from '../domain/quickModel';
import type { Brand, Climate, HeatPumpModel, Settings } from '../domain/types';
import { downloadJson, pickJsonFile } from '../store/storage';
import { Card, NumField, NumInput, TextField } from './ui';

type SetS = (fn: (s: Settings) => Settings) => void;

export function SettingsPage({ s, set }: { s: Settings; set: SetS }) {
  const [tab, setTab] = useState<'company' | 'offer' | 'catalog' | 'climate'>('company');
  return (
    <div className="stack">
      <div className="tabs-inline">
        {(
          [
            ['company', 'Фирма'],
            ['offer', 'Понуда и цени'],
            ['catalog', `Каталог (${s.catalog.length})`],
            ['climate', 'Климатски податоци'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'company' && <CompanyTab s={s} set={set} />}
      {tab === 'offer' && <OfferTab s={s} set={set} />}
      {tab === 'catalog' && <CatalogTab s={s} set={set} />}
      {tab === 'climate' && <ClimateTab s={s} set={set} />}
    </div>
  );
}

function CompanyTab({ s, set }: { s: Settings; set: SetS }) {
  const c = s.company;
  const setC = (k: keyof typeof c, v: string | null) => set((x) => ({ ...x, company: { ...x.company, [k]: v } }));
  const onLogo = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1_500_000) return alert('Логото е преголемо (макс. 1.5 MB).');
    const r = new FileReader();
    r.onload = () => setC('logoDataUrl', String(r.result));
    r.readAsDataURL(f);
  };
  return (
    <div className="grid2">
      <Card title="Податоци за фирмата (заглавие на понудата)">
        <div className="form">
          <TextField label="Назив" value={c.name} onChange={(v) => setC('name', v)} wide />
          <TextField label="Адреса" value={c.address} onChange={(v) => setC('address', v)} wide />
          <TextField label="Телефон" value={c.phone} onChange={(v) => setC('phone', v)} />
          <TextField label="Е-пошта" value={c.email} onChange={(v) => setC('email', v)} />
          <TextField label="Веб" value={c.web} onChange={(v) => setC('web', v)} />
          <TextField label="ЕДБ" value={c.taxId} onChange={(v) => setC('taxId', v)} />
          <TextField label="Жиро сметка / банка" value={c.bankAccount} onChange={(v) => setC('bankAccount', v)} wide />
          <TextField label="Инженер (стандардно)" value={s.defaultEngineer} onChange={(v) => set((x) => ({ ...x, defaultEngineer: v }))} />
        </div>
      </Card>
      <Card title="Лого">
        <div className="logo-box">
          {c.logoDataUrl ? <img src={c.logoDataUrl} alt="Лого" /> : <span className="muted">Нема прикачено лого – се користи називот.</span>}
        </div>
        <div className="row">
          <label className="btn">
            Прикачи лого (PNG/JPG)
            <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
          </label>
          {c.logoDataUrl && (
            <button className="btn ghost danger" onClick={() => setC('logoDataUrl', null)}>
              Отстрани
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function OfferTab({ s, set }: { s: Settings; set: SetS }) {
  const num = (k: keyof Settings) => (v: number) => set((x) => ({ ...x, [k]: v }));
  const ep = (k: keyof Settings['energyPrices']) => (v: number) => set((x) => ({ ...x, energyPrices: { ...x.energyPrices, [k]: v } }));
  return (
    <div className="grid2">
      <Card title="Општо">
        <div className="form">
          <TextField label="Валута" value={s.currency} onChange={(v) => set((x) => ({ ...x, currency: v }))} />
          <NumField label="ДДВ" unit="%" value={s.vatPct} min={0} onChange={num('vatPct')} />
          <NumField label="Следен број на понуда" value={s.offerCounter} min={1} onChange={(v) => set((x) => ({ ...x, offerCounter: Math.round(v) }))} />
          <TextField label="Начин на плаќање" value={s.paymentTerms} onChange={(v) => set((x) => ({ ...x, paymentTerms: v }))} wide multiline />
          <TextField label="Испорака и монтажа" value={s.deliveryTerms} onChange={(v) => set((x) => ({ ...x, deliveryTerms: v }))} wide multiline />
          <TextField label="Гаранција" value={s.warrantyTerms} onChange={(v) => set((x) => ({ ...x, warrantyTerms: v }))} wide multiline />
        </div>
      </Card>
      <div className="stack">
        <Card title="Стандардни цени на услуги (без ДДВ)">
          <div className="form">
            <NumField label="Монтажа и пуштање во работа" unit={s.currency} value={s.installationPrice} min={0} onChange={num('installationPrice')} />
            <NumField label="Хидрауличен прибор" unit={s.currency} value={s.hydraulicKitPrice} min={0} onChange={num('hydraulicKitPrice')} />
            <NumField label="Електрично поврзување" unit={s.currency} value={s.electricalPrice} min={0} onChange={num('electricalPrice')} />
          </div>
        </Card>
        <Card title="Енергенти и проценка на потрошувачка">
          <div className="form">
            <NumField label="Струја" unit={`${s.currency}/kWh`} value={s.energyPrices.electricity} min={0} onChange={ep('electricity')} />
            <NumField label="Нафта" unit={`${s.currency}/l`} value={s.energyPrices.oil} min={0} onChange={ep('oil')} />
            <NumField label="Пелети" unit={`${s.currency}/kg`} value={s.energyPrices.pellets} min={0} onChange={ep('pellets')} />
            <NumField label="Дрва" unit={`${s.currency}/m³`} value={s.energyPrices.wood} min={0} onChange={ep('wood')} />
            <NumField label="Корекција за добивки" value={s.gainFactor} min={0.3} max={1.2} hint="0.7–0.9 типично" onChange={num('gainFactor')} />
            <NumField label="ТСВ додаток по лице" unit="kW" value={s.dhwKwPerPerson} min={0} onChange={num('dhwKwPerPerson')} />
            <NumField label="Топла вода по лице" unit="l/ден" value={s.dhwLitersPerPerson} min={0} onChange={num('dhwLitersPerPerson')} />
          </div>
        </Card>
      </div>
    </div>
  );
}

const CAT_COLS: { k: keyof HeatPumpModel; label: string; num?: boolean; w?: string }[] = [
  { k: 'brand', label: 'Бренд' },
  { k: 'series', label: 'Серија', w: '9rem' },
  { k: 'model', label: 'Модел', w: '10rem' },
  { k: 'phase', label: 'Фази' },
  { k: 'capA7', label: 'A7', num: true },
  { k: 'capA2', label: 'A2', num: true },
  { k: 'capAm7', label: 'A−7', num: true },
  { k: 'capAm15', label: 'A−15', num: true },
  { k: 'copA7W35', label: 'COP', num: true },
  { k: 'scop35', label: 'SCOP35', num: true },
  { k: 'scop55', label: 'SCOP55', num: true },
  { k: 'maxFlowTemp', label: 'Макс °C', num: true },
  { k: 'minOutdoorTemp', label: 'Мин °C', num: true },
  { k: 'price', label: 'Цена', num: true },
  { k: 'indoorUnit', label: 'Внатр. единица', w: '11rem' },
  { k: 'indoorUnitPrice', label: 'Цена', num: true },
  { k: 'tank', label: 'Бојлер', w: '11rem' },
  { k: 'tankPrice', label: 'Цена', num: true },
];

function CatalogTab({ s, set }: { s: Settings; set: SetS }) {
  const upd = (id: string, patch: Partial<HeatPumpModel>) =>
    set((x) => ({ ...x, catalog: x.catalog.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const add = (brand: Brand) =>
    set((x) => ({
      ...x,
      catalog: [
        ...x.catalog,
        {
          id: uid(), brand, series: '', model: 'Нов модел', type: 'split', refrigerant: 'R32', phase: '1',
          capA7: 8, capA2: 7.5, capAm7: 6.5, capAm15: 5.5, copA7W35: 4.5, scop35: 4.4, scop55: 3.2,
          maxFlowTemp: 60, minOutdoorTemp: -25, price: null,
        },
      ],
    }));
  return (
    <Card
      title="Каталог на топлински пумпи"
      actions={
        <>
          <select className="sm" value="" onChange={(e) => e.target.value && add(e.target.value as Brand)}>
            <option value="">+ Додади модел…</option>
            <option>MDV</option>
            <option>Mitsubishi Electric</option>
            <option>Vaillant</option>
          </select>
          <button className="btn ghost sm" onClick={() => downloadJson(s.catalog, 'katalog_toplinski_pumpi.json')}>
            Извези JSON
          </button>
          <button
            className="btn ghost sm"
            onClick={async () => {
              try {
                const data = (await pickJsonFile()) as HeatPumpModel[];
                if (!Array.isArray(data) || !data.every((m) => m.id && m.brand && m.model)) throw new Error('Невалиден формат');
                set((x) => ({ ...x, catalog: data }));
              } catch (e) {
                alert('Увозот не успеа: ' + (e as Error).message);
              }
            }}
          >
            Увези JSON
          </button>
          <button
            className="btn ghost sm danger"
            onClick={() => confirm('Да се врати стандардниот каталог? Внесените цени ќе се изгубат.') && set((x) => ({ ...x, catalog: DEFAULT_CATALOG }))}
          >
            Стандарден
          </button>
        </>
      }
    >
      <p className="warn-text small">
        Капацитетите (kW при W35) и SCOP се типични вредности – проверете ги и коригирајте ги според официјалните технички листови на
        производителите. Цените се без ДДВ во {s.currency}.
      </p>
      <div className="scroll-x">
        <table className="tbl cat">
          <thead>
            <tr>
              {CAT_COLS.map((c, i) => (
                <th key={i} className={c.num ? 'r' : ''}>
                  {c.label}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {s.catalog.map((m) => (
              <tr key={m.id}>
                {CAT_COLS.map((c, i) => (
                  <td key={i} className={c.num ? 'r' : ''}>
                    {c.k === 'brand' ? (
                      <select value={m.brand} onChange={(e) => upd(m.id, { brand: e.target.value as Brand })}>
                        <option>MDV</option>
                        <option>Mitsubishi Electric</option>
                        <option>Vaillant</option>
                      </select>
                    ) : c.k === 'phase' ? (
                      <select value={m.phase ?? ''} onChange={(e) => upd(m.id, { phase: (e.target.value || undefined) as '1' | '3' | undefined })}>
                        <option value="">?</option>
                        <option value="1">1~</option>
                        <option value="3">3~</option>
                      </select>
                    ) : c.num ? (
                      <NumInput
                        compact
                        value={(m[c.k] as number | null | undefined) ?? null}
                        placeholder="–"
                        onChange={(v) => upd(m.id, { [c.k]: v } as Partial<HeatPumpModel>)}
                      />
                    ) : (
                      <input style={{ width: c.w }} value={(m[c.k] as string) ?? ''} onChange={(e) => upd(m.id, { [c.k]: e.target.value } as Partial<HeatPumpModel>)} />
                    )}
                  </td>
                ))}
                <td>
                  <button className="btn ghost sm danger" onClick={() => set((x) => ({ ...x, catalog: x.catalog.filter((z) => z.id !== m.id) }))}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ClimateTab({ s, set }: { s: Settings; set: SetS }) {
  const upd = (id: string, patch: Partial<Climate>) =>
    set((x) => ({ ...x, climates: x.climates.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  return (
    <Card
      title="Климатски податоци по локации"
      actions={
        <>
          <button className="btn ghost sm" onClick={() => set((x) => ({ ...x, climates: [...x.climates, { id: uid(), name: 'Нова локација', thetaE: -15, thetaMe: 12, hdd: 2600 }] }))}>
            + Локација
          </button>
          <button className="btn ghost sm danger" onClick={() => confirm('Да се вратат стандардните вредности?') && set((x) => ({ ...x, climates: DEFAULT_CLIMATES }))}>
            Стандардни
          </button>
        </>
      }
    >
      <p className="warn-text small">Ориентациски вредности – усогласете ги со важечкиот правилник / национален прилог на EN 12831.</p>
      <table className="tbl">
        <thead>
          <tr>
            <th>Локација</th>
            <th className="r">θe [°C]</th>
            <th className="r">θm,e [°C]</th>
            <th className="r">HDD 20/12</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {s.climates.map((c) => (
            <tr key={c.id}>
              <td>
                <input value={c.name} onChange={(e) => upd(c.id, { name: e.target.value })} />
              </td>
              <td className="r">
                <NumInput compact value={c.thetaE} onChange={(v) => upd(c.id, { thetaE: v })} />
              </td>
              <td className="r">
                <NumInput compact value={c.thetaMe} onChange={(v) => upd(c.id, { thetaMe: v })} />
              </td>
              <td className="r">
                <NumInput compact value={c.hdd} min={0} onChange={(v) => upd(c.id, { hdd: v })} />
              </td>
              <td>
                <button className="btn ghost sm danger" onClick={() => set((x) => ({ ...x, climates: x.climates.filter((z) => z.id !== c.id) }))}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
