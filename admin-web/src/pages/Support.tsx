/**
 * Support requests (UC-X02). Safety and payment requests are urgent and
 * listed first. A reply notifies the user (in the app, by push and by
 * email) and they can answer in the same thread.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { ago, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHead } from '../components/ui';

interface Person { _id: string; name?: string; phone?: string; email?: string }
interface Ticket {
  _id: string;
  user: Person | null;
  category: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  priority: 'urgent' | 'normal';
  messages: Array<{ from: 'user' | 'support'; author?: { name?: string }; text: string; at: string }>;
  booking?: { _id: string; status: string; pickup?: { address?: string }; dropoff?: { address?: string } } | null;
  appInfo?: string;
  assignedTo?: { name?: string };
  createdAt: string;
  updatedAt: string;
}

const CATEGORY: Record<string, string> = {
  safety: 'Safety', payment: 'Payment', account: 'Account', dispute: 'Trip problem',
  technical: 'Technical', feature: 'Feature request', feedback: 'Feedback',
};
const VIEWS = [['open', 'Waiting'], ['answered', 'Answered'], ['closed', 'Closed']] as const;

export function SupportPage() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find(([v]) => v === params.get('status'))?.[0] ?? 'open') as (typeof VIEWS)[number][0];
  const { data, error, loading, reload } = useApi<{ tickets: Ticket[] }>(`/admin/support?status=${view}`, 60_000);
  const navigate = useNavigate();
  const tickets = data?.tickets ?? [];

  return (
    <div className="stack">
      <PageHead
        title="Support requests"
        sub="Safety and payment first, then oldest first."
        actions={
          <div className="seg" role="group" aria-label="Status">
            {VIEWS.map(([v, l]) => (
              <button key={v} aria-pressed={view === v} onClick={() => setParams(v === 'open' ? {} : { status: v })}>{l}</button>
            ))}
          </div>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {tickets.length === 0 ? <Empty>No requests here.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Sent</th><th>From</th><th>Category</th><th>Subject</th><th>Messages</th></tr></thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t._id} className="link" onClick={() => navigate(`/support/${t._id}`)}>
                      <td><Link to={`/support/${t._id}`}>{when(t.createdAt)}</Link><div className="faint">{ago(t.createdAt)}</div></td>
                      <td>{t.user?.name || 'No name'}<div className="faint">{t.user?.phone}</div></td>
                      <td>{t.priority === 'urgent' ? <Badge tone="danger">{CATEGORY[t.category]}</Badge> : CATEGORY[t.category] ?? t.category}</td>
                      <td>{t.subject}</td>
                      <td className="num">{t.messages.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SupportDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<{ ticket: Ticket }>(`/admin/support/${id}`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState('');
  const t = data?.ticket;

  const send = async (close: boolean) => {
    setBusy(true);
    setSendError('');
    try {
      if (text.trim()) await api.post(`/admin/support/${id}/reply`, { text: text.trim(), close });
      else await api.post(`/admin/support/${id}/close`);
      setText('');
      await reload();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Not sent. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <PageHead title={t?.subject ?? 'Support request'} back={{ to: '/support', label: 'Support requests' }} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {t ? (
        <>
          <div className="card">
            <div className="row">
              {t.priority === 'urgent' ? <Badge tone="danger">Urgent</Badge> : null}
              <Badge>{CATEGORY[t.category] ?? t.category}</Badge>
              <Badge tone={t.status === 'open' ? 'warn' : t.status === 'answered' ? 'info' : 'neutral'}>{t.status === 'open' ? 'Waiting for us' : t.status === 'answered' ? 'Answered' : 'Closed'}</Badge>
            </div>
            <p>
              From {t.user ? <Link to={`/users/${t.user._id}`}>{t.user.name || 'No name'}</Link> : 'a deleted account'}
              {t.user?.phone ? ` · ${t.user.phone}` : ''}{t.user?.email ? ` · ${t.user.email}` : ''}
            </p>
            {t.booking ? <p className="muted">Trip: {t.booking.pickup?.address} to {t.booking.dropoff?.address} ({t.booking.status})</p> : null}
            {t.appInfo ? <p className="faint">{t.appInfo}</p> : null}
          </div>
          <div className="card stack">
            {t.messages.map((m, i) => (
              <div key={i}>
                <strong>{m.from === 'user' ? t.user?.name || 'User' : `${m.author?.name ?? 'Support'} (Poolora)`}</strong>
                <span className="faint"> · {when(m.at)}</span>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="card stack">
            <label className="field">
              <span>Reply (the user gets it in the app and by email)</span>
              <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            {sendError ? <div className="error-text" role="alert">{sendError}</div> : null}
            <div className="row">
              <button className="btn primary" disabled={busy || !text.trim()} onClick={() => send(false)}>Send reply</button>
              <button className="btn" disabled={busy || !text.trim()} onClick={() => send(true)}>Send and close</button>
              {t.status !== 'closed' ? <button className="btn" disabled={busy || Boolean(text.trim())} onClick={() => send(true)}>Close without reply</button> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
