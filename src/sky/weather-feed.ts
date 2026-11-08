/* What weather to show, decided only from genuine Open-Meteo readings. Pure: no DOM, no
   network, no clock of its own (everything is injected), so it runs under node --test.

   - live: a fetch for this city succeeded in THIS session, recently, and the last one did not fail
   - stale: the last fetch failed, the reading is getting old, or it was only restored from storage
     (a previous visit) and no fetch has succeeded yet this session; the last genuine reading
     for THIS city is kept and shown with its time
   - unavailable: no genuine reading for this city (or it is too old to mean anything);
     nothing is invented, the scene falls back to a neutral sky with no precipitation

   Readings are stored per city and never shared across cities. Failed fetches are retried a
   bounded number of times with backoff, then on the normal refresh interval until one works. */

/** One moment of weather, already mapped to scene intensities (0..1, wind signed). */
export interface Sample { t: number; temp: number; rain: number; snow: number; storm: number; cloud: number; fog: number; wind: number }
/** One Open-Meteo answer for a city: the current observation plus the hourly series around it. */
export interface Feed { city: string; at: number; now: Sample & { code: number; feels: number; humidity: number }; hours: Sample[] }
export interface Entry { feed: Feed; fetchedAt: number }

export type WxKind = 'live' | 'stale' | 'unavailable';
export type WxView = { kind: 'live' | 'stale'; feed: Feed; fetchedAt: number } | { kind: 'unavailable' };

export const REFRESH_MS = 10 * 60e3;
/** A successful fetch counts as live for this long (a few refreshes may be throttled in a background tab). */
export const LIVE_MAX_AGE = 30 * 60e3;
/** Past this, a reading is too old to show even as stale. */
export const STALE_MAX_AGE = 12 * 3.6e6;
/** Retry delays after a failure; once used up, attempts continue only on the refresh interval. */
export const RETRY_MS = [15e3, 60e3, 3 * 60e3] as const;

/** What to show for a city given its cached reading (if any), whether the last attempt failed and
    whether that reading was fetched in this session (`fresh`). A reading restored from storage is
    never live, however recent: only a successful fetch in this session makes it live. */
export function decide(entry: Entry | undefined, lastFailed: boolean, now: number, fresh: boolean): WxView {
  if (!entry) return { kind: 'unavailable' };
  if (now - entry.feed.at > STALE_MAX_AGE || now - entry.fetchedAt > STALE_MAX_AGE) return { kind: 'unavailable' };
  const kind = !fresh || lastFailed || now - entry.fetchedAt > LIVE_MAX_AGE ? 'stale' : 'live';
  return { kind, feed: entry.feed, fetchedAt: entry.fetchedAt };
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isSample = (s: unknown): s is Sample => {
  const o = s as Record<string, unknown> | null;
  return !!o && ['t', 'temp', 'rain', 'snow', 'storm', 'cloud', 'fog', 'wind'].every((k) => finite(o[k]));
};
/** Shape check for an entry read back from storage; it must belong to `cityId`. */
export function isEntry(x: unknown, cityId: string): x is Entry {
  const e = x as { feed?: Partial<Feed>; fetchedAt?: unknown } | null;
  const f = e?.feed;
  return !!f && finite(e.fetchedAt) && f.city === cityId && finite(f.at) && isSample(f.now)
    && finite(f.now.feels) && finite(f.now.humidity) && Array.isArray(f.hours) && f.hours.every(isSample);
}

const mix = (a: Sample, b: Sample, k: number): Sample => {
  const o = { t: a.t + (b.t - a.t) * k } as Sample;
  for (const key of ['temp', 'rain', 'snow', 'storm', 'cloud', 'fog', 'wind'] as const) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
};

/** Weather at `ms` from a feed, or null when the feed does not cover that moment. Near the
    observation the observation itself is used; elsewhere the hourly series is interpolated.
    `frozen` (stale data): from the observation on, keep showing the observation rather than a
    forecast, so the scene matches the reading the HUD labels. */
export function sampleAt(f: Feed, ms: number, frozen: boolean): Sample | null {
  const n = f.now;
  if (Math.abs(ms - n.t) < 45 * 60e3 || (frozen && ms >= n.t)) return n;
  const H = f.hours;
  if (H.length < 2 || ms < H[0].t || ms > H[H.length - 1].t) return null;
  let i = 0;
  while (i < H.length - 2 && H[i + 1].t <= ms) i++;
  const k = (ms - H[i].t) / (H[i + 1].t - H[i].t);
  return mix(H[i], H[i + 1], Math.min(1, Math.max(0, k)));
}

const pad2 = (n: number) => String(n).padStart(2, '0');
/** "dados de 14:20 · sem atualização" in the city's time ("ontem" or the date when not today). */
export function staleLabel(at: number, now: number, utcHours: number): string {
  const off = utcHours * 3.6e6, a = new Date(at + off), n = new Date(now + off);
  const day = (d: Date) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400e3);
  const hm = `${pad2(a.getUTCHours())}:${pad2(a.getUTCMinutes())}`;
  const gap = day(n) - day(a);
  const when = gap <= 0 ? hm : gap === 1 ? `ontem ${hm}` : `${pad2(a.getUTCDate())}/${pad2(a.getUTCMonth() + 1)} ${hm}`;
  return `dados de ${when} · sem atualização`;
}

