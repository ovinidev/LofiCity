// Behaviour of the weather decision logic (src/sky/weather-feed.ts) with a fake clock, timers and network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Feed, LIVE_MAX_AGE, REFRESH_MS, RETRY_MS, STALE_MAX_AGE,
  createWeatherFeed, decide, hudWeather, isEntry, manualLightningAllowed, sampleAt, staleLabel,
} from '../src/sky/weather-feed.ts';

const T0 = Date.parse('2026-11-08T17:20:00Z'); // 14:20 in Brasília

function feedFor(city: string, at: number, temp = 25, rain = 0): Feed {
  const s = (t: number) => ({ t, temp, rain, snow: 0, storm: 0, cloud: 0.4, fog: 0, wind: 0.1 });
  const hours = Array.from({ length: 25 }, (_, i) => s(at + (i - 12) * 3.6e6));
  return { city, at, now: { ...s(at), code: rain ? 61 : 2, feels: temp + 1, humidity: 70 }, hours };
}

function harness() {
  let now = T0, nextId = 1;
  const timers = new Map<number, { fn: () => void; at: number }>();
  const calls: string[] = [];
  let online = true;
  const temps: Record<string, number> = { esperanca: 25, tokyo: 12 };
  const feed = createWeatherFeed({
    fetch: async (id) => { calls.push(id); if (!online) throw new Error('offline'); return feedFor(id, now, temps[id] ?? 20); },
    now: () => now,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: (id) => { timers.delete(id); },
  });
  const flush = () => new Promise<void>((r) => setImmediate(r));
  /** Advance the fake clock, firing due timers in order and letting their fetches settle. */
  async function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].fn(); await flush();
    }
    now = end;
  }
  return {
    feed, calls, advance, flush,
    setOnline: (v: boolean) => { online = v; },
    follow: async (id: string) => { feed.follow(id); await flush(); },
    pending: () => [...timers.values()].map((t) => t.at - now),
    poke: async () => { feed.poke(); await flush(); },
  };
}

test('failure with a cached reading for the city -> stale, keeps that reading', async () => {
  const h = harness();
  await h.follow('esperanca');
  assert.equal(h.feed.view('esperanca').kind, 'live');
  h.setOnline(false);
  await h.advance(REFRESH_MS);
  const v = h.feed.view('esperanca');
  assert.equal(v.kind, 'stale');
  assert.ok(v.kind === 'stale' && v.feed.city === 'esperanca' && v.feed.now.temp === 25 && v.feed.at === T0);
});

test('failure without any cached reading -> unavailable', async () => {
  const h = harness();
  h.setOnline(false);
  await h.follow('esperanca');
  assert.deepEqual(h.feed.view('esperanca'), { kind: 'unavailable' });
  await h.advance(3600e3);
  assert.deepEqual(h.feed.view('esperanca'), { kind: 'unavailable' });
});

test('switching city never reuses another city\'s reading', async () => {
  const h = harness();
  await h.follow('esperanca');
  h.setOnline(false);
  await h.follow('tokyo');
  assert.deepEqual(h.feed.view('tokyo'), { kind: 'unavailable' });
  // Esperança keeps its own reading, untouched by Tokyo's failure
  assert.equal(h.feed.view('esperanca').kind, 'live');
  h.setOnline(true);
  await h.advance(RETRY_MS[0]);
  const t = h.feed.view('tokyo');
  assert.ok(t.kind === 'live' && t.feed.city === 'tokyo' && t.feed.now.temp === 12);
});

test('a slow answer for the previous city is stored under that city only', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const feed = createWeatherFeed({
    fetch: async (id) => { if (id === 'esperanca') await gate; else throw new Error('offline'); return feedFor(id, T0); },
    now: () => T0, setTimer: () => 1, clearTimer: () => {},
  });
  feed.follow('esperanca');
  feed.follow('tokyo');
  release();
  await new Promise<void>((r) => setImmediate(r));
  assert.equal(feed.view('tokyo').kind, 'unavailable');
  assert.equal(feed.view('esperanca').kind, 'live');
});

