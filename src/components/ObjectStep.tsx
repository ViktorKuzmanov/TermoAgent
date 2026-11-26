import { fmt } from '../format';
import {
  BOUNDARIES,
  BU_PRESETS,
  ELEMENT_KINDS,
  FLOOR_TYPES,
  getInsulation,
  getRoomType,
  INSULATION_PRESETS,
  ROOF_TYPES,
  ROOM_TYPES,
  SHAPES,
  SHIELDING,
} from '../domain/presets';
import { quickBuildingParams, quickGeometry, quickToDetailed, uid } from '../domain/quickModel';
import type { Boundary, BuildingElement, ElementKind, Project, Room, RoomTypeId } from '../domain/types';
import { Card, Check, Field, NumField, NumInput, Segmented, SelectField } from './ui';

type Update = (fn: (p: Project) => Project) => void;

export function ObjectStep({ p, update }: { p: Project; update: Update }) {
  return (
    <div className="stack">
      <div className="toolbar">
        <Segmented
          value={p.mode}
          options={[
            { id: 'quick', label: 'Брз режим (објект)' },
            { id: 'detailed', label: 'Детален режим (по простории)' },
          ]}
          onChange={(mode) =>
            update((x) => {
              if (mode === 'detailed' && x.rooms.length === 0)
                return { ...x, mode, rooms: quickToDetailed(x.quick), building: quickBuildingParams(x.quick, x.building) };
              return { ...x, mode };
            })
          }
        />
        <span className="muted small">
          {p.mode === 'quick'
            ? 'Внесете површина, катност и изолација – обвивката се генерира автоматски.'
            : 'Секоја просторија со свои елементи – за димензионирање на грејни тела.'}
        </span>
      </div>
      {p.mode === 'quick' ? <QuickForm p={p} update={update} /> : <RoomsEditor p={p} update={update} />}
      <BuildingForm p={p} update={update} />
    </div>
  );
}

