import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { ago, day, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead } from '../components/ui';
import { ActionDialog, ReasonDialog } from '../components/Dialog';

interface Application {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  kyc: {
    status: string;
    submittedAt?: string;
    licenseNumber?: string;
    rejectionReason?: string;
    autoChecks?: Array<{ check: string; result: 'pass' | 'warn' | 'fail'; detail: string }>;
    autoCheckedAt?: string;
    backgroundCheck?: { status: 'pending' | 'clear' | 'consider' | 'error'; reference?: string; summary?: string; checkedAt?: string };
  };
  vehicles?: Array<{ make: string; model: string; year: number; plateNumber: string }>;
  documents: { licence: boolean; registration: boolean; insurance: boolean };
  risks: string[];
  overdue: boolean;
  createdAt: string;
}

interface Documents {
  name: string;
  status: string;
  licenseNumber?: string;
  vehicle?: { make: string; model: string; year: number; color: string; plateNumber: string; vehicleType: string };
  documents: { licence: string | null; registration: string | null; insurance: string | null; photos: Array<string | null> };
  /** Uploaded but could not be opened */
  unavailable?: string[];
}

const DOCS = [
  ['licence', 'Driving licence'],
  ['registration', 'Vehicle registration'],
  ['insurance', 'Insurance'],
] as const;

