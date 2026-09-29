import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { when } from '../lib/format';
import { useAdmin } from '../App';
import { Badge, Empty, ErrorBox, Loading, PageHead } from '../components/ui';
import { ActionDialog, ReasonDialog } from '../components/Dialog';

type Person = { _id: string; name: string; phone?: string; email?: string };
interface Appeal {
  _id: string;
  user: Person & { isBlocked?: boolean; isSuspended?: boolean; suspendedUntil?: string };
  kind: 'suspension' | 'block';
  actionReason?: string;
  actionBy?: Person;
  actionAt?: string;
  message: string;
  status: 'open' | 'upheld' | 'overturned';
  decidedBy?: Person;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
}
interface Merge {
  _id: string;
  source: Person;
  target: Person;
  reason: string;
  requestedBy: Person;
  status: 'pending' | 'running' | 'completed' | 'rejected';
  decidedBy?: Person;
  decisionNote?: string;
  moved?: Record<string, number>;
  createdAt: string;
}

const MOVED_LABELS: Record<string, string> = {
  bookings: 'bookings', rides: 'rides', ratings: 'ratings', payments: 'payments', disputes: 'disputes', sos: 'SOS records',
  messages: 'messages', parcels: 'parcels', trips: 'trips', supportTickets: 'support requests', notifications: 'notifications',
  walletAmount: 'US dollars', coins: 'coins',
};

/** Appeals against suspensions and blocks, and duplicate-account merges (UC-A05) */
export function AppealsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'merges' ? 'merges' : 'appeals';
  const status = params.get('status') ?? (tab === 'merges' ? 'pending' : 'open');
  return (
    <div className="stack">
      <PageHead title="Appeals and merges" sub="Decisions that need an admin other than the one who asked or acted." />
      <div className="seg" role="group" aria-label="Show">
        <button aria-pressed={tab === 'appeals'} onClick={() => setParams({ tab: 'appeals' })}>Appeals</button>
        <button aria-pressed={tab === 'merges'} onClick={() => setParams({ tab: 'merges' })}>Duplicate merges</button>
      </div>
      {tab === 'appeals' ? <Appeals status={status} onStatus={(s) => setParams({ tab, status: s })} /> : <Merges status={status} onStatus={(s) => setParams({ tab, status: s })} />}
    </div>
  );
}

function Appeals({ status, onStatus }: { status: string; onStatus: (s: string) => void }) {
  const admin = useAdmin();
  const { data, error, loading, reload } = useApi<{ appeals: Appeal[] }>(`/admin/appeals?status=${status}`);
  const [deciding, setDeciding] = useState<{ appeal: Appeal; decision: 'uphold' | 'overturn' } | null>(null);

  return (
    <>
      <div className="seg" role="group" aria-label="Status">
        {[['open', 'Waiting'], ['overturned', 'Overturned'], ['upheld', 'Upheld'], ['all', 'All']].map(([k, l]) => (
          <button key={k} aria-pressed={status === k} onClick={() => onStatus(k)}>{l}</button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.appeals.length ? <Empty>No appeals here.</Empty> : null}
      {data?.appeals.map((a) => {
        const actedByMe = a.actionBy?._id === admin._id;
        return (
          <div key={a._id} className="card stack" style={{ gap: 8 }}>
            <div className="spread">
              <strong><Link to={`/users/${a.user._id}`}>{a.user.name}</Link> appeals a {a.kind}</strong>
              <Badge tone={a.status === 'open' ? 'warn' : a.status === 'overturned' ? 'good' : 'neutral'}>{a.status === 'open' ? 'Waiting' : a.status === 'overturned' ? 'Overturned' : 'Upheld'}</Badge>
            </div>
            <div className="faint">
              Filed {when(a.createdAt)}. The {a.kind} was{a.actionBy ? ` imposed by ${a.actionBy.name}` : ''}{a.actionAt ? ` ${when(a.actionAt)}` : ''}{a.actionReason ? `: ${a.actionReason}` : ''}.
            </div>
            <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '3px solid var(--border)' }}>{a.message}</blockquote>
            {a.status === 'open' ? (
              actedByMe ? <p className="faint" style={{ margin: 0 }}>You took the original action, so another admin must decide this appeal.</p> : (
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn primary" onClick={() => setDeciding({ appeal: a, decision: 'overturn' })}>Overturn and lift the {a.kind}</button>
                  <button className="btn" onClick={() => setDeciding({ appeal: a, decision: 'uphold' })}>Uphold</button>
                </div>
              )
            ) : (
              <p className="muted" style={{ margin: 0 }}>{a.decidedBy?.name ?? 'An admin'} decided {when(a.decidedAt)}: {a.decisionNote}</p>
            )}
          </div>
        );
      })}
      <ReasonDialog
        open={deciding !== null}
        title={deciding?.decision === 'overturn' ? `Overturn: lift the ${deciding.appeal.kind}` : 'Uphold the decision'}
        intro={`The user sees your note. ${deciding?.decision === 'overturn' ? 'Their account works normally again at once.' : 'The restriction stays as it is.'}`}
        confirmLabel={deciding?.decision === 'overturn' ? 'Overturn' : 'Uphold'}
        onConfirm={(note) => api.post(`/admin/appeals/${deciding!.appeal._id}/decide`, { decision: deciding!.decision, note }).then(reload)}
        onClose={() => setDeciding(null)}
      />
    </>
  );
}