function QuickForm({ p, update }: { p: Project; update: Update }) {
  const q = p.quick;
  const set = <K extends keyof typeof q>(k: K, v: (typeof q)[K]) => update((x) => ({ ...x, quick: { ...x.quick, [k]: v } }));
  const g = quickGeometry(q);
  const ins = getInsulation(q.insulation);
  return (
    <>
      <Card title="Изолација на објектот">
        <div className="ins-grid">
          {INSULATION_PRESETS.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`ins-card ${q.insulation === i.id ? 'on' : ''}`}
              onClick={() =>
                update((x) => ({ ...x, quick: { ...x.quick, insulation: i.id }, building: { ...x.building, n50: i.n50 } }))
              }
            >
              <strong>{i.label}</strong>
              <span>{i.description}</span>
              <span className="ins-u">
                Ѕид {i.uWall} · Прозор {i.uWindow} · Покрив {i.uRoof}
              </span>
            </button>
          ))}
        </div>
      </Card>
      <div className="grid2">
        <Card title="Геометрија">
          <div className="form">
            <NumField label="Грејна површина" unit="m²" value={q.area} min={0} onChange={(v) => set('area', v)} />
            <NumField label="Број на катови" value={q.floors} min={1} max={10} onChange={(v) => set('floors', Math.round(v) || 1)} />
            <NumField label="Светла височина" unit="m" value={q.storeyHeight} min={2} max={6} onChange={(v) => set('storeyHeight', v)} />
            <SelectField label="Форма на основата" value={q.shape} options={SHAPES} onChange={(v) => set('shape', v)} />
            <NumField
              label="Застаклување"
              unit="% од под"
              value={q.windowRatio}
              min={0}
              max={80}
              hint="Типично 12–20 %"
              onChange={(v) => set('windowRatio', v)}
            />
            <NumField label="Влезни врати" value={q.doors} min={0} max={10} onChange={(v) => set('doors', Math.round(v))} />
            <NumField
              label="Удел надворешни ѕидови"
              unit="%"
              value={q.exteriorWallShare}
              min={0}
              max={100}
              hint="Стан/низна куќа: помалку од 100 %"
              onChange={(v) => set('exteriorWallShare', v)}
            />
            <NumField label="Внатрешна температура" unit="°C" value={q.thetaInt} onChange={(v) => set('thetaInt', v)} />
            <SelectField label="Под" value={q.floorType} options={FLOOR_TYPES} onChange={(v) => set('floorType', v)} />
            <SelectField label="Покрив / таван" value={q.roofType} options={ROOF_TYPES} onChange={(v) => set('roofType', v)} />
          </div>
        </Card>
        <Card title="Генерирана обвивка">
          <table className="tbl">
            <tbody>
              <tr><td>Основа (по кат)</td><td className="r">{fmt(g.length, 1)} × {fmt(g.width, 1)} m = {fmt(g.footprint, 1)} m²</td></tr>
              <tr><td>Изложен периметар</td><td className="r">{fmt(g.perimeter, 1)} m</td></tr>
              <tr><td>Надворешни ѕидови (нето)</td><td className="r">{fmt(g.wallNet, 1)} m² · U {ins.uWall}</td></tr>
              <tr><td>Прозорци</td><td className="r">{fmt(g.windowArea, 1)} m² · U {ins.uWindow}</td></tr>
              <tr><td>Врати</td><td className="r">{fmt(g.doorArea, 1)} m² · U {ins.uDoor}</td></tr>
              <tr><td>Покрив / таван</td><td className="r">{q.roofType === 'heated' ? '–' : `${fmt(g.footprint * (q.roofType === 'pitched_heated' ? 1.2 : 1), 1)} m² · U ${ins.uRoof}`}</td></tr>
              <tr><td>Под</td><td className="r">{q.floorType === 'heated' ? '–' : `${fmt(g.footprint, 1)} m² · U ${ins.uFloor}`}</td></tr>
              <tr><td>Волумен</td><td className="r">{fmt(q.area * q.storeyHeight, 0)} m³</td></tr>
            </tbody>
          </table>
          <p className="muted small">
            За поточни површини и U-вредности, префрлете во „Детален режим“ – моделот се копира како почетна точка.
          </p>
        </Card>
      </div>
    </>
  );
}

function newElement(kind: ElementKind, p: Project): BuildingElement {
  const ins = getInsulation(p.quick.insulation);
  const map: Record<ElementKind, { label: string; u: number; boundary: Boundary }> = {
    wall: { label: 'Надворешен ѕид', u: ins.uWall, boundary: 'exterior' },
    window: { label: 'Прозорец', u: ins.uWindow, boundary: 'exterior' },
    door: { label: 'Врата', u: ins.uDoor, boundary: 'exterior' },
    roof: { label: 'Таван / покрив', u: ins.uRoof, boundary: 'exterior' },
    floor: { label: 'Под на тло', u: ins.uFloor, boundary: 'ground' },
  };
  const d = map[kind];
  return { id: uid(), kind, boundary: d.boundary, label: d.label, area: 0, u: d.u, bu: 0.5, thetaAdj: 15 };
}

