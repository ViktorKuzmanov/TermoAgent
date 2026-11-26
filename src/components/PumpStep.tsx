import { capacityChartSvg } from '../docs/chart';
import { fmt, money } from '../format';
import { EMITTERS } from '../domain/presets';
import type { ProjectComputation } from '../domain/project';
import type { ModelEvaluation } from '../domain/selection';
import type { EmitterType, Project, Settings } from '../domain/types';
import { Card, Check, Field, NumField, SelectField, Stat } from './ui';

type Update = (fn: (p: Project) => Project) => void;

export function PumpStep({ p, s, c, update }: { p: Project; s: Settings; c: ProjectComputation; update: Update }) {
  const sys = p.system;
  const set = <K extends keyof typeof sys>(k: K, v: (typeof sys)[K]) => update((x) => ({ ...x, system: { ...x.system, [k]: v } }));
  const select = (id: string) => update((x) => ({ ...x, selectedModelId: id }));
  const sel = c.selected;

  return (
    <div className="stack">
      <Card title="Систем за греење">
        <div className="form">
          <SelectField
            label="Грејни тела"
            value={sys.emitter}
            options={EMITTERS}
            onChange={(v: EmitterType) =>
              update((x) => ({ ...x, system: { ...x.system, emitter: v, flowTemp: EMITTERS.find((e) => e.id === v)!.flowTemp } }))
            }
          />
          <NumField label="Температура на напојување" unit="°C" value={sys.flowTemp} min={25} max={75} onChange={(v) => set('flowTemp', v)} />
          <Field label="Санитарна топла вода">
            <Check label="Пумпата загрева и ТСВ" checked={sys.dhwEnabled} onChange={(v) => set('dhwEnabled', v)} />
          </Field>
          {sys.dhwEnabled && (
            <>
              <NumField label="Број на лица" value={sys.persons} min={0} max={50} onChange={(v) => set('persons', Math.round(v))} />
              <Field label="Додаток за ТСВ" hint={`${s.dhwKwPerPerson} kW по лице`}>
                <Check label="Додај во потребната моќност" checked={sys.dhwAddToLoad} onChange={(v) => set('dhwAddToLoad', v)} />
              </Field>
            </>
          )}
          <SelectField
            label="Електрично напојување"
            value={sys.phasePref}
            options={[
              { id: 'any', label: 'Сеедно' },
              { id: '1', label: 'Монофазно (230 V)' },
              { id: '3', label: 'Трофазно (400 V)' },
            ]}
            onChange={(v) => set('phasePref', v)}
          />
          <NumField
            label="Мин. покриеност при θe"
            unit="%"
            value={sys.minCoverage}
            min={50}
            max={150}
            hint="100 % = моновалентно; 70–90 % = со дополнителен греач"
            onChange={(v) => set('minCoverage', v)}
          />
        </div>
      </Card>

      <div className="stats">
        <Stat label="Потребна моќност при θe" value={`${fmt(c.requiredKw, 2)} kW`} tone="accent" sub={`θe = ${c.thetaE} °C · W${sys.flowTemp}`} />
        <Stat label="Топлинско оптоварување" value={`${fmt(c.load.phiHL / 1000, 2)} kW`} sub="EN 12831-1" />
        <Stat label="Додаток ТСВ" value={`${fmt(c.dhwKw, 2)} kW`} sub={sys.dhwEnabled ? `${sys.persons} лица` : 'исклучено'} />
      </div>

      <div className="brand-grid">
        {c.recommendations.map((r) => (
          <div className={`brand-card brand-${r.brand.split(' ')[0].toLowerCase()}`} key={r.brand}>
            <div className="brand-name">{r.brand}</div>
            {r.best ? (
              <>
                <ModelSummary ev={r.best} s={s} />
                {r.insufficient && (
                  <div className="warn-box">
                    Ниту еден модел не постигнува {sys.minCoverage} % покриеност. Најголемиот покрива {fmt(r.best.coverage, 0)} % –
                    потребен е дополнителен греач ≈ {fmt(r.best.backupKw, 1)} kW или каскада од 2 единици.
                  </div>
                )}
                <div className="brand-actions">
                  <button className={`btn ${p.selectedModelId === r.best.model.id ? 'primary' : ''}`} onClick={() => select(r.best!.model.id)}>
                    {p.selectedModelId === r.best.model.id ? '✓ Избрано' : 'Избери'}
                  </button>
                  {r.next && (
                    <button className="btn ghost sm" onClick={() => select(r.next!.model.id)} title="Следна поголема големина">
                      Алт.: {r.next.model.model}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="muted">Нема компатибилен модел за овие услови.</p>
            )}
          </div>
        ))}
      </div>

      {sel && (
        <Card title={`Избрана пумпа: ${sel.model.brand} ${sel.model.model}`}>
          <div className="grid2 tight">
            <div>
              <div
                className="chart"
                dangerouslySetInnerHTML={{
                  __html: capacityChartSvg({
                    model: sel.model,
                    requiredKw: c.requiredKw,
                    thetaE: c.thetaE,
                    thetaRef: c.load.thetaIntAvg,
                    flowTemp: sys.flowTemp,
                    bivalentPoint: sel.bivalentPoint,
                  }),
                }}
              />
            </div>
            <div className="stats col">
              <Stat label="Капацитет при θe" value={`${fmt(sel.capAtDesign, 2)} kW`} sub={`${fmt(sel.coverage, 0)} % покриеност`} tone={sel.monovalent ? 'ok' : 'warn'} />
              <Stat
                label="Режим на работа"
                value={sel.monovalent ? 'Моновалентен' : 'Моноенергетски'}
                sub={sel.monovalent ? 'Пумпата сама го покрива оптоварувањето' : `Бивалентна точка ${fmt(sel.bivalentPoint ?? 0, 1)} °C · греач ${fmt(sel.backupKw, 1)} kW`}
              />
              <Stat label="Сезонски SCOP" value={fmt(sel.scop, 2)} sub={`при W${sys.flowTemp}`} />
              {c.energy && (
                <Stat
                  label="Годишна струја (проценка)"
                  value={`${fmt(c.energy.hpElectricKwh, 0)} kWh`}
                  sub={`≈ ${money(c.energy.options[0].cost, s.currency)} / год.`}
                />
              )}
            </div>
          </div>
          {sel.oversized && <div className="warn-box">Пумпата е предимензионирана (&gt;160 %) – можно е често вклучување/исклучување. Разгледајте помал модел.</div>}
        </Card>
      )}

      <Card title="Споредба на сите модели">
        <table className="tbl">
          <thead>
            <tr>
              <th>Бренд / Серија</th>
              <th>Модел</th>
              <th>Тип</th>
              <th className="r">A7/W35</th>
              <th className="r">При θe</th>
              <th className="r">Покриеност</th>
              <th className="r">Бив. точка</th>
              <th className="r">SCOP</th>
              <th className="r">Цена</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {c.recommendations.flatMap((r) =>
              r.all.map((e) => (
                <tr key={e.model.id} className={`${p.selectedModelId === e.model.id ? 'sel' : ''} ${e.issues.length ? 'dim' : ''}`}>
                  <td>
                    {e.model.brand}
                    <div className="muted small">{e.model.series}</div>
                  </td>
                  <td>
                    <strong>{e.model.model}</strong>
                    {e.issues.length > 0 && <div className="small warn-text">{e.issues.join('; ')}</div>}
                  </td>
                  <td>
                    {e.model.type === 'split' ? 'Сплит' : 'Моноблок'} · {e.model.refrigerant}
                    {e.model.phase && ` · ${e.model.phase}~`}
                  </td>
                  <td className="r">{fmt(e.model.capA7, 1)} kW</td>
                  <td className="r">{fmt(e.capAtDesign, 2)} kW</td>
                  <td className="r">
                    <CoverageBadge ev={e} min={sys.minCoverage} />
                  </td>
                  <td className="r">{e.monovalent ? '–' : `${fmt(e.bivalentPoint ?? 0, 1)} °C`}</td>
                  <td className="r">{fmt(e.scop, 2)}</td>
                  <td className="r">{e.model.price ? money(e.model.price, s.currency) : <span className="muted">–</span>}</td>
                  <td>
                    <button className="btn ghost sm" onClick={() => select(e.model.id)} disabled={p.selectedModelId === e.model.id}>
                      {p.selectedModelId === e.model.id ? '✓' : 'Избери'}
                    </button>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        <p className="muted small">
          Капацитетите се типични вредности од каталогот (Поставки → Каталог) – проверете ги со техничките листови на производителот.
          Корекција за напојување над W35: −0.7 %/K.
        </p>
      </Card>
    </div>
  );
}

function CoverageBadge({ ev, min }: { ev: ModelEvaluation; min: number }) {
  const tone = ev.issues.length ? 'muted' : ev.coverage >= 100 ? (ev.oversized ? 'warn' : 'ok') : ev.coverage >= min ? 'warn' : 'bad';
  return <span className={`badge ${tone}`}>{fmt(ev.coverage, 0)} %</span>;
}

function ModelSummary({ ev, s }: { ev: ModelEvaluation; s: Settings }) {
  const m = ev.model;
  return (
    <div className="model-sum">
      <div className="model-name">{m.model}</div>
      <div className="muted small">
        {m.series} · {m.type === 'split' ? 'сплит' : 'моноблок'} · {m.refrigerant}
        {m.phase && ` · ${m.phase === '1' ? '230 V' : '400 V'}`}
      </div>
      <div className="model-kv">
        <span>Капацитет при θe</span>
        <strong>{fmt(ev.capAtDesign, 2)} kW</strong>
        <span>Покриеност</span>
        <strong>
          <CoverageBadge ev={ev} min={0} />
        </strong>
        <span>Бивалентна точка</span>
        <strong>{ev.monovalent ? 'моновалентен' : `${fmt(ev.bivalentPoint ?? 0, 1)} °C`}</strong>
        <span>SCOP</span>
        <strong>{fmt(ev.scop, 2)}</strong>
        <span>Макс. напојување</span>
        <strong>{m.maxFlowTemp} °C</strong>
        <span>Цена</span>
        <strong>{m.price ? money(m.price, s.currency) : '–'}</strong>
      </div>
      {m.indoorUnit && <div className="small muted">+ {m.indoorUnit}</div>}
    </div>
  );
}
