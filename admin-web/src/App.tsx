import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { currentAdmin, type AdminUser } from './lib/auth';
import { whenSignedOut } from './lib/api';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { SignInPage } from './pages/SignIn';
import { DashboardPage } from './pages/Dashboard';
import { AnalyticsPage } from './pages/Analytics';
import { SosListPage, SosDetailPage } from './pages/Sos';
import { IdentityDetailPage, IdentityListPage } from './pages/Identity';
import { ApplicationsPage, ApplicationDetailPage } from './pages/Applications';
import { DisputesPage, DisputeDetailPage } from './pages/Disputes';
import { UsersPage, UserDetailPage } from './pages/Users';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { AuditPage } from './pages/Audit';
import { FraudPage } from './pages/Fraud';
import { ReviewsPage } from './pages/Reviews';
import { SupportPage, SupportDetailPage } from './pages/Support';
import { AppealsPage } from './pages/Appeals';
import { ParcelClaimsPage } from './pages/ParcelClaims';
import { WithdrawalsPage } from './pages/Withdrawals';
import { CompaniesPage, CompanyDetailPage } from './pages/Companies';
import { AlertsPage } from './pages/Alerts';
import { CompanyPortal } from './pages/CompanyPortal';
import { HubsPage } from './pages/Hubs';

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
  // A company admin sees only their company's own dashboard
  if (!admin.capabilities.includes('admin') && admin.company) return <CompanyPortal user={admin} onSignedOut={() => setAdmin(null)} />;

  return (
    <AdminContext.Provider value={admin}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout onSignedOut={() => setAdmin(null)} />}>
            <Route index element={<DashboardPage />} />
            <Route path="sos" element={<SosListPage />} />
            <Route path="sos/:id" element={<SosDetailPage />} />
            <Route path="identity" element={<IdentityListPage />} />
            <Route path="identity/:id" element={<IdentityDetailPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="applications/:id" element={<ApplicationDetailPage />} />
            <Route path="disputes" element={<DisputesPage />} />
            <Route path="disputes/:id" element={<DisputeDetailPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="fraud" element={<FraudPage />} />
            <Route path="appeals" element={<AppealsPage />} />
            <Route path="parcel-claims" element={<ParcelClaimsPage />} />
            <Route path="withdrawals" element={<WithdrawalsPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/:id" element={<CompanyDetailPage />} />
            <Route path="hubs" element={<HubsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="support/:id" element={<SupportDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
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
