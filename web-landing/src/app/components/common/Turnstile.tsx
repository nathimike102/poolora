import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget. Renders nothing unless VITE_TURNSTILE_SITE_KEY
 * is set at build time, so local development and previews work without it.
 * The token is written back through `onToken` and sent with the form.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const turnstileEnabled = Boolean(SITE_KEY);

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise(resolve => existing.addEventListener('load', () => resolve(), { once: true }));
  }

  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

export function Turnstile({ onToken, theme = 'light' }: { onToken: (token: string) => void; theme?: 'light' | 'dark' }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadScript().then(() => {
      if (cancelled || !hostRef.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(hostRef.current, {
        sitekey: SITE_KEY,
        theme,
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
  }, [onToken, theme]);

  if (!SITE_KEY) return null;
  return <div ref={hostRef} className="min-h-[65px]" />;
}
