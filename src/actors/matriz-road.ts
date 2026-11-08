/* Pure traffic rules for the road beside the church in Praça da Matriz (no DOM, unit-tested in
   test/matriz-road.test.ts). R. Manoel Rodrigues de Oliveira is one-way there: every vehicle enters
   below the frame and drives up the road, away from the viewer, toward the church (tail lights
   showing). There is no oncoming traffic. Rows are screen rows: y shrinks as a vehicle recedes. */
import { yieldLimit } from './street-rules.ts';

/** Where the road's curbs would meet (perspective vanishing row). */
export const ROAD_VY = 133.9;
/** Vehicles appear here (below the frame) ... */
export const Y_ENTRY = 192;
/** ... and leave here, past the church's corner. */
export const Y_EXIT = 136;
/** Zebra crossing rows (the pedestrian lanes cross the road here). */
export const CROSS0 = 141, CROSS1 = 147;
/** Stop line while the zebra is in use: two rows short of its near edge. */
export const STOP_ROW = CROSS1 + 2;
/** The only direction of travel: toward smaller rows, away from the viewer. */
export const AWAY = -1 as const;

export interface RoadCar { on: boolean; y: number; sp: number }

/** Bumper gap between two vehicles at row y (in rows; shrinks with distance). */
export const gapAt = (y: number) => 2 + (y - ROAD_VY) * 0.5;

/** Whether a new vehicle fits at the entry row (no one within the gap there). */
export const canEnter = (cars: readonly RoadCar[]) => !cars.some((o) => o.on && Math.abs(o.y - Y_ENTRY) < gapAt(Y_ENTRY) + 2);

/** Switches on a free vehicle at the entry row (going away; the only way in) and returns it, or null
    when the pool is full or the entry is blocked. The caller then picks its kind and speed. */
export function spawnAway<T extends RoadCar>(cars: readonly T[]): T | null {
  const c = cars.find((o) => !o.on);
  if (!c || !canEnter(cars)) return null;
  c.y = Y_ENTRY; c.on = true;
  return c;
}

/**
 * Moves every vehicle one tick up the road: faster near the viewer, never closing within the gap of
 * the one ahead, stopping at the stop line while the zebra is `occupied` (a vehicle already past it
 * carries on), and switching off once past the exit row.
 */
export function stepRoad(cars: RoadCar[], dt: number, occupied: boolean) {
  if (!(dt > 0)) return; // the first frame's dt can be slightly negative (rAF time vs performance.now): never roll back
  const order = cars.filter((c) => c.on).sort((a, b) => a.y - b.y); // front-most (smallest row) first
  for (const c of order) {
    let v = c.sp * 40 * (0.1 + ((c.y - ROAD_VY) / 46) ** 1.5) * dt;
    for (const o of order) if (o !== c && o.on && o.y < c.y) v = Math.min(v, Math.max(0, c.y - o.y - gapAt(c.y)));
    v = Math.min(v, yieldLimit(c.y, AWAY, CROSS0 - 1, STOP_ROW, occupied));
    c.y += AWAY * v;
    if (c.y < Y_EXIT - 0.5) c.on = false;
  }
}
