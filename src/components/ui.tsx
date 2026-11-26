import { useEffect, useState, type ReactNode } from 'react';

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, wide }: { label: ReactNode; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function NumInput({
  value,
  onChange,
  step = 'any',
  min,
  max,
  unit,
  placeholder,
  compact,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  step?: number | 'any';
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value === null || value === undefined ? '' : String(value));
  }, [value, focused]);
  return (
    <span className={`num ${compact ? 'compact' : ''}`}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        data-step={step}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.');
          setText(t);
          const v = parseFloat(t);
          if (!Number.isNaN(v)) {
            let x = v;
            if (min !== undefined) x = Math.max(min, x);
            if (max !== undefined) x = Math.min(max, x);
            onChange(x);
          } else if (t === '') onChange(0);
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </span>
  );
}

export function NumField(props: {
  label: ReactNode;
  value: number | null | undefined;
  onChange: (v: number) => void;
  unit?: string;
  hint?: ReactNode;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const { label, hint, ...rest } = props;
  return (
    <Field label={label} hint={hint}>
      <NumInput {...rest} />
    </Field>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  wide,
  multiline,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      {multiline ? (
        <textarea value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: ReactNode;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'ok' | 'warn' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} type="button" className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
