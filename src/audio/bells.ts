/* Esperança's church bells: the matriz of Nossa Senhora do Bom Conselho strikes the hours,
   05:00 through 00:00 (12-hour count; silent 01:00–04:00), on the city's real clock.

   Placement: the bells ring in EVERY Esperança scene, not only Praça da Matriz. Esperança is a
   small town and the matriz bell carries across it, so on the other scenes it sounds farther
   away (quieter and duller); in Praça da Matriz it rings near and bright.

   Pinned time (#at=): no automatic ringing at all. A pinned moment is for previews and
   screenshots, and its clock is not the real one. Tapping the church still rings one strike.

   One timer at most, armed only while it could ring (ambient sound on, city Esperança, real
   clock). sync() clears before re-arming, so it can be called freely; missed hours (tab in the
   background, machine asleep, reload, sound switched on late) are never replayed: a timer that
   fires late stays silent and just arms the next hour. Rules live in bells-schedule.ts. */
import { audio } from './audio';
import { nextTargetMs, strikesToRing } from './bells-schedule';

export interface BellContext {
  cityId: string;
  /** City's fixed UTC offset, hours. */
  utc: number;
  /** A #at= moment is pinned. */
  pinned: boolean;
  /** The church is on screen (Praça da Matriz). */
  near: boolean;
}

const CITY = 'esperanca';
let timer = 0, target = 0, get: (() => BellContext) | null = null;

const wanted = (c: BellContext) => audio.isOn() && c.cityId === CITY && !c.pinned;

function clear() { if (timer) clearTimeout(timer); timer = 0; }

function arm(prev?: number) {
  const c = get!();
  target = nextTargetMs(Date.now(), c.utc, prev);
  timer = window.setTimeout(fire, Math.max(0, target - Date.now()));
}

function fire() {
  timer = 0;
  if (!get) return;
  const c = get(), fired = target;
  const n = strikesToRing({
    targetMs: fired, nowMs: Date.now(), utcOffsetH: c.utc,
    soundOn: audio.isOn(), audioReady: audio.ready(), inCity: c.cityId === CITY, pinned: c.pinned,
  });
  if (n) audio.ringHour(n, c.near);
  if (wanted(c)) arm(fired);
}

/** Re-evaluate after the sound toggle, a city change or a scene change. Idempotent. */
function sync(ctx: () => BellContext) {
  get = ctx;
  const c = ctx();
  clear();
  if (wanted(c)) arm();
  else if (c.cityId !== CITY || c.pinned) audio.cancelPeal(); // left town mid-peal (muting cancels it in audio.toggle)
}

/** Stop everything: no timer, no peal. sync() starts it again. */
function dispose() { clear(); audio.cancelPeal(); }

export const bells = {
  sync, dispose,
  status: () => (timer ? `next ${new Date(target).toISOString().slice(11, 16)}Z` : 'off'),
};
