import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead } from '../components/ui';
import { ActionDialog } from '../components/Dialog';

interface Company {
  _id: string;
  name: string;
  domains: string[];
  billingContact: { name: string; email: string; phone?: string };
  status: 'active' | 'suspended';
  notes?: string;
  createdAt: string;
  members?: number;
  policy: Policy;
  billingHold?: { invoice: string; since: string } | null;
}

interface Bill {
  _id: string;
  month: string;
  number: string;
  trips: number;
  members: number;
  amount: number;
  adjustments: Array<{ amount: number; reason: string; at: string }>;
  total: number;
  status: 'issued' | 'paid';
  overdue: boolean;
  issuedAt: string;
  dueAt: string;
  emailedAt?: string;
  emailError?: string;
  paidAt?: string;
  paidReference?: string;
}

const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The company's monthly bills (UC-C03): download, record payment, adjust before payment */
function Bills({ companyId, onChange }: { companyId: string; onChange: () => void }) {
  const { data, error, loading, reload } = useApi<{ invoices: Bill[] }>(`/admin/organisations/${companyId}/invoices`);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [adjusting, setAdjusting] = useState<Bill | null>(null);
  const [billing, setBilling] = useState(false);
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  useEffect(() => { setText(''); setAmount(''); }, [paying, adjusting]);
  const refresh = () => { reload(); onChange(); };

  return (
    <section className="stack">
      <div className="spread">
        <h2 className="section-label">Bills</h2>
        <button className="btn" onClick={() => setBilling(true)}>Bill last month now</button>
      </div>
      <p className="faint" style={{ margin: 0 }}>Bills go out by email on the 1st for the company's share of completed trips, payable by bank transfer within 30 days. A bill more than 30 days unpaid pauses the company's contribution until it is paid.</p>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.invoices.length ? <Empty>No bills yet.</Empty> : null}
      {data?.invoices.map((b) => (
        <div key={b._id} className="card stack" style={{ gap: 6 }}>
          <div className="spread">
            <strong>{monthName(b.month)}: {money(b.total)}</strong>
            <Badge tone={b.status === 'paid' ? 'good' : b.overdue ? 'danger' : 'warn'}>{b.status === 'paid' ? 'Paid' : b.overdue ? 'Overdue' : 'Waiting for payment'}</Badge>
          </div>
          <div className="faint">
            {b.number}. {b.trips} trip{b.trips === 1 ? '' : 's'} by {b.members} member{b.members === 1 ? '' : 's'}. Issued {when(b.issuedAt)}, due {when(b.dueAt)}.
            {b.emailedAt ? ` Emailed ${when(b.emailedAt)}.` : b.emailError ? ` Not emailed yet: ${b.emailError}.` : ' Not emailed yet.'}
            {b.paidAt ? ` Paid ${when(b.paidAt)}, reference ${b.paidReference}.` : ''}
          </div>
          {b.adjustments.map((a, i) => <div key={i} className="faint">Adjustment {a.amount < 0 ? '−' : '+'}{money(Math.abs(a.amount))}: {a.reason}</div>)}
          <div className="row" style={{ gap: 6 }}>
            <button className="btn" onClick={() => api.download(`/admin/invoices/${b._id}/file?format=pdf`, `${b.number}.pdf`)}>PDF</button>
            <button className="btn" onClick={() => api.download(`/admin/invoices/${b._id}/file?format=xlsx`, `${b.number}.xlsx`)}>Spreadsheet</button>
            {b.status === 'issued' ? (
              <>
                <button className="btn primary" onClick={() => setPaying(b)}>Record payment</button>
                <button className="btn" onClick={() => setAdjusting(b)}>Adjust</button>
              </>
            ) : null}
          </div>
        </div>
      ))}

      <ActionDialog
        open={billing}
        title="Bill last month now"
        confirmLabel="Issue and email the bill"
        tone="primary"
        canConfirm
        onConfirm={() => api.post(`/admin/organisations/${companyId}/invoices`).then(refresh)}
        onClose={() => setBilling(false)}
      >
        <p style={{ margin: 0 }}>Issues last month's bill for trips not billed yet and emails it to the billing contact, instead of waiting for the 1st. Nothing is billed twice.</p>
      </ActionDialog>

      <ActionDialog
        open={paying !== null}
        title={`Record payment of ${paying ? money(paying.total) : ''}`}
        confirmLabel="Mark as paid"
        tone="primary"
        canConfirm={text.trim().length >= 3}
        onConfirm={() => api.post(`/admin/invoices/${paying!._id}/paid`, { reference: text.trim() }).then(refresh)}
        onClose={() => setPaying(null)}
      >
        <Field label="Bank transfer reference">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="CBZ-TRF-0001" />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={adjusting !== null}
        title={`Adjust ${adjusting?.number ?? ''}`}
        confirmLabel="Save adjustment"
        tone="primary"
        canConfirm={Number(amount) !== 0 && Number.isFinite(Number(amount)) && text.trim().length >= 5}
        onConfirm={() => api.post(`/admin/invoices/${adjusting!._id}/adjust`, { amount: Number(amount), reason: text.trim() }).then(refresh)}
        onClose={() => setAdjusting(null)}
      >
        <Field label="Amount in US$ (negative to take off, e.g. -5)">
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Why (shown on the bill)">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Refund after a dispute on a trip" />
        </Field>
      </ActionDialog>
    </section>
  );
}

