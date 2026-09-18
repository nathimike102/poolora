import { createBrowserRouter } from 'react-router';
import { Root } from './Root';
import { LandingPage } from './pages/LandingPage';

/**
 * The landing page is the primary entry point and is bundled eagerly so it
 * paints without an extra round-trip. Every secondary page is code-split via
 * `lazy` so it is fetched only when its route is visited.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: LandingPage },
      {
        path: 'investors',
        lazy: async () => ({ Component: (await import('./pages/InvestorPage')).InvestorPage }),
      },
      {
        path: 'about',
        lazy: async () => ({ Component: (await import('./pages/AboutPage')).AboutPage }),
      },
      {
        path: 'privacy',
        lazy: async () => ({ Component: (await import('./pages/PrivacyPolicyPage')).PrivacyPolicyPage }),
      },
      {
        path: 'terms',
        lazy: async () => ({ Component: (await import('./pages/TermsOfServicePage')).TermsOfServicePage }),
      },
      {
        path: 'features/ride-pooling',
        lazy: async () => ({ Component: (await import('./pages/features/RidePoolingPage')).RidePoolingPage }),
      },
      {
        path: 'features/parcel-pooling',
        lazy: async () => ({ Component: (await import('./pages/features/ParcelPoolingPage')).ParcelPoolingPage }),
      },
      {
        path: 'features/trip-pooling',
        lazy: async () => ({ Component: (await import('./pages/features/TripPoolingPage')).TripPoolingPage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('./pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
]);
