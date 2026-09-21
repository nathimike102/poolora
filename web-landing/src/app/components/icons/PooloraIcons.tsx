
/**
 * Premium custom icon library for Poolora
 * Design style: Stripe, Linear, Notion, Mercury, Revolut, Ramp, Airbnb
 * Using Poolora brand colors: Indigo (#0B7A75), Cyan (#06B6D4), Rose/Pink for safety
 */

/* ─── Trust & Verification Icons ─── */

export const DriverVerificationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="driver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B7A75" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
    </defs>
    {/* Fingerprint base */}
    <path d="M8 8c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="url(#driver-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M6 12c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="url(#driver-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
    <path d="M12 10v8" stroke="url(#driver-grad)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 14c0-1.66 1.34-3 3-3s3 1.34 3 3v4" stroke="url(#driver-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
    {/* Verification badge */}
    <circle cx="18" cy="6" r="3.5" fill="#0B7A75"/>
    <path d="M16.5 6l1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const VehicleVerificationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="vehicle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    {/* Car outline */}
    <path d="M7 17h10M5 11l1.5-3.5C7 6.5 8 6 9 6h6c1 0 2 .5 2.5 1.5L19 11" stroke="url(#vehicle-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="4" y="11" width="16" height="6" rx="1.5" stroke="url(#vehicle-grad)" strokeWidth="1.5" fill="none"/>
    <circle cx="7.5" cy="14" r="1" fill="#14B8A6"/>
    <circle cx="16.5" cy="14" r="1" fill="#14B8A6"/>
    {/* Shield with checkmark */}
    <path d="M12 3l-3 1.5v2.25c0 2.25 1.5 4.35 3 5.25 1.5-.9 3-3 3-5.25V4.5L12 3z" fill="#06B6D4" fillOpacity="0.15" stroke="#06B6D4" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M10.5 6l1 1 2-2" stroke="#06B6D4" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const IdentityVerificationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="identity-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#0891B2" />
      </linearGradient>
    </defs>
    {/* ID Card outline */}
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="url(#identity-grad)" strokeWidth="1.5" fill="none"/>
    {/* Profile circle */}
    <circle cx="8.5" cy="11" r="2" stroke="#06B6D4" strokeWidth="1.3" fill="none"/>
    {/* Face scan lines */}
    <path d="M6.5 11h-1M10.5 11h1" stroke="#06B6D4" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    <path d="M8.5 9v-0.5M8.5 13v0.5" stroke="#06B6D4" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    {/* Document lines */}
    <line x1="13" y1="9" x2="18" y2="9" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
    <line x1="13" y1="11.5" x2="18" y2="11.5" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <line x1="13" y1="14" x2="16" y2="14" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    {/* Verification checkmark overlay */}
    <circle cx="19" cy="16.5" r="2.5" fill="#06B6D4"/>
    <path d="M17.8 16.5l0.7 0.7 1.3-1.4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const SecurePaymentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="payment-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>
    {/* Escrow vault */}
    <rect x="4" y="9" width="16" height="11" rx="1.5" stroke="url(#payment-grad)" strokeWidth="1.5" fill="none"/>
    <rect x="6" y="7" width="12" height="2" rx="0.5" fill="#10B981" fillOpacity="0.2"/>
    {/* Lock mechanism */}
    <circle cx="12" cy="14.5" r="2" stroke="#10B981" strokeWidth="1.3" fill="none"/>
    <line x1="12" y1="16.5" x2="12" y2="18" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round"/>
    {/* Security indicators */}
    <circle cx="8" cy="14.5" r="0.8" fill="#10B981" opacity="0.4"/>
    <circle cx="16" cy="14.5" r="0.8" fill="#10B981" opacity="0.4"/>
    {/* Verified badge */}
    <circle cx="18.5" cy="6" r="3" fill="#10B981"/>
    <path d="M17.3 6l0.8 0.8 1.6-1.6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const CommunityTrustIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="community-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#A78BFA" />
      </linearGradient>
    </defs>
    {/* Network connections */}
    <circle cx="12" cy="7" r="2.5" stroke="url(#community-grad)" strokeWidth="1.3" fill="none"/>
    <circle cx="6" cy="15" r="2" stroke="#8B5CF6" strokeWidth="1.2" fill="none" opacity="0.7"/>
    <circle cx="18" cy="15" r="2" stroke="#8B5CF6" strokeWidth="1.2" fill="none" opacity="0.7"/>
    <circle cx="12" cy="18" r="1.5" stroke="#8B5CF6" strokeWidth="1" fill="none" opacity="0.5"/>
    {/* Connection lines */}
    <line x1="12" y1="9.5" x2="6.8" y2="13.5" stroke="#8B5CF6" strokeWidth="1" opacity="0.3"/>
    <line x1="12" y1="9.5" x2="17.2" y2="13.5" stroke="#8B5CF6" strokeWidth="1" opacity="0.3"/>
    <line x1="7.5" y1="16.5" x2="10.8" y2="17.5" stroke="#8B5CF6" strokeWidth="1" opacity="0.25"/>
    <line x1="16.5" y1="16.5" x2="13.2" y2="17.5" stroke="#8B5CF6" strokeWidth="1" opacity="0.25"/>
    {/* Star rating overlay */}
    <path d="M12 5l0.5 1.5h1.5l-1.2 0.9 0.5 1.5-1.3-0.9-1.3 0.9 0.5-1.5-1.2-0.9h1.5L12 5z" fill="#8B5CF6" opacity="0.3"/>
  </svg>
);

/* ─── Safety & Emergency Icons ─── */

export const EmergencySafetyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="emergency-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F43F5E" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    {/* Outer protective shield */}
    <path d="M12 2.5L5 5.5v4.5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5.5l-7-3z" stroke="url(#emergency-grad)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    {/* SOS text */}
    <circle cx="12" cy="11" r="5" fill="#F43F5E" fillOpacity="0.15"/>
    <text x="12" y="13.5" fontSize="5" fontWeight="bold" fill="#F43F5E" textAnchor="middle" fontFamily="system-ui">SOS</text>
    {/* Emergency pulse rings */}
    <circle cx="12" cy="11" r="6.5" stroke="#F43F5E" strokeWidth="0.8" opacity="0.3" fill="none"/>
    <circle cx="12" cy="11" r="8" stroke="#EC4899" strokeWidth="0.6" opacity="0.2" fill="none"/>
  </svg>
);

