/* Pure rules for how people react to real heat (no DOM, unit-tested in test/heat-rules.test.ts):
   some walkers carry a water bottle or a green coconut with a straw, stop now and then for a short
   drink, and a coconut-water cart opens by day. Everything derives from the REAL temperature reading
   (S.temp: a live or stale Open-Meteo reading; null when unknown) plus daylight and a clear sky, as
   the sun umbrellas do. Unknown temperature, unknown weather, night, cloud and real rain give no heat
   behaviour at all; nothing here ever makes up a temperature. Thresholds are art-direction assumptions. */
import { type WxState, raining } from './rain-rules.ts';

/** From this real temperature (°C) the heat is noticeable: a few people carry a drink. */
export const WARM_C = 28;
/** From this real temperature (°C) it is really hot: more drinks, more often. */
export const HOT_C = 32;
/** Daylight (S.dayK) and cloud cover (S.cloud) limits, the same as the sun umbrellas. */
export const HEAT_DAYK = 0.6;
export const HEAT_CLOUD = 0.5;

/** 0 = no heat behaviour, 1 = warm (≥ WARM_C), 2 = hot (≥ HOT_C). */
export type HeatLevel = 0 | 1 | 2;

export interface HeatCtx { kind: WxState; temp: number | null; dayK: number; cloud: number; rain: number; snow: number }

/** The heat level right now, from the real reading only. */
export function heatLevel(c: HeatCtx): HeatLevel {
  if (c.kind === 'unavailable' || c.temp === null || !Number.isFinite(c.temp)) return 0;
  if (!(c.dayK > HEAT_DAYK) || !(c.cloud < HEAT_CLOUD) || raining(c.kind, c.rain, c.snow)) return 0;
  return c.temp >= HOT_C ? 2 : c.temp >= WARM_C ? 1 : 0;
}

/** Share of new walkers who carry a drink, per level. */
export const DRINK_SHARE = [0, 0.15, 0.3] as const;
/** Of those, the share with a coconut (the rest carry a water bottle). */
export const COCO_SHARE = 0.4;

export type Drink = 'none' | 'water' | 'coco';

/** What a newly spawned walker carries; `roll` and `kindRoll` are uniform [0, 1) draws. */
export function pickDrink(level: HeatLevel, roll: number, kindRoll: number): Drink {
  if (roll >= DRINK_SHARE[level]) return 'none';
  return kindRoll < COCO_SHARE ? 'coco' : 'water';
}

/** How long a drink lasts (s): raise, a sip with the head back, lower. */
export const SIP_SECS = 2.4;
/** Seconds walking until the next sip, per level, as [min, max]. */
export const SIP_GAP: readonly (readonly [number, number])[] = [[Infinity, Infinity], [9, 16], [5, 10]];

/** Seconds until the next sip; Infinity when there is no heat (nobody stops to drink). */
export function sipGap(level: HeatLevel, roll: number): number {
  const [a, b] = SIP_GAP[level];
  return level === 0 ? Infinity : a + (b - a) * Math.min(Math.max(roll, 0), 1);
}

/** How far the drink is raised (0 = in the hand, 1 = at the mouth) `t` seconds into a sip. */
export function sipRaise(t: number): number {
  if (!(t >= 0) || t >= SIP_SECS) return 0;
  const ramp = 0.35;
  return Math.min(1, t / ramp, (SIP_SECS - t) / ramp);
}

/** Hours (city time) when the coconut-water cart sells, on top of the heat level. */
export const COCO_HOURS = [8, 17] as const;

/** Whether the coconut-water cart is open: daytime hours and real heat. */
export function cocoOpen(level: HeatLevel, hour: number): boolean {
  return level > 0 && hour >= COCO_HOURS[0] && hour < COCO_HOURS[1];
}

/** Chance that a walker without a drink stops at an open coconut cart as they pass it, per level. */
export const BUY_SHARE = [0, 0.2, 0.35] as const;
/** Seconds a customer stands at the cart buying before they drink. */
export const BUY_SECS = 3;

/** Whether a passer-by stops to buy (only one customer at a time); `roll` is a uniform [0, 1) draw. */
export function buysCoco(level: HeatLevel, open: boolean, busy: boolean, roll: number): boolean {
  return open && !busy && roll < BUY_SHARE[level];
}
