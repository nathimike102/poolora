import { UserPlus, Search, Car, ShieldCheck, Star } from 'lucide-react';
import { Container } from './layout/Container';
import { SectionHeading } from './common/SectionHeading';

const steps = [
  {
    icon: <UserPlus className="w-6 h-6" />,
    num: '01',
    title: 'Create an account',
    desc: 'Sign up with your phone number and a one-time code. There is no password to remember.',
  },
  {
    icon: <Search className="w-6 h-6" />,
    num: '02',
    title: 'Search your route',
    desc: 'Enter where you are going and when. Results are ranked by how close the pickup is and how well the time fits.',
  },
  {
    icon: <Car className="w-6 h-6" />,
    num: '03',
    title: 'Book a seat',
    desc: 'Pay the seat price the driver set. The driver confirms, and you can message each other in the app.',
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    num: '04',
    title: 'Travel with the safety tools on',
    desc: 'Share a live tracking link with someone you trust, and use SOS from inside the ride if you need it.',
  },
  {
    icon: <Star className="w-6 h-6" />,
    num: '05',
    title: 'Rate the trip',
    desc: 'Rider and driver rate each other afterwards, and those ratings show on future rides.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 bg-gray-50">
      <Container>

        <SectionHeading
          className="text-center max-w-2xl mx-auto mb-10"
          eyebrow="How it works"
          title="How booking a seat works."
          subtitle="Five steps, from signing up to rating the ride."
        />

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-[3.25rem] left-[calc(10%+2rem)] right-[calc(10%+2rem)] h-px bg-gradient-to-r from-gray-200 via-brand/30 to-gray-200" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-4">
            {steps.map((step, i) => (
              <div
                key={i}
                className="relative flex flex-col"
              >
                {/* Step circle */}
                <div className="relative z-10 w-16 h-16 mx-auto lg:mx-0 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center shadow-sm mb-5 group-hover:border-brand/30 transition-colors">
                  <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shadow-md">
                    {i + 1}
                  </div>
                  <div className="text-brand">{step.icon}</div>
                </div>

                <div className="text-center lg:text-left">
                  <p className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-1.5">{step.num}</p>
                  <h3 className="font-black text-gray-900 mb-2 tracking-tight">{step.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