export const SafetyShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F43F5E" />
        <stop offset="100%" stopColor="#FB7185" />
      </linearGradient>
    </defs>
    {/* Main shield */}
    <path d="M12 2.5L4 6v5c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-3.5z" fill="url(#shield-grad)" fillOpacity="0.15" stroke="url(#shield-grad)" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* Inner checkmark shield */}
    <path d="M12 6L7.5 8v3c0 3 2 5.5 4.5 6.5 2.5-1 4.5-3.5 4.5-6.5V8L12 6z" fill="#F43F5E" fillOpacity="0.2" stroke="#F43F5E" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M10 11.5l1.5 1.5 3-3" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Corner verification marks */}
    <circle cx="6" cy="7" r="1" fill="#F43F5E" opacity="0.4"/>
    <circle cx="18" cy="7" r="1" fill="#F43F5E" opacity="0.4"/>
  </svg>
);

export const SOSIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="sos-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#DC2626" />
        <stop offset="100%" stopColor="#F43F5E" />
      </linearGradient>
    </defs>
    {/* Phone with SOS signal */}
    <rect x="7" y="4" width="10" height="16" rx="2" stroke="url(#sos-grad)" strokeWidth="1.5" fill="none"/>
    <circle cx="12" cy="17" r="0.8" fill="#DC2626"/>
    {/* Emergency waves */}
    <path d="M4 9c0-2.5 2-4.5 4.5-4.5M15.5 4.5C18 4.5 20 6.5 20 9" stroke="#F43F5E" strokeWidth="1.3" strokeLinecap="round" opacity="0.6"/>
    <path d="M2 10c0-3.5 2.5-6 6-6M16 4c3.5 0 6 2.5 6 6" stroke="#F43F5E" strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
    {/* SOS text inside phone */}
    <text x="12" y="11.5" fontSize="4" fontWeight="bold" fill="#DC2626" textAnchor="middle" fontFamily="system-ui">SOS</text>
  </svg>
);

