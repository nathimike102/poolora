import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ConsentBanner } from './components/common/ConsentBanner';
import { usePageMeta } from './usePageMeta';
import { captureAttribution } from '../services/attribution';
import { initConsent } from '../services/consent';

export function Root() {
  const { pathname } = useLocation();

  usePageMeta();

  useEffect(() => {
    initConsent();
    captureAttribution();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand focus:text-white focus:font-bold"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  );
}
