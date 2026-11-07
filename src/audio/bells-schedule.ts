/* Pure scheduling rules for Esperança's church bells (no DOM, no Web Audio), so they can be
   unit-tested with `node --test`. Keep this file free of imports and TS-only runtime syntax
   (enums, namespaces, parameter properties): Node runs it by stripping the types. */

export const HOUR_MS = 3_600_000;
/** A timer that fires later than this after its hour (tab in background, laptop asleep) stays silent. */
export const LATE_MS = 60_000;
/** First and last hours that ring: 05:00 through 00:00; 01:00–04:00 stay silent at night. */
export const FIRST_HOUR = 5;

/** Strikes for a local hour 0–23: the 12-hour value (00h and 12h → 12, 13h → 1); 0 = silent (01–04h). */
export function strikesForHour(hour: number): number {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 1 && h < FIRST_HOUR) return 0;
  return h % 12 === 0 ? 12 : h % 12;
}

/** Local hour (0–23) at an instant, for a city with a fixed UTC offset in hours. */
export function localHour(nowMs: number, utcOffsetH: number): number {
  const local = nowMs + utcOffsetH * HOUR_MS;
  return Math.floor((((local % 86_400_000) + 86_400_000) % 86_400_000) / HOUR_MS);
}

/** Milliseconds until the next whole local hour, in (0, HOUR_MS]: exactly on the hour means the next one. */
export function msUntilNextHour(nowMs: number, utcOffsetH: number): number {
  const local = nowMs + utcOffsetH * HOUR_MS;
  const into = ((local % HOUR_MS) + HOUR_MS) % HOUR_MS;
  return HOUR_MS - into;
}

/** The next whole hour to arm for. Never returns `prevTargetMs` again, even if its timer fired a little early. */
export function nextTargetMs(nowMs: number, utcOffsetH: number, prevTargetMs?: number): number {
  const from = prevTargetMs === undefined ? nowMs : Math.max(nowMs, prevTargetMs);
  return from + msUntilNextHour(from, utcOffsetH);
}

export interface RingCheck {
  /** The whole hour the timer was armed for (epoch ms). */
  targetMs: number;
  /** When the timer actually fired (epoch ms). */
  nowMs: number;
  utcOffsetH: number;
  /** Ambient sound switched on by the user. */
  soundOn: boolean;
  /** The AudioContext is running (unlocked by a user gesture). */
  audioReady: boolean;
  /** The current city is Esperança. */
  inCity: boolean;
  /** A pinned #at= moment is in use: bells never ring on their own then. */
  pinned: boolean;
}

/** How many strikes to ring when an hour timer fires; 0 means stay silent. Missed or late hours are never replayed. */
export function strikesToRing(c: RingCheck): number {
  if (!c.soundOn || !c.audioReady || !c.inCity || c.pinned) return 0;
  const late = c.nowMs - c.targetMs;
  if (late < -1000 || late > LATE_MS) return 0; // early by more than clock jitter, or stale after a resume
  return strikesForHour(localHour(c.targetMs, c.utcOffsetH));
}
