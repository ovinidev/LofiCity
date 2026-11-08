/* World state derived each frame from the simulated clock and the live weather (Open-Meteo only).
   Only wetness and snow cover are integrated over time; everything else is a function of now. */
import { clamp, hashf, lerp, ss } from '../engine/math';
import { type City, CITIES, FESTA_PADROEIRA } from './cities';
import { weatherView } from './live';
import { type Cal, calendar, doyOf, inDoy, moonElev, moonHourAngle, moonPhase, solarHour, sunElev } from './time';
import { type WxKind, sampleAt } from './weather-feed';

export const S = {
  ms: 0, city: CITIES[0] as City, cal: calendar(0, CITIES[0]) as Cal,
  /** Where the weather comes from: a genuine reading (live / stale), none, or the #wx= test override. */
  wxKind: 'unavailable' as WxKind | 'override',
  /** Esperança: festa da padroeira (January), São João (June), Christmas lights. */
  festa: false, procissao: false, saoJoao: false, natal: false,
  sunElev: 0, moonElev: 0, moonHA: 0, moonPhase: 0, morning: true,
  dayK: 0, golden: 0, twilight: 0,
  busy: 1, deep: 0, neonOn: true, lampOn: true, stallOpen: true, trains: true,
  temp: 20, rain: 0, snow: 0, storm: 0, cloud: 0, fog: 0, wind: 0.05,
  /** Tokyo's rainy season by the calendar (a season tag, not a weather condition). */
  tsuyu: false,
  wet: 0, snowCover: 0,
  petals: 0, leaves: 0, fireworks: false,
  tree: { density: 1, pink: 0, red: 0 },
  exposure: 1, flashSky: 0, flashAll: 0, shake: 0,
};

// Pedestrian traffic by hour: commute peaks, quiet small hours.
const BUSY = [0.25, 0.15, 0.08, 0.05, 0.05, 0.12, 0.4, 0.85, 1, 0.7, 0.55, 0.6, 0.75, 0.65, 0.6, 0.65, 0.75, 0.95, 1, 0.9, 0.75, 0.6, 0.45, 0.35, 0.25];
const busyAt = (h: number) => { const i = Math.floor(h) % 24; return lerp(BUSY[i], BUSY[i + 1], h - Math.floor(h)); };
const hourIn = (h: number, a: number, b: number) => (a <= b ? h >= a && h < b : h >= a || h < b);
export { hourIn };

/** Seasonal look of deciduous and cherry trees for a day of year. */
function treeLook(doy: number) {
  const D = doyOf;
  const r = (a: number, b: number) => ss(a, b, doy);
  if (doy < D(2, 15)) return { density: 0, pink: 0, red: 0 };
  if (doy < D(3, 12)) return { density: r(D(2, 15), D(2, 26)), pink: 1 - r(D(3, 4), D(3, 12)), red: 0 };
  if (doy < D(9, 15)) return { density: 1, pink: 0, red: 0 };
  if (doy < D(10, 25)) return { density: 1, pink: 0, red: r(D(9, 15), D(10, 10)) };
  return { density: 1 - r(D(10, 25), D(11, 12)), pink: 0, red: 1 };
}

function fireworksAt(cal: Cal, city: City): boolean {
  const { doy, hour, year } = cal;
  if (doy === 0 && hour < 0.4) return true; // New Year
  if (city.br) {
    if (city.id === 'esperanca' && doy === doyOf(...FESTA_PADROEIRA.to) && hourIn(hour, 21.5, 22)) return true; // end of the procession
    // Campina Grande's São João ("o Maior São João do Mundo") has fireworks most June nights
    if (city.id === 'campina') return inDoy(doy, doyOf(5, 5), doyOf(5, 30)) && hourIn(hour, 21, 23.5) && hashf(year * 400 + doy + 3) < (inDoy(doy, doyOf(5, 22), doyOf(5, 24)) ? 1 : 0.5);
    return inDoy(doy, doyOf(5, 23), doyOf(5, 24)) && hourIn(hour, 20, 23.5) && hashf(year * 400 + doy + 7) < 0.8; // São João
  }
  if (inDoy(doy, doyOf(6, 22), doyOf(7, 31)) && hourIn(hour, 19.5, 20.75))
    return hashf(year * 400 + doy + 99) < 0.45;
  return false;
}

/** Fills the time-derived parts of S (no integration). */
function deriveTime(ms: number, city: City) {
  const cal = calendar(ms, city);
  S.ms = ms; S.city = city; S.cal = cal;
  const e = sunElev(cal.doy, cal.hour, city), solar = solarHour(cal.doy, cal.hour, city);
  S.sunElev = e; S.morning = solar < 12;
  S.dayK = ss(-8, 6, e);
  S.golden = ss(-4, 2, e) * (1 - ss(8, 18, e));
  S.twilight = ss(-14, -4, e) * (1 - ss(-2, 4, e));
  S.moonPhase = moonPhase(ms);
  S.moonHA = moonHourAngle(solar, S.moonPhase);
  S.moonElev = moonElev(S.moonHA, city);
  return cal;
}

interface Wx { temp: number; precip: number; rain: number; snow: number; storm: number; cloud: number; fog: number; wind: number }
/** No genuine reading: a neutral scene with no precipitation, fog or storm. The temperature is never
    shown (the HUD says "clima indisponível"); it only keeps clothing and snow melt neutral. */
