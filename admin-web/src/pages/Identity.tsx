import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { ago, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead, type Tone } from '../components/ui';
import { ActionDialog, ReasonDialog } from '../components/Dialog';

type Gender = 'female' | 'male' | 'other';
interface Check {
  _id: string;
  name: string;
  phone: string;
  status: 'pending' | 'verified' | 'rejected';
  gender: Gender | null;
  declaredGender: Gender | null;
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
}
interface CheckDetail extends Check {
  profilePhotoUrl: string | null;
  memberSince: string;
  links: { document: string | null; selfie: string | null };
  photosDeleted: boolean;
}

const GENDER_LABEL: Record<Gender, string> = { female: 'Woman', male: 'Man', other: 'Another gender' };
const STATUS_TONE: Record<string, Tone> = { pending: 'warn', verified: 'good', rejected: 'danger' };

/**
 * Identity checks behind women-only rides: compare the selfie with the ID,
 * and confirm the gender. Only a verified woman can post or book a
 * women-only ride, so this check is what keeps those rides safe.
 */
export function IdentityListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const { data, error, loading, reload } = useApi<{ checks: Check[] }>(`/admin/identity${qs({ status })}`, 60_000);
  const navigate = useNavigate();
  return (
    <div className="stack">
      <PageHead
        title="Identity checks"
        sub="For women-only rides. Oldest first."
        actions={
          <div className="seg" role="group" aria-label="Show">
            {[['pending', 'Waiting'], ['verified', 'Verified'], ['rejected', 'Not approved']].map(([v, l]) => (
              <button key={v} aria-pressed={status === v} onClick={() => setParams({ status: v })}>{l}</button>
            ))}
          </div>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="card">
          {data.checks.length === 0 ? <Empty>{status === 'pending' ? 'Nothing waiting.' : 'None here.'}</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Sent</th><th>Person</th><th>Says they are</th><th>Status</th></tr></thead>
                <tbody>
                  {data.checks.map((c) => (
                    <tr key={c._id} className="link" onClick={() => navigate(`/identity/${c._id}`)}>
                      <td><Link to={`/identity/${c._id}`}>{when(c.submittedAt)}</Link><div className="faint">{ago(c.submittedAt)}</div></td>
                      <td>{c.name}<div className="faint">{c.phone}</div></td>
                      <td>{c.declaredGender ? GENDER_LABEL[c.declaredGender] : '—'}</td>
                      <td><Badge tone={STATUS_TONE[c.status]}>{c.status === 'pending' ? 'Waiting' : c.status === 'verified' ? 'Verified' : 'Not approved'}</Badge></td>
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

export function IdentityDetailPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi<CheckDetail>(`/admin/identity/${id}`);
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [gender, setGender] = useState<Gender | ''>('');
  const [matches, setMatches] = useState(false);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;

  const openApprove = () => {
    setGender(data.declaredGender ?? '');
    setMatches(false);
    setDialog('approve');
  };

  return (
    <div className="stack">
      <PageHead
        back={{ to: '/identity', label: 'Identity checks' }}
        title={data.name}
        sub={<span className="row"><Badge tone={STATUS_TONE[data.status]}>{data.status === 'pending' ? 'Waiting' : data.status === 'verified' ? 'Verified' : 'Not approved'}</Badge> Sent {when(data.submittedAt)} · {data.phone} · member since {when(data.memberSince)}</span>}
        actions={data.status === 'pending' ? (
          <>
            <button className="btn primary" onClick={openApprove}>Approve</button>
            <button className="btn" onClick={() => setDialog('reject')}>Not approved</button>
          </>
        ) : null}
      />
      <p className="muted">
        Says they are: <strong>{data.declaredGender ? GENDER_LABEL[data.declaredGender] : '—'}</strong>.
        The ID proves who they are: check the selfie is the person on it, and the ID looks genuine and readable. It does not decide gender: confirm the gender they live as, from what they told us and the selfie. The photos are deleted as soon as you decide. The links work for 5 minutes; reload for new ones.
      </p>
      {data.rejectionReason ? <div className="banner"><div><strong>Not approved</strong>{data.rejectionReason}</div></div> : null}
      <div className="grid cols-2">
        {([['ID document', data.links.document], ['Selfie', data.links.selfie]] as const).map(([label, url]) => (
          <div key={label} className="card">
            <h2>{label}</h2>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`${label} of ${data.name}`} style={{ width: '100%', borderRadius: 8 }} /></a>
            ) : <p className="faint">{data.photosDeleted ? 'Deleted after the decision; only the decision is kept.' : 'Could not load this file. Uploads may not be set up (AWS keys).'}</p>}
          </div>
        ))}
      </div>

      <ActionDialog
        open={dialog === 'approve'}
        title={`Approve ${data.name}`}
        confirmLabel="Approve"
        canConfirm={matches && Boolean(gender)}
        onConfirm={() => api.post(`/admin/identity/${id}/approve`, { gender }).then(reload)}
        onClose={() => setDialog(null)}
      >
        <label className="check">
          <input type="checkbox" checked={matches} onChange={(e) => setMatches(e.target.checked)} />
          The selfie is the person on the ID, and the ID looks genuine
        </label>
        <Field label="Gender they live as">
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="">Choose</option>
            <option value="female">Woman</option>
            <option value="male">Man</option>
            <option value="other">Another gender</option>
          </select>
        </Field>
        <p className="faint">Only a verified woman can post or book women-only rides. The sex printed on an ID does not decide this: a trans woman is a woman here. If the selfie does not fit what they told us, or anything looks wrong, mark it not approved and say why.</p>
      </ActionDialog>

      <ReasonDialog
        open={dialog === 'reject'}
        title="Not approved"
        intro="Tell them what to fix. They see this and can send it again."
        placeholder="The selfie is too dark to compare with the ID photo."
        confirmLabel="Send"
        onConfirm={(reason) => api.post(`/admin/identity/${id}/reject`, { reason }).then(reload)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