/** Manual lightning (the L key) is a test tool: allowed only with #debug or the #wx= test override.
    In normal use lightning comes only from real storm data. */
export function manualLightningAllowed(f: { debug: boolean; wxOverride: string | null }): boolean {
  return f.debug || f.wxOverride !== null;
}

export interface HudIn {
  /** Scene state: a weather view kind, or 'override' for #wx=. */
  kind: WxKind | 'override';
  /** Condition word computed from the scene (only shown when there is data or an override). */
  word: string;
  /** Reading to show (live/stale): the current observation, or the sampled moment when pinned. */
  temp?: number; feels?: number; humidity?: number; at?: number;
  now: number; utc: number;
  /** #at= pins the clock (previews only). */
  pinned: boolean;
  override?: string;
}
export interface HudOut { temp: string; text: string; badge: { text: string; cls: 'live' | 'stale' | 'test' } | null }

/** HUD weather line. Never shows a temperature or a condition without a genuine reading, and
    never shows the live badge for anything but a fresh real reading at the real time. */
export function hudWeather(i: HudIn): HudOut {
  const deg = (n: number | undefined) => (n === undefined ? '' : `${Math.round(n)}°C`);
  if (i.kind === 'override') return { temp: '', text: i.word, badge: { text: `teste #wx=${i.override ?? ''} · não é ao vivo`, cls: 'test' } };
  const pinBadge = { text: 'teste #at · horário fixado', cls: 'test' } as const;
  if (i.kind === 'unavailable') return { temp: '', text: 'clima indisponível', badge: i.pinned ? pinBadge : null };
  if (i.pinned) return { temp: deg(i.temp), text: i.word, badge: pinBadge };
  const details = i.feels !== undefined && i.humidity !== undefined ? ` · sensação ${Math.round(i.feels)}° · umidade ${Math.round(i.humidity)}%` : '';
  if (i.kind === 'live') return { temp: deg(i.temp), text: i.word + details, badge: { text: '● ao vivo', cls: 'live' } };
  return { temp: deg(i.temp), text: i.word + details, badge: { text: `● ${staleLabel(i.at ?? i.now, i.now, i.utc)}`, cls: 'stale' } };
}

export interface FeedDeps {
  fetch: (cityId: string) => Promise<Feed>;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
  load?: (cityId: string) => unknown;
  save?: (cityId: string, e: Entry) => void;
}

/** Follows one city at a time: fetches, caches per city, retries with bounded backoff. */
export function createWeatherFeed(d: FeedDeps) {
  const cache = new Map<string, Entry>();
  const failed = new Map<string, boolean>();
  const loaded = new Set<string>(); // storage is read once per city, not every frame
  const fresh = new Set<string>(); // cities with a successful fetch in this session (only these can be live)
  let current: string | null = null, timer: number | null = null, retry = 0, gen = 0, busy = false;

  const entry = (id: string): Entry | undefined => {
    if (!loaded.has(id) && d.load) {
      loaded.add(id);
      const e = d.load(id);
      if (isEntry(e, id) && !cache.has(id)) cache.set(id, e);
    }
    return cache.get(id);
  };
  const schedule = (ms: number) => {
    if (timer !== null) d.clearTimer(timer);
    timer = d.setTimer(() => { timer = null; void run(); }, ms);
  };

  async function run() {
    const id = current;
    if (!id || busy) return; // one request at a time; the one in flight reschedules when it ends
    const my = gen;
    busy = true;
    try {
      const feed = await d.fetch(id);
      if (feed.city !== id) throw new Error('feed for another city');
      const e = { feed, fetchedAt: d.now() };
      cache.set(id, e); failed.set(id, false); fresh.add(id); d.save?.(id, e); // genuine data for `id`, kept under `id` only
      if (my !== gen) return; // the user moved on to another city meanwhile
      retry = 0;
      schedule(REFRESH_MS);
    } catch {
      failed.set(id, true);
      if (my !== gen) return;
      schedule(retry < RETRY_MS.length ? RETRY_MS[retry++] : REFRESH_MS);
    } finally {
      if (my === gen) busy = false;
    }
  }

  return {
    /** Start following a city; fetches now unless a recent reading from this session is cached
        (a reading restored from storage is always refetched right away). */
    follow(id: string) {
      current = id; gen++; busy = false; retry = 0;
      if (timer !== null) { d.clearTimer(timer); timer = null; }
      const e = entry(id), age = e ? d.now() - e.fetchedAt : Infinity;
      if (e && fresh.has(id) && !failed.get(id) && age < REFRESH_MS) schedule(REFRESH_MS - age);
      else void run();
    },
    /** The tab came back: refresh if the regular timer was throttled. Backoff timers are left alone. */
    poke() {
      if (!current || busy || failed.get(current)) return;
      const e = entry(current);
      if (!e || d.now() - e.fetchedAt >= REFRESH_MS) void run();
    },
    view: (id: string): WxView => decide(entry(id), failed.get(id) ?? false, d.now(), fresh.has(id)),
  };
}