const NEUTRAL: Wx = { temp: 20, precip: 0, rain: 0, snow: 0, storm: 0, cloud: 0, fog: 0, wind: 0.05 };

/** Test override for previews and screenshots: #wx=clear|cloudy|rain|snow|storm|fog (labelled as a test in the HUD). */
const FORCE: Record<string, Partial<Wx>> = {
  clear: { cloud: 0, fog: 0.1 },
  cloudy: { cloud: 0.6 },
  rain: { precip: 0.6, rain: 0.6, cloud: 0.95 },
  snow: { precip: 0.6, snow: 0.6, cloud: 0.95, temp: -2 },
  storm: { precip: 1, rain: 1, storm: 1, cloud: 1, wind: 0.5 },
  fog: { cloud: 0.7, fog: 0.9 },
};
const forced = /wx=(\w+)/.exec(location.hash)?.[1] ?? '';
export const wxOverride: string | null = FORCE[forced] ? forced : null;

/** Weather for the scene: the genuine reading for this city, the test override, or neutral. */
function wx(ms: number, city: City): Wx {
  if (wxOverride) { S.wxKind = 'override'; return { ...NEUTRAL, ...FORCE[wxOverride] }; }
  const v = weatherView(city.id);
  const l = v.kind === 'unavailable' ? null : sampleAt(v.feed, ms, v.kind === 'stale');
  if (!l || v.kind === 'unavailable') { S.wxKind = 'unavailable'; return NEUTRAL; }
  S.wxKind = v.kind;
  const precip = Math.min(1, l.rain + l.snow);
  return {
    temp: l.temp, rain: l.rain, snow: l.snow, storm: l.storm, cloud: Math.max(l.cloud, precip > 0.05 ? 0.85 : 0), precip,
    fog: l.fog, wind: l.wind,
  };
}

export function direct(ms: number, city: City, dtSim: number) {
  const cal = deriveTime(ms, city), h = cal.hour;
  const w = wx(ms, city);
  S.temp = w.temp; S.rain = w.rain; S.snow = w.snow; S.storm = w.storm; S.cloud = w.cloud; S.fog = w.fog;
  S.wind = w.wind;
  integrate(dtSim);

  S.busy = busyAt(h) * (1 - 0.3 * S.rain - 0.4 * S.storm - 0.3 * S.snow);
  S.deep = ss(0.5, 2, h) * (1 - ss(4, 5.5, h));
  S.neonOn = S.dayK < 0.55 || (S.cloud > 0.85 && S.dayK < 0.8);
  S.lampOn = S.dayK < 0.4 || (S.cloud > 0.85 && w.precip > 0.5 && S.dayK < 0.7);
  S.stallOpen = hourIn(h, 18, 2);
  S.trains = !hourIn(h, 0.75, 5);

  const doy = cal.doy;
  S.petals = ss(doyOf(2, 20), doyOf(2, 28), doy) * (1 - ss(doyOf(3, 10), doyOf(3, 18), doy));
  S.leaves = ss(doyOf(9, 20), doyOf(10, 5), doy) * (1 - ss(doyOf(10, 28), doyOf(11, 10), doy));
  const br = city.br, esp = city.id === 'esperanca';
  if (br) { S.petals = 0; S.leaves = 0; S.tree = { density: 1, pink: 0, red: 0 }; }
  else S.tree = treeLook(doy);
  S.tsuyu = !br && inDoy(doy, doyOf(5, 7), doyOf(6, 19));
  S.festa = esp && inDoy(doy, doyOf(...FESTA_PADROEIRA.from), doyOf(...FESTA_PADROEIRA.to));
  S.procissao = esp && doy === doyOf(...FESTA_PADROEIRA.to) && hourIn(h, 17, 21.5);
  S.saoJoao = br && inDoy(doy, doyOf(5, 1), doyOf(5, 30));
  S.natal = br && inDoy(doy, doyOf(11, 1), doyOf(0, 6));
  if (br) S.stallOpen = hourIn(h, 17, 23.5);
  S.fireworks = fireworksAt(cal, city) && S.rain + S.snow < 0.3;

  const stormDark = 1 - 0.15 * S.storm * S.dayK;
  S.exposure = (0.95 + 0.05 * S.dayK) * stormDark;
}

/** Wetness and snow cover follow precipitation with realistic lag. */
function integrate(dt: number) {
  const drying = S.rain < 0.05 && S.snow < 0.05 ? (1 + 2 * S.dayK) / 5400 : 0;
  S.wet = clamp(S.wet + (S.rain * (1 - S.wet)) * dt / 600 - drying * dt + S.snowCover * 0.0002 * dt * (S.temp > 1 ? 1 : 0), 0, 1);
  const melt = S.temp > 1 ? (S.temp - 1) / 7200 + S.rain / 1200 : 0;
  S.snowCover = clamp(S.snowCover + S.snow * dt / 1500 - melt * dt, 0, 1);
}

/** Re-integrate the last 8 hours so a fresh load or a time jump starts in a believable state. */
export function settle(ms: number, city: City) {
  S.wet = 0; S.snowCover = 0;
  for (let t = ms - 8 * 3.6e6; t < ms; t += 120e3) {
    deriveTime(t, city);
    const w = wx(t, city);
    S.temp = w.temp; S.rain = w.rain; S.snow = w.snow;
    integrate(120);
  }
}
