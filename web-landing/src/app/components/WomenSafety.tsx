import React from 'react';
import { PhoneCall, CheckCircle2 } from 'lucide-react';
import {
  WomenOnlyIcon,
  SOSIcon,
  RouteMonitoringIcon,
  LiveTrackingIcon,
  EmergencySafetyIcon,
} from './icons/PooloraIcons';
import { FEATURES } from '../../config/features';
import { Container } from './layout/Container';

const iconMap: Record<string, React.ReactNode> = {
  WomenOnlyIcon: <WomenOnlyIcon />,
  SOSIcon: <SOSIcon />,
  RouteMonitoringIcon: <RouteMonitoringIcon />,
  LiveTrackingIcon: <LiveTrackingIcon />,
  EmergencySafetyIcon: <EmergencySafetyIcon />,
};

/** What a rider sees in the app during a trip. Every row is a shipped feature. */
const rideChecks = [
  { label: 'Driver documents', status: 'Reviewed' },
  { label: 'Emergency contacts', status: 'Up to 5' },
  { label: 'Live location link', status: 'Sent on SOS' },
  { label: 'In-app chat', status: 'After booking' },
  { label: 'Rating after the trip', status: 'Both ways' },
];

export function WomenSafety() {
  return (
    <section id="safety" className="py-16 bg-white overflow-hidden">
      <Container>
        <div className="relative bg-[#1a0713] rounded-[2rem] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-rose-500/30" />

          <div className="relative z-10 grid lg:grid-cols-2 gap-0">
            <div className="px-8 py-12 sm:px-10 lg:py-16 xl:px-16">
              <h2 className="text-3xl sm:text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight mb-5">
                Safety tools that work<br />
                <span className="text-rose-300">while you are in the car.</span>
              </h2>

              <p className="text-rose-50/80 text-base leading-relaxed mb-10 max-w-md">
                Sharing a car with someone you have not met has to feel safe. These are the
                tools in the app at launch, not plans for a later release.
              </p>

              <ul className="space-y-4">
                {FEATURES.safetyFeatures.map(f => (
                  <li key={f.id} className="flex gap-4">
                    <div
                      aria-hidden="true"
                      className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-300 shrink-0 mt-0.5"
                    >
                      {iconMap[f.iconName] ?? null}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm mb-0.5">{f.title}</h3>
                      <p className="text-rose-50/75 text-xs leading-relaxed">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Illustration of the in-ride safety panel */}
            <div className="relative flex items-center justify-center p-8 sm:p-10 lg:p-14">
              <div className="relative w-full max-w-[340px]" aria-hidden="true">
                <div className="bg-white/[0.07] border border-white/15 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-white/70 text-xs font-medium">During a ride</p>
                      <p className="text-white font-black">What is in place</p>
                    </div>
                    <span className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-3 py-1.5 text-emerald-200 text-xs font-bold">
                      In the app
                    </span>
                  </div>

                  <div className="space-y-2.5 mb-5">
                    {rideChecks.map(item => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5"
                      >
                        <span className="text-white/85 text-xs font-medium">{item.label}</span>
                        <span className="text-emerald-300 text-[11px] font-bold">{item.status}</span>
                      </div>
                    ))}
                  </div>

                  <div className="w-full py-4 rounded-2xl bg-rose-700 text-white font-black flex items-center justify-center gap-2.5">
                    <PhoneCall className="w-5 h-5" />
                    Emergency SOS
                  </div>
                </div>

                <div className="absolute -top-5 -right-5 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <WomenOnlyIcon />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs">Women-only</p>
                    <p className="text-gray-600 text-[11px]">Offered and booked by women</p>
                  </div>
                </div>

                <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-gray-900 text-xs">Documents checked</p>
                    <p className="text-gray-600 text-[11px]">Before the first ride</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
