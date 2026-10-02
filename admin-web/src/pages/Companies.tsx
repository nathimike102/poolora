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
  const { data, error, loading, reload } = useApi<{ organisation: Company; members: Member[] }>(`/admin/organisations/${id}`);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [suspending, setSuspending] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
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
          {c.notes ? <p style={{ margin: 0 }}>{c.notes}</p> : null}
        </div>
      ) : null}

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
