/* Pure rules for the people at a shop front (vendors out front, customers going in and out), so
   they can be unit-tested with `node --test`. No imports, no DOM, no TS-only runtime syntax. */

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

/** True when this visit is someone leaving the shop (half the time), false when someone walks in. */
export const visitIsExit = (roll: number): boolean => roll < 0.5;
