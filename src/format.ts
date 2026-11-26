export const fmt = (x: number, digits = 0) =>
  Number.isFinite(x)
    ? x.toLocaleString('mk-MK', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '–';

export const kw = (watts: number) => `${fmt(watts / 1000, 2)} kW`;

export const money = (x: number, currency: string) => `${fmt(x, 2)} ${currency}`;

export const dateMk = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

export const temp = (t: number | null) => (t === null ? '–' : `${fmt(t, 1)} °C`);
