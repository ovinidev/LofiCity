/* Pure street rules shared by the scenes (no DOM, unit-tested in test/street-rules.test.ts):
   how far a vehicle may move when a zebra crossing is in use (stop line and queue spacing, with
   motorcycles riding beside bigger vehicles), and which pedestrian archetypes ride a bicycle (so
   a scene can keep its pavement to people on foot). */

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

/**
 * A vehicle on a side-on road (br-traffic.ts): `x` is its left edge as drawn, `dir` +1 drives right.
 * `beside` is true for a motorcycle riding alongside a bigger vehicle in its lane (it is drawn
 * between the lanes, so the two read as side by side, not as one sprite on top of the other).
 */
export interface QVeh { x: number; len: number; dir: number; lane: number; moto: boolean; beside: boolean }
export const leadX = (v: QVeh) => (v.dir > 0 ? v.x + v.len : v.x);
export const rearX = (v: QVeh) => (v.dir > 0 ? v.x : v.x + v.len);
/** Bumper-to-bumper gap kept by a queue at a stop line. */
export const QUEUE_GAP = 3;

/** Whether motorcycle `m` is alongside a bigger vehicle in its lane: their bodies overlap, or it is
    within `ahead` px of drawing level with one (so it moves aside just before it gets there). */
export function besideAny(m: QVeh, others: readonly QVeh[], ahead = 6): boolean {
  if (!m.moto) return false;
  const x0 = m.dir > 0 ? m.x : m.x - ahead;
  return others.some((o) => o !== m && !o.moto && o.lane === m.lane && overlaps(x0, m.len + ahead, o.x, o.x + o.len));
}

/**
 * How far `v` may advance before it comes within `gap` of a vehicle in `held` ahead of it in the
 * same queue (0 when it is already that close). A queue is one lane and one row: vehicles on the
 * lane queue with each other, motorcycles riding beside queue only with other ones beside. Combined
 * with the stop line (yieldLimit), no two bodies in a row ever overlap at a crossing.
 */
export function queueLimit(v: QVeh, held: readonly QVeh[], gap = QUEUE_GAP): number {
  let lim = Infinity;
  for (const o of held) {
    if (o === v || o.lane !== v.lane || o.dir !== v.dir || o.beside !== v.beside) continue;
    if ((leadX(o) - leadX(v)) * v.dir <= 0) continue; // not ahead of v
    lim = Math.min(lim, Math.max(0, (rearX(o) - leadX(v)) * v.dir - gap));
  }
  return lim;
}

/** How far `v` may advance toward a crossing whose stop lines are `stopFwd` / `stopBack`: its stop
    line while the crossing is `occupied`, and never into the vehicle held ahead of it. */
export function holdLimit(v: QVeh, held: readonly QVeh[], stopFwd: number, stopBack: number, occupied: boolean, gap = QUEUE_GAP): number {
  const line = yieldLimit(leadX(v), v.dir, stopFwd, stopBack, occupied);
  return line === Infinity ? Infinity : Math.min(line, queueLimit(v, held, gap));
}

/** Pedestrian archetypes drawn on a bicycle (people.ts: cyclists and delivery riders). */
export const BIKE_ARCHETYPES: ReadonlySet<string> = new Set(['bike', 'delivery']);

/** The archetype weights a scene may spawn: all of them, or only people on foot when `bikes` is false. */
export function allowedArchetypes<T extends string>(weights: [T, number][], bikes: boolean): [T, number][] {
  return bikes ? weights : weights.filter(([a]) => !BIKE_ARCHETYPES.has(a));
}