interface Site { name: string; address: string; radiusKm: number; lat?: number; lng?: number }
interface Policy { sharePercent: number; monthlyCapUsd: number; weekdaysOnly: boolean; sites: Site[] }

const money = (n: number) => `US$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** What the company pays, in a sentence */
function policyLine(p: Policy): string {
  if (!(p.sharePercent > 0) || !p.sites.length) return 'Pays nothing yet: set a share and at least one site.';
  const when = p.weekdaysOnly ? 'weekday trips' : 'trips';
  const cap = p.monthlyCapUsd > 0 ? `, up to ${money(p.monthlyCapUsd)} a person a month` : ', with no monthly limit';
  return `Pays ${p.sharePercent}% of ${when} to or from ${p.sites.map((s) => s.name).join(', ')}${cap}.`;
}

/** Edits the company's contribution (UC-C01). New sites are found on the map from their address. */
function PolicyFields({ policy, set }: { policy: Policy; set: (p: Policy) => void }) {
  const site = (i: number, patch: Partial<Site>) =>
    set({ ...policy, sites: policy.sites.map((s, j) => (j === i ? { ...s, ...patch, ...(patch.address !== undefined ? { lat: undefined, lng: undefined } : {}) } : s)) });
  return (
    <>
      <Field label="Share of each eligible fare the company pays (%)">
        <input className="input" type="number" min={0} max={100} value={policy.sharePercent} onChange={(e) => set({ ...policy, sharePercent: Number(e.target.value) })} />
      </Field>
      <Field label="Most it pays for one person in a month (US$, 0 for no limit)">
        <input className="input" type="number" min={0} value={policy.monthlyCapUsd} onChange={(e) => set({ ...policy, monthlyCapUsd: Number(e.target.value) })} />
      </Field>
      <label className="row">
        <input type="checkbox" checked={policy.weekdaysOnly} onChange={(e) => set({ ...policy, weekdaysOnly: e.target.checked })} />
        <span>Weekdays only (not weekends or public holidays)</span>
      </label>
      <p className="faint" style={{ margin: 0 }}>Sites: a trip that starts or ends within a site's radius is eligible.</p>
      {policy.sites.map((s, i) => (
        <div key={i} className="card stack" style={{ gap: 6 }}>
          <Field label="Site name"><input className="input" value={s.name} onChange={(e) => site(i, { name: e.target.value })} placeholder="Head office" /></Field>
          <Field label="Address"><input className="input" value={s.address} onChange={(e) => site(i, { address: e.target.value })} placeholder="Street, area, city" /></Field>
          <Field label="Radius (km)"><input className="input" type="number" min={0.2} max={20} step={0.1} value={s.radiusKm} onChange={(e) => site(i, { radiusKm: Number(e.target.value) })} /></Field>
          <button className="btn" onClick={() => set({ ...policy, sites: policy.sites.filter((_, j) => j !== i) })}>Remove site</button>
        </div>
      ))}
      {policy.sites.length < 10 ? (
        <button className="btn" onClick={() => set({ ...policy, sites: [...policy.sites, { name: '', address: '', radiusKm: 1 }] })}>Add a site</button>
      ) : null}
    </>
  );
}

interface Member {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  joinedAt?: string;
  driver: boolean;
}

type Form = { name: string; domains: string; contactName: string; contactEmail: string; contactPhone: string; notes: string };

const EMPTY: Form = { name: '', domains: '', contactName: '', contactEmail: '', contactPhone: '', notes: '' };

const toBody = (f: Form) => ({
  name: f.name.trim(),
  domains: f.domains.split(/[\s,]+/).filter(Boolean),
  billingContact: { name: f.contactName.trim(), email: f.contactEmail.trim(), phone: f.contactPhone.trim() || undefined },
  notes: f.notes.trim(),
});

const fromCompany = (c: Company): Form => ({
  name: c.name,
  domains: c.domains.join(', '),
  contactName: c.billingContact.name,
  contactEmail: c.billingContact.email,
  contactPhone: c.billingContact.phone ?? '',
  notes: c.notes ?? '',
});

function CompanyFields({ form, set }: { form: Form; set: (f: Form) => void }) {
  const field = (key: keyof Form) => ({ value: form[key], onChange: (e: { target: { value: string } }) => set({ ...form, [key]: e.target.value }) });
  return (
    <>
      <Field label="Company name"><input className="input" {...field('name')} placeholder="Econet Wireless" /></Field>
      <Field label="Email domains staff use (comma separated)"><input className="input" {...field('domains')} placeholder="econet.co.zw" /></Field>
      <p className="faint" style={{ margin: 0 }}>Anyone who confirms an address on these domains joins. Never a public service such as gmail.com.</p>
      <Field label="Billing contact"><input className="input" {...field('contactName')} placeholder="Accounts payable" /></Field>
      <Field label="Billing email"><input className="input" type="email" {...field('contactEmail')} placeholder="accounts@econet.co.zw" /></Field>
      <Field label="Billing phone (optional)"><input className="input" {...field('contactPhone')} /></Field>
      <label className="field">
        <span>Contract notes (admins only)</span>
        <textarea className="input" {...field('notes')} />
      </label>
    </>
  );
}

/** Companies whose staff pool rides to work (UC-C01). */
export function CompaniesPage() {
  const { data, error, loading, reload } = useApi<{ organisations: Company[] }>('/admin/organisations');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => { if (creating) setForm(EMPTY); }, [creating]);

  return (
    <div className="stack">
      <PageHead
        title="Companies"
        sub="Company programmes: staff join by confirming a work email on the company's domains, and can then ride with colleagues."
        actions={<button className="btn primary" onClick={() => setCreating(true)}>New company</button>}
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.organisations.length ? <Empty>No companies yet.</Empty> : null}
      {data?.organisations.length ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Company</th><th>Domains</th><th>Members</th><th>Status</th><th>Since</th></tr>
            </thead>
            <tbody>
              {data.organisations.map((c) => (
                <tr key={c._id}>
                  <td><Link to={`/companies/${c._id}`}>{c.name}</Link></td>
                  <td>{c.domains.join(', ')}</td>
                  <td>{c.members ?? 0}</td>
                  <td><Badge tone={c.status === 'active' ? 'good' : 'warn'}>{c.status === 'active' ? 'Active' : 'Suspended'}</Badge></td>
                  <td>{when(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ActionDialog
        open={creating}
        title="New company"
        confirmLabel="Create"
        tone="primary"
        canConfirm={form.name.trim().length >= 2 && form.domains.trim().length > 3 && form.contactName.trim().length >= 2 && form.contactEmail.includes('@')}
        onConfirm={() => api.post('/admin/organisations', toBody(form)).then(reload)}
        onClose={() => setCreating(false)}
      >
        <CompanyFields form={form} set={setForm} />
      </ActionDialog>
    </div>
  );
}

/** One company: its details, and the staff who have joined. */
export function CompanyDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<{ organisation: Company; members: Member[]; admins: Array<{ user: string; email: string; addedAt: string }> }>(`/admin/organisations/${id}`);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [removingAdmin, setRemovingAdmin] = useState<{ user: string; email: string } | null>(null);
  useEffect(() => { if (addingAdmin) { setAdminName(''); setAdminEmail(''); } }, [addingAdmin]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [suspending, setSuspending] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => { if (editing && data) setForm(fromCompany(data.organisation)); }, [editing, data]);
  useEffect(() => setReason(''), [removing]);

  const c = data?.organisation;
  return (
    <div className="stack">
      <PageHead
        title={c?.name ?? 'Company'}
        back={{ to: '/companies', label: 'Companies' }}
        actions={c ? (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn" onClick={() => setSuspending(true)}>{c.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
          </div>
        ) : null}
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {c ? (
        <div className="card stack" style={{ gap: 6 }}>
          <div className="spread">
            <strong>{c.domains.join(', ')}</strong>
            <Badge tone={c.status === 'active' ? 'good' : 'warn'}>{c.status === 'active' ? 'Active' : 'Suspended'}</Badge>
          </div>
          <div className="faint">
            Billing: {c.billingContact.name}, {c.billingContact.email}{c.billingContact.phone ? `, ${c.billingContact.phone}` : ''}. Set up {when(c.createdAt)}.
          </div>
          {c.status === 'suspended' ? <p className="faint" style={{ margin: 0 }}>Suspended: nobody new can join, and members get none of the programme's benefits.</p> : null}
          {c.billingHold ? <p style={{ margin: 0 }}><Badge tone="danger">Contribution paused</Badge> A bill is more than 30 days unpaid (since {when(c.billingHold.since)}). Staff pay full fares until it is paid.</p> : null}
          {c.notes ? <p style={{ margin: 0 }}>{c.notes}</p> : null}
        </div>
      ) : null}

      {c ? (
        <section className="stack">
          <div className="spread">
            <h2 className="section-label">Contribution</h2>
            <button className="btn" onClick={() => setPolicy(c.policy)}>Change</button>
          </div>
          <div className="card stack" style={{ gap: 6 }}>
            <p style={{ margin: 0 }}>{policyLine(c.policy)}</p>
            <p className="faint" style={{ margin: 0 }}>Staff pay the rest. The company is billed only for completed trips. Changes apply to bookings made from now on.</p>
            {c.policy.sites.length ? <div className="faint">{c.policy.sites.map((s) => `${s.name}: ${s.address}, within ${s.radiusKm} km`).join(' · ')}</div> : null}
          </div>
        </section>
      ) : null}

      {c ? <Bills companyId={c._id} onChange={reload} /> : null}

      {data ? (
        <section className="stack">
          <div className="spread">
            <h2 className="section-label">Company admins ({data.admins.length})</h2>
            <button className="btn" onClick={() => setAddingAdmin(true)}>Add a company admin</button>
          </div>
          <p className="faint" style={{ margin: 0 }}>People at the company who see its own dashboard: staff, trips, spend and bills. Never where anyone goes.</p>
          {data.admins.length ? (
            <div className="card table-wrap">
              <table>
                <thead><tr><th>Email</th><th>Added</th><th /></tr></thead>
                <tbody>
                  {data.admins.map((a) => (
                    <tr key={a.user}>
                      <td>{a.email}</td>
                      <td>{when(a.addedAt)}</td>
                      <td><button className="btn" onClick={() => setRemovingAdmin(a)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <ActionDialog
        open={addingAdmin}
        title="Add a company admin"
        confirmLabel="Add and email them"
        tone="primary"
        canConfirm={adminEmail.includes('@') && adminName.trim().length >= 2}
        onConfirm={() => api.post(`/admin/organisations/${id}/admins`, { name: adminName.trim(), email: adminEmail.trim() }).then(reload)}
        onClose={() => setAddingAdmin(false)}
      >
        <Field label="Name"><input className="input" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Chipo Ndlovu" /></Field>
        <Field label="Work email (on the company's domains, or the billing contact)"><input className="input" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></Field>
        <p className="faint" style={{ margin: 0 }}>They get an email with a link to set a password, then sign in here and see only their company.</p>
      </ActionDialog>

      <ActionDialog
        open={removingAdmin !== null}
        title={`Remove ${removingAdmin?.email ?? ''}`}
        confirmLabel="Remove"
        tone="danger"
        canConfirm
        onConfirm={() => api.del(`/admin/organisations/${id}/admins/${removingAdmin!.user}`).then(reload)}
        onClose={() => setRemovingAdmin(null)}
      >
        <p style={{ margin: 0 }}>They can no longer see the company's dashboard.</p>
      </ActionDialog>

      {data ? (
        <section className="stack">
          <h2 className="section-label">Members ({data.members.length})</h2>
          {!data.members.length ? <Empty>Nobody has joined yet. Staff join from Profile, Work in the app.</Empty> : (
            <div className="card table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Work email</th><th>Phone</th><th>Joined</th><th /></tr></thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m._id}>
                      <td><Link to={`/users/${m._id}`}>{m.name}</Link>{m.driver ? <> <Badge tone="info">Driver</Badge></> : null}</td>
                      <td>{m.email}</td>
                      <td>{m.phone}</td>
                      <td>{when(m.joinedAt)}</td>
                      <td><button className="btn" onClick={() => setRemoving(m)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <ActionDialog
        open={editing}
        title={`Edit ${c?.name ?? 'company'}`}
        confirmLabel="Save"
        tone="primary"
        canConfirm={form.name.trim().length >= 2 && form.domains.trim().length > 3 && form.contactEmail.includes('@')}
        onConfirm={() => api.patch(`/admin/organisations/${id}`, toBody(form)).then(reload)}
        onClose={() => setEditing(false)}
      >
        <CompanyFields form={form} set={setForm} />
        <p className="faint" style={{ margin: 0 }}>Removing a domain stops new people joining with it; members who joined with it stay.</p>
      </ActionDialog>

      <ActionDialog
        open={policy !== null}
        title={`What ${c?.name ?? 'the company'} pays`}
        confirmLabel="Save"
        tone="primary"
        canConfirm={Boolean(policy) && policy!.sharePercent >= 0 && policy!.sharePercent <= 100 && policy!.monthlyCapUsd >= 0 && policy!.sites.every((s) => s.name.trim().length >= 2 && s.address.trim().length >= 3)}
        onConfirm={() => api.patch(`/admin/organisations/${id}`, { policy }).then(reload)}
        onClose={() => setPolicy(null)}
      >
        {policy ? <PolicyFields policy={policy} set={setPolicy} /> : null}
      </ActionDialog>

      <ActionDialog
        open={suspending}
        title={c?.status === 'active' ? `Suspend ${c?.name}` : `Reactivate ${c?.name}`}
        confirmLabel={c?.status === 'active' ? 'Suspend' : 'Reactivate'}
        tone={c?.status === 'active' ? 'danger' : 'primary'}
        canConfirm
        onConfirm={() => api.patch(`/admin/organisations/${id}`, { status: c?.status === 'active' ? 'suspended' : 'active' }).then(reload)}
        onClose={() => setSuspending(false)}
      >
        <p style={{ margin: 0 }}>
          {c?.status === 'active'
            ? 'Members stay, but nobody new can join and they get none of the programme\'s benefits until it is reactivated.'
            : 'Members get the programme\'s benefits again, and staff can join.'}
        </p>
      </ActionDialog>

      <ActionDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''}`}
        confirmLabel="Remove from company"
        tone="danger"
        canConfirm={reason.trim().length >= 3}
        onConfirm={() => api.del(`/admin/organisations/${id}/members/${removing!._id}?reason=${encodeURIComponent(reason.trim())}`).then(reload)}
        onClose={() => setRemoving(null)}
      >
        <Field label="Why (for the audit log)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Left the company" />
        </Field>
      </ActionDialog>
    </div>
  );
}
