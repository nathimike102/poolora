import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Package, Clock, ShieldCheck, MapPin, Truck, Camera } from 'lucide-react';
import { Container } from '../../components/layout/Container';

const steps = [
  { icon: <Package className="w-6 h-6" />, step: '01', title: 'Describe the parcel', desc: 'What it is, roughly what it weighs, where it is going and by when.' },
  { icon: <Truck className="w-6 h-6" />, step: '02', title: 'A commuter picks it up', desc: 'The parcel is offered to drivers who have already published a journey in that direction.' },
  { icon: <ShieldCheck className="w-6 h-6" />, step: '03', title: 'Handover with a code', desc: 'You give the driver a one-time code at pickup, so the parcel only moves with the right person.' },
  { icon: <MapPin className="w-6 h-6" />, step: '04', title: 'Follow it on the way', desc: 'The recipient gets a tracking link that stops working once the parcel is delivered.' },
  { icon: <Camera className="w-6 h-6" />, step: '05', title: 'Delivery is proved', desc: 'A delivery photo and a code from the recipient are needed before the driver is paid.' },
];

const categories = [
  { label: 'Documents', weight: 'Envelope sized', example: 'Certificates, letters, paperwork', color: 'bg-blue-50 text-blue-700' },
  { label: 'Small package', weight: 'Fits on a seat', example: 'Books, clothes, accessories', color: 'bg-emerald-50 text-emerald-700' },
  { label: 'Medium package', weight: 'Fits in a boot', example: 'Electronics, household items', color: 'bg-orange-50 text-orange-700' },
];

export function ParcelPoolingPage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Hero */}
      <section className="relative pt-20 pb-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-gradient-to-bl from-emerald-100/60 via-teal-50/30 to-transparent rounded-full blur-3xl -z-10" />
        <Container>
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-semibold mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <div>
            <span className="inline-block px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold mb-6">
              Planned, not released
            </span>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-gray-900 tracking-tight leading-[1.04] mb-6">
              Parcel pooling.<br />
              <span className="text-emerald-700">Send it with someone already going.</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mb-10">
              The same idea as a shared seat, applied to a box. A commuter driving your parcel's route
              carries it, and the handover is confirmed with a code at both ends. This is how we intend
              it to work. It is not in the app yet.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/#waitlist"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors">
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
            Parcel pooling is not part of the first release. Everything on this page describes a
            planned feature, and nothing here can be booked yet.
          </p>
        </Container>
      </div>

      {/* Why we think this works */}
      <section className="py-12">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-emerald-800 uppercase tracking-widest mb-3">Why we are building it</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-tight mb-6">
              The car is going anyway. The boot is empty.
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              A courier sends a parcel through a sorting network. A commuter driving that same road
              has space and no extra journey to make, which is why we think this can be cheaper for
              the sender and worth the trouble for the driver.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We are not quoting prices for it. Until parcels are actually moving we have no idea what
              a driver will charge, and we would rather tell you that than make a number up.
            </p>
          </div>
        </Container>
      </section>

      {/* Parcel categories */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <Container>
          <p className="text-sm font-bold text-emerald-800 uppercase tracking-widest mb-8 text-center">Sizes we plan to support</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {categories.map((c, i) => (
              <div key={i} className={`${c.color.split(' ')[0]} border border-gray-100 rounded-2xl p-6`}>
                <Package className={`w-8 h-8 ${c.color.split(' ')[1]} mb-4`} />
                <h3 className="font-black text-gray-900 mb-1">{c.label}</h3>
                <p className="text-sm text-gray-700 mb-2">{c.weight}</p>
                <p className="text-xs text-gray-600">{c.example}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-14">
        <Container>
          <div className="max-w-xl mb-12">
            <p className="text-sm font-bold text-emerald-800 uppercase tracking-widest mb-3">Process</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">How it would work.</h2>
          </div>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i}
                className="flex gap-6 p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">{step.icon}</div>
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
      <section className="py-12 bg-emerald-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-white mb-4">We will tell you when this is real.</h2>
          <p className="text-emerald-50 text-lg mb-8">Join the waitlist and we will email you when parcel pooling is something you can actually use.</p>
          <Link to="/#waitlist"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white text-emerald-800 font-black hover:bg-emerald-50 transition-colors">
            Join the waitlist <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
