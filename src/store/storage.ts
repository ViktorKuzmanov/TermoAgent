import { defaultSettings } from '../domain/project';
import type { Project, Settings } from '../domain/types';

const PROJECTS_KEY = 'termoagent.projects.v1';
const SETTINGS_KEY = 'termoagent.settings.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Не може да се зачува', e);
  }
}

export function loadProjects(): Project[] {
  return read<Project[]>(PROJECTS_KEY) ?? [];
}

export function saveProjects(p: Project[]) {
  write(PROJECTS_KEY, p);
}

export function loadSettings(): Settings {
  const d = defaultSettings();
  const s = read<Partial<Settings>>(SETTINGS_KEY);
  if (!s) return d;
  return {
    ...d,
    ...s,
    company: { ...d.company, ...(s.company ?? {}) },
    energyPrices: { ...d.energyPrices, ...(s.energyPrices ?? {}) },
    catalog: s.catalog?.length ? s.catalog : d.catalog,
    climates: s.climates?.length ? s.climates : d.climates,
  };
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return reject(new Error('Нема датотека'));
      f.text().then((t) => {
        try {
          resolve(JSON.parse(t));
        } catch (e) {
          reject(e);
        }
      }, reject);
    };
    input.click();
  });
}