export const RouteMonitoringIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="route-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F43F5E" />
        <stop offset="100%" stopColor="#FB7185" />
      </linearGradient>
    </defs>
    {/* Navigation pin */}
    <path d="M12 2L12 12L15 9M12 12L9 9" stroke="url(#route-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Route path */}
    <path d="M6 8 Q9 12, 12 16 T18 22" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4"/>
    {/* Checkpoints */}
    <circle cx="6" cy="8" r="2" fill="#F43F5E" fillOpacity="0.3" stroke="#F43F5E" strokeWidth="1.2"/>
    <circle cx="12" cy="16" r="2" fill="#F43F5E" fillOpacity="0.3" stroke="#F43F5E" strokeWidth="1.2"/>
    <circle cx="18" cy="22" r="2" fill="#F43F5E" stroke="#F43F5E" strokeWidth="1.2"/>
    {/* Alert indicator */}
    <circle cx="19" cy="5" r="2.5" fill="#DC2626"/>
    <path d="M19 4v1.5M19 7.5h0.01" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const LiveTrackingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="track-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#FBBF24" />
      </linearGradient>
    </defs>
    {/* Map pin location */}
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="url(#track-grad)" fillOpacity="0.2" stroke="url(#track-grad)" strokeWidth="1.5"/>
    <circle cx="12" cy="9" r="2.5" fill="#F59E0B"/>
    {/* Live pulse rings */}
    <circle cx="12" cy="9" r="4.5" stroke="#F59E0B" strokeWidth="0.8" opacity="0.4" fill="none"/>
    <circle cx="12" cy="9" r="6" stroke="#FBBF24" strokeWidth="0.6" opacity="0.25" fill="none"/>
  </svg>
);

export const WomenOnlyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="women-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#F472B6" />
      </linearGradient>
    </defs>
    {/* Two user silhouettes */}
    <circle cx="9" cy="7" r="3" stroke="url(#women-grad)" strokeWidth="1.5" fill="none"/>
    <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="url(#women-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <circle cx="16" cy="8" r="2.5" stroke="#EC4899" strokeWidth="1.3" fill="none" opacity="0.6"/>
    <path d="M12 20c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#EC4899" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6"/>
    {/* Verification shield */}
    <circle cx="19" cy="5" r="3" fill="#EC4899"/>
    <path d="M17.8 5l0.7 0.7 1.3-1.4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

/* ─── Mobility & Transportation Icons ─── */

export const RidePoolingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="ride-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B7A75" />
        <stop offset="100%" stopColor="#0B7A75" />
      </linearGradient>
    </defs>
    {/* Car body */}
    <path d="M6 14h12M4 10l1.8-3.6C6.2 5.6 7.2 5 8.4 5h7.2c1.2 0 2.2.6 2.6 1.4L20 10" stroke="url(#ride-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="3" y="10" width="18" height="6" rx="1.5" stroke="url(#ride-grad)" strokeWidth="1.5" fill="none"/>
    <circle cx="7" cy="13" r="1.2" fill="#0B7A75"/>
    <circle cx="17" cy="13" r="1.2" fill="#0B7A75"/>
    {/* Multiple passengers indicator */}
    <circle cx="10" cy="7.5" r="1" fill="#0B7A75" opacity="0.5"/>
    <circle cx="12" cy="7.5" r="1" fill="#0B7A75" opacity="0.6"/>
    <circle cx="14" cy="7.5" r="1" fill="#0B7A75" opacity="0.4"/>
  </svg>
);

export const ParcelPoolingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="parcel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
    </defs>
    {/* Package box */}
    <rect x="4" y="7" width="10" height="10" rx="1.5" stroke="url(#parcel-grad)" strokeWidth="1.5" fill="none"/>
    <path d="M4 11h10M9 7v10" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="9" cy="12" r="1.5" fill="#10B981" opacity="0.3"/>
    {/* Commuter path */}
    <path d="M16 5l3 3-3 3" stroke="#34D399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    <path d="M16 8h3M16 14v5M16 19h5" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" opacity="0.4"/>
    {/* Destination pin */}
    <circle cx="21" cy="19" r="2" fill="#10B981"/>
    <circle cx="21" cy="19" r="0.8" fill="white"/>
  </svg>
);

