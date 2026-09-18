import { useMemo, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { COMPANY } from '../../config/company';
import { Container } from './layout/Container';

function FaqItem({
  q,
  a,
  isOpen,
  onToggle,
  id,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
  id: string;
}) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        >
          <span className={`font-bold text-sm sm:text-base leading-snug ${isOpen ? 'text-brand-dark' : 'text-gray-900'}`}>
            {q}
          </span>
          <span
            aria-hidden="true"
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOpen ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </span>
        </button>
      </h3>

      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} hidden={!isOpen}>
        <div className="px-6 pb-5 pt-0 border-t border-gray-100">
          <p className="text-gray-600 text-sm leading-relaxed pt-4">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  const faqs = useMemo(
    () => [
      {
        q: `What is ${COMPANY.name}?`,
        a: `${COMPANY.name} is a carpooling app for India. A driver who is already making a journey publishes it with the seats they can spare and the price per seat. Riders going the same way search for that route and book a seat. It is not a taxi service, so there are no professional drivers and no on-demand pickups.`,
      },
      {
        q: 'How is this different from a cab app?',
        a: 'A cab arrives when you ask for one and the app sets the fare. Here, you book a seat in a car that was making the trip anyway, at a time the driver chose and a price the driver set. That means fewer available rides than a cab app, and it works best for regular commutes where the route and timing repeat.',
      },
      {
        q: 'What safety features are in the app?',
        a: 'A driver can mark a ride as women-only, which means only women riders see and book it. During a ride you can hold the SOS button, which alerts our safety team and sends your emergency contacts a text message with a link to your live location. That link opens in any browser, so your contacts do not need the app. You chat inside the app, and phone numbers are shared only after a seat is confirmed.',
      },
      {
        q: 'How are drivers checked?',
        a: 'Before a driver can publish a ride they upload their driving licence, the vehicle registration certificate, insurance and a photo of the vehicle. Someone on our team reviews the documents and either approves the driver or sends them back with a reason. Riders and drivers rate each other after a trip.',
      },
      {
        q: 'How much does a seat cost?',
        a: 'The driver sets the price per seat for their journey, and that is what you pay. We do not add a booking fee to the rider. We have not launched, so we cannot tell you what a typical seat will cost until real rides are running.',
      },
      {
        q: 'How do payments work?',
        a: `You pay when you book, through UPI or a card, or from your ${COMPANY.name} wallet. If a ride is cancelled, by you within the allowed window or by the driver, you are refunded in full. The driver's share, after our platform fee, is worked out when the ride is marked complete. Bank payouts to drivers are part of the payment work we are still finishing.`,
      },
      {
        q: 'What are parcel pooling and trip pooling?',
        a: 'Parcel pooling would let you send a package with a commuter already heading that way, and trip pooling would let people share an intercity journey and split fuel and tolls. Both are designed and partly built, and neither is part of the first release. We will say so plainly here when they are ready.',
      },
      {
        q: 'When can I download the app?',
        a: `${COMPANY.name} has not launched. The app and the backend work end to end, and we are finishing payments, verification at scale and production hosting before submitting to the app stores. Join the waitlist and we will email you when it is available.`,
      },
    ],
    [],
  );

  return (
    <section id="faq" className="py-16 bg-gray-50">
      <Container>
        <div className="grid lg:grid-cols-[380px_1fr] gap-12 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-4">FAQ</p>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-[1.08] mb-5">
              Questions people<br />
              <span className="text-brand-dark">actually ask.</span>
            </h2>
            <p className="text-gray-600 text-base leading-relaxed mb-8">
              How booking works, what we check before a driver can drive, and where the product is
              right now.
            </p>
            <a
              href={`mailto:${COMPANY.emails.support}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-dark hover:underline"
            >
              Ask us something else
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FaqItem
                key={faq.q}
                id={`faq-${i}`}
                q={faq.q}
                a={faq.a}
                isOpen={openIndex === i}
                onToggle={() => toggle(i)}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
