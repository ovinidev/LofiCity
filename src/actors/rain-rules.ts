/* Pure rules for how pedestrians react to rain (no DOM, unit-tested in test/rain-rules.test.ts).
   Only the real weather state counts: a genuine Open-Meteo reading (live or stale) or the explicit
   #wx= test override. Unknown weather ('unavailable') never opens an umbrella, whatever the numbers. */

/** The scene's weather state, as in S.wxKind (sky/state.ts). */
export type WxState = 'live' | 'stale' | 'unavailable' | 'override';

/** Precipitation (rain + snow, 0..1) above which people react. */
export const WET_MIN = 0.08;
/** Lower threshold for keeping an umbrella that is already open, so it doesn't flicker at the edge. */
export const WET_KEEP = 0.06;

/** Whether the weather state shows precipitation people react to. */
export function raining(kind: WxState, rain: number, snow: number, min = WET_MIN): boolean {
  return kind !== 'unavailable' && Number.isFinite(rain + snow) && rain + snow > min;
}

/** Share of people who carry an umbrella when it rains; the rest hurry or look for shelter. */
export const UMBRELLA_SHARE = 0.9;

/** Whether a newly spawned pedestrian walks with an open umbrella; `roll` is a uniform [0, 1) draw. */
export function opensUmbrella(kind: WxState, rain: number, snow: number, roll: number): boolean {
  return raining(kind, rain, snow) && roll < UMBRELLA_SHARE;
}

/** A covered stretch of pavement (world x) where people without an umbrella wait out the rain. */
export interface Shelter { x0: number; x1: number; cap: number }

export interface ShelterAsk {
  wet: boolean;
  umbrella: boolean;
  /** On foot (not on a bicycle or in a wheelchair, not jogging, not pushing a cart). */
  onFoot: boolean;
  /** Has this person already waited once? (they don't stop twice) */
  waited: boolean;
  /** Number of people already waiting under this shelter. */
  waiting: number;
  cap: number;
}

/** Seconds to wait under a shelter just reached (0 = walk on); `roll` is a uniform [0, 1) draw. */
export function shelterWait(a: ShelterAsk, roll: number): number {
  if (!a.wet || a.umbrella || !a.onFoot || a.waited || a.waiting >= a.cap) return 0;
  return 8 + roll * 22;
}

/** The shelter (if any) covering world x. */
export const shelterAt = <T extends Shelter>(shelters: readonly T[], x: number): T | null => shelters.find((s) => x >= s.x0 && x <= s.x1) ?? null;

/** Speed factor for someone caught in real rain with no umbrella at all: they hurry (as in people.ts). */
export const HURRY = 1.3;

/** A hot, clear day from a genuine reading, when some people carry a sun umbrella (the side-on
    `sombrinha` condition in people.ts). An unknown temperature (null) never counts. */
export function parasolWeather(temp: number | null, dayK: number, cloud: number): boolean {
  return temp !== null && Number.isFinite(temp) && temp > 26 && dayK > 0.6 && cloud < 0.5;
}
/** Share of walkers with a sun umbrella on such a day (depth streets; side-on scenes weight an archetype). */
export const PARASOL_SHARE = 0.12;

export interface UmbrellaPick { umbrella: boolean; sun: boolean; speedK: number }

/** What a newly spawned walker carries: a rain umbrella exactly as `opensUmbrella`, otherwise a sun
    umbrella on a hot clear day, otherwise nothing (and they hurry if it really rains). `roll` and
    `sunRoll` are uniform [0, 1) draws from a seeded generator. */
export function pickUmbrella(kind: WxState, rain: number, snow: number, temp: number | null, dayK: number, cloud: number, roll: number, sunRoll: number): UmbrellaPick {
  const umbrella = opensUmbrella(kind, rain, snow, roll);
  const sun = !umbrella && parasolWeather(temp, dayK, cloud) && sunRoll < PARASOL_SHARE;
  return { umbrella, sun, speedK: !umbrella && !sun && raining(kind, rain, snow) ? HURRY : 1 };
}

/** Whether a carried umbrella is open now: a sun umbrella always, a rain one while it still rains (WET_KEEP). */
export const umbrellaOpen = (sun: boolean, kind: WxState, rain: number, snow: number) => sun || raining(kind, rain, snow, WET_KEEP);
