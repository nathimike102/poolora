import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Building2, Mail, User, CheckCircle2, Briefcase, ChevronDown } from 'lucide-react';
import { Turnstile, turnstileEnabled } from '../components/common/Turnstile';
import { BuildStatus } from '../components/BuildStatus';
import { COMPANY } from '../../config/company';
import { Container } from '../components/layout/Container';
import { submitContact } from '@/services/contact';

const investorRanges = ['Angel', 'Pre-seed', 'Seed', 'Strategic or corporate', 'Just exploring'];

function InvestorForm() {
  const [form, setForm] = useState({
    name: '',
    org: '',
    email: '',
    range: '',
    message: '',
    consent: false,
    website: '',
  });
  const [token, setToken] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const onToken = useCallback((value: string) => setToken(value), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await submitContact({ type: 'investor', ...form, turnstileToken: token });
    setLoading(false);
    if (result.ok) setSubmitted(true);
    else setError(result.error ?? 'Something went wrong. Please try again.');
  };

  const field =
    'w-full bg-gray-50 border border-gray-300 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm';

  if (submitted) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-lg">
        <div className="py-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-5" />
          <h3 className="text-gray-900 font-black text-xl mb-2">Message received</h3>
          <p className="text-gray-600 text-sm max-w-xs mx-auto leading-relaxed">
            Thank you, {form.name}. We will reply to {form.email} once we have read it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="mb-6">
          <h2 className="text-gray-900 font-black text-xl mb-1">Get in touch</h2>
          <p className="text-gray-600 text-sm">
            Tell us a little about your fund and what you would like to see. We share materials on request.
          </p>
        </div>

        <div className="relative">
          <label htmlFor="inv-name" className="sr-only">Full name</label>
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input id="inv-name" name="name" type="text" required autoComplete="name" value={form.name} onChange={handle}
            placeholder="Your full name" className={field} />
        </div>

        <div className="relative">
          <label htmlFor="inv-org" className="sr-only">Fund or organisation</label>
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input id="inv-org" name="org" type="text" required autoComplete="organization" value={form.org} onChange={handle}
            placeholder="Fund or organisation" className={field} />
        </div>

        <div className="relative">
          <label htmlFor="inv-email" className="sr-only">Email address</label>
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input id="inv-email" name="email" type="email" required autoComplete="email" value={form.email} onChange={handle}
            placeholder="you@fund.com" className={field} />
        </div>

        <div className="relative">
          <label htmlFor="inv-range" className="sr-only">Typical cheque size</label>
          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
          <select id="inv-range" name="range" required value={form.range} onChange={handle}
            className={`${field} appearance-none cursor-pointer`}>
            <option value="" disabled>Stage you invest at</option>
            {investorRanges.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div>
          <label htmlFor="inv-message" className="sr-only">Message</label>
          <textarea id="inv-message" name="message" value={form.message} onChange={handle} rows={3}
            placeholder="What would you like to know? (optional)"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl py-3.5 px-4 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-sm resize-none" />
        </div>

        {/* Honeypot. Hidden from people, tempting to bots. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="inv-website">Leave this field empty</label>
          <input id="inv-website" name="website" type="text" tabIndex={-1} autoComplete="off"
            value={form.website} onChange={handle} />
        </div>

        <div className="flex items-start gap-2.5">
          <input
            id="inv-consent"
            name="consent"
            type="checkbox"
            required
            checked={form.consent}
            onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))}
            className="mt-0.5 w-4 h-4 accent-brand"
          />
          <label htmlFor="inv-consent" className="text-xs text-gray-600 leading-relaxed">
            I agree that {COMPANY.name} may contact me about this enquiry and store these details, as described in
            the <Link to="/privacy" className="text-brand underline">privacy policy</Link>.
          </label>
        </div>

        {turnstileEnabled && <Turnstile onToken={onToken} />}

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-black transition-colors disabled:opacity-70">
          {loading ? 'Sending...' : <>Send enquiry <ArrowRight className="w-4 h-4" /></>}
        </button>

        {error ? <p role="alert" className="text-rose-700 text-xs text-center">{error}</p> : null}
      </form>
    </div>
  );
}

/** Points that can be checked against the product or the codebase. */
const thesis = [
  {
    title: 'A scheduled trip, not a taxi hail',
    desc: 'Drivers publish journeys they are already making. There is no fleet, no vehicle ownership and no driver supply to subsidise.',
  },
  {
    title: 'Safety built into the first release',
    desc: 'Women-only rides, SOS, emergency contacts and a public tracking link are in the product now, not on a roadmap.',
  },
  {
    title: 'Revenue from completed rides',
    desc: 'A platform fee is taken from the driver payout on a completed ride. Riders pay the seat price the driver set.',
  },
  {
    title: 'Two further modes designed, not shipped',
    desc: 'Parcel pooling and trip pooling reuse the same matching and payments layer. Both are clearly marked as not yet released.',
  },
];

export function InvestorPage() {
  return (
    <div className="bg-white text-gray-900 min-h-screen font-sans">
      <section className="pt-20 pb-12">
        <Container>
          <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-semibold mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight mb-6 text-gray-900">
                For investors looking<br />at {COMPANY.name}.
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed mb-6 max-w-lg">
                We are a small team building a carpooling app for India, with safety tools in the
                product from day one. We have not launched, so there are no ride numbers or revenue
                to show yet.
              </p>
              <p className="text-gray-600 text-base leading-relaxed max-w-lg">
                What we can walk you through is the product, the build status below, how we plan to
                earn money, and what we would use funding for. Ask us and we will send it.
              </p>
            </div>

            <InvestorForm />
          </div>
        </Container>
      </section>

      <section className="py-14 border-t border-gray-200">
        <Container>
          <div className="mb-8">
            <p className="text-brand text-sm font-bold uppercase tracking-widest mb-3">The case</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.08] mb-4 text-gray-900">
              What the product is, in four points.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {thesis.map(r => (
              <div key={r.title} className="bg-gray-50 border border-gray-200 rounded-2xl p-7">
                <h3 className="font-black text-gray-900 text-lg mb-2">{r.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <BuildStatus variant="light" />
    </div>
  );
}
