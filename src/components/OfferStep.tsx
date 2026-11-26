import { useMemo, useState } from 'react';
import { buildOfferDocx } from '../docs/docxOffer';
import { buildOfferModel } from '../docs/offerModel';
import { fmt, money } from '../format';
import { buildLineItems, offerTotals, type ProjectComputation } from '../domain/project';
import { uid } from '../domain/quickModel';
import type { LineItem, Project, Settings } from '../domain/types';
import { downloadBlob } from '../store/storage';
import { OfferPreview } from './OfferPreview';
import { Card, Check, Field, NumField, NumInput, TextField } from './ui';

type Update = (fn: (p: Project) => Project) => void;

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 60);

export function OfferStep({ p, s, c, update }: { p: Project; s: Settings; c: ProjectComputation; update: Update }) {
  const o = p.offer;
  const setO = <K extends keyof typeof o>(k: K, v: (typeof o)[K]) => update((x) => ({ ...x, offer: { ...x.offer, [k]: v } }));
  const setItems = (fn: (i: LineItem[]) => LineItem[]) => update((x) => ({ ...x, offer: { ...x.offer, items: fn(x.offer.items) } }));
  const model = useMemo(() => buildOfferModel(p, s, c), [p, s, c]);
  const totals = offerTotals(o.items, o.discountPct, s.vatPct);
  const [busy, setBusy] = useState(false);
  const selModel = s.catalog.find((m) => m.id === p.selectedModelId);
  const zeroPrices = o.items.filter((i) => !i.unitPrice).length;

  const generate = () => {
    if (!selModel) return;
    if (o.items.length && !confirm('Да се заменат постоечките ставки со нови од избраниот модел?')) return;
    setItems(() => buildLineItems(selModel, p, s, c.selected));
  };

  const downloadDocx = async () => {
    setBusy(true);
    try {
      const blob = await buildOfferDocx(model);
      downloadBlob(blob, `Ponuda_${safeName(o.number)}_${safeName(p.client.name || p.name)}.docx`);
    } catch (e) {
      alert('Грешка при генерирање на документот: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="offer-layout">
      <div className="stack offer-form no-print">
        {!selModel && <div className="warn-box">Прво изберете топлинска пумпа во чекор 4.</div>}
        <Card title="Податоци за понудата">
          <div className="form">
            <TextField label="Број на понуда" value={o.number} onChange={(v) => setO('number', v)} />
            <Field label="Датум">
              <input type="date" value={o.date} onChange={(e) => setO('date', e.target.value)} />
            </Field>
            <NumField label="Важност" unit="дена" value={o.validityDays} min={1} onChange={(v) => setO('validityDays', Math.round(v))} />
            <TextField label="Изготвил (инженер)" value={o.engineer} onChange={(v) => setO('engineer', v)} />
            <TextField label="Предмет" value={o.subject} onChange={(v) => setO('subject', v)} wide />
            <TextField label="Вовед" value={o.intro} onChange={(v) => setO('intro', v)} wide multiline />
          </div>
        </Card>

        <Card
          title="Ставки"
          actions={
            <>
              <button className="btn sm" onClick={generate} disabled={!selModel}>
                ↻ Генерирај од избор
              </button>
              <button
                className="btn ghost sm"
                onClick={() => setItems((it) => [...it, { id: uid(), description: 'Нова ставка', unit: 'ком.', qty: 1, unitPrice: 0 }])}
              >
                + Ставка
              </button>
            </>
          }
        >
          {o.items.length === 0 ? (
            <p className="muted">Нема ставки. Кликнете „Генерирај од избор“.</p>
          ) : (
            <table className="tbl items">
              <thead>
                <tr>
                  <th>Опис</th>
                  <th>Ед.</th>
                  <th className="r">Кол.</th>
                  <th className="r">Ед. цена</th>
                  <th className="r">Износ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {o.items.map((it, i) => (
                  <tr key={it.id}>
                    <td>
                      <textarea
                        rows={2}
                        value={it.description}
                        onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x)))}
                      />
                    </td>
                    <td>
                      <input
                        className="unit-in"
                        value={it.unit}
                        onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, unit: e.target.value } : x)))}
                      />
                    </td>
                    <td className="r">
                      <NumInput compact value={it.qty} min={0} onChange={(v) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, qty: v } : x)))} />
                    </td>
                    <td className="r">
                      <NumInput
                        compact
                        value={it.unitPrice}
                        min={0}
                        onChange={(v) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, unitPrice: v } : x)))}
                      />
                    </td>
                    <td className="r nowrap">{fmt(it.qty * it.unitPrice, 2)}</td>
                    <td className="nowrap">
                      <button
                        className="btn ghost sm"
                        disabled={i === 0}
                        onClick={() => setItems((xs) => { const a = [...xs]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })}
                      >
                        ↑
                      </button>
                      <button className="btn ghost sm danger" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="totals">
            <label className="mini">
              Попуст <NumInput compact value={o.discountPct} unit="%" min={0} max={100} onChange={(v) => setO('discountPct', v)} />
            </label>
            <div>
              Без ДДВ: <strong>{money(totals.net, s.currency)}</strong>
            </div>
            <div>
              ДДВ {s.vatPct} %: <strong>{money(totals.vat, s.currency)}</strong>
            </div>
            <div className="grand">
              Вкупно: <strong>{money(totals.total, s.currency)}</strong>
            </div>
          </div>
          {zeroPrices > 0 && (
            <p className="warn-text small">
              {zeroPrices} {zeroPrices === 1 ? 'ставка нема' : 'ставки немаат'} цена. Цените за моделите се внесуваат во Поставки → Каталог.
            </p>
          )}
        </Card>

        <Card title="Содржина на документот">
          <div className="checks">
            <Check label="Алтернативни решенија (други брендови)" checked={o.includeAlternatives} onChange={(v) => setO('includeAlternatives', v)} />
            <Check label="Проценка на годишни трошоци и заштеда" checked={o.includeEnergy} onChange={(v) => setO('includeEnergy', v)} />
            <Check label="Прилог: детална пресметка EN 12831" checked={o.includeAnnex} onChange={(v) => setO('includeAnnex', v)} />
          </div>
          <TextField label="Забелешки (се печатат во понудата)" value={o.notes} onChange={(v) => setO('notes', v)} wide multiline />
        </Card>

        <div className="export-bar">
          <button className="btn primary lg" onClick={downloadDocx} disabled={busy}>
            {busy ? 'Се генерира…' : '⬇ Преземи Word (.docx)'}
          </button>
          <button className="btn lg" onClick={() => window.print()}>
            🖨 Печати / Зачувај PDF
          </button>
        </div>
      </div>

      <div className="offer-preview">
        <div className="preview-label no-print">Преглед на документот</div>
        <div className="print-area">
          <OfferPreview m={model} />
        </div>
      </div>
    </div>
  );
}
