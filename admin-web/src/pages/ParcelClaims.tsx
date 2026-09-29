import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { money, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead } from '../components/ui';
import { ActionDialog } from '../components/Dialog';

interface Photo { id: string; stage: 'pickup' | 'delivery' | 'claim'; takenAt: string; path: string; location?: { lat: number; lng: number } }
interface Claim {
  _id: string;
  kind: 'damaged' | 'lost';
  description: string;
  amountClaimed: number;
  coverLimit: number;
  insured: boolean;
  status: 'submitted' | 'with_insurer' | 'approved' | 'rejected';
  insurerReference?: string;
  payout?: number;
  decisionNote?: string;
  decidedBy?: { name: string };
  decidedAt?: string;
  createdAt: string;
  claimant: { _id: string; name: string; phone: string };
  parcel: {
    _id: string;
    trackingNumber: string;
    parcelType: string;
    estimatedCost: number;
    insuranceValue?: number;
    actualPickupTime?: string;
    actualDeliveryTime?: string;
    estimatedDeliveryTime: string;
    pickupLocation?: { address: string };
    deliveryLocation?: { address: string };
  };
  evidence: Photo[];
}

const STAGE: Record<Photo['stage'], string> = { pickup: 'At pickup', delivery: 'At delivery', claim: 'From the claimant' };

/** A photo fetched with the admin's token */
function PrivateImage({ path, alt }: { path: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    api.objectUrl(`/admin${path}`).then((u) => { url = u; setSrc(u); }).catch(() => setFailed(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [path]);
  if (failed) return <div className="faint">Could not load the photo.</div>;
  if (!src) return <div className="faint">Loading photo…</div>;
  return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt} style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} /></a>;
}

/** Damaged and lost parcel claims (UC-P05), with the photo evidence (UC-P03) */
export function ParcelClaimsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const { data, error, loading, reload } = useApi<{ claims: Claim[]; insurerConnected: boolean }>(`/admin/parcel-claims?status=${status}`);
  const [deciding, setDeciding] = useState<{ claim: Claim; approve: boolean } | null>(null);
  const [payout, setPayout] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (deciding) {
      setPayout(String(deciding.claim.amountClaimed));
      setNote('');
      setReference(deciding.claim.insurerReference ?? '');
    }
  }, [deciding]);

  return (
    <div className="stack">
      <PageHead
        title="Parcel claims"
        sub={data?.insurerConnected ? 'Claims are also sent to the insurer; record its outcome here.' : 'No insurer is connected, so admins decide claims. Approved claims are paid into the claimant\'s wallet.'}
      />
      <div className="seg" role="group" aria-label="Status">
        {[['open', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => (
          <button key={k} aria-pressed={status === k} onClick={() => setParams({ status: k })}>{l}</button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.claims.length ? <Empty>No claims here.</Empty> : null}
      {data?.claims.map((cl) => (
        <div key={cl._id} className="card stack" style={{ gap: 10 }}>
          <div className="spread">
            <strong>{cl.kind === 'damaged' ? 'Damaged' : 'Lost'} parcel {cl.parcel.trackingNumber}: {money(cl.amountClaimed)} claimed</strong>
            <Badge tone={cl.status === 'approved' ? 'good' : cl.status === 'rejected' ? 'neutral' : 'warn'}>
              {cl.status === 'with_insurer' ? `With insurer${cl.insurerReference ? ` (${cl.insurerReference})` : ''}` : cl.status === 'submitted' ? 'Waiting' : cl.status === 'approved' ? `Paid ${money(cl.payout)}` : 'Rejected'}
            </Badge>
          </div>
          <div className="faint">
            By {cl.claimant.name} ({cl.claimant.phone}) {when(cl.createdAt)}. {cl.insured ? `Insured for ${money(cl.parcel.insuranceValue)}` : `Not insured; covered up to the charge, ${money(cl.parcel.estimatedCost)}`}.
            {' '}{cl.parcel.pickupLocation?.address} → {cl.parcel.deliveryLocation?.address}.
            {' '}Picked up {cl.parcel.actualPickupTime ? when(cl.parcel.actualPickupTime) : 'never'}; {cl.parcel.actualDeliveryTime ? `delivered ${when(cl.parcel.actualDeliveryTime)}` : `due ${when(cl.parcel.estimatedDeliveryTime)}, not delivered`}.
          </div>
          <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '3px solid var(--border)' }}>{cl.description}</blockquote>
          {cl.evidence.length ? (
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {cl.evidence.map((p) => (
                <figure key={p.id} style={{ margin: 0 }}>
                  <PrivateImage path={p.path} alt={`${STAGE[p.stage]} photo`} />
                  <figcaption className="faint">{STAGE[p.stage]}, {when(p.takenAt)}</figcaption>
                </figure>
              ))}
            </div>
          ) : <p className="faint" style={{ margin: 0 }}>No photos on this parcel.</p>}
          {cl.status === 'submitted' || cl.status === 'with_insurer' ? (
            <div className="row" style={{ gap: 6 }}>
              <button className="btn primary" onClick={() => setDeciding({ claim: cl, approve: true })}>Approve and pay</button>
              <button className="btn" onClick={() => setDeciding({ claim: cl, approve: false })}>Reject</button>
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>{cl.decidedBy?.name ?? 'An admin'} {when(cl.decidedAt)}: {cl.decisionNote}</p>}
        </div>
      ))}

      <ActionDialog
        open={deciding !== null}
        title={deciding?.approve ? 'Approve this claim' : 'Reject this claim'}
        confirmLabel={deciding?.approve ? `Pay ${money(Number(payout) || 0)}` : 'Reject'}
        tone={deciding?.approve ? 'primary' : 'danger'}
        canConfirm={note.trim().length >= 5 && (!deciding?.approve || (Number(payout) > 0 && Number(payout) <= (deciding?.claim.coverLimit ?? 0)))}
        onConfirm={() => api.post(`/admin/parcel-claims/${deciding!.claim._id}/decide`, { decision: deciding!.approve ? 'approve' : 'reject', payout: Number(payout), note, insurerReference: reference || undefined }).then(reload)}
        onClose={() => setDeciding(null)}
      >
        {deciding?.approve ? (
          <Field label={`Pay into the claimant's wallet (up to ${money(deciding.claim.coverLimit)})`}>
            <input className="input" type="number" min={1} max={deciding.claim.coverLimit} value={payout} onChange={(e) => setPayout(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Insurer's claim reference (optional)">
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <label className="field">
          <span>Note to the claimant</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} required />
        </label>
      </ActionDialog>
    </div>
  );
}