export const TripPoolingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="trip-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#FB923C" />
      </linearGradient>
    </defs>
    {/* Map with route */}
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="url(#trip-grad)" strokeWidth="1.5" fill="none"/>
    {/* Inter-city route */}
    <path d="M6 10 L10 8 L14 12 L18 9" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* City markers */}
    <circle cx="6" cy="10" r="1.5" fill="#F97316"/>
    <circle cx="10" cy="8" r="1.3" fill="#FB923C" opacity="0.7"/>
    <circle cx="14" cy="12" r="1.3" fill="#FB923C" opacity="0.7"/>
    <circle cx="18" cy="9" r="1.5" fill="#F97316"/>
    {/* Group indicator */}
    <circle cx="10" cy="16" r="1" fill="#F97316" opacity="0.4"/>
    <circle cx="12" cy="16" r="1" fill="#F97316" opacity="0.4"/>
    <circle cx="14" cy="16" r="1" fill="#F97316" opacity="0.4"/>
  </svg>
);

export const SmartMobilityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="mobility-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B7A75" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    {/* Smart car outline */}
    <path d="M6 14h12M4 10l1.5-2.5C6 6.8 7 6 8 6h8c1 0 2 .8 2.5 1.5L20 10" stroke="url(#mobility-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="3" y="10" width="18" height="5" rx="1.5" stroke="url(#mobility-grad)" strokeWidth="1.5" fill="none"/>
    <circle cx="7" cy="12.5" r="1" fill="#0B7A75"/>
    <circle cx="17" cy="12.5" r="1" fill="#06B6D4"/>
    {/* AI brain/network overlay */}
    <circle cx="12" cy="6" r="2" stroke="#0B7A75" strokeWidth="1" fill="none" opacity="0.5"/>
    <circle cx="9" cy="8" r="1" fill="#0B7A75" opacity="0.3"/>
    <circle cx="15" cy="8" r="1" fill="#06B6D4" opacity="0.3"/>
    <line x1="10" y1="8" x2="11" y2="7" stroke="#0B7A75" strokeWidth="0.8" opacity="0.3"/>
    <line x1="14" y1="8" x2="13" y2="7" stroke="#06B6D4" strokeWidth="0.8" opacity="0.3"/>
    {/* Efficiency indicator */}
    <path d="M19 17.5l1.5-1.5-1.5-1.5" stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SmartMatchingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="match-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#A78BFA" />
      </linearGradient>
    </defs>
    {/* AI matching nodes */}
    <circle cx="6" cy="6" r="2.5" stroke="url(#match-grad)" strokeWidth="1.3" fill="none"/>
    <circle cx="18" cy="6" r="2.5" stroke="url(#match-grad)" strokeWidth="1.3" fill="none"/>
    <circle cx="6" cy="18" r="2.5" stroke="url(#match-grad)" strokeWidth="1.3" fill="none"/>
    <circle cx="18" cy="18" r="2.5" stroke="url(#match-grad)" strokeWidth="1.3" fill="none"/>
    {/* Smart connections */}
    <path d="M8.5 6h7M8.5 18h7M6 8.5v7M18 8.5v7" stroke="#8B5CF6" strokeWidth="1" strokeDasharray="2 2" opacity="0.3"/>
    <path d="M8 8l8 8M16 8l-8 8" stroke="#A78BFA" strokeWidth="1.2" opacity="0.4"/>
    {/* Central AI processor */}
    <circle cx="12" cy="12" r="3" fill="#8B5CF6" fillOpacity="0.15" stroke="#8B5CF6" strokeWidth="1.5"/>
    <path d="M10.5 12l1 1 2-2" stroke="#8B5CF6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─── Value Proposition Icons ─── */

export const SmartSavingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="savings-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#FBBF24" />
      </linearGradient>
    </defs>
    {/* Upward trending arrow */}
    <path d="M4 17l6-6 4 4 6-8" stroke="url(#savings-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 7v6M20 7h-6" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Data points */}
    <circle cx="4" cy="17" r="1.5" fill="#F59E0B"/>
    <circle cx="10" cy="11" r="1.5" fill="#F59E0B"/>
    <circle cx="14" cy="15" r="1.5" fill="#FBBF24"/>
    <circle cx="20" cy="7" r="1.5" fill="#FBBF24"/>
    {/* Percentage symbol */}
    <circle cx="17" cy="18" r="3.5" fill="#F59E0B"/>
    <text x="17" y="19.8" fontSize="4.5" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="system-ui">%</text>
  </svg>
);

/* ─── Values & Mission Icons ─── */

