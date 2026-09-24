/**
 * Fraud flags (UC-AI02). The automatic check on failed payments flags
 * high-risk accounts and suspends critical ones until an admin looks. An
 * admin clears a false positive, which lifts the check's suspension, or
 * confirms it. High-risk flags are due for review within 2 hours.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { ago, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHead } from '../components/ui';
import { ReasonDialog } from '../components/Dialog';

interface FlaggedAccount {
  _id: string;
  name: string;
  phone: string;
  capabilities: string[];
  fraudLevel: 'flagged' | 'blocked' | 'clear';
  fraudFlags?: string[];
  fraudFlaggedAt?: string;
  fraudReview?: { decision: 'cleared' | 'confirmed'; by?: { name?: string }; at: string; note: string };
  isSuspended: boolean;
  suspensionReason?: string;
  isBlocked: boolean;
  stats?: { totalRidesAsRider?: number; totalRidesAsDriver?: number };
  overdue: boolean;
  createdAt: string;
}

type Decision = { account: FlaggedAccount; decision: 'cleared' | 'confirmed' };

function state(a: FlaggedAccount) {
  if (a.isBlocked) return <Badge tone="danger">Blocked</Badge>;
  if (a.isSuspended && a.suspensionReason?.startsWith('Automatic fraud check')) return <Badge tone="danger">Suspended by the check</Badge>;
  if (a.isSuspended) return <Badge tone="warn">Suspended by an admin</Badge>;
  return <Badge tone="warn">Flagged, still active</Badge>;
}

export function FraudPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'reviewed' ? 'reviewed' : 'open';
  const { data, error, loading, reload } = useApi<{ accounts: FlaggedAccount[] }>(`/admin/fraud?view=${view}`, 60_000);
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const accounts = data?.accounts ?? [];

  return (
    <div className="stack">
      <PageHead
        title="Fraud flags"
        sub={view === 'open'
          ? 'Accounts the automatic check flagged on failed payments. Review each within 2 hours. Oldest first.'
          : 'Recent decisions. Cleared flags are the false positives the model is retrained on.'}
        actions={
          <div className="seg" role="group" aria-label="View">
            {[['open', 'Waiting'], ['reviewed', 'Reviewed']].map(([v, l]) => (
              <button key={v} aria-pressed={view === v} onClick={() => setParams(v === 'open' ? {} : { view: v })}>{l}</button>
            ))}
          </div>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {accounts.length === 0 ? <Empty>{view === 'open' ? 'No flags waiting for review.' : 'No reviewed flags yet.'}</Empty> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Flagged</th><th>Account</th><th>What the check found</th><th>Now</th>
                    <th>{view === 'open' ? <span className="sr-only">Actions</span> : 'Decision'}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a._id}>
                      <td>
                        {when(a.fraudFlaggedAt)}
                        <div className="faint">{ago(a.fraudFlaggedAt)}</div>
                        {a.overdue ? <Badge tone="warn">Over 2 hours</Badge> : null}
                      </td>
                      <td>
                        <Link to={`/users/${a._id}`}>{a.name || 'No name'}</Link>
                        <div className="faint">{a.phone}</div>
                        <div className="faint">
                          {a.capabilities.includes('driver') ? 'Driver · ' : ''}joined {ago(a.createdAt)}
                        </div>
                      </td>
                      <td>
                        {a.fraudLevel === 'blocked' || a.fraudReview?.decision === 'confirmed'
                          ? <div><Badge tone="danger">Critical</Badge></div>
                          : null}
                        {(a.fraudFlags ?? []).length
                          ? a.fraudFlags!.map((f) => <div key={f}>{f}</div>)
                          : <span className="faint">No details recorded</span>}
                      </td>
                      <td>{state(a)}</td>
                      <td>
                        {view === 'open' ? (
                          <div className="row">
                            <button className="btn small" onClick={() => setDeciding({ account: a, decision: 'cleared' })}>Clear</button>
                            <button className="btn small danger" onClick={() => setDeciding({ account: a, decision: 'confirmed' })}>Confirm</button>
                          </div>
                        ) : a.fraudReview ? (
                          <>
                            <Badge tone={a.fraudReview.decision === 'cleared' ? 'good' : 'danger'}>
                              {a.fraudReview.decision === 'cleared' ? 'False positive' : 'Confirmed'}
                            </Badge>
                            <div className="faint">{a.fraudReview.by?.name ?? 'An admin'}, {ago(a.fraudReview.at)}</div>
                            <div>{a.fraudReview.note}</div>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ReasonDialog
        open={deciding !== null}
        title={deciding?.decision === 'cleared' ? `Clear the flag on ${deciding.account.name}?` : `Confirm fraud by ${deciding?.account.name ?? ''}?`}
        intro={deciding?.decision === 'cleared'
          ? (deciding.account.suspensionReason?.startsWith('Automatic fraud check')
            ? 'This was a false positive. The suspension the check placed is lifted and the user is told.'
            : 'This was a false positive. The flag is removed; nothing else about the account changes.')
          : 'The account stays as it is now. To block it for good, request a block from the user page; a second admin must approve it.'}
        confirmLabel={deciding?.decision === 'cleared' ? 'Clear flag' : 'Confirm fraud'}
        tone={deciding?.decision === 'cleared' ? 'primary' : 'danger'}
        placeholder={deciding?.decision === 'cleared' ? 'The failures were a bank outage on 24 Sept' : 'Twelve different cards tried within an hour'}
        onConfirm={(note) => api.post(`/admin/fraud/${deciding!.account._id}/review`, { decision: deciding!.decision, note }).then(reload)}
        onClose={() => setDeciding(null)}
      />
    </div>
  );
}
