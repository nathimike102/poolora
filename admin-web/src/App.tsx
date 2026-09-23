import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { currentAdmin, type AdminUser } from './lib/auth';
import { whenSignedOut } from './lib/api';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { SignInPage } from './pages/SignIn';
import { DashboardPage } from './pages/Dashboard';
import { SosListPage, SosDetailPage } from './pages/Sos';
import { ApplicationsPage, ApplicationDetailPage } from './pages/Applications';
import { DisputesPage, DisputeDetailPage } from './pages/Disputes';
import { UsersPage, UserDetailPage } from './pages/Users';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { AuditPage } from './pages/Audit';

const AdminContext = createContext<AdminUser | null>(null);
export const useAdmin = () => useContext(AdminContext)!;

export function App() {
  const [admin, setAdmin] = useState<AdminUser | null | undefined>(undefined);

  useEffect(() => {
    whenSignedOut(() => setAdmin(null));
    currentAdmin().then(setAdmin);
  }, []);

  if (admin === undefined) return <Loading label="Checking your session" />;
  if (!admin) return <SignInPage onSignedIn={setAdmin} />;

  return (
    <AdminContext.Provider value={admin}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout onSignedOut={() => setAdmin(null)} />}>
            <Route index element={<DashboardPage />} />
            <Route path="sos" element={<SosListPage />} />
            <Route path="sos/:id" element={<SosDetailPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="applications/:id" element={<ApplicationDetailPage />} />
            <Route path="disputes" element={<DisputesPage />} />
            <Route path="disputes/:id" element={<DisputeDetailPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AdminContext.Provider>
  );
}
