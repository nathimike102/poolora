import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, MapPin, PiggyBank, Clock } from 'lucide-react';
import {
  RidePoolingIcon,
  SafetyShieldIcon,
  SmartSavingsIcon,
  CalendarScheduleIcon,
} from '../../components/icons/SanchariIcons';
import { Container } from '../../components/layout/Container';

const howItWorks = [
  {
    icon: <CalendarScheduleIcon />,
    step: '01',
    title: 'The driver publishes a journey',
    desc: 'Route, date, time, how many seats are free, and the price per seat. The driver sets that price, not us.',
  },
  {
    icon: <MapPin className="w-6 h-6" />,
    step: '02',
    title: 'The rider searches that route',
    desc: 'Results are ranked by how close the pickup and drop-off are, how well the departure time fits, and the driver rating.',
  },
  {
    icon: <SafetyShieldIcon />,
    step: '03',
    title: 'The driver has already been checked',
    desc: 'Licence, registration certificate, insurance and a vehicle photo are reviewed by our team before a driver can publish anything.',
  },
  {
    icon: <RidePoolingIcon />,
    step: '04',
    title: 'You travel',
    desc: 'Chat in the app, share a live tracking link with someone you trust, and use SOS if you need it.',
  },
  {
    icon: <PiggyBank className="w-6 h-6" />,
    step: '05',
    title: 'The cost is settled',
    desc: 'You pay the seat price when you book. The driver is paid for the completed ride, less our platform fee.',
  },
];

const benefits = [
  {
    icon: <SmartSavingsIcon />,
    title: 'The driver sets the price',
    desc: 'You pay the seat price shown. We do not add a booking fee for riders, and there is no surge pricing.',
  },
  {
    icon: <CalendarScheduleIcon />,
    title: 'Scheduled, not on demand',
    desc: 'Rides are published ahead of time for a specific departure, which suits a commute better than a hail.',
  },
  {
    icon: <SafetyShieldIcon />,
    title: 'Documents reviewed by a person',
    desc: 'A driver cannot publish a ride until our team has looked at their documents and approved them.',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Cancel and get your money back',
    desc: 'Cancel within the allowed window, or have the driver cancel, and the seat price is refunded in full.',
  },
];

export function RidePoolingPage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Hero */}
      <section className="relative pt-20 pb-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-[700px] h-[600px] bg-gradient-to-bl from-teal-100/70 via-cyan-50/30 to-transparent rounded-full blur-3xl -z-10" />
        <Container>
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-semibold mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <div>
            <span className="inline-block px-4 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-brand-dark text-sm font-bold mb-6">
              In the first release
            </span>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-gray-900 tracking-tight leading-[1.04] mb-6">
              Ride pooling.<br />
              <span className="text-brand-dark">A seat in a car already going your way.</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mb-10">
              Someone is driving your route at roughly your time with empty seats. You book one of
              them at the price they set, and the two of you split what the trip was going to cost
              anyway.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/#waitlist"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand text-white font-bold hover:bg-brand-dark transition-colors shadow-xl shadow-teal-500/25">
                Join the waitlist <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/#features"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 transition-colors">
                See the other modes
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* What this is not */}
      <section className="py-12 bg-gray-50 border-y border-gray-200">
        <Container>
          <div className="max-w-3xl">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-4">What ride pooling is not</h2>
            <ul className="space-y-3 text-gray-700 leading-relaxed">
              <li>It is not a taxi. Nobody is driving for a living, and a ride only exists if someone was making that trip anyway.</li>
              <li>It is not instant. You book a published journey ahead of time, so there will be routes and hours with nothing available.</li>
              <li>It is not live yet. We have not launched, so we cannot tell you what a seat will cost on your route until real rides are running.</li>
            </ul>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-14">
        <Container>
          <div className="max-w-xl mb-8">
            <p className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">Five steps, start to finish.</h2>
          </div>
          <div className="space-y-4">
            {howItWorks.map((step, i) => (
              <div key={i}
                className="flex gap-6 p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-lg hover:border-gray-200 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-brand flex items-center justify-center shrink-0">{step.icon}</div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{step.step}</p>
                  <h3 className="font-black text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Benefits */}
      <section className="py-14 bg-gray-50 border-t border-gray-100">
        <Container>
          <div className="max-w-xl mb-12">
            <p className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-3">Key points</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">What you get out of it.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b, i) => (
              <div key={i}
                className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-brand flex items-center justify-center mb-4">{b.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-12 bg-brand">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-white mb-4">Want to know when it opens near you?</h2>
          <p className="text-teal-50 text-lg mb-8">Leave your email and we will tell you when rides are running in your city.</p>
          <Link to="/#waitlist"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white text-brand font-black hover:bg-teal-50 transition-colors shadow-xl">
            Join the waitlist <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