export const CommunityHeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#F472B6" />
      </linearGradient>
    </defs>
    {/* Heart shape */}
    <path d="M12 21C12 21 3 15 3 9c0-3 2-5 5-5 2 0 3.5 1 4 2.5C12.5 5 14 4 16 4c3 0 5 2 5 5 0 6-9 12-9 12z"
      fill="url(#heart-grad)" fillOpacity="0.15" stroke="url(#heart-grad)" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* People nodes inside heart */}
    <circle cx="9" cy="10" r="1.5" fill="#EC4899" opacity="0.6"/>
    <circle cx="12" cy="12" r="1.5" fill="#EC4899" opacity="0.8"/>
    <circle cx="15" cy="10" r="1.5" fill="#F472B6" opacity="0.6"/>
    {/* Connection lines */}
    <line x1="9" y1="10" x2="12" y2="12" stroke="#EC4899" strokeWidth="0.8" opacity="0.3"/>
    <line x1="15" y1="10" x2="12" y2="12" stroke="#F472B6" strokeWidth="0.8" opacity="0.3"/>
  </svg>
);

export const AffordabilityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="afford-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#FBBF24" />
      </linearGradient>
    </defs>
    {/* Wallet/money card */}
    <rect x="3" y="7" width="18" height="12" rx="2" stroke="url(#afford-grad)" strokeWidth="1.5" fill="none"/>
    <path d="M3 11h18" stroke="#F59E0B" strokeWidth="1.5"/>
    {/* Savings indicator */}
    <circle cx="16" cy="15" r="2.5" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="1.3"/>
    <path d="M15 15l0.7 0.7 1.3-1.4" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Coin stack */}
    <circle cx="8" cy="14.5" r="1.5" fill="#FBBF24" opacity="0.4"/>
    <circle cx="8" cy="16" r="1.5" fill="#FBBF24" opacity="0.6"/>
    <circle cx="8" cy="17.5" r="1.5" fill="#FBBF24" opacity="0.8"/>
  </svg>
);

export const SustainabilityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="sustain-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
    </defs>
    {/* Earth/globe */}
    <circle cx="12" cy="12" r="8" stroke="url(#sustain-grad)" strokeWidth="1.5" fill="none"/>
    {/* Continents/land masses */}
    <path d="M4 12c0-2 1-3.5 2.5-4.5M12 4c2.5 0 4.5 1.5 6 3.5" stroke="#10B981" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <path d="M20 12c0 2-1 3.5-2.5 4.5M12 20c-2.5 0-4.5-1.5-6-3.5" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    {/* Leaf overlay for sustainability */}
    <path d="M14 8c2 0 3.5 1.5 3.5 3.5 0 2-2.5 4.5-3.5 5.5-1-1-3.5-3.5-3.5-5.5C10.5 9.5 12 8 14 8z"
      fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="1.2"/>
    <path d="M14 10v4" stroke="#10B981" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

export const MissionTargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="target-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B7A75" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
    </defs>
    {/* Target circles */}
    <circle cx="12" cy="12" r="9" stroke="url(#target-grad)" strokeWidth="1.5" fill="none" opacity="0.3"/>
    <circle cx="12" cy="12" r="6" stroke="url(#target-grad)" strokeWidth="1.5" fill="none" opacity="0.5"/>
    <circle cx="12" cy="12" r="3" stroke="url(#target-grad)" strokeWidth="1.5" fill="none" opacity="0.7"/>
    {/* Center bullseye */}
    <circle cx="12" cy="12" r="1.5" fill="#0B7A75"/>
    {/* Arrow pointing to center */}
    <path d="M18 6l-5 5" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M18 6l-1 3M18 6l-3 1" stroke="#7C3AED" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const UserGroupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="usergroup-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B7A75" />
        <stop offset="100%" stopColor="#0B7A75" />
      </linearGradient>
    </defs>
    {/* Three user silhouettes */}
    <circle cx="9" cy="8" r="3" stroke="url(#usergroup-grad)" strokeWidth="1.5" fill="none"/>
    <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="url(#usergroup-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <circle cx="16" cy="7" r="2.5" stroke="#0B7A75" strokeWidth="1.3" fill="none" opacity="0.6"/>
    <path d="M12 20c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#0B7A75" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6"/>
  </svg>
);

