import { Link } from 'react-router';
import { ArrowLeft, Shield } from 'lucide-react';
import { COMPANY } from '../../config/company';
import { LEGAL } from '../../config/legal';

/**
 * Written to match what the product actually does today. If a service is added
 * or a practice changes, change this page and LEGAL.privacyUpdated in the same
 * commit. This is a plain-language policy, not legal advice, and it should be
 * reviewed by a lawyer before launch.
 */
export function PrivacyPolicyPage() {
  const sections = [
    {
      title: '1. Who we are',
      content: [
        {
          sub: 'The people responsible for your data',
          text: `${COMPANY.name} is a carpooling service in development, run from ${COMPANY.address}. We decide what personal data is collected and why, which under the Digital Personal Data Protection Act, 2023 makes us the data fiduciary. You can reach us at ${COMPANY.emails.contact}.`,
        },
        {
          sub: 'What this policy covers',
          text: 'This website and the Poolora mobile app. The app has not launched publicly, so at the moment the only personal data most people give us is what they type into the waitlist or investor form on this site.',
        },
      ],
    },
    {
      title: '2. What we collect on this website',
      content: [
        {
          sub: 'Forms',
          text: 'The waitlist form asks for your name, email address, city and whether you would ride or drive. The investor form asks for your name, organisation, email address, the stage you invest at and an optional message. We send that to ourselves by email so we can reply.',
        },
        {
          sub: 'Campaign parameters',
          text: 'If you arrive from a link with utm_ parameters, or from another website, we keep those values for the length of your browser session and attach them to a form you submit, so we know which link brought you here. They are stored in your browser, not in a cookie, and are cleared when you close the tab.',
        },
        {
          sub: 'Anti-spam',
          text: 'If Cloudflare Turnstile is enabled on a form, Cloudflare receives technical signals from your browser to judge whether the submission is automated. Cloudflare acts as our processor for that check.',
        },
        {
          sub: 'Analytics',
          text: 'We load analytics only after you accept it in the cookie banner, and not at all if your browser sends a Global Privacy Control signal. Decline, and no analytics script is loaded and no analytics cookie is set.',
        },
      ],
    },
    {
      title: '3. What the app will collect',
      content: [
        {
          sub: 'Your account',
          text: 'Your name, mobile number (confirmed with a one-time code), email address if you give one, and a profile photo if you upload one.',
        },
        {
          sub: 'Driver documents',
          text: 'To offer rides you upload your driving licence, the vehicle registration certificate, insurance and a photo of the vehicle, plus the licence and vehicle details. A member of our team looks at these to approve or reject you. We do not collect Aadhaar and we are not connected to DigiLocker.',
        },
        {
          sub: 'Location',
          text: 'Your pickup and drop-off points when you search or publish a ride, and your live location during an active ride so the trip can be tracked. If you trigger SOS, your location is included in the alert sent to your emergency contacts.',
        },
        {
          sub: 'Emergency contacts',
          text: 'The names and phone numbers you add, up to five. We use them only to send an SOS alert, which means those numbers reach our SMS provider at that moment.',
        },
        {
          sub: 'Payments',
          text: `Payments are handled by Razorpay. We never see or store your card number or UPI PIN. We keep the payment reference, amount, status and any refund record for accounting and for sorting out disputes.`,
        },
        {
          sub: 'Messages and ratings',
          text: 'Messages you send in the app about a booking, and the rating and any comment you leave after a trip.',
        },
        {
          sub: 'Technical data',
          text: 'Device type, operating system version, app version and crash reports, which we use to find and fix faults.',
        },
      ],
    },
    {
      title: '4. Why we use it',
      content: [
        {
          sub: 'To run the service',
          text: 'Matching a rider with a driver going the same way, taking payment, letting you message each other, and settling what the driver is owed.',
        },
        {
          sub: 'To keep people safe',
          text: 'Checking driver documents before a first ride, sending SOS alerts, and providing the tracking link your contacts can open.',
        },
        {
          sub: 'To fix and improve the product',
          text: 'Crash reports and error logs, and, where you have agreed to analytics, aggregate usage patterns.',
        },
        {
          sub: 'To reply to you',
          text: 'Answering an enquiry you send us, and emailing you about the launch if you asked us to.',
        },
      ],
    },
    {
      title: '5. Who else sees it',
      content: [
        {
          sub: 'Other users',
          text: 'A driver sees the name, photo and rating of a rider who books, and a rider sees the same for the driver. Phone numbers are exchanged only after a booking is confirmed.',
        },
        {
          sub: 'Your emergency contacts',
          text: 'Only when you trigger SOS. They receive a text message with a link showing your live location for that trip.',
        },
        {
          sub: 'Service providers',
          text: 'Razorpay for payments, Twilio for SMS, Google Firebase for push notifications and sign-in, Google Maps for routing and maps, Amazon Web Services for hosting and file storage, and Sentry for error reports. Each one only receives what it needs to do its job.',
        },
        {
          sub: 'Nobody else',
          text: 'We do not sell personal data, and we do not share it for someone else’s advertising.',
        },
      ],
    },
    {
      title: '6. Where it is stored and for how long',
      content: [
        {
          sub: 'Storage',
          text: 'Our database and uploaded documents are hosted on Amazon Web Services, configured to the Mumbai region (ap-south-1). Some of the providers above process data outside India under their own terms.',
        },
        {
          sub: 'Retention',
          text: 'Waitlist and enquiry details are kept until you ask us to remove them. Account data is kept while your account exists. Payment and tax records are kept for as long as Indian tax law requires. Driver documents are kept while the driver is approved and deleted when the account is closed.',
        },
        {
          sub: 'Security',
          text: 'Traffic is encrypted with HTTPS. Documents are held in private storage and opened through links that expire after a few minutes. Access to personal data is limited to the people who need it, and passwords, tokens and keys are never stored in readable form.',
        },
      ],
    },
    {
      title: '7. Your choices',
      content: [
        {
          sub: 'See, correct or delete your data',
          text: `Email ${COMPANY.emails.contact} and we will send you a copy of what we hold, correct it, or delete it. We aim to reply within 30 days. Once the app is live you will also be able to edit your profile and close your account in the app.`,
        },
        {
          sub: 'Marketing email',
          text: 'Every marketing email has an unsubscribe link, and a one-click unsubscribe header your mail app can use. Unsubscribing does not stop the emails you need in order to use the service, such as a booking confirmation.',
        },
        {
          sub: 'Tracking',
          text: 'You can change your cookie choice at any time from the link in the footer. We honour the Global Privacy Control signal, so if your browser sends it we treat analytics as declined without asking.',
        },
        {
          sub: 'Complaints',
          text: 'If you think we have handled your data badly, tell us first so we can put it right. You may also complain to the Data Protection Board of India.',
        },
      ],
    },
    {
      title: '8. Children',
      content: [
        {
          sub: 'Age',
          text: `${COMPANY.name} is for adults. We do not knowingly collect data from anyone under 18. If you believe a child has given us data, email ${COMPANY.emails.contact} and we will delete it.`,
        },
      ],
    },
    {
      title: '9. Changes to this policy',
      content: [
        {
          sub: 'How we tell you',
          text: 'When this policy changes we update the date at the top of the page. If a change materially affects how we use your data, we will email account holders before it takes effect.',
        },
      ],
    },
  ];

  return (
    <div className="bg-white min-h-screen font-sans">
      <section className="pt-20 pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-semibold mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 flex items-center justify-center" aria-hidden="true">
              <Shield className="w-5 h-5 text-brand-dark" />
            </div>
            <div>
              <p className="text-xs font-black text-brand-dark uppercase tracking-widest">Legal</p>
              <p className="text-xs text-gray-600">Last updated {LEGAL.privacyUpdated}</p>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-5">
            Privacy policy
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
            What we collect, why, who else sees it, and how to get it back or get rid of it. Written
            in plain words, and kept in step with what the product actually does.
          </p>
        </div>
      </section>

      <section className="pb-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {sections.map(sec => (
              <div key={sec.title}>
                <h2 className="text-2xl font-black text-gray-900 mb-6 pb-3 border-b border-gray-200">{sec.title}</h2>
                <div className="space-y-5">
                  {sec.content.map(c => (
                    <div key={c.sub}>
                      <h3 className="font-bold text-gray-900 mb-1.5">{c.sub}</h3>
                      <p className="text-gray-700 leading-relaxed text-sm">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 p-6 bg-teal-50 border border-teal-200 rounded-2xl">
            <p className="text-sm font-bold text-brand-dark mb-1">Questions about this policy?</p>
            <p className="text-sm text-gray-700">
              Email{' '}
              <a href={`mailto:${COMPANY.emails.contact}`} className="text-brand-dark font-semibold hover:underline">
                {COMPANY.emails.contact}
              </a>
              . A person reads it, so give us a few days.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
