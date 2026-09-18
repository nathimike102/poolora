import React, { useCallback, useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin, Mail, User, Car } from 'lucide-react';
import { Link } from 'react-router';
import { COMPANY } from '../../config/company';
import { Container } from './layout/Container';
import { Turnstile, turnstileEnabled } from './common/Turnstile';
import { submitContact } from '@/services/contact';

const cities = [
  'Hyderabad', 'Bangalore', 'Pune', 'Mumbai', 'Chennai',
  'Delhi / NCR', 'Kolkata', 'Ahmedabad', 'Other',
];

/** What joining the list actually gets you. Nothing here is a promise we cannot keep. */
const listPoints = [
  'An email when the app is available to download',
  'A say in which city we open first',
  'Nothing else. We do not sell or share your address.',
];

const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.78 3.59-.74 1.5.04 2.76.69 3.49 1.76-2.95 1.76-2.45 5.56.5 6.78-.71 1.76-1.57 3.32-2.66 4.37zm-3.83-13.6c-.19-1.89 1.35-3.66 3.19-3.86.35 2.11-1.6 3.84-3.19 3.86z" />
  </svg>
);

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]" aria-hidden="true">
    <path d="M3 20.5v-17c0-.83 1-1.3 1.7-.8l14 8.5c.7.4.7 1.5 0 1.9l-14 8.5c-.7.5-1.7.03-1.7-.1z" />
  </svg>
);

const storeBadges = [
  { name: 'App Store', Glyph: AppleGlyph },
  { name: 'Google Play', Glyph: PlayGlyph },
];

const fieldClass =
  'w-full bg-white/10 border border-white/25 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent text-sm';

export function Waitlist() {
  const [form, setForm] = useState({ name: '', email: '', city: '', role: '', consent: false, website: '' });
  const [token, setToken] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const onToken = useCallback((value: string) => setToken(value), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await submitContact({ type: 'waitlist', ...form, turnstileToken: token });
    setLoading(false);
    if (result.ok) setSubmitted(true);
    else setError(result.error ?? 'Something went wrong. Please try again.');
  };

  return (
    <section id="waitlist" className="py-16 bg-[#0A1A1D]">
      <Container>
        <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-center">
          <div>
            <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-white/20 bg-white/10 text-teal-200 text-sm font-bold mb-8">
              {COMPANY.name} is {COMPANY.launch.status.toLowerCase()}
            </p>

            <h2 className="text-4xl sm:text-5xl xl:text-6xl font-black text-white tracking-tight leading-[1.05] mb-6">
              Know when {COMPANY.name} opens in your city.
            </h2>

            <p className="text-white/75 text-lg leading-relaxed mb-10 max-w-lg">
              We are building in one city first and adding more as drivers sign up. Leave your
              email and we will tell you when you can actually book a ride.
            </p>

            <ul className="space-y-3.5">
              {listPoints.map(point => (
                <li key={point} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" aria-hidden="true" />
                  <span className="text-white/85 font-medium text-sm">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="bg-white/[0.07] border border-white/15 rounded-3xl p-8">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-white font-black text-xl mb-1">Join the waitlist</h3>
                    <p className="text-white/70 text-sm">Four fields, then you are done.</p>
                  </div>

                  <div className="relative">
                    <label htmlFor="wl-name" className="sr-only">Full name</label>
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" aria-hidden="true" />
                    <input id="wl-name" type="text" name="name" autoComplete="name" value={form.name}
                      onChange={handleChange} placeholder="Your full name" required className={fieldClass} />
                  </div>

                  <div className="relative">
                    <label htmlFor="wl-email" className="sr-only">Email address</label>
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" aria-hidden="true" />
                    <input id="wl-email" type="email" name="email" autoComplete="email" value={form.email}
                      onChange={handleChange} placeholder="you@example.com" required className={fieldClass} />
                  </div>

                  <div className="relative">
                    <label htmlFor="wl-city" className="sr-only">City</label>
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none z-10" aria-hidden="true" />
                    <select id="wl-city" name="city" value={form.city} onChange={handleChange} required
                      className={`${fieldClass} appearance-none cursor-pointer`} style={{ colorScheme: 'dark' }}>
                      <option value="" disabled className="bg-gray-900">Select your city</option>
                      {cities.map(city => (
                        <option key={city} value={city} className="bg-gray-900">{city}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <label htmlFor="wl-role" className="sr-only">How you would use Sanchari</label>
                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none z-10" aria-hidden="true" />
                    <select id="wl-role" name="role" value={form.role} onChange={handleChange} required
                      className={`${fieldClass} appearance-none cursor-pointer`} style={{ colorScheme: 'dark' }}>
                      <option value="" disabled className="bg-gray-900">I would use it as a...</option>
                      <option value="rider" className="bg-gray-900">Rider, booking a seat</option>
                      <option value="driver" className="bg-gray-900">Driver, offering seats</option>
                      <option value="both" className="bg-gray-900">Both</option>
                    </select>
                  </div>

                  {/* Honeypot. Hidden from people, tempting to bots. */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="wl-website">Leave this field empty</label>
                    <input id="wl-website" type="text" name="website" tabIndex={-1} autoComplete="off"
                      value={form.website} onChange={handleChange} />
                  </div>

                  <div className="flex items-start gap-2.5">
                    <input id="wl-consent" type="checkbox" required checked={form.consent}
                      onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-teal-400" />
                    <label htmlFor="wl-consent" className="text-xs text-white/75 leading-relaxed">
                      Email me when {COMPANY.name} launches. I can unsubscribe from any email, and my details
                      are handled as described in the{' '}
                      <Link to="/privacy" className="text-teal-200 underline">privacy policy</Link>.
                    </label>
                  </div>

                  {turnstileEnabled && <Turnstile onToken={onToken} theme="dark" />}

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-black transition-colors disabled:opacity-70">
                    {loading ? 'Sending...' : <>Join the waitlist <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                  </button>

                  {error ? (
                    <p role="alert" className="text-rose-200 text-xs text-center leading-relaxed">{error}</p>
                  ) : null}
                </form>
              ) : (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-5" aria-hidden="true" />
                  <h3 className="text-white font-black text-xl mb-2">You are on the list</h3>
                  <p className="text-white/75 text-sm leading-relaxed max-w-xs mx-auto">
                    Thank you, {form.name || 'and welcome'}. We will email {form.email} when
                    {COMPANY.name} is ready in {form.city}.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-7">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60 mb-3.5">
                Not on the app stores yet
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {storeBadges.map(({ name, Glyph }) => (
                  <div key={name}
                    className="flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-2.5">
                    <span className="text-white/90"><Glyph /></span>
                    <span className="text-left leading-tight">
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-white/60">
                        Not submitted yet
                      </span>
                      <span className="block text-sm font-bold text-white">{name}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
