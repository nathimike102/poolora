import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { when } from '../lib/format';
import { Badge, ErrorBox, Loading, PageHead } from '../components/ui';
import { ReasonDialog } from '../components/Dialog';

type Unit = 'percent' | 'minutes' | 'hours' | 'seconds' | 'km' | 'meters' | 'count' | 'weights' | 'tiers';
type Tier = { minHours: number; refundRate: number };
interface Setting {
  key: string;
  group: 'fees' | 'cancellation' | 'safety' | 'matching' | 'rules';
  label: string;
  help: string;
  unit: Unit;
  min?: number;
  max?: number;
  value: unknown;
  defaultValue: unknown;
}
interface HistoryEntry {
  _id: string;
  action: string;
  reason?: string;
  createdAt: string;
  actor?: { name: string };
  details?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
}

const GROUPS: Array<[Setting['group'], string]> = [
  ['fees', 'Fees'],
  ['cancellation', 'Cancellations and time limits'],
  ['safety', 'Safety'],
  ['matching', 'Matching and search'],
  ['rules', 'Business rules'],
];
const UNIT_LABEL: Partial<Record<Unit, string>> = { percent: '%', minutes: 'min', hours: 'h', seconds: 's', km: 'km', meters: 'm' };
const WEIGHT_LABELS: Record<string, string> = { proximity: 'Distance to route', time: 'Departure time', rating: 'Driver rating', acceptance: 'Acceptance rate', safety: 'Low cancellations' };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function describe(s: Setting, v: unknown): string {
  if (s.unit === 'percent') return `${Math.round(Number(v) * 1000) / 10}%`;
  if (s.unit === 'weights') return Object.entries(v as Record<string, number>).map(([k, w]) => `${WEIGHT_LABELS[k] ?? k} ${Math.round(w * 100)}%`).join(', ');
  if (s.unit === 'tiers') return (v as Tier[]).map((t) => `${t.minHours}h+: ${Math.round(t.refundRate * 100)}%`).join(', ');
  return `${v} ${UNIT_LABEL[s.unit] ?? ''}`.trim();
}

function NumberEditor({ s, value, onChange }: { s: Setting; value: number; onChange: (v: number) => void }) {
  const percent = s.unit === 'percent';
  const shown = percent ? Math.round(value * 1000) / 10 : value;
  return (
    <div className="row">
      <input
        className="input"
        type="number"
        style={{ width: 120 }}
        step={percent ? 0.5 : s.unit === 'km' ? 0.5 : 1}
        min={percent ? (s.min ?? 0) * 100 : s.min}
        max={percent ? (s.max ?? 1) * 100 : s.max}
        value={Number.isFinite(shown) ? shown : ''}
        onChange={(e) => onChange(percent ? Number(e.target.value) / 100 : Number(e.target.value))}
        aria-label={s.label}
      />
      <span className="muted">{UNIT_LABEL[s.unit] ?? ''}</span>
      <span className="faint">Allowed {percent ? `${(s.min ?? 0) * 100}–${(s.max ?? 1) * 100}%` : `${s.min}–${s.max}`}</span>
    </div>
  );
}

function WeightsEditor({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const total = Object.values(value).reduce((a, b) => a + b, 0);
  return (
    <div className="stack" style={{ gap: 6 }}>
      {Object.entries(value).map(([k, w]) => (
        <label key={k} className="row">
          <span style={{ width: 150 }}>{WEIGHT_LABELS[k] ?? k}</span>
          <input className="input" type="number" style={{ width: 90 }} min={0} max={100} step={1} value={Math.round(w * 100)} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) / 100 })} />
          <span className="muted">%</span>
        </label>
      ))}
      <div>{Math.abs(total - 1) < 0.001 ? <Badge tone="good">Adds up to 100%</Badge> : <Badge tone="danger">Adds up to {Math.round(total * 100)}%, must be 100%</Badge>}</div>
    </div>
  );
}