test('stored readings for another city are rejected', () => {
  const feed = createWeatherFeed({
    fetch: () => new Promise(() => {}), now: () => T0, setTimer: () => 1, clearTimer: () => {},
    load: () => ({ feed: feedFor('esperanca', T0), fetchedAt: T0 }),
  });
  assert.equal(feed.view('tokyo').kind, 'unavailable');
  assert.equal(feed.view('esperanca').kind, 'stale');
  assert.equal(isEntry({ feed: { city: 'tokyo' }, fetchedAt: T0 }, 'tokyo'), false);
});

test('recovery after failure -> live again on its own', async () => {
  const h = harness();
  await h.follow('esperanca');
  h.setOnline(false);
  await h.advance(REFRESH_MS + RETRY_MS[0]);
  assert.equal(h.feed.view('esperanca').kind, 'stale');
  h.setOnline(true);
  await h.advance(RETRY_MS[1]);
  const v = h.feed.view('esperanca');
  assert.equal(v.kind, 'live');
  assert.equal(h.pending()[0], REFRESH_MS, 'back on the normal refresh interval');
});

test('recovery also happens after the retries are used up, on the refresh interval', async () => {
  const h = harness();
  h.setOnline(false);
  await h.follow('esperanca');
  await h.advance(RETRY_MS.reduce((a, b) => a + b, 0));
  assert.equal(h.feed.view('esperanca').kind, 'unavailable');
  h.setOnline(true);
  await h.advance(REFRESH_MS);
  assert.equal(h.feed.view('esperanca').kind, 'live');
});

test('retries are bounded: a short backoff burst, then only the refresh interval', async () => {
  const h = harness();
  h.setOnline(false);
  await h.follow('esperanca');
  assert.equal(h.calls.length, 1);
  const burst = RETRY_MS.reduce((a, b) => a + b, 0);
  await h.advance(burst);
  assert.equal(h.calls.length, 1 + RETRY_MS.length);
  await h.advance(3600e3);
  assert.equal(h.calls.length, 1 + RETRY_MS.length + Math.floor(3600e3 / REFRESH_MS));
  assert.equal(h.pending().length, 1, 'never more than one pending attempt');
  await h.poke(); // tab coming back does not add attempts while failing
  assert.equal(h.calls.length, 1 + RETRY_MS.length + Math.floor(3600e3 / REFRESH_MS));
});

test('a fresh cached reading is not refetched on follow; an old one is', async () => {
  const h = harness();
  await h.follow('esperanca');
  await h.follow('tokyo');
  await h.advance(60e3);
  await h.follow('esperanca');
  assert.deepEqual(h.calls, ['esperanca', 'tokyo']);
  await h.advance(REFRESH_MS);
  assert.deepEqual(h.calls, ['esperanca', 'tokyo', 'esperanca']);
});

test('decide: ages', () => {
  const e = { feed: feedFor('esperanca', T0), fetchedAt: T0 };
  assert.equal(decide(e, false, T0 + LIVE_MAX_AGE - 1, true).kind, 'live');
  assert.equal(decide(e, false, T0 + LIVE_MAX_AGE + 1, true).kind, 'stale');
  assert.equal(decide(e, true, T0 + 1, true).kind, 'stale');
  assert.equal(decide(e, true, T0 + STALE_MAX_AGE + 1, true).kind, 'unavailable');
  assert.equal(decide(undefined, false, T0, true).kind, 'unavailable');
  assert.equal(decide(e, false, T0 + 1, false).kind, 'stale', 'not fetched this session -> never live');
});

/** A feed whose storage already holds a reading from a previous visit, `ageMs` old. */
function restored(ageMs: number) {
  let now = T0, online = true;
  const calls: string[] = [];
  let pendingTimer: (() => void) | null = null;
  const feed = createWeatherFeed({
    fetch: async (id) => { calls.push(id); if (!online) throw new Error('offline'); return feedFor(id, now, 27); },
    now: () => now,
    setTimer: (fn) => { pendingTimer = fn; return 1; },
    clearTimer: () => { pendingTimer = null; },
    load: (id) => ({ feed: feedFor(id, T0 - ageMs, 25), fetchedAt: T0 - ageMs }),
  });
  const flush = () => new Promise<void>((r) => setImmediate(r));
  return {
    feed, calls, flush,
    setOnline: (v: boolean) => { online = v; },
    tick: (ms: number) => { now += ms; },
    fire: async () => { const f = pendingTimer; pendingTimer = null; f?.(); await flush(); },
  };
}