function Merges({ status, onStatus }: { status: string; onStatus: (s: string) => void }) {
  const admin = useAdmin();
  const { data, error, loading, reload } = useApi<{ merges: Merge[] }>(`/admin/merges${status === 'all' ? '' : `?status=${status}`}`);
  const [approving, setApproving] = useState<Merge | null>(null);
  const [rejecting, setRejecting] = useState<Merge | null>(null);

  return (
    <>
      <div className="seg" role="group" aria-label="Status">
        {[['pending', 'Waiting'], ['completed', 'Done'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => (
          <button key={k} aria-pressed={status === k} onClick={() => onStatus(k)}>{l}</button>
        ))}
      </div>
      <p className="faint" style={{ margin: 0 }}>Start a merge from the account to keep: Users, open the account, then "Duplicate accounts".</p>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.merges.length ? <Empty>No merges here.</Empty> : null}
      {data?.merges.map((m) => (
        <div key={m._id} className="card stack" style={{ gap: 8 }}>
          <div className="spread">
            <strong>
              Merge <Link to={`/users/${m.source._id}`}>{m.source.name}</Link> ({m.source.phone}) into <Link to={`/users/${m.target._id}`}>{m.target.name}</Link> ({m.target.phone})
            </strong>
            <Badge tone={m.status === 'completed' ? 'good' : m.status === 'rejected' ? 'neutral' : 'warn'}>{m.status === 'running' ? 'Stopped part-way' : m.status === 'pending' ? 'Waiting' : m.status === 'completed' ? 'Done' : 'Rejected'}</Badge>
          </div>
          <div className="faint">Asked by {m.requestedBy?.name ?? 'an admin'} {when(m.createdAt)}: {m.reason}</div>
          {m.moved ? (
            <div className="muted">Moved: {Object.entries(m.moved).filter(([, n]) => n).map(([k, n]) => `${n} ${MOVED_LABELS[k] ?? k}`).join(', ') || 'nothing but the account'}</div>
          ) : null}
          {m.decisionNote ? <div className="muted">{m.decidedBy?.name}: {m.decisionNote}</div> : null}
          {m.status === 'pending' || m.status === 'running' ? (
            m.requestedBy?._id === admin._id ? <p className="faint" style={{ margin: 0 }}>You asked for this merge, so another admin must approve it.</p> : (
              <div className="row" style={{ gap: 6 }}>
                <button className="btn danger" onClick={() => setApproving(m)}>{m.status === 'running' ? 'Finish the merge' : 'Approve and merge'}</button>
                {m.status === 'pending' ? <button className="btn" onClick={() => setRejecting(m)}>Reject</button> : null}
              </div>
            )
          ) : null}
        </div>
      ))}
      <ActionDialog
        open={approving !== null}
        title="Merge these accounts?"
        confirmLabel="Merge"
        tone="danger"
        onConfirm={() => api.post(`/admin/merges/${approving!._id}/approve`).then(reload)}
        onClose={() => setApproving(null)}
      >
        <p className="muted" style={{ margin: 0 }}>
          Trips, ratings, payments, messages, wallet money and coins move from {approving?.source.name} ({approving?.source.phone}) to {approving?.target.name} ({approving?.target.phone}).
          The duplicate is closed for good; signing in with its number shows where to go. This cannot be undone.
        </p>
      </ActionDialog>
      <ReasonDialog
        open={rejecting !== null}
        title="Reject this merge"
        confirmLabel="Reject"
        onConfirm={(reason) => api.post(`/admin/merges/${rejecting!._id}/reject`, { reason }).then(reload)}
        onClose={() => setRejecting(null)}
      />
    </>
  );
}
