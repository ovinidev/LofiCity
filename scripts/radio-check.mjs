// Playback check for the radio against the real Internet Archive (needs network and `pnpm build`).
// Usage: node scripts/radio-check.mjs   (BROWSER=firefox to use Playwright's Firefox instead)
//
// 1. Playback: for each station, after a real click on Tocar / the station button, an archive.org
//    audio response arrives with HTTP 200/206, an audio/* content type and a nonzero size; the
//    playing media element is unpaused and its currentTime advances by more than 2 s; its source
//    belongs to that station's album list (read from src/audio/radio.ts).
// 2. Failure: with every archive.org audio request aborted, the radio gives up after a bounded
//    number of attempts, shows the pt-BR error status, and makes no further audio requests for 30 s.
// The media elements are found by wrapping HTMLMediaElement.prototype.play in the test page only;
// the app needs no hooks. Exits non-zero on any failed check.
import { chromium, firefox } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PAGE = `${pathToFileURL(resolve('dist/index.html')).href}#city=tokyo&scene=rain-corner&wx=clear`;
const MAX_FAILS = 5, QUIET_MS = 30_000;
const AUDIO_URL = /^https:\/\/([a-z0-9.-]+\.)?archive\.org\/(download\/|\d+\/items\/)/;

// Station album lists, straight from the source so the check cannot drift from the app.
const src = readFileSync(resolve('src/audio/radio.ts'), 'utf8');
const catalog = {};
for (const m of src.matchAll(/id: '(\w+)', name:[\s\S]*?albums: \[([\s\S]*?)\]/g)) {
  catalog[m[1]] = [...m[2].matchAll(/^\s*'([^']+)'/gm)].map((a) => a[1]);
}

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failed++; };

const engine = process.env.BROWSER === 'firefox' ? firefox : chromium;
const browser = await engine.launch({ headless: true });
console.log(`browser: ${engine.name()} ${browser.version()}`);

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    const seen = (window.__media = []);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) { if (!seen.includes(this)) seen.push(this); return play.apply(this, a); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#radio [data-a=play]');
  return { ctx, page };
}

