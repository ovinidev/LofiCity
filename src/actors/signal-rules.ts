/* Pure rules for a traffic light at a zebra crossing on a one-way road (no DOM, unit-tested in
   test/signal-rules.test.ts): the fixed-time phase cycle, the stop / go decision of a vehicle as
   the light changes (on yellow it stops only if it can do so comfortably before the stop line),
   when pedestrians may step onto the crossing (only while vehicles have red, never in the
   clearance intervals), and the spawn direction of a one-way road. */

export type Phase = 'green' | 'yellow' | 'red';

/** Durations in seconds. `clear` is the all-red clearance at each end of red: no vehicle has green
    and no pedestrian may start, so the crossing empties before the other side gets its turn. */
export interface SignalTiming { green: number; yellow: number; red: number; clear: number }

/** Urban fixed-time plan: Brazilian practice uses 3-5 s of yellow on town streets. */
export const SIGNAL: SignalTiming = { green: 24, yellow: 4, red: 20, clear: 2 };

export const cycleLength = (t: SignalTiming = SIGNAL) => t.green + t.yellow + t.red;

export interface SignalState {
  phase: Phase;
  /** Seconds since this phase began. */
  elapsed: number;
  /** Seconds until it ends. */
  left: number;
}

/** The light at `time` seconds into the cycle (any real number; the cycle repeats). */
export function signalAt(time: number, t: SignalTiming = SIGNAL): SignalState {
  const c = cycleLength(t);
  let s = time % c;
  if (s < 0) s += c;
  if (s < t.green) return { phase: 'green', elapsed: s, left: t.green - s };
  s -= t.green;
  if (s < t.yellow) return { phase: 'yellow', elapsed: s, left: t.yellow - s };
  s -= t.yellow;
  return { phase: 'red', elapsed: s, left: t.red - s };
}

/** Driver reaction time (s) and comfortable deceleration (px/s²; a car of 26 px is about 4 m, so
    24 px/s² is roughly 3.7 m/s²). */
export const REACTION = 0.5, DECEL = 24;

/** Distance (px) a vehicle at `speed` px/s needs to come to a stop: reaction plus braking. */
export const stoppingDistance = (speed: number, reaction = REACTION, decel = DECEL) => speed * reaction + (speed * speed) / (2 * decel);

/** A front this far (px) past the stop line counts as past it; less is rounding at the line. */
export const PAST_LINE = 0.5;
const past = (dist: number) => dist < -PAST_LINE;

/**
 * Whether a vehicle `dist` px before its stop line (negative once its front is past it) may go on.
 * Green: go. Past the line: go (clear the crossing). Red: stop. Yellow: stop if it can do so
 * comfortably before the line, otherwise go on. `committed` is true for a vehicle that already
 * decided to go on this yellow: it keeps going even after the light turns red, as a real driver who
 * entered on yellow does (the all-red clearance covers it).
 */
export function mayGo(phase: Phase, dist: number, speed: number, committed = false): boolean {
  if (past(dist) || phase === 'green' || committed) return true;
  if (phase === 'red') return false;
  return stoppingDistance(speed) > dist;
}

/** Whether a vehicle that `mayGo` is now committed to crossing (it decided to go on yellow). The
    commitment ends on green or once the vehicle is past the line. */
export function nextCommitted(phase: Phase, dist: number, go: boolean, committed: boolean): boolean {
  if (phase === 'green' || past(dist)) return false;
  return committed || (phase === 'yellow' && go);
}

/** Whether a pedestrian may step onto the crossing now: only during red, after the opening
    clearance, and with at least `crossTime` seconds plus the closing clearance left, so they are
    off the road before vehicles get green. */
export function pedestrianMayStart(s: SignalState, crossTime: number, t: SignalTiming = SIGNAL): boolean {
  return s.phase === 'red' && s.elapsed >= t.clear && s.left >= crossTime + t.clear;
}

/** The pedestrian signal head: walk (green figure) while pedestrians may start, otherwise don't walk. */
export const pedestrianLight = (s: SignalState, crossTime: number, t: SignalTiming = SIGNAL): 'walk' | 'dont' =>
  (pedestrianMayStart(s, crossTime, t) ? 'walk' : 'dont');

/** Direction a vehicle spawned on `lane` drives: on a one-way road always `oneWay` (+1 = left to
    right), otherwise the far lane (0) drives left and the near lane right. */
export const spawnDir = (lane: number, oneWay: 1 | -1 | 0): number => (oneWay !== 0 ? oneWay : lane === 0 ? -1 : 1);
