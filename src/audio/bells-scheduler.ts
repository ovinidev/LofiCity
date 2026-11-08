/* The bell timer itself, with the clock, timers and sound injected so `node --test` can drive it
   without a DOM or Web Audio. bells.ts wires it to the real ones. Same constraints as
   bells-schedule.ts: no runtime-only TS syntax, and import nothing that touches the DOM. */
import { nextTargetMs, strikesToRing } from './bells-schedule.ts';

export interface BellContext {
  cityId: string;
  /** City's fixed UTC offset, hours. */
  utc: number;
  /** A #at= moment is pinned. */
  pinned: boolean;
  /** The church is on screen (Praça da Matriz). */
  near: boolean;
}

export interface BellDeps {
  now(): number;
  setTimer(fn: () => void, ms: number): number;
  clearTimer(id: number): void;
  /** Ambient sound switched on by the user. */
  soundOn(): boolean;
  /** The AudioContext is running. */
  audioReady(): boolean;
  ring(strikes: number, near: boolean): void;
  cancelPeal(): void;
}

export const BELL_CITY = 'esperanca';

export function createBellScheduler(d: BellDeps) {
  let timer = 0, target = 0, lastFired = 0, get: (() => BellContext) | null = null;

  const wanted = (c: BellContext) => d.soundOn() && c.cityId === BELL_CITY && !c.pinned;

  function clear() { if (timer) d.clearTimer(timer); timer = 0; }

  function arm(c: BellContext, prev?: number) {
    const now = d.now();
    target = nextTargetMs(now, c.utc, prev);
    timer = d.setTimer(fire, Math.max(0, target - now));
  }

  function fire() {
    timer = 0;
    if (!get) return;
    const c = get(), fired = target;
    lastFired = fired;
    const n = strikesToRing({
      targetMs: fired, nowMs: d.now(), utcOffsetH: c.utc,
      soundOn: d.soundOn(), audioReady: d.audioReady(), inCity: c.cityId === BELL_CITY, pinned: c.pinned,
    });
    if (n) d.ring(n, c.near);
    if (wanted(c)) arm(c, fired);
  }

  /** Re-evaluate after the sound toggle, a city change or a scene change. Idempotent. */
  function sync(ctx: () => BellContext) {
    get = ctx;
    const c = ctx();
    clear();
    // lastFired: a timer that fired a little early must not be re-armed for the same hour by a
    // sync() in the moment before that hour (it would ring twice).
    if (wanted(c)) arm(c, lastFired || undefined);
    else if (c.cityId !== BELL_CITY || c.pinned) d.cancelPeal(); // left town mid-peal (muting cancels it in audio.toggle)
  }

  /** Stop everything: no timer, no peal. sync() starts it again. */
  function dispose() { clear(); get = null; d.cancelPeal(); }

  return {
    sync, dispose,
    /** Epoch ms of the armed hour, or 0 when no timer is armed. */
    armedFor: () => (timer ? target : 0),
  };
}
