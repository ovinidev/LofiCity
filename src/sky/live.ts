/* Live weather from Open-Meteo (free, no key, CORS enabled). One request every 10 minutes
   brings the current conditions plus the last and next 12 hours, so the streets can already
   be wet from rain that fell before the page opened. Codes follow the WMO table. The decision
   of what to show (live, stale, unavailable) lives in weather-feed.ts; this file only does the
   network, the storage and the browser timers. Nothing here invents weather: when the network
   fails the last genuine reading for that city is kept, or the weather is reported unavailable.
   It also follows the nearby airport METAR (via the same-origin /api/metar proxy, since
   aviationweather.gov sends no CORS header); rain-gate.ts decides what that report confirms. */
import { clamp } from '../engine/math';
import { type City, type MetarStation, cityById } from './cities';
import { type Obs, pickObs } from './rain-gate';
import { type Feed, type Sample, createWeatherFeed } from './weather-feed';
import { windValue } from './wind-rules';

const KEY = 'loficity:wx:', OLD_KEY = 'loficity:live:';

/** Rain / snow / storm / fog intensities for a WMO weather code. */
function fromCode(code: number) {
  const r = { rain: 0, snow: 0, storm: 0, fog: 0 };
  const L: Record<number, Partial<typeof r>> = {
    45: { fog: 0.8 }, 48: { fog: 0.9 },
    51: { rain: 0.12 }, 53: { rain: 0.22 }, 55: { rain: 0.32 }, 56: { rain: 0.2 }, 57: { rain: 0.32 },
    61: { rain: 0.35 }, 63: { rain: 0.6 }, 65: { rain: 0.85 }, 66: { rain: 0.4 }, 67: { rain: 0.75 },
    71: { snow: 0.3 }, 73: { snow: 0.55 }, 75: { snow: 0.85 }, 77: { snow: 0.2 },
    80: { rain: 0.4 }, 81: { rain: 0.65 }, 82: { rain: 0.95 }, 85: { snow: 0.5 }, 86: { snow: 0.8 },
    95: { rain: 0.75, storm: 0.75 }, 96: { rain: 0.85, storm: 0.9 }, 99: { rain: 0.95, storm: 1 },
  };
  return { ...r, ...L[code] };
}

/** `precipMm` is the precipitation summed over `perS` seconds (Open-Meteo: 900 s for the current
    15-minute value, 3600 s for the hourly series); the sample keeps it as a rate in mm/h for the gate. */
function sample(t: number, code: number, temp: number, precipMm: number, cloudPct: number, windKmh: number, windDir: number, perS = 3600): Sample {
  const c = fromCode(code);
  // measured precipitation can only strengthen what the code says
  const mm = clamp(precipMm / 6, 0, 1);
  if (c.snow > 0) c.snow = Math.max(c.snow, mm); else if (mm > 0.02 || c.rain > 0) c.rain = Math.max(c.rain, mm);
  const dir = -Math.sin((windDir * Math.PI) / 180); // blowing west → east is positive
  return {
    t, temp, rain: c.rain, snow: c.snow, storm: c.storm, fog: c.fog,
    cloud: clamp(cloudPct / 100, 0, 1), wind: windValue(windKmh, dir), // clamp(km/h / 55, 0, 1.2) * sign * 0.9 + 0.05 (wind-rules.ts)
    mm: Number.isFinite(precipMm) ? Math.max(0, precipMm) * 3600 / perS : 0, // missing value: dry for the gate
  };
}

async function fetchFeed(city: City): Promise<Feed> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  const hourly = 'temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m';
  Object.entries({
    latitude: String(city.lat), longitude: String(city.lon), timeformat: 'unixtime', past_hours: '12', forecast_hours: '12',
    current: `${hourly},apparent_temperature,relative_humidity_2m`, hourly,
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u, { cache: 'no-store' });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = await res.json();
  const c = j.current, h = j.hourly;
  // no interval in the answer: read the value as an hourly sum (the lower rate, never more rain)
  const per = Number.isFinite(c.interval) && c.interval > 0 ? Math.min(c.interval, 3600) : 3600;
  const now = sample(c.time * 1000, c.weather_code, c.temperature_2m, c.precipitation, c.cloud_cover, c.wind_speed_10m, c.wind_direction_10m, per);
  const hours: Sample[] = h.time.map((t: number, i: number) =>
    sample(t * 1000, h.weather_code[i], h.temperature_2m[i], h.precipitation[i], h.cloud_cover[i], h.wind_speed_10m[i], h.wind_direction_10m[i]));
  if (![now.t, now.temp, c.apparent_temperature, c.relative_humidity_2m].every(Number.isFinite)) throw new Error('open-meteo: incomplete reading');
  return { city: city.id, at: now.t, now: { ...now, code: c.weather_code, feels: c.apparent_temperature, humidity: c.relative_humidity_2m }, hours };
}

const feed = createWeatherFeed({
  fetch: (id) => fetchFeed(cityById(id)),
  now: () => Date.now(),
  setTimer: (fn, ms) => window.setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id),
  load: (id) => {
    try {
      localStorage.removeItem(OLD_KEY + id); // older cache format, no longer read
      return JSON.parse(localStorage.getItem(KEY + id) ?? 'null');
    } catch { return null; }
  },
  save: (id, e) => { try { localStorage.setItem(KEY + id, JSON.stringify(e)); } catch { /* storage unavailable */ } },
});

/** Start following a city; refreshes every 10 minutes, retries failures, refreshes when the tab comes back. */
export const followLive = (city: City) => { feed.follow(city.id); followObs(city); };
/** Live, stale (last genuine reading for that city) or unavailable. */
export const weatherView = (cityId: string) => feed.view(cityId);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  feed.poke();
  // background tabs throttle timers: refetch the METAR if the regular refresh is overdue
  if (obsStation && Date.now() - obsTried >= OBS_REFRESH_MS) { const gen = ++obsGen; if (obsTimer !== null) clearTimeout(obsTimer); obsTimer = null; void runObs(gen); }
});

// ---------- nearby observation (METAR) ----------
const OBS_REFRESH_MS = 10 * 60e3, OBS_RETRY_MS = 3 * 60e3, OBS_TIMEOUT_MS = 8e3;
const obs = new Map<MetarStation, Obs>();
let obsStation: MetarStation | null = null, obsTimer: number | null = null, obsGen = 0, obsTried = 0;

async function fetchObs(station: MetarStation): Promise<Obs | null> {
  const res = await fetch(`/api/metar?ids=${station}&format=json&hours=3`, { signal: AbortSignal.timeout(OBS_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`metar ${res.status}`);
  return pickObs(await res.json(), station, Date.now());
}
async function runObs(gen: number) {
  const st = obsStation;
  if (!st) return;
  let next = OBS_REFRESH_MS;
  obsTried = Date.now();
  try {
    const o = await fetchObs(st);
    if (o) obs.set(st, o); else next = OBS_RETRY_MS;
  } catch { next = OBS_RETRY_MS; } // proxy down, timeout, bad JSON: the gate falls back to the forecast threshold
  if (gen !== obsGen) return;
  obsTimer = window.setTimeout(() => void runObs(gen), next);
}
function followObs(city: City) {
  if (obsTimer !== null) { clearTimeout(obsTimer); obsTimer = null; }
  const gen = ++obsGen;
  obsStation = city.metar ?? null;
  if (obsStation) void runObs(gen);
}
/** Latest METAR fetched this session for the city's station, or null (no station, none yet). Its age is checked by the gate. */
export const observationFor = (city: City): Obs | null => (city.metar ? obs.get(city.metar) ?? null : null);
