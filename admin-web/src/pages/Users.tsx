import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { day, money, titleCase, when } from '../lib/format';
import { useAdmin } from '../App';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead, Pager } from '../components/ui';
import { ReasonDialog } from '../components/Dialog';

interface UserRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  capabilities: string[];
  kyc?: { status: string };
  isSuspended?: boolean;
  suspendedUntil?: string;
  isBlocked?: boolean;
  warnings?: number;
  fraudLevel?: string;
  pendingBlock?: { requestedAt?: string };
  createdAt: string;
}

interface UserDetail {
  user: UserRow & {
    gender?: string;
    dateOfBirth?: string;
    suspensionReason?: string;
    blockReason?: string;
    pendingBlock?: { requestedBy?: { _id: string; name: string }; reason: string; requestedAt: string };
    stats: { totalRidesAsDriver: number; totalRidesAsRider: number; totalEarnings: number; totalSpent: number; avgRatingAsDriver: number; avgRatingAsRider: number; cancellationRate: number };
    vehicles?: Array<{ make: string; model: string; year: number; plateNumber: string }>;
  };
  bookingsAsRider: Array<{ _id: string; status: string; estimatedFare: number; createdAt: string; ride?: { pickup?: { address: string }; dropoff?: { address: string }; departureTime: string }; driver?: { name: string } }>;
  ridesAsDriver: Array<{ _id: string; status: string; departureTime: string; pickup: { address: string }; dropoff: { address: string }; totalSeats: number; availableSeats: number; pricePerSeat: number }>;
  ratings: Array<{ _id: string; score: number; comment?: string; tags: string[]; createdAt: string; rater?: { name: string }; raterRole: string }>;
  payments: Array<{ _id: string; amount: number; status: string; method?: string; createdAt: string }>;
  disputes: Array<{ _id: string; category: string; status: string; createdAt: string }>;
  sos: Array<{ _id: string; status: string; riskLevel: string; createdAt: string }>;
  notes: Array<{ _id: string; text: string; createdAt: string; author?: { name: string } }>;
  auditLog: Array<{ _id: string; action: string; reason?: string; createdAt: string; actor?: { name: string } }>;
  cancelledAsRider: number;
}

