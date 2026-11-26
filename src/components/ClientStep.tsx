import { OBJECT_TYPES } from '../domain/presets';
import type { Project, Settings } from '../domain/types';
import { Card, Field, NumInput, TextField } from './ui';

export function ClientStep({ p, s, update }: { p: Project; s: Settings; update: (fn: (p: Project) => Project) => void }) {
  const climate = s.climates.find((c) => c.id === p.site.climateId);
  const setClient = (k: keyof Project['client'], v: string) => update((x) => ({ ...x, client: { ...x.client, [k]: v } }));
  return (
    <div className="grid2">
      <Card title="Проект">
        <div className="form">
          <TextField label="Назив на проект" value={p.name} onChange={(v) => update((x) => ({ ...x, name: v }))} wide />
          <Field label="Тип на објект">
            <select value={p.site.objectType} onChange={(e) => update((x) => ({ ...x, site: { ...x.site, objectType: e.target.value } }))}>
              {OBJECT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <TextField
            label="Адреса на објектот"
            value={p.site.address}
            placeholder="ул. ..., Скопје"
            onChange={(v) => update((x) => ({ ...x, site: { ...x.site, address: v } }))}
          />
        </div>
      </Card>

      <Card title="Клиент">
        <div className="form">
          <TextField label="Име и презиме / Фирма" value={p.client.name} onChange={(v) => setClient('name', v)} wide />
          <TextField label="Контакт лице" value={p.client.contactPerson} onChange={(v) => setClient('contactPerson', v)} />
          <TextField label="Телефон" value={p.client.phone} onChange={(v) => setClient('phone', v)} />
          <TextField label="Е-пошта" value={p.client.email} onChange={(v) => setClient('email', v)} />
          <TextField label="Адреса на клиентот" value={p.client.address} onChange={(v) => setClient('address', v)} />
        </div>
      </Card>

      <Card title="Климатска зона" className="span2">
        <div className="form">
          <Field label="Локација">
            <select value={p.site.climateId} onChange={(e) => update((x) => ({ ...x, site: { ...x.site, climateId: e.target.value } }))}>
              {s.climates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (θe = {c.thetaE} °C)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Проектна надворешна температура θe" hint={p.site.thetaEOverride === null ? 'Од табелата за локацијата' : 'Рачно внесена вредност'}>
            <div className="row">
              <NumInput
                value={p.site.thetaEOverride ?? climate?.thetaE ?? -15}
                unit="°C"
                onChange={(v) => update((x) => ({ ...x, site: { ...x.site, thetaEOverride: v } }))}
              />
              {p.site.thetaEOverride !== null && (
                <button className="btn ghost sm" onClick={() => update((x) => ({ ...x, site: { ...x.site, thetaEOverride: null } }))}>
                  Ресетирај
                </button>
              )}
            </div>
          </Field>
          <Field label="Средна годишна температура θm,e">
            <div className="readonly">{climate?.thetaMe ?? '–'} °C</div>
          </Field>
          <Field label="Степен-денови HDD (20/12)">
            <div className="readonly">{climate?.hdd ?? '–'} K·d</div>
          </Field>
        </div>
        <p className="muted small">
          Климатските податоци се ориентациски и може да се уредат во Поставки → Климатски податоци, според важечкиот правилник.
        </p>
      </Card>
    </div>
  );
}