function RoomsEditor({ p, update }: { p: Project; update: Update }) {
  const setRooms = (fn: (r: Room[]) => Room[]) => update((x) => ({ ...x, rooms: fn(x.rooms) }));
  const setRoom = (id: string, patch: Partial<Room>) => setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRoom = (type: RoomTypeId) => {
    const t = getRoomType(type);
    setRooms((rs) => [
      ...rs,
      {
        id: uid(),
        name: t.label,
        type,
        area: 15,
        height: p.quick.storeyHeight,
        thetaInt: t.thetaInt,
        nMin: t.nMin,
        elements: [{ ...newElement('wall', p), area: 10 }, { ...newElement('window', p), area: 2 }],
      },
    ]);
  };
  const totalArea = p.rooms.reduce((s, r) => s + r.area, 0);
  return (
    <Card
      title={`Простории (${p.rooms.length}) · ${fmt(totalArea, 1)} m²`}
      actions={
        <>
          <select className="sm" value="" onChange={(e) => e.target.value && addRoom(e.target.value as RoomTypeId)}>
            <option value="">+ Додади просторија…</option>
            {ROOM_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            className="btn ghost sm"
            onClick={() => {
              if (confirm('Да се заменат сите простории со моделот од брзиот режим?'))
                update((x) => ({ ...x, rooms: quickToDetailed(x.quick), building: quickBuildingParams(x.quick, x.building) }));
            }}
          >
            Копирај од брз режим
          </button>
        </>
      }
    >
      {p.rooms.length === 0 && <p className="muted">Нема простории. Додадете просторија или копирајте од брзиот режим.</p>}
      <div className="rooms">
        {p.rooms.map((r) => (
          <div className="room" key={r.id}>
            <div className="room-head">
              <input className="room-name" value={r.name} onChange={(e) => setRoom(r.id, { name: e.target.value })} />
              <select
                className="sm"
                value={r.type}
                onChange={(e) => {
                  const t = getRoomType(e.target.value as RoomTypeId);
                  setRoom(r.id, { type: t.id, thetaInt: t.thetaInt, nMin: t.nMin });
                }}
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="mini">A <NumInput compact value={r.area} unit="m²" min={0} onChange={(v) => setRoom(r.id, { area: v })} /></label>
              <label className="mini">h <NumInput compact value={r.height} unit="m" min={0} onChange={(v) => setRoom(r.id, { height: v })} /></label>
              <label className="mini">θint <NumInput compact value={r.thetaInt} unit="°C" onChange={(v) => setRoom(r.id, { thetaInt: v })} /></label>
              <label className="mini">n<sub>min</sub> <NumInput compact value={r.nMin} unit="1/h" min={0} onChange={(v) => setRoom(r.id, { nMin: v })} /></label>
              <span className="spacer" />
              <button
                className="btn ghost sm"
                title="Дуплирај"
                onClick={() =>
                  setRooms((rs) => {
                    const i = rs.findIndex((x) => x.id === r.id);
                    const copy: Room = { ...r, id: uid(), name: `${r.name} (копија)`, elements: r.elements.map((e) => ({ ...e, id: uid() })) };
                    return [...rs.slice(0, i + 1), copy, ...rs.slice(i + 1)];
                  })
                }
              >
                ⧉
              </button>
              <button className="btn ghost sm danger" title="Избриши" onClick={() => setRooms((rs) => rs.filter((x) => x.id !== r.id))}>
                ✕
              </button>
            </div>
            <ElementsTable
              room={r}
              onChange={(elements) => setRoom(r.id, { elements })}
              onAdd={(k) => setRoom(r.id, { elements: [...r.elements, newElement(k, p)] })}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ElementsTable({ room, onChange, onAdd }: { room: Room; onChange: (e: BuildingElement[]) => void; onAdd: (k: ElementKind) => void }) {
  const set = (id: string, patch: Partial<BuildingElement>) => onChange(room.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return (
    <table className="tbl el-tbl">
      <thead>
        <tr>
          <th>Елемент</th>
          <th>Опис</th>
          <th>Граничи со</th>
          <th className="r">A [m²]</th>
          <th className="r">U [W/m²K]</th>
          <th className="r">b<sub>u</sub> / θ<sub>adj</sub></th>
          <th />
        </tr>
      </thead>
      <tbody>
        {room.elements.map((e) => (
          <tr key={e.id}>
            <td>
              <select value={e.kind} onChange={(ev) => set(e.id, { kind: ev.target.value as ElementKind })}>
                {ELEMENT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <input value={e.label} onChange={(ev) => set(e.id, { label: ev.target.value })} />
            </td>
            <td>
              <select value={e.boundary} onChange={(ev) => set(e.id, { boundary: ev.target.value as Boundary })}>
                {BOUNDARIES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </td>
            <td className="r">
              <NumInput compact value={e.area} min={0} onChange={(v) => set(e.id, { area: v })} />
            </td>
            <td className="r">
              <NumInput compact value={e.u} min={0} onChange={(v) => set(e.id, { u: v })} />
            </td>
            <td className="r">
              {e.boundary === 'unheated' ? (
                <select className="bu" value={String(e.bu ?? 0.5)} onChange={(ev) => set(e.id, { bu: parseFloat(ev.target.value) })}>
                  {[...new Set([...(BU_PRESETS.map((b) => b.value)), e.bu ?? 0.5])].sort().map((v) => (
                    <option key={v} value={String(v)} title={BU_PRESETS.filter((b) => b.value === v).map((b) => b.label).join('; ')}>
                      {v} – {BU_PRESETS.find((b) => b.value === v)?.label ?? 'рачно'}
                    </option>
                  ))}
                </select>
              ) : e.boundary === 'adjacent' ? (
                <NumInput compact value={e.thetaAdj ?? 15} unit="°C" onChange={(v) => set(e.id, { thetaAdj: v })} />
              ) : (
                <span className="muted">–</span>
              )}
            </td>
            <td>
              <button className="btn ghost sm danger" onClick={() => onChange(room.elements.filter((x) => x.id !== e.id))}>
                ✕
              </button>
            </td>
          </tr>
        ))}
        <tr className="add-row">
          <td colSpan={7}>
            {ELEMENT_KINDS.map((k) => (
              <button key={k.id} className="btn ghost sm" onClick={() => onAdd(k.id)}>
                + {k.label}
              </button>
            ))}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function BuildingForm({ p, update }: { p: Project; update: Update }) {
  const b = p.building;
  const set = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => update((x) => ({ ...x, building: { ...x.building, [k]: v } }));
  return (
    <Card title="Вентилација, херметичност и тло">
      <div className="form">
        <NumField label="Херметичност n50" unit="1/h" value={b.n50} min={0} hint="Ново ≈ 2–3, старо ≈ 6–10" onChange={(v) => set('n50', v)} />
        <SelectField label="Заштита од ветер" value={b.shielding} options={SHIELDING} onChange={(v) => set('shielding', v)} />
        <SelectField
          label="Вентилација"
          value={b.ventilation}
          options={[
            { id: 'natural', label: 'Природна (прозорци)' },
            { id: 'mvhr', label: 'Механичка со рекуперација' },
          ]}
          onChange={(v) => set('ventilation', v)}
        />
        {b.ventilation === 'mvhr' && (
          <NumField
            label="Ефикасност на рекуператор"
            unit="%"
            value={Math.round(b.mvhrEfficiency * 100)}
            min={0}
            max={95}
            onChange={(v) => set('mvhrEfficiency', v / 100)}
          />
        )}
        <NumField label="Термички мостови ΔU_TB" unit="W/m²K" value={b.deltaUtb} min={0} hint="EN 12831-1 стандардно: 0.10" onChange={(v) => set('deltaUtb', v)} />
        <NumField label="Загревање по прекин f_RH" unit="W/m²" value={b.reheat} min={0} hint="0 за континуирано греење" onChange={(v) => set('reheat', v)} />
        {p.mode === 'detailed' && (
          <>
            <NumField label="Површина на под на тло A_g" unit="m²" value={b.groundArea} min={0} onChange={(v) => set('groundArea', v)} />
            <NumField label="Изложен периметар P" unit="m" value={b.exposedPerimeter} min={0} onChange={(v) => set('exposedPerimeter', v)} />
          </>
        )}
        <Field label="Подземна вода">
          <Check label="Поплитко од 1 m (G_w = 1.15)" checked={b.groundwaterShallow} onChange={(v) => set('groundwaterShallow', v)} />
        </Field>
      </div>
    </Card>
  );
}
