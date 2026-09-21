import { ArrowRight, ShieldCheck, MapPin, BellRing, UserCheck, Play } from 'lucide-react';
import { Container } from './layout/Container';
import { FloatingCard } from './common/FloatingCard';

const heroPoints = [
  { icon: UserCheck, label: "Driver documents reviewed by our team before their first ride" },
  { icon: ShieldCheck, label: 'Women-only rides, offered and booked by women' },
  { icon: BellRing, label: 'SOS that texts your emergency contacts a live location link' },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 pb-12 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-white" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Gradient blobs */}
        <div className="absolute top-0 right-0 w-[700px] h-[600px] bg-teal-50/70 rounded-full blur-3xl" />
      </div>

      <Container className="w-full">
        <div className="grid lg:grid-cols-[1fr_auto] gap-16 xl:gap-24 items-center">

          {/* ─── Left content ─── */}
          <div
            className="max-w-2xl"
          >
            {/* Launch badge */}
            <div  className="mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/20 bg-teal-50 text-brand text-sm font-bold">
                <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                Pre-launch · Join the waitlist
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-[3.2rem] sm:text-[4rem] xl:text-[5rem] font-black text-gray-900 leading-[1.02] tracking-[-0.03em] mb-6"
            >
              Share the ride<br />
              with drivers already<br />
              <span className="text-brand">going your way.</span>
            </h1>

            {/* Subheadline */}
            <p
              className="text-lg sm:text-xl text-gray-500 leading-relaxed mb-10 max-w-xl"
            >
              Poolora is a carpooling app for scheduled journeys in India. Drivers publish trips they are already
              making, riders book a seat on the route and time that fits, and every driver's licence and vehicle
              documents are checked before they can carry anyone.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-4 mb-14"
            >
              {/* Primary action */}
              <a
                href="#waitlist"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-brand text-white font-bold hover:bg-brand-dark active:scale-[0.98] transition-all duration-150 shadow-xl shadow-brand/30"
              >
                Join the waitlist
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>

              {/* Secondary action */}
              <a
                href="#how-it-works"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                <Play className="w-4 h-4 text-brand transition-transform group-hover:scale-110" />
                See how it works
              </a>
            </div>

            {/* What you get */}
            <ul className="flex flex-col gap-3">
              {heroPoints.map(({ icon: PointIcon, label }) => (
                <li key={label} className="flex items-start gap-3">
                  <PointIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  <span className="text-sm text-gray-700">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ─── Right: Phone mockup (decorative illustration) ─── */}
          <div
            className="relative hidden lg:flex items-center justify-center"
            aria-hidden="true"
          >
            {/* Glow ring behind phone */}
            <div className="absolute w-[360px] h-[360px] rounded-full bg-gradient-to-br from-brand/20 to-brand-cyan/10 blur-3xl" />

            {/* Anchor box: phone + floating cards share one positioning context */}
            <div className="relative w-[296px] h-[620px]">

            {/* Phone device */}
            <div className="absolute inset-0 bg-[#111] rounded-[3.2rem] border-4 border-[#222] shadow-2xl shadow-black/30 overflow-hidden z-10">
              {/* Dynamic Island */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#111] rounded-full z-20" />

              {/* Screen */}
              <div className="absolute inset-0 bg-[#F7F8FC] flex flex-col overflow-hidden">

                {/* Status bar */}
                <div className="px-6 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-600">9:41</span>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-1.5 rounded-sm bg-gray-400" />
                    <div className="w-1 h-1 rounded-full bg-gray-400" />
                  </div>
                </div>

                {/* App header */}
                <div className="bg-gradient-to-br from-brand to-brand-dark px-5 pb-5 pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-teal-300 text-[10px] font-medium">Good morning</p>
                      <p className="text-white font-black text-sm">Find your ride</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  {/* Route input */}
                  <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
                    <MapPin className="w-3.5 h-3.5 text-brand" />
                    <span className="text-gray-600 text-xs font-medium">Where are you going?</span>
                  </div>
                </div>

                {/* Ride list */}
                <div className="flex-1 px-4 py-4 space-y-3 overflow-hidden">
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">
                    Example of the ride list
                  </p>

                  {/* Sample rows: illustration only, not real listings */}
                  <div className="bg-white rounded-2xl p-3.5 border border-pink-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-pink-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-bold text-gray-900">Verified driver</span>
                          <span className="text-[9px] bg-pink-100 text-pink-800 px-1.5 py-0.5 rounded font-bold">Women-only</span>
                        </div>
                        <span className="text-[10px] text-gray-500 block truncate">Your pickup to your drop</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-500">Seat price</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-gray-900 block">Verified driver</span>
                        <span className="text-[10px] text-gray-500 block truncate">Matched on route and time</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-500">Seat price</span>
                    </div>
                  </div>

                  {/* Safety status */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-emerald-800">SOS ready</p>
                      <p className="text-[9px] text-emerald-700">Contacts get your live location</p>
                    </div>
                  </div>
                </div>

                {/* Bottom action */}
                <div className="px-4 pb-5">
                  <div className="w-full py-3.5 bg-brand rounded-2xl text-white font-black text-xs text-center shadow-lg shadow-brand/30">
                    Request seat
                  </div>
                </div>
              </div>
            </div>

            <FloatingCard
              className="-right-14 top-20 w-52"
              iconBgClassName="bg-emerald-100"
              icon={<UserCheck className="w-5 h-5 text-emerald-700" />}
              title="Documents checked"
              subtitle="Before a driver's first ride"
            />

            <FloatingCard
              className="-left-16 bottom-32 w-52"
              iconBgClassName="bg-rose-100"
              icon={<BellRing className="w-5 h-5 text-rose-700" />}
              title="SOS in every ride"
              subtitle="Contacts get a live link"
            />

            </div>
          </div>

        </div>
      </Container>
    </section>
  );
}