/** The media element that is currently audible (unpaused), as a plain snapshot. */
const media = (page) => page.evaluate(() => {
  const m = window.__media.find((e) => !e.paused) ?? window.__media.at(-1);
  return m ? { src: m.currentSrc || m.src, paused: m.paused, t: m.currentTime, err: m.error?.code ?? null } : null;
});
/** Album id from https://archive.org/download/<id>/… or its redirect target https://<node>.archive.org/<n>/items/<id>/… */
const albumOf = (url) => decodeURIComponent((/\/(?:download|\d+\/items)\/([^/]+)\//.exec(url ?? '') ?? [])[1] ?? '');
const radioText = (page) => page.$eval('#radio .track', (e) => e.textContent);

// ---------- 1. playback ----------
{
  const { ctx, page } = await newPage();
  const responses = [];
  page.on('response', (r) => {
    if (!AUDIO_URL.test(r.url()) || r.request().resourceType() !== 'media') return;
    const h = r.headers();
    responses.push({ url: r.url(), status: r.status(), type: h['content-type'] ?? '', length: Number(h['content-length'] ?? 0), range: h['content-range'] ?? '' });
  });
  // Bytes actually received per URL (Chromium only, via CDP; Firefox reports content-length only).
  const received = new Map();
  if (engine === chromium) {
    const cdp = await ctx.newCDPSession(page), urls = new Map();
    await cdp.send('Network.enable');
    cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url));
    cdp.on('Network.dataReceived', (e) => { const u = urls.get(e.requestId); if (u) received.set(u, (received.get(u) ?? 0) + e.dataLength); });
  }

  for (const [i, st] of ['lofi', 'neon'].entries()) {
    console.log(`\n== station ${st} (${catalog[st].length} albums) ==`);
    await page.mouse.move(640, 360);
    const from = responses.length;
    if (i === 0) {
      if ((await page.$eval('#radio', (e) => e.dataset.station)) !== st) await page.click(`#radio [data-st=${st}]`);
      await page.click('#radio [data-a=play]'); // the user gesture that starts the radio
    } else {
      await page.click(`#radio [data-st=${st}]`);
    }
    check((await page.$eval('#radio', (e) => e.dataset.station)) === st, `panel shows station ${st}`);

    // wait for a station track to actually play
    let m = null;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      m = await media(page);
      if (m && !m.paused && m.t > 0.2 && catalog[st].includes(albumOf(m.src))) break;
      await page.waitForTimeout(500);
    }
    console.log(`status line: "${await radioText(page)}"`);
    check(!!m && !m.paused, `media element paused=${m?.paused}`);
    const album = albumOf(m?.src);
    check(catalog[st].includes(album), `source album "${album}" is in the ${st} catalog  (${m?.src})`);

    const got = responses.slice(from).filter((r) => albumOf(r.url) === album);
    const bytes = (r) => received.get(r.url) ?? r.length;
    for (const r of got) console.log(`  response ${r.status} ${r.type} content-length=${r.length} ${r.range ? `content-range="${r.range}" ` : ''}${received.has(r.url) ? `received=${received.get(r.url)} B ` : ''}${r.url}`);
    const good = got.find((r) => (r.status === 200 || r.status === 206) && /^audio\//.test(r.type) && bytes(r) > 0);
    check(!!good, `audio response with 200/206, audio/* and nonzero bytes${good ? `: ${good.status} ${good.type} ${bytes(good)} B` : ''}`);

    const t0 = (await media(page))?.t ?? 0;
    await page.waitForTimeout(3000);
    const m1 = await media(page);
    check(!!m1 && !m1.paused && m1.t - t0 > 2, `currentTime ${t0.toFixed(2)}s -> ${m1?.t.toFixed(2)}s over 3 s (paused=${m1?.paused})`);
  }
  await ctx.close();
}

// ---------- 2. failure handling ----------
{
  console.log('\n== failure: every archive.org audio request aborted ==');
  const { ctx, page } = await newPage();
  const aborted = [];
  await ctx.route(AUDIO_URL, (route) => { aborted.push({ at: Date.now(), url: route.request().url() }); return route.abort('failed'); });
  await page.mouse.move(640, 360);
  const t0 = Date.now();
  await page.click('#radio [data-a=play]');
  const giveUp = /Internet Archive não respondeu|sem internet/;
  let text = '';
  while (Date.now() - t0 < 90_000) {
    text = await radioText(page);
    if (giveUp.test(text)) break;
    await page.waitForTimeout(250);
  }
  const gaveUpAt = Date.now();
  check(giveUp.test(text), `pt-BR error status after ${((gaveUpAt - t0) / 1000).toFixed(1)} s: "${text}"`);
  const play = await page.$eval('#radio [data-a=play]', (e) => `${e.textContent} aria-pressed=${e.getAttribute('aria-pressed')}`);
  check(/^Tocar aria-pressed=false$/.test(play), `play button back to "${play}"`);
  const tracks = new Set(aborted.map((a) => a.url));
  check(tracks.size <= MAX_FAILS, `attempts before giving up: ${aborted.length} aborted requests for ${tracks.size} distinct tracks (limit ${MAX_FAILS} tracks)`);
  const before = aborted.length;
  await page.waitForTimeout(QUIET_MS);
  check(aborted.length === before, `no audio requests in the ${QUIET_MS / 1000} s after giving up (${aborted.length - before} new)`);
  check(giveUp.test(await radioText(page)), 'error status still shown');
  await ctx.close();
}

await browser.close();
console.log(`\n${failed ? `${failed} check(s) FAILED` : 'all checks passed'}`);
process.exit(failed ? 1 : 0);
