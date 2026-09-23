import type { ReactNode } from 'react';
import { Link } from 'react-router';

export type Tone = 'good' | 'warn' | 'danger' | 'info' | 'neutral';

/** Status always carries a word; the colour only reinforces it */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone === 'neutral' ? '' : tone}`}>{children}</span>;
}

export function StatTile({ label, value, note, hero }: { label: string; value: ReactNode; note?: ReactNode; hero?: boolean }) {
  return (
    <div className={`card tile${hero ? ' hero' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {note ? <div className="note">{note}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="empty" role="status">
      <span className="spinner" aria-hidden /> <span style={{ marginLeft: 8 }}>{label}…</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="banner danger" role="alert">
      <div style={{ flex: 1 }}>
        <strong>Something went wrong</strong>
        {error.message}
      </div>
      {onRetry ? <button className="btn small" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageHead({ title, sub, back, actions }: { title: string; sub?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  return (
    <>
      {back ? <Link className="back" to={back.to}>← {back.label}</Link> : null}
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {sub ? <div className="sub">{sub}</div> : null}
        </div>
        {actions ? <div className="row">{actions}</div> : null}
      </div>
    </>
  );
}

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="spread" style={{ marginTop: 12 }}>
      <span className="faint">Page {page} of {pages} · {total} in all</span>
      <div className="row">
        <button className="btn small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
