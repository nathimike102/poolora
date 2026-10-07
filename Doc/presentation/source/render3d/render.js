// Renders the 3D scenes in scenes.js to ../../media/<scene>.mp4 and .gif.
//   node render3d/render.js [hero pool map]
// Needs ffmpeg and a Chromium: PLAYWRIGHT_CHROMIUM, or Playwright's cached build.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');

const SOURCE = path.resolve(__dirname, '..');
const SCREENS = path.resolve(SOURCE, '../screens');
const MEDIA = path.resolve(SOURCE, '../media');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

function chromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const cache = path.join(os.homedir(), '.cache/ms-playwright');
  const dirs = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(cache, d, sub);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('No Chromium found; set PLAYWRIGHT_CHROMIUM');
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url.startsWith('/screens/') ? path.join(SCREENS, url.slice('/screens/'.length)) : path.join(SOURCE, url);
    if (!file.startsWith(SOURCE) && !file.startsWith(SCREENS)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['hero', 'pool', 'map'];
  fs.mkdirSync(MEDIA, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const name of wanted) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('console', (m) => m.type() === 'error' && console.error(`[${name}]`, m.text()));
      page.on('pageerror', (e) => console.error(`[${name}]`, e.message));
      await page.goto(`http://127.0.0.1:${port}/render3d/index.html?scene=${name}`);
      const info = await page.evaluate(() => window.ready);
      if (process.env.PREVIEW) {
        // A few stills to look at, instead of the whole animation
        for (const k of [0.05, 0.4, 0.8]) {
          const i = Math.floor(info.frames * k);
          const url = await page.evaluate((f) => window.frame(f), i);
          fs.writeFileSync(path.join(process.env.PREVIEW, `${name}-${i}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
        }
        await page.close();
        console.log(`${name}: preview written`);
        continue;
      }
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `siham-${name}-`));
      const started = Date.now();
      for (let i = 0; i < info.frames; i++) {
        const url = await page.evaluate((f) => window.frame(f), i);
        fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      }
      await page.close();
      const mp4 = path.join(MEDIA, `${name}.mp4`);
      const gif = path.join(MEDIA, `${name}.gif`);
      const poster = path.join(MEDIA, `${name}.png`);
      const input = ['-y', '-loglevel', 'error', '-framerate', String(info.fps), '-i', path.join(dir, 'f%04d.jpg')];
      execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4]);
      execFileSync('ffmpeg', [...input, '-vf', 'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, 'f0000.jpg'), poster]);
      fs.rmSync(dir, { recursive: true, force: true });
      const mb = (p) => (fs.statSync(p).size / 1e6).toFixed(1);
      console.log(`${name}: ${info.frames} frames in ${Math.round((Date.now() - started) / 1000)} s · mp4 ${mb(mp4)} MB · gif ${mb(gif)} MB`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
