import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { siteConfig } from './src/config/site'
import { COMPANY } from './src/config/company'
import { PAGES } from './src/config/pages'

/**
 * Injects the head tags that must exist before React runs: the default title
 * and description, Open Graph defaults, the favicon and the Organization
 * structured data. Per-page titles, descriptions and canonicals are then kept
 * in step with the route by `src/app/usePageMeta.ts`.
 *
 * Analytics is NOT injected here. It loads only after the visitor accepts it
 * (see `src/services/consent.ts`).
 */
function htmlSeoMeta() {
  const { seo, themeColor, url, name } = siteConfig

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY.name,
    url,
    logo: `${url}/apple-touch-icon.png`,
    email: COMPANY.emails.contact,
    telephone: COMPANY.phone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Surampalem',
      addressRegion: 'Andhra Pradesh',
      addressCountry: 'IN',
    },
    founder: { '@type': 'Person', name: COMPANY.founder.name },
    description: COMPANY.description,
  }

  const organizationJson = JSON.stringify(organization)

  return {
    name: 'html-seo-meta',
    /**
     * The structured-data block is an inline script, so the CSP in vercel.json
     * carries its sha256. Change the organization details and this check tells
     * you the new hash to paste in, instead of shipping a page whose structured
     * data the browser blocks.
     */
    buildStart() {
      const hash = `sha256-${crypto.createHash('sha256').update(organizationJson).digest('base64')}`
      const vercelPath = path.resolve(__dirname, 'vercel.json')
      if (!fs.existsSync(vercelPath)) return
      const config = fs.readFileSync(vercelPath, 'utf8')
      if (!config.includes(hash)) {
        throw new Error(
          `The JSON-LD block changed. Put this hash in the script-src of vercel.json: '${hash}'`,
        )
      }
    },
    transformIndexHtml() {
      const tags: any[] = [
        { tag: 'title', children: seo.title, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'description', content: seo.description }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: themeColor }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: 'any' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/favicon-32.png', sizes: '32x32' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:site_name', content: name }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:title', content: seo.title }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:description', content: seo.description }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:locale', content: seo.locale }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:title', content: seo.title }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:description', content: seo.description }, injectTo: 'head' },
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: organizationJson,
          injectTo: 'head',
        },
      ]
      if (seo.ogImage) {
        tags.push(
          { tag: 'meta', attrs: { property: 'og:image', content: seo.ogImage }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: seo.ogImage }, injectTo: 'head' },
        )
      }
      if (seo.twitterHandle) {
        tags.push({ tag: 'meta', attrs: { name: 'twitter:site', content: seo.twitterHandle }, injectTo: 'head' })
      }
      return tags
    },
  }
}

/**
 * Writes robots.txt and sitemap.xml into the build output. `lastmod` comes from
 * the `updated` field each page carries in src/config/pages.ts, so it reflects
 * a real content change rather than the time of the last deploy.
 */
function robotsAndSitemap() {
  const { url } = siteConfig
  return {
    name: 'robots-and-sitemap',
    apply: 'build' as const,
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      fs.mkdirSync(outDir, { recursive: true })

      const robots = [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${url}/sitemap.xml`,
        '',
      ].join('\n')
      fs.writeFileSync(path.join(outDir, 'robots.txt'), robots)

      const urls = PAGES.map(
        p => `  <url>
    <loc>${url}${p.path === '/' ? '/' : p.path}</loc>
    <lastmod>${p.updated}</lastmod>
    <priority>${p.priority.toFixed(1)}</priority>
  </url>`,
      ).join('\n')

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), htmlSeoMeta(), robotsAndSitemap()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the router and React out of the page chunk so a content edit
        // does not invalidate the whole bundle for returning visitors.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.webp', '**/*.gif'],
})