test('a reading restored from storage on load is shown as cached (stale), not live, even if recent', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const feed = createWeatherFeed({
    fetch: async (id) => { await gate; throw new Error(`offline ${id}`); },
    now: () => T0, setTimer: () => 1, clearTimer: () => {},
    load: (id) => ({ feed: feedFor(id, T0 - 60e3, 25), fetchedAt: T0 - 60e3 }), // 1 minute old
  });
  feed.follow('esperanca');
  const v = feed.view('esperanca');
  assert.ok(v.kind === 'stale' && v.feed.now.temp === 25, 'cached while the first fetch is in flight');
  const hud = hudWeather({ kind: v.kind, word: 'nublado', now: T0, utc: -3, pinned: false, temp: 25, at: v.feed.at });
  assert.equal(hud.badge?.cls, 'stale');
  assert.match(hud.badge!.text, /^● dados de 14:19/);
  release();
  await new Promise<void>((r) => setImmediate(r));
  assert.equal(feed.view('esperanca').kind, 'stale', 'still cached after the fetch fails');
});

test('a restored reading is refetched at once, and a successful fetch in this session makes it live', async () => {
  const h = restored(60e3);
  h.setOnline(false);
  h.feed.follow('esperanca');
  await h.flush();
  assert.deepEqual(h.calls, ['esperanca'], 'refetched immediately despite being recent');
  assert.equal(h.feed.view('esperanca').kind, 'stale');
  h.setOnline(true);
  h.tick(RETRY_MS[0]);
  await h.fire();
  const v = h.feed.view('esperanca');
  assert.ok(v.kind === 'live' && v.feed.now.temp === 27, 'fresh success -> live with the new reading');
});

test('manual lightning is allowed only in debug / #wx= test mode', () => {
  assert.equal(manualLightningAllowed({ debug: false, wxOverride: null }), false);
  assert.equal(manualLightningAllowed({ debug: true, wxOverride: null }), true);
  assert.equal(manualLightningAllowed({ debug: false, wxOverride: 'storm' }), true);
  assert.equal(manualLightningAllowed({ debug: true, wxOverride: 'rain' }), true);
});

test('stale data freezes the scene on the reading instead of the forecast', () => {
  const f = feedFor('esperanca', T0);
  f.hours = f.hours.map((s) => (s.t > T0 ? { ...s, rain: 0.9 } : s));
  assert.equal(sampleAt(f, T0 + 3 * 3.6e6, true)?.rain, 0);
  assert.ok((sampleAt(f, T0 + 3 * 3.6e6, false)?.rain ?? 0) > 0.5);
  assert.equal(sampleAt(f, T0 + 20 * 3.6e6, false), null);
});

test('HUD text per state (pt-BR)', () => {
  const base = { word: 'chuva', now: T0 + 2 * 3.6e6, utc: -3, pinned: false, temp: 25.4, feels: 27, humidity: 80, at: T0 };
  const live = hudWeather({ ...base, kind: 'live' });
  assert.equal(live.temp, '25°C');
  assert.equal(live.badge?.text, '● ao vivo');
  const stale = hudWeather({ ...base, kind: 'stale' });
  assert.equal(stale.badge?.text, '● dados de 14:20 · sem atualização');
  assert.equal(stale.badge?.cls, 'stale');
  const none = hudWeather({ ...base, kind: 'unavailable' });
  assert.deepEqual(none, { temp: '', text: 'clima indisponível', badge: null });
  const test = hudWeather({ ...base, kind: 'override', override: 'rain' });
  assert.equal(test.temp, '');
  assert.equal(test.badge?.cls, 'test');
  assert.match(test.badge!.text, /teste #wx=rain/);
  assert.equal(hudWeather({ ...base, kind: 'live', pinned: true }).badge?.cls, 'test');
  assert.equal(staleLabel(Date.parse('2026-11-08T02:40:00Z'), T0, -3), 'dados de ontem 23:40 · sem atualização');
});
