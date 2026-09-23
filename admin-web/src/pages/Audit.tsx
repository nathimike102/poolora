import { Link, useSearchParams } from 'react-router';
import { qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { when } from '../lib/format';
import { Empty, ErrorBox, Loading, PageHead, Pager } from '../components/ui';

interface Entry {
  _id: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  createdAt: string;
  actor?: { _id: string; name: string; email?: string };
}

const ACTIONS: Record<string, string> = {
  'user.suspend': 'Suspended an account',
  'user.reinstate': 'Lifted a suspension',
  'user.block.request': 'Asked to block an account',
  'user.block.approve': 'Approved a block',
  'user.block.reject': 'Rejected a block',
  'user.unblock': 'Unblocked an account',
  'user.note': 'Added a note',
  'kyc.approve': 'Approved a driver',
  'kyc.reject': 'Rejected a driver',
  'kyc.request_changes': 'Asked a driver for new documents',
  'dispute.assign': 'Took a dispute',
  'dispute.resolve': 'Decided a dispute',
  'sos.acknowledge': 'Took an SOS',
  'sos.note': 'Logged an SOS action',
  'sos.police': 'Recorded a police call',
  'sos.resolve': 'Resolved an SOS',
  'sos.false_alarm': 'Closed an SOS as a false alarm',
  'settings.update': 'Changed settings',
};

function target(e: Entry) {
  if (!e.targetId) return '—';
  const to = e.targetType === 'user' || e.targetType === 'kyc' ? `/users/${e.targetId}` : e.targetType === 'dispute' ? `/disputes/${e.targetId}` : e.targetType === 'sos' ? `/sos/${e.targetId}` : '/settings';
  return <Link to={to}>{e.targetType === 'settings' ? 'Settings' : 'Open'}</Link>;
}

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const action = params.get('action') ?? '';
  const page = Number(params.get('page') ?? 1);
  const { data, error, loading, reload } = useApi<{ entries: Entry[]; total: number; limit: number }>(`/admin/audit${qs({ action, page, limit: 50 })}`);

  return (
    <div className="stack">
      <PageHead
        title="Audit log"
        sub="Every admin action, newest first. Entries cannot be edited or deleted."
        actions={
          <select className="input" value={action} onChange={(e) => setParams(e.target.value ? { action: e.target.value } : {})} aria-label="Filter">
            <option value="">All actions</option>
            <option value="user">Accounts</option>
            <option value="kyc">Driver applications</option>
            <option value="dispute">Disputes</option>
            <option value="sos">SOS</option>
            <option value="settings">Settings</option>
          </select>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {data.entries.length === 0 ? <Empty>Nothing logged yet.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Reason</th><th>Subject</th></tr></thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e._id}>
                      <td>{when(e.createdAt)}</td>
                      <td>{e.actor?.name ?? e.actor?.email ?? '—'}</td>
                      <td>{ACTIONS[e.action] ?? e.action}</td>
                      <td style={{ maxWidth: 420 }}>{e.reason ?? ''}</td>
                      <td>{target(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={data.limit} total={data.total} onPage={(p) => setParams({ ...(action ? { action } : {}), page: String(p) })} />
        </div>
      ) : null}
    </div>
  );
}
