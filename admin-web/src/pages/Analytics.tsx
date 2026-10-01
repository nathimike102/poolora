import { useApi } from '../lib/useApi';
import { num, pct, short, when } from '../lib/format';
import { ErrorBox, Loading, PageHead, StatTile } from '../components/ui';
import { LineChart } from '../components/LineChart';

interface Daily { day: string; count: number }
interface Kpis {
  generatedAt: string;
  users: { total: number; signups: { today: number; week: number; month: number; daily: Daily[] } };
  active: { dau: number; wau: number; mau: number; stickiness: number | null; daily: Daily[] };
  activation: { cohort: number; activated: number; rate: number | null };
  retention: Array<{ day: number; cohort: number; retained: number; rate: number | null }>;
  funnel: Array<{ step: string; label: string; users: number }>;
  errors: { live: { requests: number; errorRate: number }; top7d: Array<{ id: string; count: number }> | null };
  posthog: boolean;
}

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** The rider funnel as thin bars, each labelled at its tip with the share kept from the step before */
function Funnel({ steps }: { steps: Kpis['funnel'] }) {
  const top = Math.max(1, steps[0]?.users ?? 0);
  return (
    <div className="stack" style={{ gap: 10 }} role="list" aria-label="Rider funnel, people who signed up in the last 30 days">
      {steps.map((s, i) => {
        const kept = i > 0 && steps[i - 1].users ? s.users / steps[i - 1].users : null;
        const text = `${s.label}: ${num(s.users)}${kept === null ? '' : `, ${pct(kept)} of the step before`}`;
        return (
          <div key={s.step} role="listitem" title={text} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 30%) 1fr', alignItems: 'center', gap: 12 }}>
            <span className="muted">{s.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: `${(s.users / top) * 75}%`, minWidth: s.users ? 4 : 0, height: 20, background: 'var(--series-1)', borderRadius: '0 4px 4px 0' }} />
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong>{num(s.users)}</strong>
                {kept === null ? null : <span className="faint"> · {pct(kept)}</span>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsPage() {
  const { data, error, loading, reload } = useApi<Kpis>('/admin/analytics', 300_000);

  if (loading && !data) return <Loading label="Working out the figures" />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const { users, active, activation, retention, funnel, errors } = data;
  const rows = active.daily.map((d, i) => ({ period: d.day, active: d.count, signups: users.signups.daily[i]?.count ?? 0 }));

  return (
    <div className="stack">
      <PageHead
        title="Analytics"
        sub={`Updated ${when(data.generatedAt)} · refreshes every 5 minutes · admins are not counted, and only signed-in use is`}
      />
      <ErrorBox error={error} onRetry={reload} />

      <div className="grid cols-4">
        <StatTile hero label="Active today" value={num(active.dau)} note={`${num(active.wau)} this week · ${num(active.mau)} in 30 days`} />
        <StatTile label="All users" value={num(users.total)} note={`${num(users.signups.today)} signed up today`} />
        <StatTile label="New users, 7 days" value={num(users.signups.week)} note={`${num(users.signups.month)} in 30 days`} />
        <StatTile label="Activation" value={pct(activation.rate)} note={`${num(activation.activated)} of ${num(activation.cohort)} new users booked or offered a ride`} />
      </div>

      <div className="card">
        <h2>Active users and sign-ups per day, last 30 days</h2>
        <LineChart
          title="Active users and sign-ups per day"
          rows={rows}
          series={[{ key: 'active', label: 'Active users' }, { key: 'signups', label: 'Sign-ups' }]}
          formatX={dayLabel}
          formatY={short}
        />
        <details style={{ marginTop: 12 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>Show the figures as a table</summary>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead><tr><th>Day</th><th className="num">Active users</th><th className="num">Sign-ups</th></tr></thead>
              <tbody>
                {rows.map((r) => <tr key={r.period}><td>{dayLabel(r.period)}</td><td className="num">{num(r.active)}</td><td className="num">{num(r.signups)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <section>
        <h2 className="section-label">Retention</h2>
        <div className="grid cols-4">
          {retention.map((r) => (
            <StatTile key={r.day} label={`Back on day ${r.day}`} value={pct(r.rate)} note={r.cohort ? `${num(r.retained)} of ${num(r.cohort)} who signed up` : 'Not enough sign-ups yet'} />
          ))}
          <StatTile label="Stickiness" value={pct(active.stickiness)} note="Today's actives as a share of the month's" />
        </div>
      </section>

      <div className="grid cols-2">
        <section className="card">
          <h2>Rider funnel</h2>
          <p className="faint" style={{ marginTop: 0 }}>People who signed up in the last 30 days, and how far they got.</p>
          <Funnel steps={funnel} />
        </section>
        <section className="card">
          <h2>Errors people saw, last 7 days</h2>
          {errors.top7d === null ? (
            <p className="faint">Needs Redis.</p>
          ) : errors.top7d.length === 0 ? (
            <p className="faint">None.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Error</th><th className="num">Times</th></tr></thead>
                <tbody>{errors.top7d.map((e) => <tr key={e.id}><td><code>{e.id}</code></td><td className="num">{num(e.count)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="faint" style={{ marginTop: 8 }}>
            Right now {pct(errors.live.errorRate, 1)} of the last {num(errors.live.requests)} requests failed on this server.
            {data.posthog ? ' Events also go to PostHog.' : ' PostHog is not connected (see SETUP_TODO.md).'}
          </p>
        </section>
      </div>
    </div>
  );
}
