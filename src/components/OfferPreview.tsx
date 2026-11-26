import type { Align, OfferModel } from '../docs/offerModel';

const cls = (a?: Align) => (a === 'r' ? 'r' : a === 'c' ? 'c' : '');

/** HTML приказ на понудата – истиот се користи за печатење / PDF. */
export function OfferPreview({ m }: { m: OfferModel }) {
  const c = m.company;
  return (
    <div className="doc">
      <div className="doc-header">
        <div className="doc-logo">{c.logoDataUrl ? <img src={c.logoDataUrl} alt={c.name} /> : <span className="doc-company">{c.name}</span>}</div>
        <div className="doc-contact">
          <strong>{c.name}</strong>
          <div>{c.address}</div>
          <div>Тел: {c.phone}</div>
          <div>
            {c.email} · {c.web}
          </div>
          {c.taxId && <div>ЕДБ: {c.taxId}</div>}
          {c.bankAccount && <div>Ж-с: {c.bankAccount}</div>}
        </div>
      </div>

      <div className="doc-title-row">
        <div>
          <div className="doc-small">До:</div>
          {m.recipient.length ? (
            m.recipient.map((r, i) => (
              <div key={i} className={i === 0 ? 'doc-recipient' : ''}>
                {r}
              </div>
            ))
          ) : (
            <div className="muted">[Клиент]</div>
          )}
        </div>
        <div className="r">
          <div className="doc-title">ПОНУДА бр. {m.number}</div>
          <div>Датум: {m.date}</div>
          <div className="doc-small">Важи до: {m.validUntil}</div>
        </div>
      </div>
      <p className="doc-subject">
        <strong>Предмет:</strong> {m.subject}
      </p>

      {m.blocks.map((b, i) => {
        switch (b.t) {
          case 'h':
            return b.level === 1 ? <h2 key={i}>{b.text}</h2> : <h3 key={i}>{b.text}</h3>;
          case 'p':
            return (
              <p key={i} className={`${b.bold ? 'strong' : ''} ${b.muted ? 'doc-muted' : ''} ${b.small ? 'doc-small' : ''}`}>
                {b.text}
              </p>
            );
          case 'kv':
            return (
              <table key={i} className="doc-kv">
                <tbody>
                  {b.rows.map(([k, v], j) => (
                    <tr key={j}>
                      <td>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case 'table':
            return (
              <table key={i} className={`doc-tbl ${b.small ? 'small' : ''}`}>
                <colgroup>
                  {(b.widths ?? b.head.map(() => 100 / b.head.length)).map((w, j) => (
                    <col key={j} style={{ width: `${w}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {b.head.map((h, j) => (
                      <th key={j} className={cls(b.align?.[j])}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((v, k) => (
                        <td key={k} className={cls(b.align?.[k])}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {b.foot && (
                  <tfoot>
                    {b.foot.map((r, j) => (
                      <tr key={j} className={j === b.foot!.length - 1 ? 'grand' : ''}>
                        {r.map((v, k) => (
                          <td key={k} className={cls(b.align?.[k])}>
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tfoot>
                )}
              </table>
            );
          case 'chart':
            return (
              <figure key={i} className="doc-chart">
                <div dangerouslySetInnerHTML={{ __html: b.svg }} />
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            );
          case 'pagebreak':
            return <div key={i} className="doc-pagebreak" />;
          case 'signatures':
            return (
              <div key={i} className="doc-signs">
                {b.items.map((it, j) => (
                  <div key={j}>
                    <div className="doc-small">{it.title}</div>
                    <div className="doc-sign-line" />
                    <div>{it.name}</div>
                  </div>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
