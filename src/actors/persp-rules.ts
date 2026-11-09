/* Pure rules for traffic on a street seen down its length (one-point perspective), used by Rua
   Faustino Porto and Rua José Bezerra da Costa. No DOM: unit-tested in test/persp-rules.test.ts.

   Vehicles live in metres along the road: z is the distance from the camera to the vehicle's
   centre, dir +1 drives away from the viewer (right lane, tail lights), dir -1 comes toward it
   (left lane, headlights). Each lane keeps its order: a vehicle never closes within `gap` metres
   of the one ahead. With a zebra crossing, vehicles stop at a line `stopGap` metres before the
   stripes while it is occupied (street-rules.ts yieldLimit); one already past its line carries on.
   A signalised crossing (Rua Manoel Rodrigues de Oliveira) also stops vehicles at that line on red,
   and on yellow unless they cannot stop comfortably (signal-rules.ts mayGo). A one-way road spawns
   every vehicle in its single direction (depthSpawnDir). */
import { type Phase, mayGo, nextCommitted } from './signal-rules.ts';
import { overlaps, yieldLimit } from './street-rules.ts';

export interface DepthCar {
  on: boolean; z: number; dir: 1 | -1; sp: number; cruise: number; len: number;
  /** Decided to go on a yellow light: keeps going even if it turns red (signal-rules.ts). */
  committed?: boolean;
}
export interface DepthCrossing {
  z0: number; z1: number; occupied: boolean;
  /** The vehicle light at the stop line, when the crossing is signalised. */
  signal?: Phase | null;
}

/** signal-rules.ts works in side-on screen pixels (a 26 px car is about 4 m): metres to those pixels. */
export const PX_PER_M = 6.5;

/** Direction of a new vehicle: always `oneWay` on a one-way road, otherwise a coin flip on `r` in [0, 1). */
export const depthSpawnDir = (r: number, oneWay: 1 | -1 | 0 = 0): 1 | -1 => (oneWay !== 0 ? oneWay : r < 0.5 ? 1 : -1);

/** Signed distance (m) from a vehicle's front to its stop line at the crossing (negative once past it). */
export function toStopLine(v: DepthCar, road: DepthRoad): number {
  const c = road.crossing;
  if (!c) return Infinity;
  const line = v.dir > 0 ? c.z0 - road.stopGap : c.z1 + road.stopGap;
  return (line - frontZ(v)) * v.dir;
}
export interface DepthRoad {
  /** Vehicles going away appear here (just behind the camera) and oncoming ones leave here. */
  zNear: number;
  /** Oncoming vehicles appear here (far down the street) and the ones going away leave here. */
  zFar: number;
  /** Minimum bumper-to-bumper gap, metres. */
  gap: number;
  /** Distance from the stop line to the stripes, metres. */
  stopGap: number;
  crossing?: DepthCrossing | null;
}

/** Leading edge of a vehicle along its direction of travel. */
export const frontZ = (c: DepthCar) => c.z + (c.dir * c.len) / 2;

/** Whether a new vehicle heading `dir` fits at its entry point (no one within a car length and gap). */
export function canEnter(cars: readonly DepthCar[], dir: 1 | -1, len: number, road: DepthRoad): boolean {
  const z = dir > 0 ? road.zNear : road.zFar;
  return !cars.some((o) => o.on && o.dir === dir && Math.abs(o.z - z) < (o.len + len) / 2 + road.gap + 1);
}

/** Whether any vehicle's body is on the stripes or between their stop lines (a pedestrian waits for this to clear). */
export function carsOnCrossing(cars: readonly DepthCar[], road: DepthRoad): boolean {
  const c = road.crossing;
  if (!c) return false;
  return cars.some((v) => v.on && overlaps(v.z - v.len / 2, v.len, c.z0 - road.stopGap, c.z1 + road.stopGap));
}

/**
 * Moves every vehicle one tick: ease toward cruise speed, keep the gap to the one ahead in the same
 * lane, stop before an occupied crossing, and switch off once past either end of the road.
 * Vehicles are moved front-first so each one sees where the vehicle ahead ended up this tick.
 */
export function stepDepthCars(cars: DepthCar[], dt: number, road: DepthRoad) {
  const c = road.crossing;
  const order = cars.filter((v) => v.on).sort((a, b) => b.z * b.dir - a.z * a.dir);
  for (const v of order) {
    let lim = Infinity;
    for (const o of order) {
      if (o === v || !o.on || o.dir !== v.dir || (o.z - v.z) * v.dir <= 0) continue;
      const room = Math.abs(o.z - v.z) - (o.len + v.len) / 2 - road.gap;
      lim = Math.min(lim, Math.max(0, room));
    }
    if (c) lim = Math.min(lim, yieldLimit(frontZ(v), v.dir, c.z0 - road.stopGap, c.z1 + road.stopGap, c.occupied));
    if (c?.signal) { // the light: stop at the line on red (and on yellow when there is room to)
      const dist = toStopLine(v, road), go = mayGo(c.signal, dist * PX_PER_M, v.sp * PX_PER_M, v.committed);
      v.committed = nextCommitted(c.signal, dist * PX_PER_M, go, !!v.committed);
      if (!go) lim = Math.min(lim, Math.max(0, dist));
    }
    // slow down smoothly as a limit approaches, speed up again toward cruise
    const want = lim < Infinity ? Math.min(v.cruise, lim * 1.2) : v.cruise;
    v.sp += (want - v.sp) * Math.min(1, dt * 2);
    const move = Math.min(Math.max(0, v.sp) * dt, lim);
    if (move < v.sp * dt) v.sp = move / dt;
    v.z += v.dir * move;
    if ((v.dir > 0 && v.z > road.zFar) || (v.dir < 0 && v.z < road.zNear)) v.on = false;
  }
}