export function ApplicationsPage() {
  const { data, error, loading, reload } = useApi<{ applications: Application[] }>('/admin/applications', 60_000);
  const navigate = useNavigate();
  const apps = data?.applications ?? [];

  return (
    <div className="stack">
      <PageHead title="Driver applications" sub="Oldest first. Review each within 48 hours of submission." />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {apps.length === 0 ? <Empty>No applications waiting.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Submitted</th><th>Applicant</th><th>Vehicle</th><th>Documents</th><th>Risk indicators</th></tr></thead>
                <tbody>
                  {apps.map((a) => {
                    const v = a.vehicles?.[a.vehicles.length - 1];
                    const missing = DOCS.filter(([k]) => !a.documents[k]).length;
                    return (
                      <tr key={a._id} className="link" onClick={() => navigate(`/applications/${a._id}`)}>
                        <td>
                          <Link to={`/applications/${a._id}`}>{when(a.kyc.submittedAt)}</Link>
                          <div className="faint">{ago(a.kyc.submittedAt)}</div>
                          {a.overdue ? <Badge tone="warn">Over 48 hours</Badge> : null}
                        </td>
                        <td>{a.name}<div className="faint">{a.phone}</div></td>
                        <td>{v ? `${v.make} ${v.model} (${v.year})` : '—'}<div className="faint">{v?.plateNumber}</div></td>
                        <td>{missing ? <Badge tone="danger">{missing} missing</Badge> : <Badge tone="good">All uploaded</Badge>}</td>
                        <td>{a.risks.length ? a.risks.map((r) => <div key={r}><Badge tone="warn">{r}</Badge></div>) : <span className="faint">None</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const CHECKS = [
  'The driving licence is genuine, in the applicant\'s name, and valid for more than 6 more months',
  'The registration matches the vehicle details and plate number',
  'The insurance is active and comprehensive',
  'The photo and name match the applicant',
  'The vehicle is less than 15 years old',
  'No expired documents, mismatched details or unreadable images',
];

const BACKGROUND: Record<string, { label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }> = {
  clear: { label: 'Clear', tone: 'good' },
  consider: { label: 'Needs a look', tone: 'danger' },
  pending: { label: 'Waiting for the vendor', tone: 'neutral' },
  error: { label: 'Vendor not reachable', tone: 'warn' },
};

/** Results of the automatic document checks and the vendor background check (UC-A01) */
function AutomaticChecks({ app, userId, onDone }: { app?: Application; userId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rerun = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/applications/${userId}/recheck`);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const checks = app?.kyc.autoChecks ?? [];
  const bg = app?.kyc.backgroundCheck;
  return (
    <div className="card">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Automatic checks</h2>
        <button className="btn small" onClick={rerun} disabled={busy}>{busy ? 'Checking…' : 'Run again'}</button>
      </div>
      <p className="faint">Formats, dates, reused licences and old vehicles, checked by the system. They inform your decision; they do not replace looking at the documents.{app?.kyc.autoCheckedAt ? ` Last run ${when(app.kyc.autoCheckedAt)}.` : ''}</p>
      {error ? <div className="error-text">{error}</div> : null}
      {checks.length === 0 ? <p className="faint">Not run yet.</p> : (
        <table><tbody>
          {checks.map((c) => (
            <tr key={c.check}>
              <td style={{ width: 90 }}><Badge tone={c.result === 'pass' ? 'good' : c.result === 'warn' ? 'warn' : 'danger'}>{c.result === 'pass' ? 'OK' : c.result === 'warn' ? 'Check' : 'Problem'}</Badge></td>
              <td><strong>{c.check}</strong> <span className="muted">{c.detail}</span></td>
            </tr>
          ))}
        </tbody></table>
      )}
      <p style={{ marginTop: 10, marginBottom: 0 }}>
        <strong>Background check: </strong>
        {bg ? <><Badge tone={BACKGROUND[bg.status]?.tone ?? 'neutral'}>{BACKGROUND[bg.status]?.label ?? bg.status}</Badge> {bg.summary ?? ''}{bg.reference ? <span className="faint"> (ref {bg.reference})</span> : null}</> : <span className="faint">No vendor connected (KYC_VERIFY_URL). Check the licence on Parivahan/Sarathi by hand.</span>}
      </p>
    </div>
  );
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const docs = useApi<Documents>(`/admin/kyc/${id}/documents`);
  const list = useApi<{ applications: Application[] }>('/admin/applications');
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'changes' | null>(null);
  const [changeDocs, setChangeDocs] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const app = list.data?.applications.find((a) => a._id === id);
  if (docs.loading && !docs.data) return <Loading />;
  if (!docs.data) return <ErrorBox error={docs.error} onRetry={docs.reload} />;
  const d = docs.data;
  const pending = d.status === 'pending';
  const done = () => navigate('/applications');

  return (
    <div className="stack">
      <PageHead
        back={{ to: '/applications', label: 'Driver applications' }}
        title={d.name}
        sub={<span className="row"><Badge tone={pending ? 'warn' : d.status === 'approved' ? 'good' : 'danger'}>{d.status}</Badge>{app ? `Submitted ${when(app.kyc.submittedAt)}` : null}</span>}
        actions={pending ? (
          <>
            <button className="btn" onClick={() => { setChangeDocs([]); setNote(''); setDialog('changes'); }}>Ask for new documents</button>
            <button className="btn danger" onClick={() => setDialog('reject')}>Reject</button>
            <button className="btn primary" disabled={!checked.every(Boolean)} title={checked.every(Boolean) ? undefined : 'Tick every check first'} onClick={() => setDialog('approve')}>Approve</button>
          </>
        ) : null}
      />
      {app?.risks.length ? (
        <div className="banner warn"><div><strong>Risk indicators</strong>{app.risks.join(' · ')}</div></div>
      ) : null}
      <div className="grid cols-2">
        <div className="card">
          <h2>Applicant and vehicle</h2>
          <table>
            <tbody>
              <tr><td className="muted">Phone</td><td>{app?.phone ?? '—'}</td></tr>
              <tr><td className="muted">Email</td><td>{app?.email ?? '—'}</td></tr>
              <tr><td className="muted">Account since</td><td>{day(app?.createdAt)}</td></tr>
              <tr><td className="muted">Licence number</td><td>{d.licenseNumber ?? '—'}</td></tr>
              <tr><td className="muted">Vehicle</td><td>{d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}, ${d.vehicle.color}, ${d.vehicle.year}` : '—'}</td></tr>
              <tr><td className="muted">Plate · type</td><td>{d.vehicle ? `${d.vehicle.plateNumber} · ${d.vehicle.vehicleType}` : '—'}</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}><Link to={`/users/${id}`}>Full account history</Link></p>
        </div>
        <div className="card">
          <h2>Documents</h2>
          <p className="faint">Links are temporary; reload the page if one has expired.</p>
          {DOCS.map(([k, label]) => (
            <div key={k} className="spread" style={{ padding: '6px 0' }}>
              <span>{label}</span>
              {d.documents[k] ? (
                <a className="btn small" href={d.documents[k]!} target="_blank" rel="noreferrer">Open</a>
              ) : d.unavailable?.includes(k) ? (
                <Badge tone="warn">Could not load</Badge>
              ) : (
                <Badge tone="danger">Not uploaded</Badge>
              )}
            </div>
          ))}
          {d.documents.photos.filter(Boolean).map((p, i) => (
            <div key={p} className="spread" style={{ padding: '6px 0' }}>
              <span>Vehicle photo {i + 1}</span>
              <a className="btn small" href={p!} target="_blank" rel="noreferrer">Open</a>
            </div>
          ))}
        </div>
      </div>
      <AutomaticChecks app={app} userId={id} onDone={list.reload} />
      {pending ? (
        <div className="card">
          <h2>Checks before approval</h2>
          <p className="faint">Approval stays disabled until every check is ticked. Zero tolerance for fake documents: reject and block the account.</p>
          <div className="stack" style={{ gap: 8 }}>
            {CHECKS.map((c, i) => (
              <label key={c} className="check">
                <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))} />
                {c}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <ActionDialog
        open={dialog === 'approve'}
        title={`Approve ${d.name} as a driver?`}
        confirmLabel="Approve"
        onConfirm={() => api.post(`/auth/kyc/${id}/approve`).then(done)}
        onClose={() => setDialog(null)}
      >
        <p className="muted">They can start posting rides straight away, and riders are told their licence and vehicle papers were checked.</p>
      </ActionDialog>

      <ReasonDialog
        open={dialog === 'reject'}
        title="Reject this application"
        intro="The driver sees this reason and can apply again with corrected documents."
        confirmLabel="Reject"
        tone="danger"
        placeholder="The licence has expired."
        onConfirm={(reason) => api.post(`/auth/kyc/${id}/reject`, { reason }).then(done)}
        onClose={() => setDialog(null)}
      />

      <ActionDialog
        open={dialog === 'changes'}
        title="Ask for new documents"
        confirmLabel="Send request"
        canConfirm={changeDocs.length > 0 && note.trim().length >= 5}
        onConfirm={() => api.post(`/admin/applications/${id}/request-changes`, { documents: changeDocs, note }).then(done)}
        onClose={() => setDialog(null)}
      >
        <div className="stack" style={{ gap: 6 }}>
          {[...DOCS, ['photo', 'Profile photo'] as const].map(([k, label]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={changeDocs.includes(k)} onChange={(e) => setChangeDocs((p) => (e.target.checked ? [...p, k] : p.filter((x) => x !== k)))} />
              {label}
            </label>
          ))}
        </div>
        <Field label="What is wrong (the driver sees this)">
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="The insurance image is blurred; the policy number cannot be read." />
        </Field>
      </ActionDialog>
    </div>
  );
}
