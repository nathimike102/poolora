import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router';
import { useAdmin } from '../App';
import { signOut } from '../lib/auth';
import { isUrgent, subscribeSos } from '../lib/socket';
import { soundSosAlarm } from '../lib/alarm';
import { useApi } from '../lib/useApi';

interface Counts {
  safety: { activeSos: number; openDisputes: number; pendingBlocks: number; fraudFlagged: number; reviewsWaiting?: number; supportOpen?: number; appealsOpen?: number; parcelClaimsOpen?: number; withdrawalsPending?: number; mergesPending?: number; settingsPending?: number; identityPending?: number };
  users: { pendingApplications: number };
}

type Theme = 'system' | 'light' | 'dark';

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('poolora-admin-theme') as Theme) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('poolora-admin-theme', theme);
    } catch {
      // private mode: the choice lasts for this visit only
    }
  }, [theme]);
  return [theme, setTheme];
}

export function Layout({ onSignedOut }: { onSignedOut: () => void }) {
  const admin = useAdmin();
  const [theme, setTheme] = useTheme();
  // Counts for the sidebar; the dashboard polls the same data every 30 s
  const { data, reload } = useApi<Counts>('/admin/overview', 30_000);
  const [liveSos, setLiveSos] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeSos((e) => {
        if (e.kind !== 'alert') return;
        if (isUrgent(e)) {
          setLiveSos(e.emergencyId);
          soundSosAlarm();
        }
        reload();
      }),
    [reload],
  );

  const activeSos = data?.safety.activeSos ?? 0;
  const nav: Array<[string, string, number]> = [
    ['/', 'Dashboard', 0],
    ['/sos', 'SOS incidents', activeSos],
    ['/applications', 'Driver applications', data?.users.pendingApplications ?? 0],
    ['/identity', 'Identity checks', data?.safety.identityPending ?? 0],
    ['/disputes', 'Disputes', data?.safety.openDisputes ?? 0],
    ['/users', 'Users', data?.safety.pendingBlocks ?? 0],
    ['/fraud', 'Fraud flags', data?.safety.fraudFlagged ?? 0],
    ['/appeals', 'Appeals and merges', (data?.safety.appealsOpen ?? 0) + (data?.safety.mergesPending ?? 0)],
    ['/reviews', 'Reviews', data?.safety.reviewsWaiting ?? 0],
    ['/support', 'Support requests', data?.safety.supportOpen ?? 0],
    ['/parcel-claims', 'Parcel claims', data?.safety.parcelClaimsOpen ?? 0],
    ['/withdrawals', 'Withdrawals', data?.safety.withdrawalsPending ?? 0],
    ['/companies', 'Companies', 0],
    ['/hubs', 'Ranks and termini', 0],
    ['/analytics', 'Analytics', 0],
    ['/reports', 'Reports', 0],
    ['/alerts', 'Alerts', 0],
    ['/settings', 'Settings', data?.safety.settingsPending ?? 0],
    ['/audit', 'Audit log', 0],
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/mark.png" alt="" />
          Poolora Admin
        </div>
        <nav className="nav" aria-label="Main">
          {nav.map(([to, label, n]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
              {n > 0 ? <span className="count" aria-label={`${n} waiting`}>{n}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>Signed in as {admin.name || admin.email}</span>
          <label className="field">
            <span>Theme</span>
            <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="system">Match the system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button className="btn small" onClick={() => signOut().then(onSignedOut)}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        {activeSos > 0 || liveSos ? (
          <div className="sos-ticker" role="alert">
            <span>
              <strong>SOS: </strong>
              {activeSos > 0 ? `${activeSos} active incident${activeSos === 1 ? '' : 's'}.` : 'New alert.'} Respond within 5 minutes.
            </span>
            <Link to={liveSos ? `/sos/${liveSos}` : '/sos?status=open'} onClick={() => setLiveSos(null)}>Open</Link>
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
