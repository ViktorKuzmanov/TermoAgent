import { fmt, kw } from '../format';
import type { Breakdown } from '../domain/en12831';
import { BOUNDARIES, BREAKDOWN_LABELS } from '../domain/presets';
import type { ProjectComputation } from '../domain/project';
import { Card, Stat } from './ui';



const COLORS: Record<keyof Breakdown, string> = {
  wall: '#0b3a66',
  window: '#2f7fc1',
  door: '#7fb2dd',
  roof: '#f28c28',
  floor: '#a65c12',
  ventilation: '#3aa17e',
  reheat: '#9aa5b1',
};

export function LoadStep({ c }: { c: ProjectComputation }) {
  const L = c.load;
  const entries = (Object.keys(L.breakdown) as (keyof Breakdown)[]).filter((k) => L.breakdown[k] > 0.5);
  const max = Math.max(1, ...entries.map((k) => L.breakdown[k]));
  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Проектно топлинско оптоварување Φ_HL" value={kw(L.phiHL)} tone="accent" sub={`при θe = ${c.thetaE} °C`} />
        <Stat label="Специфично оптоварување" value={`${fmt(L.specific, 1)} W/m²`} sub={`${fmt(L.area, 1)} m² · ${fmt(L.volume, 0)} m³`} />
        <Stat label="Трансмисиони загуби Φ_T" value={kw(L.phiT)} sub={`${fmt((L.phiT / Math.max(1, L.phiHL)) * 100, 0)} %`} />
        <Stat label="Вентилациони загуби Φ_V" value={kw(L.phiV)} sub={`${fmt((L.phiV / Math.max(1, L.phiHL)) * 100, 0)} %`} />
        <Stat label="Потребна моќност на пумпа" value={`${fmt(c.requiredKw, 2)} kW`} tone="ok" sub={c.dhwKw > 0 ? `вкл. ТСВ +${fmt(c.dhwKw, 2)} kW` : 'без додаток за ТСВ'} />
      </div>

      <div className="grid2">
        <Card title="Каде се губи топлината">
          <div className="bars">
            {entries.map((k) => (
              <div className="bar-row" key={k}>
                <span className="bar-label">{BREAKDOWN_LABELS[k]}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(L.breakdown[k] / max) * 100}%`, background: COLORS[k] }} />
                </span>
                <span className="bar-val">
                  {fmt(L.breakdown[k] / 1000, 2)} kW · {fmt((L.breakdown[k] / Math.max(1, L.phiHL)) * 100, 0)} %
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Параметри на пресметката">
          <table className="tbl">
            <tbody>
              <tr><td>Метод</td><td className="r">EN 12831-1, по простории</td></tr>
              <tr><td>Локација</td><td className="r">{c.climate.name}</td></tr>
              <tr><td>θe / θm,e</td><td className="r">{c.thetaE} °C / {c.climate.thetaMe} °C</td></tr>
              <tr><td>Пондерирана θint</td><td className="r">{fmt(L.thetaIntAvg, 1)} °C</td></tr>
              <tr><td>H вкупно (T + V)</td><td className="r">{fmt(L.hTotal, 1)} W/K</td></tr>
              <tr><td>B' (под на тло)</td><td className="r">{L.bPrime > 0 && L.bPrime < 1000 ? `${fmt(L.bPrime, 2)} m` : '–'}</td></tr>
              <tr><td>ΔU_TB / n50</td><td className="r">{c.building.deltaUtb} W/m²K / {c.building.n50} 1/h</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Оптоварување по простории">
        <table className="tbl">
          <thead>
            <tr>
              <th>Просторија</th>
              <th className="r">A [m²]</th>
              <th className="r">θint</th>
              <th className="r">Φ_T [W]</th>
              <th className="r">V̇ [m³/h]</th>
              <th className="r">Φ_V [W]</th>
              <th className="r">Φ_RH [W]</th>
              <th className="r">Φ_HL [W]</th>
              <th className="r">W/m²</th>
            </tr>
          </thead>
          <tbody>
            {L.rooms.map((r) => (
              <tr key={r.room.id}>
                <td>{r.room.name}</td>
                <td className="r">{fmt(r.room.area, 1)}</td>
                <td className="r">{r.room.thetaInt} °C</td>
                <td className="r">{fmt(r.phiT)}</td>
                <td className="r">{fmt(r.vFlow, 1)}</td>
                <td className="r">{fmt(r.phiV)}</td>
                <td className="r">{fmt(r.phiRH)}</td>
                <td className="r strong">{fmt(r.phiHL)}</td>
                <td className="r">{fmt(r.specific, 1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Вкупно</td>
              <td className="r">{fmt(L.area, 1)}</td>
              <td />
              <td className="r">{fmt(L.phiT)}</td>
              <td className="r">{fmt(L.rooms.reduce((s, r) => s + r.vFlow, 0), 1)}</td>
              <td className="r">{fmt(L.phiV)}</td>
              <td className="r">{fmt(L.phiRH)}</td>
              <td className="r strong">{fmt(L.phiHL)}</td>
              <td className="r">{fmt(L.specific, 1)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <Card title="Трансмисиони загуби по елементи">
        <table className="tbl">
          <thead>
            <tr>
              <th>Просторија</th>
              <th>Елемент</th>
              <th>Граничи со</th>
              <th className="r">A [m²]</th>
              <th className="r">U [W/m²K]</th>
              <th className="r">U_eff</th>
              <th className="r">H [W/K]</th>
              <th className="r">Φ [W]</th>
            </tr>
          </thead>
          <tbody>
            {L.rooms.flatMap((r) =>
              r.elements.map((e) => (
                <tr key={r.room.id + e.element.id}>
                  <td className="muted">{r.room.name}</td>
                  <td>{e.element.label}</td>
                  <td>{BOUNDARIES.find((b) => b.id === e.element.boundary)?.label}</td>
                  <td className="r">{fmt(e.element.area, 2)}</td>
                  <td className="r">{fmt(e.element.u, 2)}</td>
                  <td className="r">{fmt(e.uEff, 3)}</td>
                  <td className="r">{fmt(e.h, 2)}</td>
                  <td className="r">{fmt(e.phi)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
