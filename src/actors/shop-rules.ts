/* Pure rules for the people at a shop front (vendors out front, customers going in and out), so
   they can be unit-tested with `node --test`. No DOM, no TS-only runtime syntax; the rain reaction
   comes from the shared rain-rules.ts like every other walker's. */
import { HURRY, type WxState, opensUmbrella, raining } from './rain-rules.ts';

/** Vendors standing out front: none when the shop is closed, otherwise at least one, more as the street fills. */
export function vendorCount(open: boolean, busy: number, max: number): number {
  if (!open || max <= 0) return 0;
  return Math.max(1, Math.min(max, Math.round(max * Math.min(1, busy * 1.6))));
}

/** Seconds until the next customer walks in or out. `weight` is how busy the shop is next to an ordinary one
    (Armazém Paraíba is high); `roll` is a random number in [0, 1). Infinity when the street is empty. */
export function nextVisitIn(busy: number, weight: number, roll: number): number {
  if (busy < 0.03 || weight <= 0) return Infinity;
  return (5 + roll * 6) / (busy * weight);
}

/** Customers on screen at once for one shop: never more than the pool allows, fewer when it is quiet. */
export function visitorCap(busy: number, weight: number, pool: number): number {
  return Math.max(1, Math.min(pool, Math.round(1 + busy * weight * 2)));
}

/** How a customer who sets off now copes with the weather, exactly as the street pedestrians: in real
    rain or snow most open an umbrella (opensUmbrella) and the rest hurry; dry or unknown weather
    changes nothing. `roll` is a uniform [0, 1) draw from a seeded generator. */
export function customerRain(kind: WxState, rain: number, snow: number, roll: number): { umbrella: boolean; speedK: number } {
  const umbrella = opensUmbrella(kind, rain, snow, roll);
  return { umbrella, speedK: !umbrella && raining(kind, rain, snow) ? HURRY : 1 };
}

/** True when this visit is someone leaving the shop (half the time), false when someone walks in. */
export const visitIsExit = (roll: number): boolean => roll < 0.5;
