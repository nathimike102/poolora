import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { siteConfig } from '../config/site';
import { pageMetaFor } from '../config/pages';

function setMeta(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
}

/**
 * Keeps the title, description, canonical URL and robots directive in step with
 * the route. A page that is not in the page list (such as the 404) is marked
 * noindex rather than inheriting the previous page's tags.
 */
export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = pageMetaFor(pathname);
    const title = meta?.title ?? `Page not found | ${siteConfig.name}`;
    const description = meta?.description ?? siteConfig.seo.description;
    const canonical = `${siteConfig.url}${meta ? meta.path : pathname}`;

    document.title = title;

    setMeta(
      'meta[name="description"]',
      () => Object.assign(document.createElement('meta'), { name: 'description' }),
      el => el.setAttribute('content', description),
    );
    setMeta(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
      el => el.setAttribute('href', canonical),
    );
    setMeta(
      'meta[name="robots"]',
      () => Object.assign(document.createElement('meta'), { name: 'robots' }),
      el => el.setAttribute('content', meta ? 'index, follow' : 'noindex, follow'),
    );
    setMeta(
      'meta[property="og:title"]',
      () => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'og:title');
        return el;
      },
      el => el.setAttribute('content', title),
    );
    setMeta(
      'meta[property="og:description"]',
      () => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'og:description');
        return el;
      },
      el => el.setAttribute('content', description),
    );
    setMeta(
      'meta[property="og:url"]',
      () => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'og:url');
        return el;
      },
      el => el.setAttribute('content', canonical),
    );
  }, [pathname]);
}
