import { COMPANY } from './company';

/**
 * Title, description and last-changed date for every route. The sitemap and the
 * per-page meta tags both read from here, so a page cannot quietly end up with
 * a stale `lastmod` or a duplicate title. Update `updated` when you change a
 * page's content, using the date of that change.
 */
export interface PageMeta {
  path: string;
  title: string;
  description: string;
  /** ISO date of the last meaningful content change. */
  updated: string;
  /** Sitemap priority, 0 to 1. */
  priority: number;
}

export const PAGES: PageMeta[] = [
  {
    path: '/',
    title: `${COMPANY.name}: carpooling for India`,
    description:
      'Book a seat in a car already making your journey. Drivers set the price, documents are checked before anyone drives, and safety tools are in every ride. In development.',
    updated: '2026-09-18',
    priority: 1,
  },
  {
    path: '/about',
    title: `About ${COMPANY.name}`,
    description: `Who is building ${COMPANY.name}, why we started with safety rather than adding it later, and what is and is not ready.`,
    updated: '2026-09-18',
    priority: 0.6,
  },
  {
    path: '/features/ride-pooling',
    title: `Ride pooling | ${COMPANY.name}`,
    description:
      'How booking a shared seat works: the driver publishes a journey and sets the seat price, you search that route, and the ride is refunded in full if it is cancelled.',
    updated: '2026-09-18',
    priority: 0.8,
  },
  {
    path: '/features/parcel-pooling',
    title: `Parcel pooling | ${COMPANY.name}`,
    description:
      'The plan for sending a parcel with a commuter already driving that route, with a handover code at both ends. Planned, not yet released.',
    updated: '2026-09-18',
    priority: 0.5,
  },
  {
    path: '/features/trip-pooling',
    title: `Trip pooling | ${COMPANY.name}`,
    description:
      'The plan for sharing an intercity drive and splitting fuel and tolls, with the split agreed before the trip. Designed, not yet built.',
    updated: '2026-09-18',
    priority: 0.5,
  },
  {
    path: '/investors',
    title: `For investors | ${COMPANY.name}`,
    description: `Where ${COMPANY.name} stands before launch: what is built, what is still in progress, and how the platform is meant to make money.`,
    updated: '2026-09-18',
    priority: 0.5,
  },
  {
    path: '/privacy',
    title: `Privacy policy | ${COMPANY.name}`,
    description:
      'What we collect on this site and in the app, who else sees it, how long we keep it, and how to get a copy or have it deleted.',
    updated: '2026-09-18',
    priority: 0.3,
  },
  {
    path: '/terms',
    title: `Terms of service | ${COMPANY.name}`,
    description:
      'The rules for using Poolora: who may sign up, what drivers and riders agree to, how payments and cancellations work, and how disputes are handled.',
    updated: '2026-09-18',
    priority: 0.3,
  },
];

export function pageMetaFor(pathname: string): PageMeta | undefined {
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PAGES.find(p => p.path === normalised);
}
