import { Link } from 'react-router';
import { CheckCircle2, Clock, Circle, ArrowRight } from 'lucide-react';
import { COMPANY } from '../../config/company';
import { Container } from './layout/Container';

type MilestoneState = 'done' | 'progress' | 'upcoming';

interface Milestone {
  label: string;
  detail: string;
  state: MilestoneState;
}

/**
 * Build status, written from what is actually in the codebase. Update this list
 * when the state of the work changes rather than adding dates or projections.
 */
const milestones: Milestone[] = [
  {
    label: 'Backend API',
    detail: 'Node.js and Express with MongoDB and Redis, covered by an automated test suite.',
    state: 'done',
  },
  {
    label: 'Accounts and sign-in',
    detail: 'Phone number sign-in with a one-time password, and separate rider and driver profiles.',
    state: 'done',
  },
  {
    label: 'Ride pooling',
    detail: 'Publishing a ride, searching by route and time, booking a seat, cancelling and refunding.',
    state: 'done',
  },
  {
    label: 'Safety features',
    detail: 'SOS, emergency contacts, SMS alerts and a tracking link that opens in any browser.',
    state: 'done',
  },
  {
    label: 'Driver verification',
    detail: 'Document upload from the app and a review queue where our team approves or rejects.',
    state: 'done',
  },
  {
    label: 'In-app chat',
    detail: 'Rider and driver can message each other once a seat is confirmed.',
    state: 'done',
  },
  {
    label: 'Payments',
    detail: 'Razorpay checkout, wallet and refunds are built. Live merchant approval is pending.',
    state: 'progress',
  },
  {
    label: 'Mobile app release',
    detail: 'The React Native app runs end to end. Store submission has not started.',
    state: 'progress',
  },
  {
    label: 'Production deployment',
    detail: 'Container and Kubernetes manifests exist. Nothing is running in production yet.',
    state: 'progress',
  },
  {
    label: 'Parcel pooling',
    detail: 'Groundwork is in the backend. Not part of the first release.',
    state: 'upcoming',
  },
  {
    label: 'Trip pooling',
    detail: 'Design only. Planned after parcel pooling.',
    state: 'upcoming',
  },
];

const legend: { state: MilestoneState; label: string }[] = [
  { state: 'done', label: 'Built' },
  { state: 'progress', label: 'In progress' },
  { state: 'upcoming', label: 'Not started' },
];

interface BuildStatusProps {
  variant?: 'light' | 'dark';
}

export function BuildStatus({ variant = 'light' }: BuildStatusProps) {
  const isDark = variant === 'dark';

  const stateIcon = (state: MilestoneState) => {
    if (state === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />;
    if (state === 'progress') {
      return <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-amber-300' : 'text-brand'}`} />;
    }
    return <Circle className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-600'}`} />;
  };

  return (
    <section
      id="build-status"
      className={isDark ? 'py-14 border-t border-white/10 bg-white/[0.03]' : 'py-16 bg-white'}
    >
      <Container>
        <div className="max-w-2xl mb-10">
          <p className={`text-sm font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-amber-300' : 'text-brand'}`}>
            Build status
          </p>
          <h2
            className={`text-4xl sm:text-5xl font-black tracking-tight leading-[1.08] mb-5 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Where the product stands today.
          </h2>
          <p className={`text-lg leading-relaxed ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
            {COMPANY.name} is in development and has not launched. This list is kept current so
            that what you read here matches what the app can actually do.
          </p>
        </div>

        <div
          className={`rounded-3xl p-6 sm:p-8 ${isDark ? 'bg-white/[0.05] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {milestones.map(m => (
              <li key={m.label} className="flex gap-3">
                {stateIcon(m.state)}
                <div>
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.label}</p>
                  <p className={`text-sm leading-relaxed ${isDark ? 'text-white/65' : 'text-gray-600'}`}>{m.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <div
            className={`flex flex-wrap gap-5 mt-7 pt-5 border-t text-xs ${isDark ? 'border-white/15 text-white/70' : 'border-gray-200 text-gray-600'}`}
          >
            {legend.map(l => (
              <span key={l.state} className="flex items-center gap-1.5">
                {stateIcon(l.state)} {l.label}
              </span>
            ))}
          </div>
        </div>

        {!isDark && (
          <p className="mt-6 text-sm text-gray-600">
            Looking at {COMPANY.name} as an investor?{' '}
            <Link to="/investors" className="inline-flex items-center gap-1 text-brand font-semibold hover:underline">
              What we can share <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </p>
        )}
      </Container>
    </section>
  );
}
