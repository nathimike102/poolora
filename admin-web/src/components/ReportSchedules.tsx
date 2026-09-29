import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { when } from '../lib/format';
import { ActionDialog } from './Dialog';
import { Badge, ErrorBox, Field, Loading } from './ui';

type Frequency = 'daily' | 'weekly' | 'monthly';
type Format = 'csv' | 'xlsx' | 'pdf';
interface Schedule {
  id: string;
  name: string;
  types: string[];
  frequency: Frequency;
  format: Format;
  recipients: string[];
  active: boolean;
  nextRunAt: string;
  lastSentAt: string | null;
  lastError: string | null;
}

export const REPORT_NAMES: Record<string, string> = {
  users: 'Users',
  rides: 'Rides',
  financial: 'Money',
  performance: 'Performance',
  safety: 'Safety',
};
export const FORMAT_NAMES: Record<Format, string> = { xlsx: 'Excel', pdf: 'PDF', csv: 'CSV' };
const FREQUENCY: Record<Frequency, { label: string; covers: string }> = {
  daily: { label: 'Daily', covers: 'Every day at 07:00, covering yesterday' },
  weekly: { label: 'Weekly', covers: 'Mondays at 07:00, covering the last seven days' },
  monthly: { label: 'Monthly', covers: 'On the 1st at 07:00, covering last month' },
};

interface Draft {
  name: string;
  types: string[];
  frequency: Frequency;
  format: Format;
  recipients: string;
}
const EMPTY: Draft = { name: '', types: ['rides', 'financial'], frequency: 'weekly', format: 'xlsx', recipients: '' };

/** Scheduled report emails (UC-A06): who gets which reports, and when */
export function ReportSchedules() {
  const { data, error, loading, reload } = useApi<{ schedules: Schedule[]; emailEnabled: boolean }>('/admin/report-schedules');
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (editing === 'new') setDraft(EMPTY);
    else if (editing) setDraft({ ...editing, recipients: editing.recipients.join(', ') });
  }, [editing]);

  const act = async (s: Schedule, fn: () => Promise<unknown>, done: string) => {
    setBusyId(s.id);
    setNotice('');
    try {
      await fn();
      setNotice(done);
      reload();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusyId('');
    }
  };

  const save = async () => {
    if (editing === 'new') await api.post('/admin/report-schedules', draft);
    else if (editing) await api.patch(`/admin/report-schedules/${editing.id}`, draft);
    reload();
  };

  const toggleType = (t: string) =>
    setDraft((d) => ({ ...d, types: d.types.includes(t) ? d.types.filter((x) => x !== t) : [...d.types, t] }));

  return (
    <div className="card stack">
      <div className="spread">
        <div>
          <h2 style={{ margin: 0 }}>Scheduled emails</h2>
          <p className="faint" style={{ margin: '4px 0 0' }}>Reports sent by email at 07:00 India time, with the full report attached.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>Schedule a report</button>
      </div>

      {data && !data.emailEnabled ? (
        <div className="banner warn" role="status">
          <div><strong>Email is not set up on the server</strong>Scheduled reports will not go out until SMTP_HOST and the other SMTP_* settings are added to the backend.</div>
        </div>
      ) : null}
      {notice ? <div className="muted" role="status">{notice}</div> : null}
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading label="Loading scheduled reports" /> : null}
      {data && data.schedules.length === 0 ? <p className="faint">No reports are scheduled yet.</p> : null}
      {data && data.schedules.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Reports</th><th>When</th><th>Sent to</th><th>Next email</th><th>Last email</th><th /></tr>
            </thead>
            <tbody>
              {data.schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.types.map((t) => REPORT_NAMES[t] ?? t).join(', ')} <span className="faint">({FORMAT_NAMES[s.format]})</span></td>
                  <td>{FREQUENCY[s.frequency].label}</td>
                  <td>{s.recipients.join(', ')}</td>
                  <td>{s.active ? when(s.nextRunAt) : <Badge>Paused</Badge>}</td>
                  <td>{s.lastError ? <Badge tone="danger">Failed: {s.lastError}</Badge> : s.lastSentAt ? when(s.lastSentAt) : <span className="faint">Not yet</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <button className="btn" disabled={busyId === s.id || !data.emailEnabled} onClick={() => act(s, () => api.post(`/admin/report-schedules/${s.id}/send`), `"${s.name}" was sent.`)}>Send now</button>
                      <button className="btn" disabled={busyId === s.id} onClick={() => act(s, () => api.patch(`/admin/report-schedules/${s.id}`, { active: !s.active }), s.active ? `"${s.name}" is paused.` : `"${s.name}" is back on.`)}>{s.active ? 'Pause' : 'Resume'}</button>
                      <button className="btn" onClick={() => setEditing(s)}>Edit</button>
                      <button className="btn" onClick={() => setDeleting(s)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ActionDialog
        open={editing !== null}
        title={editing === 'new' ? 'Schedule a report' : 'Change the scheduled report'}
        confirmLabel={editing === 'new' ? 'Schedule' : 'Save'}
        canConfirm={Boolean(draft.name.trim() && draft.types.length && draft.recipients.trim())}
        onConfirm={save}
        onClose={() => setEditing(null)}
      >
        <Field label="Name">
          <input className="input" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Weekly money summary" required />
        </Field>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="section-label">Reports</legend>
          <div className="row" style={{ gap: 14 }}>
            {Object.entries(REPORT_NAMES).map(([k, l]) => (
              <label key={k} className="check">
                <input type="checkbox" checked={draft.types.includes(k)} onChange={() => toggleType(k)} /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="How often">
          <select className="input" value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}>
            {Object.entries(FREQUENCY).map(([k, f]) => <option key={k} value={k}>{f.label}: {f.covers.toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Attach as">
          <select className="input" value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as Format })}>
            {Object.entries(FORMAT_NAMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Send to (up to 10 addresses, separated by commas)">
          <textarea className="input" value={draft.recipients} onChange={(e) => setDraft({ ...draft, recipients: e.target.value })} placeholder="ops@example.com, finance@example.com" required />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={deleting !== null}
        title="Delete this scheduled report?"
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => api.del(`/admin/report-schedules/${deleting!.id}`).then(reload)}
        onClose={() => setDeleting(null)}
      >
        <p className="muted" style={{ margin: 0 }}>"{deleting?.name}" will stop going to {deleting?.recipients.join(', ')}.</p>
      </ActionDialog>
    </div>
  );
}
