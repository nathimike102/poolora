import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Calendar, MapPin, Map, Fuel, Clock, Mountain } from 'lucide-react';
import {
  TripPoolingIcon,
  UserGroupIcon,
  SafetyShieldIcon,
} from '../../components/icons/PooloraIcons';
import { Container } from '../../components/layout/Container';

const steps = [
  { icon: <TripPoolingIcon />, step: '01', title: 'Post the journey', desc: 'Where you are going, which days, and how many people can come along.' },
  { icon: <UserGroupIcon />, step: '02', title: 'Find people going too', desc: 'Browse journeys others have posted, or wait for people to join yours.' },
  { icon: <SafetyShieldIcon />, step: '03', title: 'Agree the split first', desc: 'Fuel and tolls divided by the number of travellers, shown and accepted before anyone commits.' },
  { icon: <MapPin className="w-6 h-6" />, step: '04', title: 'Keep the plan in one place', desc: 'Stops and timings visible to everyone on the trip, so nobody is working from a different message thread.' },
  { icon: <Fuel className="w-6 h-6" />, step: '05', title: 'Settle at the end', desc: 'Pay your share through the app instead of working it out in cash at a petrol pump.' },
];

const tripTypes = [
  { label: 'Weekend getaway', icon: <Mountain className="w-5 h-5" />, example: 'A hill station and back', color: 'bg-orange-50 text-orange-700' },
  { label: 'Pilgrimage', icon: <MapPin className="w-5 h-5" />, example: 'A temple town, there and back in a day', color: 'bg-amber-50 text-amber-800' },
  { label: 'Long weekend', icon: <Calendar className="w-5 h-5" />, example: 'Three or four days away', color: 'bg-rose-50 text-rose-700' },
  { label: 'Multi-city', icon: <Map className="w-5 h-5" />, example: 'Several stops on one route', color: 'bg-teal-50 text-teal-800' },
];

export function TripPoolingPage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Hero */}
      <section className="relative pt-20 pb-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-[650px] h-[550px] bg-gradient-to-bl from-orange-100/60 via-amber-50/30 to-transparent rounded-full blur-3xl -z-10" />
        <Container>
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-semibold mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <div>
            <span className="inline-block px-4 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm font-bold mb-6">
              Designed, not built
            </span>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-gray-900 tracking-tight leading-[1.04] mb-6">
              Trip pooling.<br />
              <span className="text-orange-700">One long drive, split four ways.</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mb-10">
              An intercity trip costs the same whether one person or four make it. This is the plan for
              sharing that cost properly, with the split agreed before anyone gets in the car. It is the
              last of the three modes we intend to build.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/#waitlist"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-orange-700 text-white font-bold hover:bg-orange-800 transition-colors">
                Join the waitlist <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/features/ride-pooling"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 transition-colors">
                See what is built today
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Phase notice */}
      <div className="bg-amber-50 border-y border-amber-100 py-4">
        <Container className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-amber-900 text-sm font-semibold">
            Trip pooling exists as a design, not as working software. Nothing on this page can be
            booked, and we will change this notice when that stops being true.
          </p>
        </Container>
      </div>

      {/* Trip types */}
      <section className="py-12">
        <Container>
          <div className="max-w-xl mb-12">
            <p className="text-sm font-bold text-orange-800 uppercase tracking-widest mb-3">What it is for</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">
              The journeys we have in mind.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            {tripTypes.map((t, i) => (
              <div key={i}
                className={`${t.color.split(' ')[0]} border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all`}>
                <div className={`w-10 h-10 rounded-xl bg-white/60 ${t.color.split(' ')[1]} flex items-center justify-center mb-4`}>
                  {t.icon}
                </div>
                <h3 className="font-black text-gray-900 mb-1">{t.label}</h3>
                <p className="text-xs text-gray-700">{t.example}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* How the split would work */}
      <section className="py-16 bg-gray-50 border-y border-gray-200">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-orange-800 uppercase tracking-widest mb-3">The cost split</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-tight mb-6">
              Fuel and tolls, divided by the people in the car.
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The driver enters what the fuel and tolls are expected to come to. Everyone sees the same
              figure and the same division before they agree to come, and the app settles it afterwards
              so nobody has to chase anyone for cash.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We are not publishing example routes with rupee figures. Fuel prices, vehicles and tolls
              vary too much for a made-up table to tell you anything useful.
            </p>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-14">
        <Container>
          <div className="max-w-xl mb-12">
            <p className="text-sm font-bold text-orange-800 uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">How it would work.</h2>
          </div>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i}
                className="flex gap-6 p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">{step.icon}</div>
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

      {/* CTA */}
      <section className="py-12 bg-orange-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-white mb-4">We will tell you when this is real.</h2>
          <p className="text-orange-50 text-lg mb-8">Join the waitlist and we will email you when trip pooling is something you can actually use.</p>
          <Link to="/#waitlist"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white text-orange-800 font-black hover:bg-orange-50 transition-colors">
            Join the waitlist <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
