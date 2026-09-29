import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead } from '../components/ui';
import { ActionDialog } from '../components/Dialog';

interface Metric { key: string; label: string; unit: 'count' | 'percent'; help: string }
interface Admin { _id: string; name: string; email?: string; phone?: string }
interface Rule {
  _id: string;
  name: string;
  metric: string;
  comparator: 'above' | 'below';
  threshold: number;
  channels: { email: boolean; sms: boolean };
  recipients: Admin[];
  cooldownMins: number;
  active: boolean;
  lastValue?: number;
  lastCheckedAt?: string;
  lastFiredAt?: string;
  history: Array<{ at: string; value: number; sent: { email: number; sms: number } }>;
}
interface Data { rules: Rule[]; admins: Admin[]; metrics: Metric[]; channels: { email: boolean; sms: boolean } }
interface Draft { name: string; metric: string; comparator: 'above' | 'below'; threshold: string; email: boolean; sms: boolean; recipients: string[]; cooldownMins: string }

const EMPTY: Draft = { name: '', metric: 'new_sos', comparator: 'above', threshold: '0', email: true, sms: true, recipients: [], cooldownMins: '60' };

/** Custom alert rules with email and SMS to chosen admins (UC-A02, UC-A06) */
export function AlertsPage() {
  const { data, error, loading, reload } = useApi<Data>('/admin/alert-rules');
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (editing === 'new') setDraft(EMPTY);
    else if (editing) {
      setDraft({
        name: editing.name, metric: editing.metric, comparator: editing.comparator, threshold: String(editing.threshold),
        email: editing.channels.email, sms: editing.channels.sms, recipients: editing.recipients.map((r) => r._id), cooldownMins: String(editing.cooldownMins),
      });
    }
  }, [editing]);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const metric = (key: string) => data.metrics.find((m) => m.key === key);
  const show = (key: string, v?: number) => (v === undefined ? '—' : metric(key)?.unit === 'percent' ? `${v}%` : String(v));

  const save = () => {
    const body = {
      name: draft.name, metric: draft.metric, comparator: draft.comparator, threshold: Number(draft.threshold),
      channels: { email: draft.email, sms: draft.sms }, recipients: draft.recipients, cooldownMins: Number(draft.cooldownMins),
    };
    return (editing === 'new' ? api.post('/admin/alert-rules', body) : api.patch(`/admin/alert-rules/${(editing as Rule)._id}`, body)).then(reload);
  };

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setNotice('');
    try {
      await fn();
      setNotice(done);
      reload();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  return (
    <div className="stack">
      <PageHead
        title="Alerts"
        sub="Rules checked every minute. A firing rule shows on the dashboard and is emailed or texted to the admins you choose, then stays quiet for its cooldown."
        actions={<button className="btn primary" onClick={() => setEditing('new')}>New rule</button>}
      />
      {!data.channels.email || !data.channels.sms ? (
        <div className="banner warn" role="status">
          <div>
            <strong>{!data.channels.email && !data.channels.sms ? 'Email and SMS are' : !data.channels.email ? 'Email is' : 'SMS is'} not set up on the server</strong>
            {!data.channels.sms ? ' SMS needs TWILIO_ENABLED=true, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER.' : ''}
            {!data.channels.email ? ' Email needs SMTP_HOST and the other SMTP_* settings.' : ''} Rules still show on the dashboard.
          </div>
        </div>
      ) : null}
      {notice ? <div className="muted" role="status">{notice}</div> : null}
      {!data.rules.length ? <Empty>No rules yet. A good first one: New SOS alerts above 0, by SMS to whoever is on call.</Empty> : null}
      {data.rules.map((r) => {
        const firing = r.lastValue !== undefined && (r.comparator === 'above' ? r.lastValue > r.threshold : r.lastValue < r.threshold);
        return (
          <div key={r._id} className="card stack" style={{ gap: 8 }}>
            <div className="spread">
              <strong>{r.name}</strong>
              {!r.active ? <Badge>Paused</Badge> : firing ? <Badge tone="danger">Firing</Badge> : <Badge tone="good">Normal</Badge>}
            </div>
            <div className="muted">
              {metric(r.metric)?.label ?? r.metric} {r.comparator} {show(r.metric, r.threshold)}. Now {show(r.metric, r.lastValue)}
              {r.lastCheckedAt ? ` (checked ${when(r.lastCheckedAt)})` : ''}.
            </div>
            <div className="faint">
              {[r.channels.email ? 'Email' : '', r.channels.sms ? 'SMS' : '', 'dashboard'].filter(Boolean).join(', ')} to {r.recipients.map((a) => a.name).join(', ') || 'nobody'}; quiet for {r.cooldownMins} min after firing.
              {r.lastFiredAt ? ` Last fired ${when(r.lastFiredAt)}.` : ' Has not fired.'}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn" onClick={() => act(() => api.post(`/admin/alert-rules/${r._id}/test`), `Test alert for "${r.name}" sent.`)}>Send a test</button>
              <button className="btn" onClick={() => act(() => api.patch(`/admin/alert-rules/${r._id}`, { active: !r.active }), r.active ? 'Paused.' : 'Back on.')}>{r.active ? 'Pause' : 'Resume'}</button>
              <button className="btn" onClick={() => setEditing(r)}>Edit</button>
              <button className="btn" onClick={() => setDeleting(r)}>Delete</button>
            </div>
          </div>
        );
      })}

      <ActionDialog
        open={editing !== null}
        title={editing === 'new' ? 'New alert rule' : 'Change alert rule'}
        confirmLabel="Save"
        canConfirm={Boolean(draft.name.trim() && draft.recipients.length && draft.threshold !== '' && (draft.email || draft.sms))}
        onConfirm={save}
        onClose={() => setEditing(null)}
      >
        <Field label="Name"><input className="input" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Page on-call for every SOS" /></Field>
        <Field label="Watch">
          <select className="input" value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })}>
            {data.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </Field>
        <p className="faint" style={{ margin: 0 }}>{metric(draft.metric)?.help}</p>
        <div className="row" style={{ gap: 8 }}>
          <Field label="When it is">
            <select className="input" value={draft.comparator} onChange={(e) => setDraft({ ...draft, comparator: e.target.value as Draft['comparator'] })}>
              <option value="above">above</option>
              <option value="below">below</option>
            </select>
          </Field>
          <Field label={metric(draft.metric)?.unit === 'percent' ? 'Percent' : 'Number'}>
            <input className="input" type="number" min={0} value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: e.target.value })} style={{ width: 120 }} />
          </Field>
          <Field label="Quiet for (minutes)">
            <input className="input" type="number" min={5} max={1440} value={draft.cooldownMins} onChange={(e) => setDraft({ ...draft, cooldownMins: e.target.value })} style={{ width: 120 }} />
          </Field>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="section-label">Send by</legend>
          <div className="row" style={{ gap: 14 }}>
            <label className="check"><input type="checkbox" checked={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.checked })} /> Email</label>
            <label className="check"><input type="checkbox" checked={draft.sms} onChange={(e) => setDraft({ ...draft, sms: e.target.checked })} /> SMS</label>
          </div>
        </fieldset>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="section-label">To</legend>
          <div className="stack" style={{ gap: 4 }}>
            {data.admins.map((a) => (
              <label key={a._id} className="check">
                <input type="checkbox" checked={draft.recipients.includes(a._id)} onChange={(e) => setDraft({ ...draft, recipients: e.target.checked ? [...draft.recipients, a._id] : draft.recipients.filter((x) => x !== a._id) })} />
                {a.name} <span className="faint">{[a.email, a.phone?.startsWith('firebase:') ? '' : a.phone].filter(Boolean).join(' · ')}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </ActionDialog>

      <ActionDialog open={deleting !== null} title="Delete this rule?" confirmLabel="Delete" tone="danger" onConfirm={() => api.del(`/admin/alert-rules/${deleting!._id}`).then(reload)} onClose={() => setDeleting(null)}>
        <p className="muted" style={{ margin: 0 }}>"{deleting?.name}" stops alerting anyone.</p>
      </ActionDialog>
    </div>
  );
}
