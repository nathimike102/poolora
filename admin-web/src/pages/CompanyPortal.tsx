import { useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import { api } from '../lib/api';
import { signOut, type AdminUser } from '../lib/auth';
import { useApi } from '../lib/useApi';
import { money, num, short, when } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, PageHead, StatTile } from '../components/ui';
import { ActionDialog } from '../components/Dialog';
import { Brand } from '../components/Brand';

interface Company {
  _id: string;
  name: string;
  status: 'active' | 'suspended';
  domains: string[];
  contributionPaused: boolean;
  policy: { sharePercent: number; monthlyCapUsd: number; weekdaysOnly: boolean; sites: Array<{ name: string; address: string; radiusKm: number }> };
}

interface Overview { month: string; members: number; newMembers: number; ridersThisMonth: number; trips: number; companyPaid: number; staffPaid: number; co2SavedKg: number }
interface Member { _id: string; name: string; email?: string; joinedAt?: string; tripsThisMonth: number; companyPaidThisMonth: number }
interface Bill { _id: string; month: string; number: string; trips: number; members: number; total: number; status: 'issued' | 'paid'; overdue: boolean; issuedAt: string; dueAt: string; paidAt?: string; adjustments: Array<{ amount: number; reason: string }> }

const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A company's own dashboard (UC-C01 step 3), for the company admins a
 * Siham admin named. Staff, trips, spend and bills; never where anyone went.
 */
export function CompanyPortal({ user, onSignedOut }: { user: AdminUser; onSignedOut: () => void }) {
  const { data } = useApi<{ company: Company }>('/company/me');
  const name = data?.company.name ?? user.company?.name ?? 'Your company';
  return (
    <BrowserRouter>
      <div className="shell">
        <aside className="sidebar">
          <Brand label={name} />
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Overview</NavLink>
            <NavLink to="/staff">Staff</NavLink>
            <NavLink to="/bills">Bills</NavLink>
          </nav>
          <div className="sidebar-foot">
            <span>Signed in as {user.name || user.email}</span>
            <button className="btn small" onClick={() => signOut().then(onSignedOut)}>Sign out</button>
          </div>
        </aside>
        <main className="main">
          <Routes>
            <Route index element={<OverviewPage company={data?.company} />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="bills" element={<BillsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function OverviewPage({ company }: { company?: Company }) {
  const { data, error, loading, reload } = useApi<Overview>('/company/overview');
  const p = company?.policy;
  return (
    <div className="stack">
      <PageHead title={company ? company.name : 'Overview'} sub={data ? `${monthName(data.month)} so far` : undefined} />
      {company?.contributionPaused ? (
        <div className="card"><Badge tone="danger">Contribution paused</Badge> A bill is more than 30 days unpaid, so new bookings are at full fare until it is settled; trips already booked keep the company's part. See Bills.</div>
      ) : null}
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="grid cols-4">
          <StatTile label="Staff on Siham" value={num(data.members)} note={`${num(data.newMembers)} joined this month`} />
          <StatTile label="Trips the company helped pay for" value={num(data.trips)} note={`${num(data.ridersThisMonth)} people rode`} />
          <StatTile label="Company paid" value={money(data.companyPaid)} note={`Staff paid ${money(data.staffPaid)}`} />
          <StatTile label="CO₂ saved" value={`${short(data.co2SavedKg)} kg`} note="An estimate, against driving alone" />
        </div>
      ) : null}
      {p ? (
        <section className="stack">
          <h2 className="section-label">What the company pays</h2>
          <div className="card stack" style={{ gap: 6 }}>
            <p style={{ margin: 0 }}>
              {p.sharePercent > 0 && p.sites.length
                ? `${p.sharePercent}% of ${p.weekdaysOnly ? 'weekday trips' : 'trips'} that start or end near ${p.sites.map((s) => s.name).join(', ')}${p.monthlyCapUsd > 0 ? `, up to ${money(p.monthlyCapUsd)} a person a month` : ''}.`
                : 'Nothing yet. Ask Siham to set your share and sites.'}
            </p>
            <p className="faint" style={{ margin: 0 }}>To change it, contact Siham. You see who rides, when and what it costs; never where anyone goes.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StaffPage() {
  const { data, error, loading, reload } = useApi<{ month: string; members: Member[] }>('/company/members');
  const [removing, setRemoving] = useState<Member | null>(null);
  return (
    <div className="stack">
      <PageHead title="Staff" sub="People who confirmed a work email. Remove anyone who has left, and their new bookings no longer get the company's contribution. Trips they already booked keep it and are on the bill." />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.members.length ? <Empty>Nobody has joined yet. Staff join from Profile, Work in the Siham app.</Empty> : null}
      {data?.members.length ? (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Work email</th><th>Joined</th><th>Trips in {monthName(data.month)}</th><th>Company paid</th><th /></tr></thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m._id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{when(m.joinedAt)}</td>
                  <td>{num(m.tripsThisMonth)}</td>
                  <td>{money(m.companyPaidThisMonth)}</td>
                  <td><button className="btn" onClick={() => setRemoving(m)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <ActionDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''}`}
        confirmLabel="Remove from the programme"
        tone="danger"
        canConfirm
        onConfirm={() => api.del(`/company/members/${removing!._id}`).then(reload)}
        onClose={() => setRemoving(null)}
      >
        <p style={{ margin: 0 }}>They keep their Siham account, but no longer see colleagues-only rides or get the company's contribution on new bookings. Trips they have already booked keep it, at the price they were given, and are billed when they complete.</p>
      </ActionDialog>
    </div>
  );
}

function BillsPage() {
  const { data, error, loading, reload } = useApi<{ invoices: Bill[] }>('/company/bills');
  return (
    <div className="stack">
      <PageHead title="Bills" sub="One a month, emailed to your billing contact on the 1st. Pay by bank transfer within 30 days, quoting the bill number." />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : null}
      {data && !data.invoices.length ? <Empty>No bills yet.</Empty> : null}
      {data?.invoices.map((b) => (
        <div key={b._id} className="card stack" style={{ gap: 6 }}>
          <div className="spread">
            <strong>{monthName(b.month)}: {money(b.total)}</strong>
            <Badge tone={b.status === 'paid' ? 'good' : b.overdue ? 'danger' : 'warn'}>{b.status === 'paid' ? 'Paid' : b.overdue ? 'Overdue' : 'Due'}</Badge>
          </div>
          <div className="faint">
            {b.number}. {b.trips} trip{b.trips === 1 ? '' : 's'} by {b.members} member{b.members === 1 ? '' : 's'} of staff. Due {when(b.dueAt)}.{b.paidAt ? ` Paid ${when(b.paidAt)}.` : ''}
          </div>
          {b.adjustments.map((a, i) => <div key={i} className="faint">Adjustment {a.amount < 0 ? '−' : '+'}{money(Math.abs(a.amount))}: {a.reason}</div>)}
          <div className="row" style={{ gap: 6 }}>
            <button className="btn" onClick={() => api.download(`/company/bills/${b._id}/file?format=pdf`, `${b.number}.pdf`)}>PDF</button>
            <button className="btn" onClick={() => api.download(`/company/bills/${b._id}/file?format=xlsx`, `${b.number}.xlsx`)}>Spreadsheet</button>
          </div>
        </div>
      ))}
      <Field label="Questions about a bill">
        <span className="faint">Reply to the bill's email, and Siham will get back to you.</span>
      </Field>
    </div>
  );
}
