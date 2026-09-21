export interface FeatureItem {
  id: string;
  iconName: string;
  label?: string;
  title: string;
  desc: string;
  color?: string;
  bg?: string;
  border?: string;
  highlight?: string;
  tag?: string;
  href?: string;
}

export interface FeaturesConfig {
  modules: FeatureItem[];
  differentiators: FeatureItem[];
  safetyFeatures: FeatureItem[];
  values: FeatureItem[];
}

/**
 * Product content for the site. Descriptions state what the product does
 * today; anything not built yet is labelled as planned.
 */
export const FEATURES: FeaturesConfig = {
  modules: [
    {
      id: 'ride-pooling',
      iconName: 'RidePoolingIcon',
      label: 'In the first release',
      title: 'Ride pooling',
      desc: 'Drivers publish a journey they are already making. Riders search that route and time, book a seat, and split the cost the driver sets.',
      color: 'text-brand',
      bg: 'bg-teal-50',
      border: 'border-teal-100',
      highlight: 'bg-brand',
      tag: 'Core',
      href: '/features/ride-pooling',
    },
    {
      id: 'parcel-pooling',
      iconName: 'ParcelPoolingIcon',
      label: 'Planned',
      title: 'Parcel pooling',
      desc: 'Send a parcel with a commuter already heading that way. Design work has started; it is not part of the first release.',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      highlight: 'bg-emerald-600',
      tag: 'Planned',
      href: '/features/parcel-pooling',
    },
    {
      id: 'trip-pooling',
      iconName: 'TripPoolingIcon',
      label: 'Planned',
      title: 'Trip pooling',
      desc: 'Plan an intercity journey with others and share fuel and tolls. Planned for a later release.',
      color: 'text-orange-700',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      highlight: 'bg-orange-500',
      tag: 'Planned',
      href: '/features/trip-pooling',
    },
  ],
  differentiators: [
    {
      id: 'diff-safety',
      iconName: 'SafetyShieldIcon',
      title: 'Safety tools in every ride',
      desc: 'An SOS button, live location for your emergency contacts, and women-only rides are part of the core product.',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
    },
    {
      id: 'diff-kyc',
      iconName: 'DriverVerificationIcon',
      title: 'Documents checked before driving',
      desc: 'Driving licence, registration certificate, insurance and a vehicle photo are reviewed by our team before a driver can offer a ride.',
      color: 'text-teal-700',
      bg: 'bg-teal-50',
    },
    {
      id: 'diff-matching',
      iconName: 'SmartMatchingIcon',
      title: 'Matched on route and time',
      desc: 'Search results are ranked by how close the pickup is, how well the departure time fits, and the driver rating.',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      id: 'diff-price',
      iconName: 'AffordabilityIcon',
      title: 'The price the driver sets',
      desc: 'Riders pay the seat price shown, with no booking fee added on top. Cancellations are refunded in full.',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
  ],
  safetyFeatures: [
    {
      id: 'safety-women-only',
      iconName: 'WomenOnlyIcon',
      title: 'Women-only rides',
      desc: 'A driver can mark a ride as women-only. Those rides are shown to, and bookable by, women riders only.',
    },
    {
      id: 'safety-sos',
      iconName: 'SOSIcon',
      title: 'SOS during a ride',
      desc: 'Hold the SOS button to alert the Poolora safety team and text your emergency contacts a link to your live location.',
    },
    {
      id: 'safety-tracking',
      iconName: 'LiveTrackingIcon',
      title: 'A link your family can open',
      desc: 'The tracking link works in any browser. Your contacts do not need the app or an account.',
    },
    {
      id: 'safety-verification',
      iconName: 'EmergencySafetyIcon',
      title: 'Reviewed drivers',
      desc: 'Every driver is checked by a person before their first ride, and riders rate each trip afterwards.',
    },
    {
      id: 'safety-contact',
      iconName: 'RouteMonitoringIcon',
      title: 'Numbers stay private until booking',
      desc: 'You chat in the app. Phone numbers are shared only after the driver confirms your seat.',
    },
  ],
  values: [
    {
      id: 'val-safety',
      iconName: 'SafetyShieldIcon',
      title: 'Safety first',
      desc: 'Verification, emergency contacts and the SOS flow are part of the core product, not paid extras.',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
    },
    {
      id: 'val-trust',
      iconName: 'CommunityHeartIcon',
      title: 'Trust between commuters',
      desc: 'Verified identities, ratings after every ride, and prices agreed before you travel.',
      color: 'text-pink-700',
      bg: 'bg-pink-50',
    },
    {
      id: 'val-afford',
      iconName: 'AffordabilityIcon',
      title: 'Affordable travel',
      desc: 'Drivers set a seat price for a journey they are already making, so the cost is shared rather than added.',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      id: 'val-sustain',
      iconName: 'SustainabilityIcon',
      title: 'Fewer empty seats',
      desc: 'Each shared seat is one more person travelling in a car that was making the journey anyway.',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
  ],
};
