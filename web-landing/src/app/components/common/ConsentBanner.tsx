import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { siteConfig } from '../../../config/site';
import { needsDecision, setConsent, type ConsentChoice } from '../../../services/consent';

/**
 * Asks once, at the bottom of the page, and only when there is something to
 * ask about: a visitor sending Global Privacy Control, or one who has already
 * answered, never sees it. With no analytics id configured there is nothing
 * non-essential to load, so the banner stays hidden.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (siteConfig.analytics.googleAnalyticsId && needsDecision()) setVisible(true);
  }, []);

  if (!visible) return null;

  const decide = (choice: ConsentChoice) => {
    setConsent(choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="consent-heading"
      className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl bg-white border border-gray-300 rounded-2xl shadow-lg p-5 sm:p-6">
        <h2 id="consent-heading" className="font-black text-gray-900 mb-2">
          Can we measure how this site is used?
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">
          We would like to load Google Analytics to see which pages people read. It is not needed for
          the site to work, so it stays off until you say yes. Read the{' '}
          <Link to="/privacy" className="text-brand-dark font-semibold underline">privacy policy</Link>.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => decide('granted')}
            className="px-5 py-2.5 rounded-lg bg-brand text-white font-bold text-sm hover:bg-brand-dark transition-colors"
          >
            Yes, that's fine
          </button>
          <button
            type="button"
            onClick={() => decide('denied')}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-800 font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