function TiersEditor({ value, onChange }: { value: Tier[]; onChange: (v: Tier[]) => void }) {
  const update = (i: number, t: Partial<Tier>) => onChange(value.map((x, j) => (j === i ? { ...x, ...t } : x)));
  return (
    <div className="stack" style={{ gap: 6 }}>
      {value.map((t, i) => (
        <div key={i} className="row">
          <span>Cancelled</span>
          <input className="input" type="number" style={{ width: 80 }} min={0} max={168} value={t.minHours} onChange={(e) => update(i, { minHours: Number(e.target.value) })} aria-label="Hours before departure" />
          <span>or more hours before: refund</span>
          <input className="input" type="number" style={{ width: 80 }} min={0} max={100} value={Math.round(t.refundRate * 100)} onChange={(e) => update(i, { refundRate: Number(e.target.value) / 100 })} aria-label="Refund percent" />
          <span>%</span>
          {value.length > 1 ? <button className="btn small ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button> : null}
        </div>
      ))}
      {value.length < 6 ? <div><button className="btn small" onClick={() => onChange([...value, { minHours: 0, refundRate: 0 }])}>Add a tier</button></div> : null}
      <p className="faint">The last tier must start at 0 hours. Driver cancellations are always refunded in full.</p>
    </div>
  );
}

export function SettingsPage() {
  const { data, error, loading, reload } = useApi<{ settings: Setting[] }>('/admin/settings');
  const history = useApi<{ history: HistoryEntry[] }>('/admin/settings/history');
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [revertId, setRevertId] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.settings.map((s) => [s.key, s.value])));
  }, [data]);

  // The draft is filled after the first render with data; until then show the saved value
  const valueOf = (s: Setting) => (s.key in draft ? draft[s.key] : s.value);
  const changed = useMemo(
    () => (data?.settings ?? []).filter((s) => s.key in draft && !same(s.value, draft[s.key])),
    [data, draft],
  );

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;

  const refresh = async () => {
    await reload();
    await history.reload();
  };

  return (
    <div className="stack">
      <PageHead
        title="Settings"
        sub="Changes apply to every server within a minute and are logged. Payment keys and message templates are not editable here."
        actions={
          <>
            {changed.length ? <button className="btn" onClick={() => setDraft(Object.fromEntries(data.settings.map((s) => [s.key, s.value])))}>Discard</button> : null}
            <button className="btn primary" disabled={!changed.length} onClick={() => setSaving(true)}>Save {changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}` : ''}</button>
          </>
        }
      />

      {GROUPS.map(([group, title]) => (
        <section key={group} className="card">
          <h2>{title}</h2>
          <div className="stack">
            {data.settings.filter((s) => s.group === group).map((s) => (
              <div key={s.key} style={{ paddingBottom: 12, borderBottom: '1px solid var(--grid)' }}>
                <div className="spread">
                  <strong>{s.label}</strong>
                  {!same(s.value, valueOf(s)) ? <Badge tone="warn">Changed</Badge> : !same(s.value, s.defaultValue) ? <Badge tone="info">Not the default</Badge> : null}
                </div>
                <p className="faint">{s.help} Default: {describe(s, s.defaultValue)}.</p>
                {s.unit === 'weights' ? (
                  <WeightsEditor value={valueOf(s) as Record<string, number>} onChange={(v) => setDraft((d) => ({ ...d, [s.key]: v }))} />
                ) : s.unit === 'tiers' ? (
                  <TiersEditor value={valueOf(s) as Tier[]} onChange={(v) => setDraft((d) => ({ ...d, [s.key]: v }))} />
                ) : (
                  <NumberEditor s={s} value={Number(valueOf(s))} onChange={(v) => setDraft((d) => ({ ...d, [s.key]: v }))} />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="card">
        <h2>Recent changes</h2>
        {history.data?.history.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>By</th><th>Changed</th><th>Reason</th><th /></tr></thead>
              <tbody>
                {history.data.history.map((h) => {
                  const after = h.details?.after ?? {};
                  const recent = Date.now() - new Date(h.createdAt).getTime() < 24 * 3_600_000;
                  return (
                    <tr key={h._id}>
                      <td>{when(h.createdAt)}</td>
                      <td>{h.actor?.name ?? '—'}</td>
                      <td>
                        {Object.entries(after).map(([k, v]) => {
                          const s = data.settings.find((x) => x.key === k);
                          return <div key={k}>{s?.label ?? k}: {s ? describe(s, h.details?.before?.[k]) : ''} → {s ? describe(s, v) : String(v)}</div>;
                        })}
                      </td>
                      <td>{h.reason}</td>
                      <td>{recent ? <button className="btn small" onClick={() => setRevertId(h._id)}>Revert</button> : <span className="faint">Over 24 h</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="faint">No changes yet: every setting is at its default.</p>}
      </section>

      <ReasonDialog
        open={saving}
        title="Save settings"
        intro={<div>{changed.map((s) => <div key={s.key}><strong>{s.label}</strong>: {describe(s, s.value)} → {describe(s, draft[s.key])}</div>)}</div>}
        confirmLabel="Save and apply"
        placeholder="Trial a lower commission for the festival week."
        onConfirm={(reason) => api.put('/admin/settings', { changes: Object.fromEntries(changed.map((s) => [s.key, draft[s.key]])), reason }).then(refresh)}
        onClose={() => setSaving(false)}
      />
      <ReasonDialog
        open={revertId !== null}
        title="Revert this change"
        intro="The settings go back to what they were before the change. The revert is logged as a new change."
        confirmLabel="Revert"
        onConfirm={(reason) => api.post(`/admin/settings/revert/${revertId}`, { reason }).then(refresh)}
        onClose={() => setRevertId(null)}
      />
    </div>
  );
}
