import { Link } from 'react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  RidePoolingIcon,
  ParcelPoolingIcon,
  TripPoolingIcon,
  SafetyShieldIcon,
  CommunityHeartIcon,
  AffordabilityIcon,
  SustainabilityIcon,
  MissionTargetIcon,
} from '../components/icons/PooloraIcons';
import { COMPANY } from '../../config/company';
import { FEATURES } from '../../config/features';
import { Container } from '../components/layout/Container';

const iconMap: Record<string, React.ReactNode> = {
  RidePoolingIcon: <RidePoolingIcon />,
  ParcelPoolingIcon: <ParcelPoolingIcon />,
  TripPoolingIcon: <TripPoolingIcon />,
  SafetyShieldIcon: <SafetyShieldIcon />,
  CommunityHeartIcon: <CommunityHeartIcon />,
  AffordabilityIcon: <AffordabilityIcon />,
  SustainabilityIcon: <SustainabilityIcon />,
};

export function AboutPage() {
  // Combine modules and safety differentiator to form pillars list
  const pillarsList = [
    ...FEATURES.modules.map(m => ({
      icon: iconMap[m.iconName],
      title: m.title,
      desc: m.desc,
      phase: m.label || 'Roadmap',
      color: m.color,
      bg: m.bg,
      border: m.border,
      to: m.href || '#',
    })),
    {
      icon: <SafetyShieldIcon />,
      title: 'Safety tools',
      desc: 'Women-only rides, an SOS button, emergency contacts and a tracking link your family can open in a browser.',
      phase: 'In the first release',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      to: '/#safety',
    }
  ];

  return (
    <div className="bg-white min-h-screen font-sans">

      {/* Hero */}
      <section className="relative pt-20 pb-14 overflow-hidden">
        <div className="absolute top-0 right-0 w-[700px] h-[600px] bg-gradient-to-bl from-teal-100/60 via-cyan-50/30 to-transparent rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-pink-100/40 to-transparent rounded-full blur-3xl -z-10" />

        <Container>
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-semibold mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <div>
            <span className="inline-block px-4 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-brand-dark text-sm font-bold mb-6">
              About {COMPANY.name}
            </span>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-gray-900 tracking-tight leading-[1.04] mb-6 max-w-3xl">
              A carpooling app built around the ride actually feeling safe.
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mb-6">
              {COMPANY.description}
            </p>
            <p className="text-base text-gray-600 leading-relaxed max-w-2xl mb-10">
              We are a small team in {COMPANY.address}, led by {COMPANY.founder.name}, {COMPANY.founder.title}.
              The product is in development and has not launched, so everything on this site describes
              either what the app does today or what is still being built.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/#waitlist"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand text-white font-bold hover:bg-brand-dark transition-colors shadow-xl shadow-teal-500/25">
                Join the waitlist <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/investors"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 transition-colors">
                For investors
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Why we exist */}
      <section className="py-12 bg-gray-50 border-y border-gray-200">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-4">Why we exist</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-tight mb-6">
              Cars make the same trip every morning with the seats empty.
            </h2>
            <p className="text-gray-700 leading-relaxed mb-5">
              Someone drives to the same office park at the same time every weekday with three seats
              nobody uses. Someone else pays for a cab along that exact road. Putting those two people
              in touch is the whole idea, and the hard part is not the matching. It is making both of
              them comfortable enough to share a car.
            </p>
            <p className="text-gray-700 leading-relaxed">
              That is why verification, women-only rides, emergency contacts and the SOS flow are in
              the first release rather than a later one. If the ride does not feel safe, nothing else
              about the product matters.
            </p>
          </div>
        </Container>
      </section>

      {/* What we build */}
      <section className="py-14">
        <Container>
          <div className="max-w-2xl mb-8">
            <p className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-4">What we build</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight mb-4">Four parts, in order.</h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              Ride pooling and the safety tools come first. Parcel and trip pooling are designed and
              partly built, and are labelled here so you know what you would actually be getting.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pillarsList.map((p, i) => (
              <div key={i}
                className={`relative bg-white rounded-3xl border ${p.border || 'border-gray-100'} p-7 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group`}>
                <div className={`w-12 h-12 rounded-2xl ${p.bg || 'bg-gray-50'} ${p.color || 'text-gray-900'} flex items-center justify-center mb-5`}>
                  {p.icon}
                </div>
                <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest mb-2 block">{p.phase}</span>
                <h3 className="font-black text-gray-900 mb-2 tracking-tight">{p.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">{p.desc}</p>
                <Link to={p.to} className={`inline-flex items-center gap-1.5 text-sm font-bold ${p.color || 'text-gray-900'} hover:opacity-80 transition-opacity`}>
                  More about {p.title.toLowerCase()} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Vision */}
      <section className="py-12 bg-brand">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div>
            <div className="w-12 h-12 mx-auto mb-6">
              <MissionTargetIcon />
            </div>
            <p className="text-sm font-bold text-teal-100 uppercase tracking-widest mb-4">What we are aiming for</p>
            <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6 tracking-tight">
              A commute you would recommend to your sister.
            </h2>
            <p className="text-teal-50 text-lg leading-relaxed max-w-2xl mx-auto">
              Shared rides that cost less than a cab, with drivers who have been checked and tools that
              work when something feels wrong.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-14 bg-white">
        <Container>
          <div className="max-w-xl mb-8">
            <p className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-4">What we stand for</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">Four things we will not trade away.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.values.map((v, i) => (
              <div key={i}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:bg-white hover:shadow-md transition-all">
                <div className={`w-11 h-11 rounded-xl ${v.bg || 'bg-gray-50'} ${v.color || 'text-gray-900'} flex items-center justify-center mb-4`}>
                  {iconMap[v.iconName] || null}
                </div>
                <h3 className="font-black text-gray-900 mb-2">{v.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Want to be told when we launch?</h2>
          <p className="text-gray-600 text-lg mb-8">Join the waitlist, or email us if you would rather just ask something.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/#waitlist"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand text-white font-bold hover:bg-brand-dark transition-colors shadow-xl shadow-teal-500/25">
              Join the waitlist <ArrowRight className="w-4 h-4" />
            </Link>
            <a href={`mailto:${COMPANY.emails.contact}`}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-white transition-colors">
              Email us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
