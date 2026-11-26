/**
 * Генерирање на понуда како Word (.docx) документ – уредлив пред испраќање до клиентот.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
} from 'docx';
import type { Align, Block, OfferModel } from './offerModel';
import { CHART_H, CHART_W, svgToPng } from './chart';

const PRIMARY = '0B3A66';
const ACCENT = 'F28C28';
const MUTED = '5B6773';
const LINE = 'D5DCE4';
const FONT = 'Arial';
/** A4 ширина 11906 twips − маргини 2 × 1000 */
const CONTENT_W = 9906;

const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const thin: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

const align = (a?: Align) => (a === 'r' ? AlignmentType.RIGHT : a === 'c' ? AlignmentType.CENTER : AlignmentType.LEFT);

function run(text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text, font: FONT, bold: o.bold, size: o.size ?? 20, color: o.color, italics: o.italics });
}

function para(text: string, o: { bold?: boolean; size?: number; color?: string; align?: Align; after?: number; before?: number } = {}) {
  return new Paragraph({
    alignment: align(o.align),
    spacing: { after: o.after ?? 80, before: o.before ?? 0 },
    children: [run(text, o)],
  });
}

function cell(children: Paragraph[], o: { width: number; fill?: string; borders?: Record<string, IBorderOptions> } = { width: 0 }) {
  return new TableCell({
    children,
    width: { size: o.width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    verticalAlign: VerticalAlign.CENTER,
    borders: o.borders,
  });
}

function dataTable(b: Extract<Block, { t: 'table' }>): Table {
  const n = b.head.length;
  const pct = b.widths ?? Array(n).fill(100 / n);
  const widths = pct.map((w) => Math.round((w / 100) * CONTENT_W));
  const size = b.small ? 16 : 18;
  const head = new TableRow({
    tableHeader: true,
    children: b.head.map((h, i) =>
      cell([para(h, { bold: true, size, color: 'FFFFFF', align: b.align?.[i], after: 0 })], { width: widths[i], fill: PRIMARY }),
    ),
  });
  const rows = b.rows.map(
    (r, ri) =>
      new TableRow({
        children: r.map((v, i) =>
          cell([para(v, { size, align: b.align?.[i], after: 0 })], { width: widths[i], fill: ri % 2 ? 'F5F7FA' : undefined }),
        ),
      }),
  );
  const foot = (b.foot ?? []).map(
    (r, fi, arr) =>
      new TableRow({
        children: r.map((v, i) =>
          cell(
            [
              para(v, {
                size: fi === arr.length - 1 ? size + 2 : size,
                bold: true,
                align: b.align?.[i],
                after: 0,
                color: fi === arr.length - 1 ? PRIMARY : undefined,
              }),
            ],
            { width: widths[i], fill: 'E8EEF5' },
          ),
        ),
      }),
  );
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin },
    rows: [head, ...rows, ...foot],
  });
}

function kvTable(rows: [string, string][]): Table {
  const w = [Math.round(CONTENT_W * 0.4), Math.round(CONTENT_W * 0.6)];
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: w,
    borders: { top: none, left: none, right: none, bottom: thin, insideHorizontal: thin, insideVertical: none },
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            cell([para(k, { color: MUTED, size: 18, after: 0 })], { width: w[0] }),
            cell([para(v, { size: 19, after: 0 })], { width: w[1] }),
          ],
        }),
    ),
  });
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' } {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const type = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('gif') ? 'gif' : mime.includes('bmp') ? 'bmp' : 'png';
  return { bytes, type };
}

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth || 200, h: img.naturalHeight || 60 });
    img.onerror = () => res({ w: 200, h: 60 });
    img.src = dataUrl;
  });
}

