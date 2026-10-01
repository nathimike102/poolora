/**
 * Review moderation (UC-R06). Written reviews are public only after an admin
 * approves them. Ratings that report a problem are private; safety reports
 * come first and alert admins as soon as they are submitted.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { ago, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHead } from '../components/ui';
import { ActionDialog } from '../components/Dialog';

interface Person { _id: string; name?: string; phone?: string }
interface Review {
  _id: string;
  booking: string;
  rater: Person | null;
  ratee: Person | null;
  raterRole: 'rider' | 'driver';
  score: number;
  categories?: { behavior?: number; cleanliness?: number; punctuality?: number };
  comment?: string;
  commentStatus?: 'pending' | 'approved' | 'rejected';
  issues?: Array<'safety' | 'route' | 'payment'>;
  /** Confidential "did you feel safe?", 1 (no) to 5 (yes) */
  safety?: number;
  issueDetails?: string;
  flagReason?: string;
  moderatedBy?: { name?: string };
  moderatedAt?: string;
  moderationNote?: string;
  createdAt: string;
}

const ISSUE: Record<string, string> = { safety: 'Safety', route: 'Route or timing', payment: 'Payment' };
const VIEWS = [['pending', 'Waiting'], ['reported', 'Problems reported'], ['done', 'Decided']] as const;

function stars(n: number) {
  return <span aria-label={`${n} of 5 stars`}>{'★'.repeat(n)}<span className="faint">{'★'.repeat(5 - n)}</span></span>;
}

const SAFE_LABEL: Record<number, string> = { 1: 'No', 3: 'Mostly', 5: 'Yes' };

export function ReviewsPage() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find(([v]) => v === params.get('status'))?.[0] ?? 'pending') as (typeof VIEWS)[number][0];
  const { data, error, loading, reload } = useApi<{ ratings: Review[] }>(`/admin/reviews?status=${view}`, 60_000);
  const [deciding, setDeciding] = useState<{ review: Review; decision: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const reviews = data?.ratings ?? [];

  return (
    <div className="stack">
      <PageHead
        title="Reviews"
        sub="Reviews go on profiles only after approval. Safety reports come first; they are never shown publicly."
        actions={
          <div className="seg" role="group" aria-label="View">
            {VIEWS.map(([v, l]) => (
              <button key={v} aria-pressed={view === v} onClick={() => setParams(v === 'pending' ? {} : { status: v })}>{l}</button>
            ))}
          </div>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {reviews.length === 0 ? <Empty>Nothing here.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Submitted</th><th>From</th><th>About</th><th>Rating</th><th>Review and report</th><th>{view === 'done' ? 'Decision' : <span className="sr-only">Actions</span>}</th></tr>
                </thead>
                <tbody>
                  {reviews.map((r) => {
                    const safety = r.issues?.includes('safety') || (r.safety !== undefined && r.safety <= 2);
                    return (
                      <tr key={r._id}>
                        <td>{when(r.createdAt)}<div className="faint">{ago(r.createdAt)}</div></td>
                        <td>{r.rater ? <Link to={`/users/${r.rater._id}`}>{r.rater.name || 'No name'}</Link> : '—'}<div className="faint">as {r.raterRole}</div></td>
                        <td>{r.ratee ? <Link to={`/users/${r.ratee._id}`}>{r.ratee.name || 'No name'}</Link> : '—'}</td>
                        <td>
                          {stars(r.score)}
                          {r.categories ? (
                            <div className="faint">
                              {[['Behaviour', r.categories.behavior], ['Cleanliness', r.categories.cleanliness], ['Punctuality', r.categories.punctuality]]
                                .filter(([, v]) => v).map(([l, v]) => `${l} ${v}`).join(' · ')}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ maxWidth: 360 }}>
                          {safety ? <div><Badge tone="danger">{r.issues?.includes('safety') ? 'Safety report' : 'Did not feel safe'}</Badge></div> : null}
                          {r.safety !== undefined ? <div className="faint">Felt safe: {SAFE_LABEL[r.safety] ?? r.safety} (confidential)</div> : null}
                          {(r.issues ?? []).filter((i) => i !== 'safety').map((i) => <div key={i}><Badge tone="warn">{ISSUE[i]}</Badge></div>)}
                          {r.issueDetails ? <div><strong>Report:</strong> {r.issueDetails}</div> : null}
                          {r.comment ? <div><strong>Review:</strong> {r.comment}</div> : null}
                          {r.flagReason?.includes('Profanity') ? <div className="faint">Profanity was masked</div> : null}
                        </td>
                        <td>
                          {r.moderatedAt ? (
                            <>
                              {r.commentStatus ? <Badge tone={r.commentStatus === 'approved' ? 'good' : 'danger'}>{r.commentStatus === 'approved' ? 'Published' : 'Rejected'}</Badge> : <Badge tone="good">Handled</Badge>}
                              <div className="faint">{r.moderatedBy?.name ?? 'An admin'}, {ago(r.moderatedAt)}</div>
                              {r.moderationNote ? <div>{r.moderationNote}</div> : null}
                            </>
                          ) : (
                            <div className="row">
                              <button className="btn small" onClick={() => { setNote(''); setDeciding({ review: r, decision: 'approve' }); }}>
                                {r.comment ? 'Publish' : 'Mark handled'}
                              </button>
                              {r.comment ? (
                                <button className="btn small danger" onClick={() => { setNote(''); setDeciding({ review: r, decision: 'reject' }); }}>Reject</button>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ActionDialog
        open={deciding !== null}
        title={deciding?.decision === 'reject' ? 'Reject this review?' : deciding?.review.comment ? 'Publish this review?' : 'Mark this report handled?'}
        confirmLabel={deciding?.decision === 'reject' ? 'Reject' : deciding?.review.comment ? 'Publish' : 'Mark handled'}
        tone={deciding?.decision === 'reject' ? 'danger' : 'primary'}
        onConfirm={() => api.post(`/admin/reviews/${deciding!.review._id}/moderate`, { decision: deciding!.decision, note }).then(reload)}
        onClose={() => setDeciding(null)}
      >
        <div className="muted">
          {deciding?.decision === 'reject'
            ? 'The star rating still counts; only the written review stays hidden.'
            : deciding?.review.issues?.includes('safety')
              ? 'Before marking it handled, contact the people involved, and raise a dispute or suspend the account from the user page if needed.'
              : 'The review appears on the profile.'}
        </div>
        <label className="field">
          <span>Note (optional, recorded in the audit log)</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </ActionDialog>
    </div>
  );
}
