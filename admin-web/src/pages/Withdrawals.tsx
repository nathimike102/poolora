import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { money, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead } from '../components/ui';
import { ActionDialog } from '../components/Dialog';

interface Withdrawal {
  _id: string;
  amount: number;
  channel: 'ecocash' | 'onemoney' | 'innbucks';
  payNumber: string;
  status: 'pending' | 'paid' | 'rejected' | 'cancelled';
  payoutReference?: string;
  note?: string;
  processedAt?: string;
  createdAt: string;
  user: { _id: string; name: string; phone: string; email?: string } | null;
}

const CHANNEL: Record<Withdrawal['channel'], string> = { ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks' };
const STATUS: Record<Withdrawal['status'], string> = { pending: 'Waiting', paid: 'Sent', rejected: 'Rejected', cancelled: 'Cancelled by user' };

/**
 * Wallet cash-outs to mobile money. The amount has already left the user's
 * wallet; send it from the business account, then record the transaction id.
 * Rejecting puts it back in their wallet.
 */
export function WithdrawalsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const { data, error, loading, reload } = useApi<{ withdrawals: Withdrawal[] }>(`/admin/withdrawals?status=${status}`);
  const [acting, setActing] = useState<{ w: Withdrawal; paid: boolean } | null>(null);
  const [text, setText] = useState('');

  useEffect(() => setText(''), [acting]);

  const waiting = data?.withdrawals.filter((w) => w.status === 'pending') ?? [];
  const total = waiting.reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="stack">
      <PageHead
        title="Withdrawals"
        sub="Users cashing out their wallet. Send each one from the business mobile money account, then record the transaction id. Oldest first."
      />
      <div className="seg" role="group" aria-label="Status">
        {[['pending', 'Waiting'], ['paid', 'Sent'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => (
          <button key={k} aria-pressed={status === k} onClick={() => setParams({ status: k })}>{l}</button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {status === 'pending' && waiting.length ? <p className="muted" style={{ margin: 0 }}>{waiting.length} waiting, {money(total)} in all.</p> : null}
      {data && !data.withdrawals.length ? <Empty>No withdrawals here.</Empty> : null}
      {data?.withdrawals.map((w) => (
        <div key={w._id} className="card stack" style={{ gap: 8 }}>
          <div className="spread">
            <strong>{money(w.amount)} to {CHANNEL[w.channel]} {w.payNumber}</strong>
            <Badge tone={w.status === 'paid' ? 'good' : w.status === 'pending' ? 'warn' : 'neutral'}>{STATUS[w.status]}</Badge>
          </div>
          <div className="faint">
            {w.user ? `${w.user.name}, account phone ${w.user.phone}` : 'Deleted account'}. Asked {when(w.createdAt)}.
            {w.payoutReference ? ` Sent ${when(w.processedAt)}, reference ${w.payoutReference}.` : ''}
            {w.note ? ` ${w.note}` : ''}
          </div>
          {w.user && w.user.phone !== w.payNumber && w.status === 'pending' ? (
            <p className="faint" style={{ margin: 0 }}>The payout number is not the account's phone. Check the name EcoCash shows before sending.</p>
          ) : null}
          {w.status === 'pending' ? (
            <div className="row" style={{ gap: 6 }}>
              <button className="btn primary" onClick={() => setActing({ w, paid: true })}>I have sent it</button>
              <button className="btn" onClick={() => setActing({ w, paid: false })}>Reject</button>
            </div>
          ) : null}
        </div>
      ))}

      <ActionDialog
        open={acting !== null}
        title={acting?.paid ? `Record the ${money(acting.w.amount)} payout` : 'Reject this withdrawal'}
        confirmLabel={acting?.paid ? 'Mark as sent' : 'Reject and return to wallet'}
        tone={acting?.paid ? 'primary' : 'danger'}
        canConfirm={text.trim().length >= (acting?.paid ? 4 : 5)}
        onConfirm={() => api.post(`/admin/withdrawals/${acting!.w._id}/${acting!.paid ? 'paid' : 'reject'}`, acting!.paid ? { payoutReference: text.trim() } : { note: text.trim() }).then(reload)}
        onClose={() => setActing(null)}
      >
        {acting?.paid ? (
          <Field label={`${CHANNEL[acting.w.channel]} transaction id`}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="MP260929.1234.A00001" />
          </Field>
        ) : (
          <label className="field">
            <span>Tell the user why (the amount goes back to their wallet)</span>
            <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="The number is not registered for EcoCash." />
          </label>
        )}
      </ActionDialog>
    </div>
  );
}