export const TrendingUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="trending-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
    </defs>
    {/* Upward trend line */}
    <path d="M3 17l5-5 4 4 6-9" stroke="url(#trending-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18 7v7M18 7h-7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Data points */}
    <circle cx="3" cy="17" r="1.5" fill="#10B981"/>
    <circle cx="8" cy="12" r="1.5" fill="#10B981"/>
    <circle cx="12" cy="16" r="1.5" fill="#34D399"/>
    <circle cx="18" cy="7" r="1.5" fill="#34D399"/>
  </svg>
);

export const CalendarScheduleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="calendar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B7A75" />
        <stop offset="100%" stopColor="#0B7A75" />
      </linearGradient>
    </defs>
    {/* Calendar outline */}
    <rect x="4" y="5" width="16" height="16" rx="2" stroke="url(#calendar-grad)" strokeWidth="1.5" fill="none"/>
    <path d="M4 9h16" stroke="#0B7A75" strokeWidth="1.5"/>
    <path d="M8 3v4M16 3v4" stroke="#0B7A75" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Checkmarks for scheduled days */}
    <path d="M8 13l1 1 2-2" stroke="#0B7A75" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 17l1 1 2-2" stroke="#0B7A75" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="16" cy="13.5" r="1" fill="#0B7A75" opacity="0.4"/>
    <circle cx="16" cy="17.5" r="1" fill="#0B7A75" opacity="0.4"/>
  </svg>
);

export const BlueOceanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="ocean-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    {/* Globe/Earth */}
    <circle cx="12" cy="12" r="8.5" stroke="url(#ocean-grad)" strokeWidth="1.5" fill="none"/>
    {/* Ocean waves */}
    <path d="M4 12c0-1.5 1-2.5 2-2.5s1.5 1 2.5 1c1 0 1.5-1 2.5-1s1.5 1 2.5 1c1 0 1.5-1 2.5-1s1.5 1 2 2.5"
      stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6"/>
    <path d="M4 15c0-1 0.8-1.5 1.5-1.5s1.2 0.5 2 0.5 1.3-0.5 2-0.5 1.3 0.5 2 0.5 1.3-0.5 2-0.5 1.2 0.5 1.5 1.5"
      stroke="#06B6D4" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.4"/>
    {/* Opportunity star */}
    <path d="M18 6l0.5 1.5h1.5l-1.2 0.9 0.5 1.5-1.3-0.9-1.3 0.9 0.5-1.5-1.2-0.9h1.5L18 6z"
      fill="#3B82F6" opacity="0.8"/>
  </svg>
);

export const AssetLightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="asset-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#FBBF24" />
      </linearGradient>
    </defs>
    {/* Cloud platform */}
    <path d="M7 14c-2.2 0-4-1.8-4-4s1.8-4 4-4c0.3-2.2 2.1-4 4.5-4 2.2 0 4 1.5 4.5 3.5 1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5"
      stroke="url(#asset-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    {/* Lightweight nodes */}
    <circle cx="7" cy="18" r="2" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="1.3"/>
    <circle cx="12" cy="20" r="2" fill="#F59E0B" fillOpacity="0.2" stroke="#FBBF24" strokeWidth="1.3"/>
    <circle cx="17" cy="18" r="2" fill="#FBBF24" fillOpacity="0.2" stroke="#FBBF24" strokeWidth="1.3"/>
    {/* Connection lines */}
    <line x1="9" y1="17" x2="10.5" y2="19" stroke="#F59E0B" strokeWidth="1" opacity="0.4"/>
    <line x1="13.5" y1="19" x2="15" y2="17" stroke="#FBBF24" strokeWidth="1" opacity="0.4"/>
  </svg>
);

export const UnitEconomicsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="economics-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
    </defs>
    {/* Upward trend bars */}
    <rect x="4" y="15" width="3" height="5" rx="0.5" fill="#10B981" fillOpacity="0.4"/>
    <rect x="8.5" y="12" width="3" height="8" rx="0.5" fill="#10B981" fillOpacity="0.6"/>
    <rect x="13" y="8" width="3" height="12" rx="0.5" fill="#10B981" fillOpacity="0.8"/>
    <rect x="17.5" y="4" width="3" height="16" rx="0.5" fill="url(#economics-grad)"/>
    {/* Profit arrow */}
    <path d="M3 17l5-5 4 4 6-9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    {/* Percentage indicator */}
    <circle cx="20" cy="3" r="2.5" fill="#34D399"/>
    <text x="20" y="4.2" fontSize="3" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="system-ui">%</text>
  </svg>
);
