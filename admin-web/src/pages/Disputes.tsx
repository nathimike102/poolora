import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { ago, money, titleCase, when } from '../lib/format';
import { useAdmin } from '../App';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead, Pager, type Tone } from '../components/ui';
import { ActionDialog } from '../components/Dialog';

const CATEGORIES: Record<string, string> = {
  payment: 'Payment issue',
  cancellation: 'Cancellation disagreement',
  behavior: 'Behaviour complaint',
  route: 'Route or time deviation',
  quality: 'Service quality',
};
const STATUS_TONE: Record<string, Tone> = { open: 'danger', in_review: 'warn', resolved: 'good' };
const OUTCOMES: Record<string, string> = { rider: 'In favour of the rider', driver: 'In favour of the driver', both: 'Both at fault', dismissed: 'Dismissed' };

interface Party { _id: string; name: string; phone: string; warnings?: number; isSuspended?: boolean; isBlocked?: boolean; stats?: { avgRatingAsDriver?: number; avgRatingAsRider?: number; cancellationRate?: number } }
interface DisputeRow {
  _id: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  raisedBy: { _id: string; name: string };
  against: { _id: string; name: string };
  assignedTo?: { name: string };
}
interface DisputeDetail {
  dispute: {
    _id: string;
    category: string;
    description: string;
    evidenceUrls: string[];
    status: string;
    createdAt: string;
    raisedBy: string;
    assignedTo?: { _id: string; name: string };
    decision?: {
      outcome: string;
      refundAmount: number;
      refundStatus?: string;
      driverCompensation: number;
      justification: string;
      decidedAt: string;
      decidedBy?: { name: string };
    };
  };
  booking: {
    _id: string;
    rider: string;
    driver: string;
    status: string;
    seatsBooked: number;
    estimatedFare: number;
    finalFare?: number;
    refundAmount?: number;
    cancellationReason?: string;
    cancelledAt?: string;
    pickup: { address: string };
    dropoff: { address: string };
    ride?: { departureTime: string; startedAt?: string; completedAt?: string; status: string; estimatedDistanceKm?: number };
  };
  rider: Party | null;
  driver: Party | null;
  raisedByRole: 'rider' | 'driver';
  messages: Array<{ _id: string; sender: string; content: string; contentType: string; createdAt: string }>;
  payments: Array<{ _id: string; amount: number; status: string; method?: string; refundAmount?: number; createdAt: string }>;
  ratings: Array<{ _id: string; raterRole: string; score: number; comment?: string; tags: string[] }>;
  sos: Array<{ _id: string; status: string; createdAt: string }>;
  previousDisputes: { rider: Array<{ _id: string; category: string; status: string; createdAt: string }>; driver: Array<{ _id: string; category: string; status: string; createdAt: string }> };
  history: Array<{ _id: string; action: string; createdAt: string; actor?: { name: string } }>;
  refundable: number;
}