export function AccountBadges({ u }: { u: UserRow }) {
  return (
    <span className="row">
      {u.isBlocked ? <Badge tone="danger">Blocked</Badge> : u.isSuspended ? <Badge tone="warn">Suspended{u.suspendedUntil ? ` until ${day(u.suspendedUntil)}` : ''}</Badge> : <Badge tone="good">Active</Badge>}
      {u.pendingBlock?.requestedAt ? <Badge tone="warn">Block awaiting approval</Badge> : null}
      {u.capabilities?.includes('driver') ? <Badge tone="info">Driver</Badge> : null}
      {u.capabilities?.includes('admin') ? <Badge>Admin</Badge> : null}
      {u.warnings ? <Badge tone="warn">{u.warnings} warning{u.warnings === 1 ? '' : 's'}</Badge> : null}
      {u.fraudLevel && u.fraudLevel !== 'clear' ? <Badge tone="danger">Fraud: {u.fraudLevel}</Badge> : null}
    </span>
  );
}

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const status = params.get('status') ?? '';
  const role = params.get('role') ?? '';
  const page = Number(params.get('page') ?? 1);
  const { data, error, loading, reload } = useApi<{ users: UserRow[]; total: number; limit: number }>(
    `/admin/accounts${qs({ q: params.get('q'), status, role, page, limit: 25 })}`,
  );
  const navigate = useNavigate();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('page');
    setParams(next);
  };

  // Search as the admin types, after a short pause
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q) set('q', q);
    }, 350);
    return () => clearTimeout(t);
    // Runs on typing only; `set` and `params` change with every keystroke's URL update
  }, [q]);

  return (
    <div className="stack">
      <PageHead title="Users" sub="Search by name, phone or email." />
      <div className="row">
        <input className="input" style={{ flex: '1 1 260px' }} type="search" placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <select className="input" value={status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="blocked">Blocked</option>
          <option value="pending_block">Block awaiting approval</option>
        </select>
        <select className="input" value={role} onChange={(e) => set('role', e.target.value)} aria-label="Role">
          <option value="">Anyone</option>
          <option value="driver">Drivers</option>
          <option value="admin">Admins</option>
        </select>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {data.users.length === 0 ? <Empty>No users match.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Contact</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u._id} className="link" onClick={() => navigate(`/users/${u._id}`)}>
                      <td><Link to={`/users/${u._id}`}>{u.name}</Link></td>
                      <td>{u.phone?.startsWith('firebase:') ? '' : u.phone}<div className="faint">{u.email}</div></td>
                      <td><AccountBadges u={u} /></td>
                      <td>{day(u.createdAt)}</td>
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

type Action = 'suspend' | 'reinstate' | 'block' | 'approveBlock' | 'rejectBlock' | 'unblock' | null;

export function UserDetailPage() {
  const { id = '' } = useParams();
  const admin = useAdmin();
  const { data, error, loading, reload } = useApi<UserDetail>(`/admin/accounts/${id}`);
  const [action, setAction] = useState<Action>(null);
  const [days, setDays] = useState('7');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const u = data.user;
  const self = u._id === admin._id;
  const pendingByMe = u.pendingBlock?.requestedBy?._id === admin._id;
  const post = (path: string, body: object) => api.post(`/admin/accounts/${id}/${path}`, body).then(reload);

  const addNote = async () => {
    setNoteError('');
    try {
      await api.post(`/admin/accounts/${id}/notes`, { text: note });
      setNote('');
      reload();
    } catch (e) {
      setNoteError((e as Error).message);
    }
  };

  return (
    <div className="stack">
      <PageHead
        back={{ to: '/users', label: 'Users' }}
        title={u.name}
        sub={<AccountBadges u={u} />}
        actions={self ? <span className="faint">This is your account</span> : (
          <>
            {u.isSuspended ? <button className="btn" onClick={() => setAction('reinstate')}>Lift suspension</button> : !u.isBlocked ? <button className="btn" onClick={() => setAction('suspend')}>Suspend</button> : null}
            {u.isBlocked ? <button className="btn" onClick={() => setAction('unblock')}>Unblock</button> : null}
            {!u.isBlocked && !u.pendingBlock?.requestedAt ? <button className="btn danger" onClick={() => setAction('block')}>Block permanently</button> : null}
          </>
        )}
      />

      {u.pendingBlock?.requestedAt ? (
        <div className="banner warn">
          <div style={{ flex: 1 }}>
            <strong>Block requested by {u.pendingBlock.requestedBy?.name ?? 'an admin'} {when(u.pendingBlock.requestedAt)}</strong>
            {u.pendingBlock.reason}
            {pendingByMe ? <div>Another admin must approve it.</div> : null}
          </div>
          {!pendingByMe && !self ? (
            <div className="row">
              <button className="btn small" onClick={() => setAction('rejectBlock')}>Reject</button>
              <button className="btn small danger" onClick={() => post('block/approve', {})}>Approve block</button>
            </div>
          ) : null}
        </div>
      ) : null}
      {u.isSuspended && u.suspensionReason ? <div className="banner warn"><div><strong>Suspended</strong>{u.suspensionReason}</div></div> : null}
      {u.isBlocked && u.blockReason ? <div className="banner danger"><div><strong>Blocked</strong>{u.blockReason}</div></div> : null}

      <div className="grid cols-3">
        <div className="card">
          <h2>Profile</h2>
          <table><tbody>
            <tr><td className="muted">Phone</td><td>{u.phone?.startsWith('firebase:') ? '—' : u.phone}</td></tr>
            <tr><td className="muted">Email</td><td>{u.email ?? '—'}</td></tr>
            <tr><td className="muted">Gender</td><td>{u.gender ?? '—'}</td></tr>
            <tr><td className="muted">Joined</td><td>{day(u.createdAt)}</td></tr>
            <tr><td className="muted">Driver check</td><td>{u.kyc?.status ? titleCase(u.kyc.status) : '—'}</td></tr>
          </tbody></table>
          {u.kyc?.status === 'pending' ? <p style={{ marginTop: 8 }}><Link to={`/applications/${u._id}`}>Review driver application</Link></p> : null}
        </div>
        <div className="card">
          <h2>As a rider</h2>
          <table><tbody>
            <tr><td className="muted">Rides</td><td className="num">{u.stats.totalRidesAsRider}</td></tr>
            <tr><td className="muted">Spent</td><td className="num">{money(u.stats.totalSpent)}</td></tr>
            <tr><td className="muted">Rating</td><td className="num">{u.stats.avgRatingAsRider ? u.stats.avgRatingAsRider.toFixed(1) : '—'}</td></tr>
            <tr><td className="muted">Cancelled (last 20)</td><td className="num">{data.cancelledAsRider}</td></tr>
          </tbody></table>
        </div>
        <div className="card">
          <h2>As a driver</h2>
          <table><tbody>
            <tr><td className="muted">Rides</td><td className="num">{u.stats.totalRidesAsDriver}</td></tr>
            <tr><td className="muted">Earned</td><td className="num">{money(u.stats.totalEarnings)}</td></tr>
            <tr><td className="muted">Rating</td><td className="num">{u.stats.avgRatingAsDriver ? u.stats.avgRatingAsDriver.toFixed(1) : '—'}</td></tr>
            <tr><td className="muted">Vehicle</td><td>{u.vehicles?.length ? `${u.vehicles[u.vehicles.length - 1].plateNumber}` : '—'}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="card">
        <h2>Internal notes</h2>
        <p className="faint">Only admins see these.</p>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <textarea className="input" style={{ flex: 1, minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called about repeated late cancellations; agreed to warn." aria-label="New note" />
          <button className="btn" disabled={!note.trim()} onClick={addNote}>Add note</button>
        </div>
        {noteError ? <div className="error-text">{noteError}</div> : null}
        {data.notes.map((n) => (
          <div key={n._id} style={{ padding: '8px 0', borderTop: '1px solid var(--grid)' }}>
            <div className="faint">{n.author?.name ?? 'Admin'} · {when(n.createdAt)}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div>
          </div>
        ))}
      </div>

      <div className="grid cols-2">
        <HistoryTable title="Bookings as a rider" empty="No bookings." head={['When', 'Route', 'Driver', 'Fare', 'Status']}
          rows={data.bookingsAsRider.map((b) => [when(b.ride?.departureTime ?? b.createdAt), `${b.ride?.pickup?.address ?? '—'} → ${b.ride?.dropoff?.address ?? '—'}`, b.driver?.name ?? '—', money(b.estimatedFare), titleCase(b.status)])} />
        <HistoryTable title="Rides as a driver" empty="No rides." head={['When', 'Route', 'Seats taken', 'Status']}
          rows={data.ridesAsDriver.map((r) => [when(r.departureTime), `${r.pickup.address} → ${r.dropoff.address}`, `${r.totalSeats - r.availableSeats}/${r.totalSeats}`, titleCase(r.status)])} />
        <HistoryTable title="Ratings received" empty="No ratings." head={['When', 'From', 'Score', 'Comment']}
          rows={data.ratings.map((r) => [day(r.createdAt), `${r.rater?.name ?? '—'} (${r.raterRole})`, `${r.score}/5`, r.comment ?? r.tags.join(', ')])} />
        <HistoryTable title="Payments" empty="No online payments." head={['When', 'Amount', 'Method', 'Status']}
          rows={data.payments.map((p) => [when(p.createdAt), money(p.amount), p.method ?? '—', titleCase(p.status)])} />
        <div className="card">
          <h2>Disputes and SOS</h2>
          {data.disputes.length === 0 && data.sos.length === 0 ? <p className="faint">None.</p> : null}
          {data.disputes.map((d) => <div key={d._id}><Link to={`/disputes/${d._id}`}>{titleCase(d.category)} dispute</Link> · {titleCase(d.status)} · {day(d.createdAt)}</div>)}
          {data.sos.map((s) => <div key={s._id}><Link to={`/sos/${s._id}`}>SOS</Link> · {titleCase(s.status)} · {day(s.createdAt)}</div>)}
        </div>
        <CallsCard userId={u._id} />
        {!self && !u.isBlocked ? <DuplicateAccounts keepId={u._id} keepName={u.name} /> : null}
        <HistoryTable title="Admin actions on this account" empty="None." head={['When', 'Action', 'By', 'Reason']}
          rows={data.auditLog.map((a) => [when(a.createdAt), titleCase(a.action.split('.').slice(1).join(' ')), a.actor?.name ?? '—', a.reason ?? ''])} />
      </div>

      <ReasonDialog
        open={action === 'suspend'}
        title={`Suspend ${u.name}`}
        intro="They can still sign in and see their rides, but cannot post or book until the suspension ends. They are told the reason."
        confirmLabel="Suspend"
        tone="danger"
        extra={
          <Field label="For how long">
            <select className="input" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option><option value="indefinite">Until lifted by an admin</option>
            </select>
          </Field>
        }
        onConfirm={(reason) => post('suspend', { days: days === 'indefinite' ? null : Number(days), reason })}
        onClose={() => setAction(null)}
      />
      <ReasonDialog open={action === 'reinstate'} title="Lift the suspension" confirmLabel="Lift suspension" onConfirm={(reason) => post('reinstate', { reason })} onClose={() => setAction(null)} />
      <ReasonDialog
        open={action === 'block'}
        title={`Block ${u.name} permanently`}
        intro="For serious violations only. A second admin must approve the block before it takes effect."
        confirmLabel="Request block"
        tone="danger"
        onConfirm={(reason) => post('block', { reason })}
        onClose={() => setAction(null)}
      />
      <ReasonDialog open={action === 'rejectBlock'} title="Reject the block request" confirmLabel="Reject request" onConfirm={(reason) => post('block/reject', { reason })} onClose={() => setAction(null)} />
      <ReasonDialog open={action === 'unblock'} title="Unblock this account" confirmLabel="Unblock" onConfirm={(reason) => post('unblock', { reason })} onClose={() => setAction(null)} />
    </div>
  );
}

/** Masked calls on this user's bookings, with recordings for safety reviews (UC-D06, UC-A03) */
function CallsCard({ userId }: { userId: string }) {
  const { data } = useApi<{ calls: Array<{ _id: string; createdAt: string; status: string; durationSec?: number; hasRecording: boolean; caller?: { name: string }; callee?: { name: string } }> }>(`/admin/accounts/${userId}/calls`);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  useEffect(() => () => Object.values(audio).forEach((u) => URL.revokeObjectURL(u)), [audio]);
  const play = async (id: string) => {
    setLoadError('');
    try {
      const url = await api.objectUrl(`/admin/calls/${id}/recording`);
      setAudio((a) => ({ ...a, [id]: url }));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };
  if (!data?.calls.length) return null;
  return (
    <div className="card">
      <h2>Calls</h2>
      <p className="faint">Calls through Poolora between this person and their riders or drivers. Recordings are for safety reviews only.</p>
      {loadError ? <div className="error-text">{loadError}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>From</th><th>To</th><th>Result</th><th>Recording</th></tr></thead>
          <tbody>
            {data.calls.map((c) => (
              <tr key={c._id}>
                <td>{when(c.createdAt)}</td>
                <td>{c.caller?.name ?? '—'}</td>
                <td>{c.callee?.name ?? '—'}</td>
                <td>{titleCase(c.status)}{c.durationSec ? `, ${Math.round(c.durationSec / 60)} min` : ''}</td>
                <td>{audio[c._id] ? <audio controls src={audio[c._id]} /> : c.hasRecording ? <button className="btn small" onClick={() => play(c._id)}>Play</button> : <span className="faint">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Accounts that look like this person's; merge one into this account (UC-A05) */
function DuplicateAccounts({ keepId, keepName }: { keepId: string; keepName: string }) {
  const { data, error, reload } = useApi<{ candidates: Array<{ _id: string; name: string; phone: string; email?: string; sameDevice: boolean; sameName: boolean; isBlocked?: boolean; createdAt: string; stats?: { totalRidesAsRider?: number; totalRidesAsDriver?: number } }> }>(`/admin/accounts/${keepId}/duplicates`);
  const [merging, setMerging] = useState<{ _id: string; name: string; phone: string } | null>(null);
  const [done, setDone] = useState('');
  return (
    <div className="card">
      <h2>Duplicate accounts</h2>
      <ErrorBox error={error} onRetry={reload} />
      {done ? <div className="muted" role="status">{done}</div> : null}
      {data && !data.candidates.length ? <p className="faint">No accounts with the same name or phone.</p> : null}
      {data?.candidates.map((c) => (
        <div key={c._id} className="spread" style={{ padding: '6px 0', borderTop: '1px solid var(--grid)' }}>
          <div>
            <Link to={`/users/${c._id}`}>{c.name}</Link> · {c.phone}
            <div className="faint">
              {[c.sameDevice ? 'Same phone handset' : '', c.sameName ? 'Same name' : '', `${(c.stats?.totalRidesAsRider ?? 0) + (c.stats?.totalRidesAsDriver ?? 0)} trips`, `joined ${day(c.createdAt)}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          {c.isBlocked ? <Badge>Blocked</Badge> : <button className="btn small" onClick={() => setMerging(c)}>Merge into this account</button>}
        </div>
      ))}
      <ReasonDialog
        open={merging !== null}
        title={`Merge ${merging?.name} into ${keepName}`}
        intro={`${merging?.name} (${merging?.phone}) is closed, and its history, wallet and coins move to this account. A second admin must approve it under Appeals and merges.`}
        confirmLabel="Ask for the merge"
        tone="danger"
        placeholder="Same person: confirmed on a support call from both numbers."
        onConfirm={(reason) => api.post(`/admin/accounts/${merging!._id}/merge`, { targetId: keepId, reason }).then(() => setDone('Merge requested. Another admin must approve it.'))}
        onClose={() => setMerging(null)}
      />
    </div>
  );
}

function HistoryTable({ title, head, rows, empty }: { title: string; head: string[]; rows: Array<Array<string>>; empty: string }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="faint">{empty}</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
