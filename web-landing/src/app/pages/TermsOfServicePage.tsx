import { Link } from 'react-router';
import { ArrowLeft, FileText } from 'lucide-react';
import { COMPANY } from '../../config/company';
import { LEGAL } from '../../config/legal';

export function TermsOfServicePage() {
  const sections = [
    {
      title: '1. User Responsibilities',
      content: [
        {
          sub: 'Eligibility',
          text: `You must be at least 18 years old to create a ${COMPANY.name} account. By registering, you confirm that all information you provide is accurate, current, and complete. You are responsible for maintaining the confidentiality of your account credentials.`,
        },
        {
          sub: 'Prohibited Conduct',
          text: 'You agree not to: (a) impersonate any person or entity, (b) create false or misleading ride listings, (c) misuse the SOS or emergency alert system, (d) transport prohibited items, (e) engage in harassment, discrimination, or abuse of other users, (f) attempt to reverse-engineer, scrape, or disrupt the platform, or (g) use the platform for commercial transportation services without authorisation.',
        },
        {
          sub: 'Account Accuracy',
          text: 'You are responsible for keeping your profile, vehicle documents and contact details up to date. Expired or inaccurate documents may result in your account being suspended until you submit current ones.',
        },
      ],
    },
    {
      title: '2. Account Usage',
      content: [
        {
          sub: 'Account Creation',
          text: 'Accounts are personal and non-transferable. You may not share your account credentials or allow another person to use your account to offer or accept rides.',
        },
        {
          sub: 'OTP Authentication',
          text: `${COMPANY.name} uses mobile OTP for authentication. You are responsible for all activity conducted through your phone number. If you suspect your account has been compromised, contact ${COMPANY.emails.support} immediately.`,
        },
        {
          sub: 'One Account Per User',
          text: 'Accounts are tied to your phone number. Duplicate accounts may be merged or suspended.',
        },
      ],
    },
    {
      title: '3. Ride Sharing Guidelines',
      content: [
        {
          sub: 'Nature of Service',
          text: `${COMPANY.name} is a marketplace where private individuals share journeys they were already making in their own vehicles. Drivers are not professional commercial drivers, and ${COMPANY.name} is not a taxi or transport company.`,
        },
        {
          sub: 'Driver Obligations',
          text: "Drivers must maintain valid and current Driving License, Vehicle RC, Insurance, and PUC certificates at all times. Drivers must not offer more seats than the vehicle's legal seating capacity. Rides must start and end at declared locations.",
        },
        {
          sub: 'Rider Obligations',
          text: "Riders must be at the pickup location at the agreed time. Riders must not bring prohibited items (see prohibited items policy in-app). Riders must treat drivers and co-passengers with respect.",
        },
        {
          sub: 'Cancellations',
          text: 'A booking cancelled before the ride is completed, by either the rider or the driver, is refunded in full. We do not charge a cancellation fee. Repeated no-shows may lead to restrictions on your account.',
        },
      ],
    },
    {
      title: '4. Payments',
      content: [
        {
          sub: 'Pricing',
          text: `The driver sets the price per seat, and you see it before you confirm. ${COMPANY.name} takes a platform fee out of the driver's share of a completed ride. No booking fee is added to the rider's price.`,
        },
        {
          sub: 'When money moves',
          text: `You pay when you book, through our payment provider. The driver's share is calculated when the ride is marked complete, so a ride that never happens is refunded rather than paid out.`,
        },
        {
          sub: 'Refunds',
          text: `A refund is sent back to the payment method you used. How long it takes to appear is decided by your bank or payment provider, not by us. If a refund does not arrive, email ${COMPANY.emails.support} and we will chase it.`,
        },
        {
          sub: 'Tax',
          text: 'Drivers are responsible for declaring what they earn. Where Indian law requires us to deduct tax at source or to report earnings, we will do so and tell the driver what was deducted.',
        },
      ],
    },
    {
      title: '5. Liability Limitations',
      content: [
        {
          sub: 'Platform Role',
          text: `${COMPANY.name} is a technology platform connecting private vehicle owners with commuters. ${COMPANY.name} does not own or operate vehicles, employ drivers, or guarantee the outcome of any specific ride, parcel delivery, or trip.`,
        },
        {
          sub: 'Safety Incidents',
          text: `We check driver documents before a first ride and provide SOS, emergency contact alerts and live tracking. These reduce risk. They cannot prevent every incident, and we do not claim otherwise. If something happens, we will cooperate with you and with the police.`,
        },
        {
          sub: 'Service Availability',
          text: `${COMPANY.name} is provided as it is. Maintenance and outages will interrupt it from time to time, and we do not promise a particular level of availability.`,
        },
        {
          sub: 'Liability Cap',
          text: `To the maximum extent permitted by applicable law, ${COMPANY.name}'s total liability for any claim arising from use of the platform shall not exceed the amount paid by the user in the 3 months preceding the claim.`,
        },
      ],
    },
    {
      title: '6. Account Suspension',
      content: [
        {
          sub: 'Grounds for Suspension',
          text: `${COMPANY.name} may suspend or close an account for: (a) expired or forged documents, (b) repeated safety complaints, (c) misuse of the SOS system, (d) harassment or discrimination, (e) fraudulent payment activity, or (f) any other breach of these terms.`,
        },
        {
          sub: 'Notice',
          text: `We will tell you why your account was suspended, except where telling you would interfere with an investigation. Where there is an immediate safety risk or suspected fraud, suspension takes effect at once.`,
        },
        {
          sub: 'Appeal',
          text: `If you think a suspension was wrong, email ${COMPANY.emails.support} within 30 days and a person will review it.`,
        },
      ],
    },
    {
      title: '7. Dispute Resolution',
      content: [
        {
          sub: 'Raise it with us first',
          text: 'Most disagreements about a fare or a trip can be settled by our support team. Send us what you have, such as photos, the in-app chat or the trip details, and we will look at both sides.',
        },
        {
          sub: 'If that does not settle it',
          text: `Email ${COMPANY.emails.contact} and we will review the decision. We will tell you the outcome and the reason for it.`,
        },
        {
          sub: 'Governing Law',
          text: `These Terms are governed by the laws of India. Any legal disputes shall be subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana.`,
        },
        {
          sub: 'Arbitration',
          text: 'Both parties agree to attempt good-faith resolution before initiating formal legal proceedings. Where required, arbitration shall be conducted per the Arbitration and Conciliation Act, 1996.',
        },
      ],
    },
    {
      title: '8. Contact Information',
      content: [
        {
          sub: 'General Support',
          text: `${COMPANY.emails.support} for anything about an account, a booking or a payment.`,
        },
        {
          sub: 'Legal and privacy',
          text: `${COMPANY.emails.contact} for these terms, the privacy policy and compliance enquiries.`,
        },
        {
          sub: 'Investors',
          text: `${COMPANY.emails.investors} for funding and partnership enquiries.`,
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

          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center" aria-hidden="true">
                <FileText className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-700 uppercase tracking-widest">Legal</p>
                <p className="text-xs text-gray-600">Last updated {LEGAL.termsUpdated}</p>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-5">
              Terms of service
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
              Using {COMPANY.name} means agreeing to these terms. They are written to be read, so if
              something here is unclear, tell us and we will fix the wording.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Table of contents */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-12">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-4">Contents</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {sections.map((s, i) => (
                <a key={i} href={`#section-${i}`} className="text-sm text-gray-700 hover:text-brand-dark transition-colors py-0.5">
                  {s.title}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-12">
            {sections.map((sec, i) => (
              <div key={i} id={`section-${i}`}>
                <h2 className="text-2xl font-black text-gray-900 mb-6 pb-3 border-b border-gray-200">{sec.title}</h2>
                <div className="space-y-5">
                  {sec.content.map((c, j) => (
                    <div key={j}>
                      <h3 className="font-bold text-gray-900 mb-1.5">{c.sub}</h3>
                      <p className="text-gray-700 leading-relaxed text-sm">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 p-6 bg-gray-50 border border-gray-100 rounded-2xl">
            <p className="text-sm font-bold text-gray-700 mb-1">Questions about these terms?</p>
            <p className="text-sm text-gray-700">Email <a href={`mailto:${COMPANY.emails.contact}`} className="text-brand-dark font-semibold hover:underline">{COMPANY.emails.contact}</a> or visit our <Link to="/privacy" className="text-brand-dark font-semibold hover:underline">Privacy Policy</Link>.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