export async function buildOfferDocx(m: OfferModel): Promise<Blob> {
  const c = m.company;

  // ── Заглавие: лого + податоци за фирмата ──
  const left: Paragraph[] = [];
  if (c.logoDataUrl && /^data:image\/(png|jpe?g|gif|bmp)/.test(c.logoDataUrl)) {
    const { bytes, type } = dataUrlToBytes(c.logoDataUrl);
    const { w, h } = await imageSize(c.logoDataUrl);
    const height = 56;
    const width = Math.min(220, Math.round((w / h) * height));
    left.push(new Paragraph({ children: [new ImageRun({ type, data: bytes, transformation: { width, height: Math.round((width / w) * h) } })] }));
  } else {
    left.push(para(c.name, { bold: true, size: 32, color: PRIMARY, after: 0 }));
  }
  const right = [
    para(c.name, { bold: true, size: 18, align: 'r', after: 0, color: PRIMARY }),
    para(c.address, { size: 16, align: 'r', after: 0, color: MUTED }),
    para(`Тел: ${c.phone}`, { size: 16, align: 'r', after: 0, color: MUTED }),
    para(`${c.email} · ${c.web}`, { size: 16, align: 'r', after: 0, color: MUTED }),
    ...(c.taxId ? [para(`ЕДБ: ${c.taxId}`, { size: 16, align: 'r', after: 0, color: MUTED })] : []),
    ...(c.bankAccount ? [para(`Ж-с: ${c.bankAccount}`, { size: 16, align: 'r', after: 0, color: MUTED })] : []),
  ];
  const half = Math.round(CONTENT_W / 2);
  const header = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [half, CONTENT_W - half],
    borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT } },
    rows: [new TableRow({ children: [cell(left, { width: half }), cell(right, { width: CONTENT_W - half })] })],
  });

  const children: (Paragraph | Table)[] = [header, para('', { after: 120 })];

  // ── Наслов и примач ──
  const titleW = [Math.round(CONTENT_W * 0.55), CONTENT_W - Math.round(CONTENT_W * 0.55)];
  children.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: titleW,
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            cell(
              [para('До:', { size: 16, color: MUTED, after: 20 }), ...m.recipient.map((r, i) => para(r, { bold: i === 0, size: i === 0 ? 22 : 19, after: 0 }))],
              { width: titleW[0] },
            ),
            cell(
              [
                para(`ПОНУДА бр. ${m.number}`, { bold: true, size: 30, color: PRIMARY, align: 'r', after: 40 }),
                para(`Датум: ${m.date}`, { size: 19, align: 'r', after: 0 }),
                para(`Важи до: ${m.validUntil}`, { size: 19, align: 'r', after: 0, color: MUTED }),
              ],
              { width: titleW[1] },
            ),
          ],
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { before: 240, after: 160 },
      children: [run('Предмет: ', { bold: true, size: 22 }), run(m.subject, { size: 22 })],
    }),
  );

  // ── Блокови ──
  for (const b of m.blocks) {
    switch (b.t) {
      case 'h':
        children.push(
          new Paragraph({
            spacing: { before: b.level === 1 ? 280 : 200, after: 100 },
            keepNext: true,
            border: b.level === 1 ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 2 } } : undefined,
            children: [run(b.text, { bold: true, size: b.level === 1 ? 24 : 21, color: PRIMARY })],
          }),
        );
        break;
      case 'p':
        children.push(para(b.text, { bold: b.bold, size: b.small ? 16 : 20, color: b.muted ? MUTED : undefined, after: 120, before: 60 }));
        break;
      case 'kv':
        children.push(kvTable(b.rows), para('', { after: 60 }));
        break;
      case 'table':
        children.push(dataTable(b), para('', { after: 60 }));
        break;
      case 'chart': {
        try {
          const png = await svgToPng(b.svg);
          const width = 600;
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 40 },
              children: [new ImageRun({ type: 'png', data: png, transformation: { width, height: Math.round((width / CHART_W) * CHART_H) } })],
            }),
          );
          if (b.caption) children.push(para(b.caption, { size: 16, color: MUTED, align: 'c', after: 120 }));
        } catch {
          /* дијаграмот е опционален */
        }
        break;
      }
      case 'pagebreak':
        children.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'signatures': {
        const w = Math.round(CONTENT_W / b.items.length);
        children.push(para('', { after: 400 }));
        children.push(
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            columnWidths: b.items.map(() => w),
            borders: noBorders,
            rows: [
              new TableRow({
                children: b.items.map((it) =>
                  cell(
                    [
                      para(it.title, { size: 18, color: MUTED, align: 'c', after: 480 }),
                      para('______________________________', { align: 'c', after: 20, color: MUTED }),
                      para(it.name, { size: 19, align: 'c', after: 0 }),
                    ],
                    { width: w },
                  ),
                ),
              }),
            ],
          }),
        );
        break;
      }
    }
  }

  const doc = new Document({
    creator: c.name,
    title: `Понуда ${m.number}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${c.name} · Понуда бр. ${m.number} · Страна `, font: FONT, size: 15, color: MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: MUTED }),
                  new TextRun({ text: ' од ', font: FONT, size: 15, color: MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
