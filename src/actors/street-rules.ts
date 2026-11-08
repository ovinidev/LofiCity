/* Pure street rules shared by the scenes (no DOM, unit-tested in test/street-rules.test.ts):
   how far a vehicle may move when a zebra crossing is in use, and which pedestrian archetypes
   ride a bicycle (so a scene can keep its pavement to people on foot). */

/**
 * How far a vehicle at `pos` heading `dir` along its road axis may advance this tick when a zebra
 * crossing is `occupied`. `stopFwd` is the stop line for vehicles moving toward larger values
 * (dir > 0), `stopBack` the one for vehicles moving toward smaller values (dir < 0); `pos` is the
 * vehicle's leading edge on that axis. A vehicle already past its stop line carries on (Infinity),
 * as does everyone while the crossing is clear.
 */
export function yieldLimit(pos: number, dir: number, stopFwd: number, stopBack: number, occupied: boolean): number {
  if (!occupied) return Infinity;
  if (dir > 0 && pos <= stopFwd) return Math.max(0, stopFwd - pos);
  if (dir < 0 && pos >= stopBack) return Math.max(0, pos - stopBack);
  return Infinity;
}

/** Whether a body spanning [x, x + len) overlaps the open zone (z0, z1). */
export const overlaps = (x: number, len: number, z0: number, z1: number) => x + len > z0 && x < z1;

/** Pedestrian archetypes drawn on a bicycle (people.ts: cyclists and delivery riders). */
export const BIKE_ARCHETYPES: ReadonlySet<string> = new Set(['bike', 'delivery']);

/** The archetype weights a scene may spawn: all of them, or only people on foot when `bikes` is false. */
export function allowedArchetypes<T extends string>(weights: [T, number][], bikes: boolean): [T, number][] {
  return bikes ? weights : weights.filter(([a]) => !BIKE_ARCHETYPES.has(a));
}