export function DisputesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 1);
  const { data, error, loading, reload } = useApi<{ disputes: DisputeRow[]; total: number; limit: number }>(
    `/admin/disputes${qs({ status: status === 'all' ? '' : status, category, page, limit: 25 })}`,
  );
  const navigate = useNavigate();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('page');
    setParams(next);
  };

  return (
    <div className="stack">
      <PageHead
        title="Disputes"
        sub="Resolve within 48 to 72 hours. Oldest first."
        actions={
          <>
            <select className="input" value={category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="seg" role="group" aria-label="Status">
              {[['open', 'Open'], ['in_review', 'In review'], ['resolved', 'Resolved'], ['all', 'All']].map(([v, l]) => (
                <button key={v} aria-pressed={status === v} onClick={() => set('status', v)}>{l}</button>
              ))}
            </div>
          </>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {data.disputes.length === 0 ? <Empty>No disputes here.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Raised</th><th>Category</th><th>By</th><th>About</th><th>Status</th><th>Handled by</th></tr></thead>
                <tbody>
                  {data.disputes.map((d) => (
                    <tr key={d._id} className="link" onClick={() => navigate(`/disputes/${d._id}`)}>
                      <td><Link to={`/disputes/${d._id}`}>{when(d.createdAt)}</Link><div className="faint">{ago(d.createdAt)}</div></td>
                      <td>{CATEGORIES[d.category] ?? d.category}<div className="faint" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</div></td>
                      <td>{d.raisedBy?.name}</td>
                      <td>{d.against?.name}</td>
                      <td><Badge tone={STATUS_TONE[d.status]}>{titleCase(d.status)}</Badge></td>
                      <td>{d.assignedTo?.name ?? <span className="faint">Nobody yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={data.limit} total={data.total} onPage={(p) => set('page', String(p))} />
        </div>
      ) : null}
    </div>
  );
}

function PartyCard({ role, party, raised, previous }: { role: 'rider' | 'driver'; party: Party | null; raised: boolean; previous: Array<{ _id: string; category: string; status: string; createdAt: string }> }) {
  if (!party) return null;
  const rating = role === 'driver' ? party.stats?.avgRatingAsDriver : party.stats?.avgRatingAsRider;
  return (
    <div className="card">
      <div className="spread">
        <h2 style={{ margin: 0 }}>{role === 'rider' ? 'Rider' : 'Driver'}</h2>
        {raised ? <Badge tone="info">Raised the dispute</Badge> : null}
      </div>
      <p style={{ marginTop: 8 }}><Link to={`/users/${party._id}`}><strong>{party.name}</strong></Link> · <a href={`tel:${party.phone}`}>{party.phone}</a></p>
      <div className="row">
        {rating ? <Badge>Rating {rating.toFixed(1)}</Badge> : null}
        {party.warnings ? <Badge tone="warn">{party.warnings} warning{party.warnings === 1 ? '' : 's'}</Badge> : null}
        {party.isSuspended ? <Badge tone="warn">Suspended</Badge> : null}
        {party.isBlocked ? <Badge tone="danger">Blocked</Badge> : null}
      </div>
      <p className="faint" style={{ marginTop: 8 }}>
        {previous.length ? `${previous.length} other dispute${previous.length === 1 ? '' : 's'}: ${previous.slice(0, 4).map((p) => CATEGORIES[p.category] ?? p.category).join(', ')}` : 'No other disputes.'}
      </p>
    </div>
  );
}

export function DisputeDetailPage() {
  const { id = '' } = useParams();
  const admin = useAdmin();
  const { data, error, loading, reload } = useApi<DisputeDetail>(`/admin/disputes/${id}`);
  const [deciding, setDeciding] = useState(false);
  const [form, setForm] = useState({ outcome: 'rider', refundAmount: '0', driverCompensation: '0', warnRider: false, warnDriver: false, suspendRider: false, suspendDriver: false, suspendDays: '7', justification: '' });

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const { dispute, booking, rider, driver } = data;
  const resolved = dispute.status === 'resolved';
  const paid = booking.finalFare ?? booking.estimatedFare;
  const up = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const suspending = form.suspendRider || form.suspendDriver;

  const decide = () =>
    api.post(`/admin/disputes/${id}/resolve`, {
      outcome: form.outcome,
      refundAmount: Number(form.refundAmount) || 0,
      driverCompensation: Number(form.driverCompensation) || 0,
      warn: [form.warnRider && 'rider', form.warnDriver && 'driver'].filter(Boolean),
      suspend: [form.suspendRider && 'rider', form.suspendDriver && 'driver'].filter(Boolean),
      suspendDays: suspending ? (form.suspendDays === 'indefinite' ? null : Number(form.suspendDays)) : undefined,
      justification: form.justification,
    }).then(reload);

  return (
    <div className="stack">
      <PageHead
        back={{ to: '/disputes', label: 'Disputes' }}
        title={CATEGORIES[dispute.category] ?? dispute.category}
        sub={<span className="row"><Badge tone={STATUS_TONE[dispute.status]}>{titleCase(dispute.status)}</Badge>Raised {when(dispute.createdAt)} by the {data.raisedByRole}{dispute.assignedTo ? ` · handled by ${dispute.assignedTo.name}` : ''}</span>}
        actions={!resolved ? (
          <>
            {dispute.assignedTo?._id !== admin._id ? <button className="btn" onClick={() => api.post(`/admin/disputes/${id}/assign`).then(reload)}>Take this case</button> : null}
            <button className="btn primary" onClick={() => setDeciding(true)}>Decide</button>
          </>
        ) : null}
      />

      {dispute.decision?.outcome ? (
        <div className="banner info">
          <div>
            <strong>{OUTCOMES[dispute.decision.outcome]} · decided {when(dispute.decision.decidedAt)}{dispute.decision.decidedBy ? ` by ${dispute.decision.decidedBy.name}` : ''}</strong>
            {dispute.decision.justification}
            <div style={{ marginTop: 4 }}>
              Refund {money(dispute.decision.refundAmount)}{dispute.decision.refundStatus === 'failed' || (dispute.decision.refundAmount > 0 && dispute.decision.refundStatus === 'none') ? ' — needs a manual refund' : ''} · driver compensation {money(dispute.decision.driverCompensation)}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2>What they said</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{dispute.description}</p>
        {dispute.evidenceUrls.length ? (
          <div className="row">{dispute.evidenceUrls.map((u, i) => <a key={u} className="btn small" href={u} target="_blank" rel="noreferrer">Evidence {i + 1}</a>)}</div>
        ) : <p className="faint">No evidence attached.</p>}
      </div>

      <div className="grid cols-2">
        <PartyCard role="rider" party={rider} raised={data.raisedByRole === 'rider'} previous={data.previousDisputes.rider} />
        <PartyCard role="driver" party={driver} raised={data.raisedByRole === 'driver'} previous={data.previousDisputes.driver} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Booking</h2>
          <table>
            <tbody>
              <tr><td className="muted">Route</td><td>{booking.pickup.address} → {booking.dropoff.address}</td></tr>
              <tr><td className="muted">Departure</td><td>{when(booking.ride?.departureTime)}</td></tr>
              <tr><td className="muted">Started · completed</td><td>{when(booking.ride?.startedAt)} · {when(booking.ride?.completedAt)}</td></tr>
              <tr><td className="muted">Booking status</td><td>{titleCase(booking.status)}{booking.cancellationReason ? ` (${booking.cancellationReason})` : ''}</td></tr>
              <tr><td className="muted">Paid</td><td>{money(paid)} for {booking.seatsBooked} seat{booking.seatsBooked === 1 ? '' : 's'}</td></tr>
              <tr><td className="muted">Refunded so far</td><td>{money(booking.refundAmount ?? 0)} · {money(data.refundable)} still refundable</td></tr>
            </tbody>
          </table>
          <h3 style={{ marginTop: 16 }}>Payments</h3>
          {data.payments.length ? data.payments.map((p) => (
            <div key={p._id} className="spread"><span>{money(p.amount)} · {p.method ?? 'card/UPI'} · {p.status}</span><span className="faint">{p.refundAmount ? `${money(p.refundAmount)} refunded` : when(p.createdAt)}</span></div>
          )) : <p className="faint">Paid from the wallet.</p>}
          <h3 style={{ marginTop: 16 }}>Ratings</h3>
          {data.ratings.length ? data.ratings.map((r) => (
            <div key={r._id}>{r.raterRole === 'rider' ? 'Rider' : 'Driver'} gave {r.score}/5{r.comment ? `: "${r.comment}"` : ''}</div>
          )) : <p className="faint">No ratings.</p>}
          {data.sos.length ? <p style={{ marginTop: 12 }}><Badge tone="danger">SOS on this ride</Badge> {data.sos.map((s) => <Link key={s._id} to={`/sos/${s._id}`}> view</Link>)}</p> : null}
        </div>
        <div className="card">
          <h2>Chat between them</h2>
          {data.messages.length ? (
            <div className="chat">
              {data.messages.map((m) => (
                <div key={m._id} className={`bubble${m.sender === booking.driver ? ' right' : ''}`}>
                  <div className="faint">{m.sender === rider?._id ? rider?.name : driver?.name} · {when(m.createdAt)}</div>
                  {m.contentType === 'text' ? m.content : `[${m.contentType}]`}
                </div>
              ))}
            </div>
          ) : <p className="faint">They did not chat.</p>}
        </div>
      </div>

      {data.history.length ? (
        <div className="card">
          <h2>Case history</h2>
          <ol className="timeline">
            {data.history.map((h) => <li key={h._id}><time>{when(h.createdAt)}</time><div>{titleCase(h.action.replace('dispute.', ''))} by {h.actor?.name ?? 'an admin'}</div></li>)}
          </ol>
        </div>
      ) : null}

      <ActionDialog
        open={deciding}
        title="Decide this dispute"
        confirmLabel="Record decision and carry it out"
        canConfirm={form.justification.trim().length >= 10}
        onConfirm={decide}
        onClose={() => setDeciding(false)}
      >
        <Field label="Outcome">
          <select className="input" value={form.outcome} onChange={(e) => up('outcome', e.target.value)}>
            {Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <div className="grid cols-2">
          <Field label={`Refund to rider (up to ${money(data.refundable)})`}>
            <input className="input" type="number" min={0} max={data.refundable} step="1" value={form.refundAmount} onChange={(e) => up('refundAmount', e.target.value)} />
          </Field>
          <Field label={`Pay the driver (up to ${money(paid)})`}>
            <input className="input" type="number" min={0} max={paid} step="1" value={form.driverCompensation} onChange={(e) => up('driverCompensation', e.target.value)} />
          </Field>
        </div>
        <div className="row">
          <label className="check"><input type="checkbox" checked={form.warnRider} onChange={(e) => up('warnRider', e.target.checked)} /> Warn the rider</label>
          <label className="check"><input type="checkbox" checked={form.warnDriver} onChange={(e) => up('warnDriver', e.target.checked)} /> Warn the driver</label>
        </div>
        <div className="row">
          <label className="check"><input type="checkbox" checked={form.suspendRider} onChange={(e) => up('suspendRider', e.target.checked)} /> Suspend the rider</label>
          <label className="check"><input type="checkbox" checked={form.suspendDriver} onChange={(e) => up('suspendDriver', e.target.checked)} /> Suspend the driver</label>
          {suspending ? (
            <select className="input" value={form.suspendDays} onChange={(e) => up('suspendDays', e.target.value)} aria-label="Suspension length">
              <option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option><option value="indefinite">Until lifted</option>
            </select>
          ) : null}
        </div>
        <Field label="Justification (both parties see this)">
          <textarea className="input" value={form.justification} onChange={(e) => up('justification', e.target.value)} placeholder="The chat shows the driver asked the rider to cancel, so the late-cancellation fee is returned." />
        </Field>
        <p className="faint">Money moves as soon as you confirm: wallet refunds are instant, card and UPI refunds go through Razorpay.</p>
      </ActionDialog>
    </div>
  );
}
