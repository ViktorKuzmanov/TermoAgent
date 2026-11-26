import { useEffect, useMemo, useRef, useState } from 'react';
import { ClientStep } from './components/ClientStep';
import { LoadStep } from './components/LoadStep';
import { ObjectStep } from './components/ObjectStep';
import { OfferStep } from './components/OfferStep';
import { PumpStep } from './components/PumpStep';
import { SettingsPage } from './components/SettingsPage';
import { computeProject, newProject } from './domain/project';
import { uid } from './domain/quickModel';
import type { Project, Settings } from './domain/types';
import { dateMk, fmt } from './format';
import { downloadJson, loadProjects, loadSettings, pickJsonFile, saveProjects, saveSettings } from './store/storage';

const STEPS = ['Клиент и локација', 'Објект', 'Топлинско оптоварување', 'Топлинска пумпа', 'Понуда'] as const;

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [projects, setProjects] = useState<Project[]>(() => {
    const ps = loadProjects();
    return ps.length ? ps : [];
  });
  const [currentId, setCurrentId] = useState<string | null>(() => projects[0]?.id ?? null);
  const [view, setView] = useState<'project' | 'settings'>('project');
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => saveProjects(projects), [projects]);
  useEffect(() => saveSettings(settings), [settings]);

  const createProject = () => {
    const p = newProject(settings);
    setSettings((s) => ({ ...s, offerCounter: s.offerCounter + 1 }));
    setProjects((ps) => [p, ...ps]);
    setCurrentId(p.id);
    setView('project');
    setStep(0);
  };

  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    if (projects.length === 0) createProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = projects.find((p) => p.id === currentId) ?? projects[0] ?? null;
  const update = (fn: (p: Project) => Project) =>
    setProjects((ps) => ps.map((p) => (p.id === current?.id ? { ...fn(p), updatedAt: new Date().toISOString() } : p)));

  const comp = useMemo(() => (current ? computeProject(current, settings) : null), [current, settings]);

  const filtered = projects
    .filter((p) => !query || `${p.name} ${p.client.name} ${p.site.address} ${p.offer.number}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" width="26" height="26">
              <rect width="32" height="32" rx="7" fill="#f28c28" />
              <path d="M16 6c4 5 6 8 6 11a6 6 0 0 1-12 0c0-2 1-4 2-5 0 2 1 3 2 3 0-3 1-6 2-9z" fill="#fff" />
            </svg>
          </span>
          <div>
            <div className="brand-title">TermoAgent</div>
            <div className="brand-sub">{settings.company.name} · Пресметка и понуди за топлински пумпи</div>
          </div>
        </div>
        {comp && view === 'project' && (
          <div className="topbar-summary">
            <span>
              Φ<sub>HL</sub> <strong>{fmt(comp.load.phiHL / 1000, 2)} kW</strong>
            </span>
            <span>
              <strong>{fmt(comp.load.specific, 0)}</strong> W/m²
            </span>
            <span>
              Пумпа <strong>{comp.selected ? comp.selected.model.model : '—'}</strong>
            </span>
          </div>
        )}
        <button className={`btn ${view === 'settings' ? 'primary' : 'ghost-light'}`} onClick={() => setView(view === 'settings' ? 'project' : 'settings')}>
          {view === 'settings' ? '← Назад кон проект' : '⚙ Поставки'}
        </button>
      </header>

      <div className="body">
        <aside className="sidebar no-print">
          <button className="btn primary block" onClick={createProject}>
            + Нов проект
          </button>
          <input className="search" placeholder="Барај проект, клиент…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="plist">
            {filtered.map((p) => (
              <li key={p.id} className={p.id === current?.id ? 'on' : ''} onClick={() => { setCurrentId(p.id); setView('project'); }}>
                <div className="pname">{p.name || 'Без назив'}</div>
                <div className="pmeta">
                  {p.client.name || '—'} · {p.offer.number}
                </div>
                <div className="pmeta">{dateMk(p.updatedAt)}</div>
              </li>
            ))}
          </ul>
          {current && (
            <div className="side-actions">
              <button
                className="btn ghost sm"
                onClick={() => {
                  const copy: Project = {
                    ...structuredClone(current),
                    id: uid(),
                    name: `${current.name} (копија)`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  setProjects((ps) => [copy, ...ps]);
                  setCurrentId(copy.id);
                }}
              >
                Дуплирај
              </button>
              <button className="btn ghost sm" onClick={() => downloadJson(current, `proekt_${current.offer.number.replace('/', '-')}.json`)}>
                Извези
              </button>
              <button
                className="btn ghost sm"
                onClick={async () => {
                  try {
                    const p = (await pickJsonFile()) as Project;
                    if (!p || !p.quick || !p.offer) throw new Error('Невалиден проект');
                    const imported = { ...p, id: uid(), updatedAt: new Date().toISOString() };
                    setProjects((ps) => [imported, ...ps]);
                    setCurrentId(imported.id);
                  } catch (e) {
                    alert('Увозот не успеа: ' + (e as Error).message);
                  }
                }}
              >
                Увези
              </button>
              <button
                className="btn ghost sm danger"
                onClick={() => {
                  if (!confirm(`Да се избрише проектот „${current.name}“?`)) return;
                  const rest = projects.filter((p) => p.id !== current.id);
                  setProjects(rest);
                  setCurrentId(rest[0]?.id ?? null);
                  if (rest.length === 0) setTimeout(createProject, 0);
                }}
              >
                Избриши
              </button>
            </div>
          )}
        </aside>

        <main className="main">
          {view === 'settings' ? (
            <SettingsPage s={settings} set={setSettings} />
          ) : current && comp ? (
            <>
              <nav className="steps no-print">
                {STEPS.map((label, i) => {
                  const done = (i === 3 && !!current.selectedModelId) || (i === 4 && current.offer.items.length > 0);
                  return (
                    <button key={label} className={`${step === i ? 'on' : ''} ${done ? 'done' : ''}`} onClick={() => setStep(i)}>
                      <span className="step-n">{done ? '✓' : i + 1}</span>
                      {label}
                    </button>
                  );
                })}
              </nav>
              <div className="step-body">
                {step === 0 && <ClientStep p={current} s={settings} update={update} />}
                {step === 1 && <ObjectStep p={current} update={update} />}
                {step === 2 && <LoadStep c={comp} />}
                {step === 3 && <PumpStep p={current} s={settings} c={comp} update={update} />}
                {step === 4 && <OfferStep p={current} s={settings} c={comp} update={update} />}
              </div>
              <div className="step-nav no-print">
                <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
                  ← Назад
                </button>
                {step < STEPS.length - 1 && (
                  <button className="btn primary" onClick={() => setStep(step + 1)}>
                    {STEPS[step + 1]} →
                  </button>
                )}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
