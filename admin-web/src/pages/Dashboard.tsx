import { Link } from 'react-router';
import { useApi } from '../lib/useApi';
import { money, num, pct, when } from '../lib/format';
import { Badge, ErrorBox, Loading, PageHead, StatTile } from '../components/ui';

interface Overview {
  generatedAt: string;
  users: { total: number; newToday: number; newThisWeek: number; drivers: number; riders: number; verifiedDrivers: number; pendingApplications: number; activeLastHour: number | null };
  rides: { live: number; upcoming: number; createdToday: number; completedToday: number; cancelledToday: number; cancellationRate7d: number; occupancy7d: number | null };
  money: {
    revenue: { today: number; week: number; month: number };
    volume: { today: number; week: number; month: number };
    tripsPaid: { today: number; week: number; month: number };
    pendingSettlement: number;
    refunds7d: { total: number; count: number };
  };
  safety: { activeSos: number; openDisputes: number; blockedUsers: number; suspendedUsers: number; pendingBlocks: number; fraudFlagged: number };
  system: {
    uptimeSeconds: number;
    memoryMb: number;
    databaseMs: number | null;
    redis: boolean;
    requests: { windowMinutes: number; requests: number; errorRate: number; avgMs: number; p95Ms: number };
  };
  anomalies: Array<{ severity: 'critical' | 'warning'; title: string; detail: string; link?: string }>;
}

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  return d ? `${d} d ${h} h` : `${h} h ${Math.floor((seconds % 3600) / 60)} min`;
}

export function DashboardPage() {
  const { data, error, loading, reload } = useApi<Overview>('/admin/overview', 30_000);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} onRetry={reload} />;
  const { users, rides, money: m, safety, system } = data;
  const errorRate = system.requests.errorRate;

  return (
    <div className="stack">
      <PageHead title="Dashboard" sub={`Updated ${when(data.generatedAt)} · refreshes every 30 seconds`} />
      <ErrorBox error={error} onRetry={reload} />

      {data.anomalies.length ? (
        <div className="stack" style={{ gap: 8 }}>
          {data.anomalies.map((a) => (
            <div key={a.title} className={`banner ${a.severity === 'critical' ? 'danger' : 'warn'}`} role={a.severity === 'critical' ? 'alert' : undefined}>
              <div style={{ flex: 1 }}>
                <strong>{a.title}</strong>
                {a.detail}
              </div>
              {a.link ? <Link className="btn small" to={a.link}>View</Link> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="banner info">Nothing unusual right now.</div>
      )}

      <div className="grid cols-4">
        <StatTile hero label="Rides under way" value={num(rides.live)} note={`${num(rides.upcoming)} upcoming`} />
        <StatTile label="Commission today" value={money(m.revenue.today)} note={`${money(m.volume.today)} in fares · ${num(m.tripsPaid.today)} trips`} />
        <StatTile label="Active SOS" value={num(safety.activeSos)} note={safety.activeSos ? <Link to="/sos?status=open">Respond now</Link> : 'None open'} />
        <StatTile label="Signed in, last hour" value={users.activeLastHour === null ? '—' : num(users.activeLastHour)} note={users.activeLastHour === null ? 'Needs Redis' : 'Distinct users'} />
      </div>

      <section>
        <h2 className="section-label">Users</h2>
        <div className="grid cols-4">
          <StatTile label="All users" value={num(users.total)} note={`${num(users.riders)} riders · ${num(users.drivers)} drivers`} />
          <StatTile label="New today" value={num(users.newToday)} note={`${num(users.newThisWeek)} in the last 7 days`} />
          <StatTile label="Verified drivers" value={num(users.verifiedDrivers)} />
          <StatTile label="Applications waiting" value={num(users.pendingApplications)} note={<Link to="/applications">Review</Link>} />
        </div>
      </section>

      <section>
        <h2 className="section-label">Rides</h2>
        <div className="grid cols-4">
          <StatTile label="Posted today" value={num(rides.createdToday)} />
          <StatTile label="Completed today" value={num(rides.completedToday)} note={`${num(rides.cancelledToday)} cancelled today`} />
          <StatTile label="Cancellation rate" value={pct(rides.cancellationRate7d)} note="Rides, last 7 days" />
          <StatTile label="Seat occupancy" value={pct(rides.occupancy7d)} note="Completed rides, last 7 days" />
        </div>
      </section>

      <section>
        <h2 className="section-label">Money</h2>
        <div className="grid cols-4">
          <StatTile label="Commission, 7 days" value={money(m.revenue.week)} note={`${money(m.revenue.month)} in 30 days`} />
          <StatTile label="Fares, 7 days" value={money(m.volume.week)} note={`${num(m.tripsPaid.week)} trips`} />
          <StatTile label="Owed to drivers" value={money(m.pendingSettlement)} note="Not yet settled" />
          <StatTile label="Refunds, 7 days" value={money(m.refunds7d.total)} note={`${num(m.refunds7d.count)} cancellations`} />
        </div>
      </section>

      <div className="grid cols-2">
        <section className="card">
          <h2>Safety</h2>
          <table>
            <tbody>
              <tr><td>Open disputes</td><td className="num"><Link to="/disputes?status=open">{num(safety.openDisputes)}</Link></td></tr>
              <tr><td>Blocks waiting for a second admin</td><td className="num"><Link to="/users?status=pending_block">{num(safety.pendingBlocks)}</Link></td></tr>
              <tr><td>Suspended accounts</td><td className="num"><Link to="/users?status=suspended">{num(safety.suspendedUsers)}</Link></td></tr>
              <tr><td>Blocked accounts</td><td className="num"><Link to="/users?status=blocked">{num(safety.blockedUsers)}</Link></td></tr>
              <tr><td>Flagged by fraud checks</td><td className="num">{num(safety.fraudFlagged)}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="card">
          <div className="spread">
            <h2>System health</h2>
            {errorRate > 0.05 ? <Badge tone="danger">Errors high</Badge> : <Badge tone="good">Healthy</Badge>}
          </div>
          <table>
            <tbody>
              <tr><td>Requests, last {system.requests.windowMinutes} min</td><td className="num">{num(system.requests.requests)}</td></tr>
              <tr><td>Server errors</td><td className="num">{pct(errorRate, 1)}</td></tr>
              <tr><td>Response time, average / 95th percentile</td><td className="num">{system.requests.avgMs} ms / {system.requests.p95Ms} ms</td></tr>
              <tr><td>Database round trip</td><td className="num">{system.databaseMs === null ? <Badge tone="danger">Down</Badge> : `${system.databaseMs} ms`}</td></tr>
              <tr><td>Redis</td><td className="num">{system.redis ? <Badge tone="good">Up</Badge> : <Badge tone="warn">Unavailable</Badge>}</td></tr>
              <tr><td>Uptime · memory</td><td className="num">{uptime(system.uptimeSeconds)} · {system.memoryMb} MB</td></tr>
            </tbody>
          </table>
          <p className="faint" style={{ marginTop: 8 }}>Request figures are for the server that answered; with several servers, each reports its own.</p>
        </section>
      </div>
    </div>
  );
}
