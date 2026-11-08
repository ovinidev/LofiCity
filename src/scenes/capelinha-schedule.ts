/* Who shows up at the Capelinha das Pedras, and when.

   ART DIRECTION, NOT AN OFFICIAL SCHEDULE. The real chapel's mass times are not modelled; these
   rules only keep the scene quiet and believable:
   - By default nobody is there: no pedestrians, never any cars or motorcycles.
   - Some days have one short daytime mass: the door opens, the interior is lit, a priest waits at
     the door and 3 to 6 people walk up, stand in front of the chapel, then leave. It starts between
     07:00 and 16:15 and lasts 45 to 60 minutes, always ending by 17:00. Chance per day: 55% on
     Sundays, 30% on Saturdays, 15% on weekdays; always on festa days (27 June, the feast of Our
     Lady of Perpetual Help, and 1 January, the chapel's anniversary), at 16:00.
   - A few visitor windows per day (0 to 3), each 5 to 15 minutes between 07:00 and 17:00 and never
     overlapping the mass or each other: one person walks up the rock, raises a phone to take
     photos (with the odd flash) and walks away.
   Everything comes from a seed built from the city's local date (so a pinned `#at=` moment gets the
   same day as everyone else), and figure positions are pure functions of the local hour: the same
   date and time always give the same picture, with no per-frame randomness. Weather does not change
   the schedule. This module is pure (no DOM, no engine imports) so `node --test` can load it. */

/** Events only happen between these local clock hours (well inside daylight in Esperança, 7°S). */
export const DAY_START = 7, DAY_END = 17;
export const MASS_MIN = 45, MASS_MAX = 60, VISIT_MIN = 5, VISIT_MAX = 15; // minutes
export const ATTENDEES_MIN = 3, ATTENDEES_MAX = 6, VISITORS_MAX = 3;

/** A time window in local clock hours (fractional). */
export interface Win { start: number; end: number }
export interface Mass extends Win { attendees: number; seed: number }
export interface Visit extends Win { seed: number }
export interface DaySchedule { key: number; mass: Mass | null; visits: Visit[] }

export interface Day { year: number; month: number; day: number; weekday: number; festa?: boolean }

/** mulberry32, copied so this module has no imports. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable integer key for a local calendar date (month is 0-based, as in `Cal`). */
export const dayKey = (year: number, month: number, day: number) => year * 10000 + (month + 1) * 100 + day;

const minutes = (h: number) => h / 60;
const overlaps = (a: Win, b: Win, marginH = 0) => a.start < b.end + marginH && b.start < a.end + marginH;

/** The whole day's events for one local date. Same date, same schedule. */
export function scheduleFor(d: Day): DaySchedule {
  const key = dayKey(d.year, d.month, d.day), r = rng(Math.imul(key, 0x9e3779b1) ^ 0xca9e11a);
  let mass: Mass | null = null;
  const chance = d.weekday === 0 ? 0.55 : d.weekday === 6 ? 0.3 : 0.15;
  const roll = r(), dur = MASS_MIN + Math.round(r() * (MASS_MAX - MASS_MIN)), people = ATTENDEES_MIN + Math.floor(r() * (ATTENDEES_MAX - ATTENDEES_MIN + 1));
  const slot = r(), mseed = (r() * 4294967296) >>> 0;
  if (d.festa || roll < chance) {
    // start on a quarter hour, leaving room to finish by DAY_END
    const latest = DAY_END - minutes(dur), quarters = Math.floor((latest - DAY_START) * 4);
    const start = d.festa ? Math.min(16, latest) : DAY_START + Math.floor(slot * (quarters + 1)) / 4;
    mass = { start, end: start + minutes(dur), attendees: people, seed: mseed };
  }
  const want = [0, 1, 1, 2, 2, 2, 3][Math.floor(r() * 7)], visits: Visit[] = [];
  for (let tries = 0; tries < 40 && visits.length < want; tries++) {
    const len = minutes(VISIT_MIN + Math.round(r() * (VISIT_MAX - VISIT_MIN)));
    const start = DAY_START + Math.round(r() * (DAY_END - len - DAY_START) * 60) / 60;
    const w: Visit = { start, end: start + len, seed: (r() * 4294967296) >>> 0 };
    if (mass && overlaps(w, mass, minutes(10))) continue;
    if (visits.some((v) => overlaps(w, v, minutes(5)))) continue;
    visits.push(w);
  }
  visits.sort((a, b) => a.start - b.start);
  return { key, mass, visits };
}

export const massActive = (s: DaySchedule, hour: number) => !!s.mass && hour >= s.mass.start && hour < s.mass.end;

// ---------- figures ----------
export type Role = 'priest' | 'attendee' | 'visitor';
export type Pose = 'walk' | 'stand' | 'photo';
export interface Figure {
  role: Role; x: number; dir: 1 | -1; pose: Pose;
  /** walking cycle phase (pixels walked), for the stride frame */
  step: number;
  /** a camera flash this instant */
  flash: boolean;
  /** stable per-person look seed, for clothes and skin */
  look: number;
}
/** Where things are in the scene, in world pixels. */
export interface Stage { door: number; worldW: number }

const WALK = 9; // px per second, a slow uphill walk

/** A walk from `from` to `to` starting at t0 (seconds); position at t, and whether still moving. */
function walk(from: number, to: number, t0: number, t: number) {
  const dist = Math.abs(to - from), dt = Math.max(0, t - t0), done = dt * WALK >= dist;
  const x = done ? to : from + Math.sign(to - from) * dt * WALK;
  return { x, done, step: Math.min(dt * WALK, dist) };
}

/** Everybody on stage at a local hour. Empty outside the day's windows. */
export function figuresAt(s: DaySchedule, hour: number, stage: Stage): Figure[] {
  const out: Figure[] = [];
  const offL = -12, offR = stage.worldW + 12;
  if (s.mass && hour >= s.mass.start && hour < s.mass.end) {
    const m = s.mass, t = (hour - m.start) * 3600, len = (m.end - m.start) * 3600, r = rng(m.seed);
    // priest waits in the doorway from just after the door opens until just before it closes
    if (t >= 30 && t < len - 60) out.push({ role: 'priest', x: stage.door, dir: 1, pose: 'stand', step: 0, flash: false, look: m.seed });
    for (let i = 0; i < m.attendees; i++) {
      const left = r() < 0.5, look = (r() * 4294967296) >>> 0;
      // spots either side of the door, facing it, never blocking it
      const spot = stage.door + (left ? -(8 + Math.round(r() * 22)) : 8 + Math.round(r() * 22));
      const arrive = r() * 8 * 60, leave = len - 8 * 60 + r() * 5 * 60;
      const edge = left ? offL : offR;
      if (t < leave) {
        const w = walk(edge, spot, arrive, t);
        if (t < arrive) continue;
        out.push({ role: 'attendee', x: w.x, dir: left ? 1 : -1, pose: w.done ? 'stand' : 'walk', step: w.step, flash: false, look });
      } else {
        const w = walk(spot, edge, leave, t);
        if (w.done) continue;
        out.push({ role: 'attendee', x: w.x, dir: left ? -1 : 1, pose: 'walk', step: w.step, flash: false, look });
      }
    }
  }
  for (const v of s.visits) {
    if (hour < v.start || hour >= v.end) continue;
    const t = (hour - v.start) * 3600, len = (v.end - v.start) * 3600, r = rng(v.seed);
    const left = r() < 0.5, look = (r() * 4294967296) >>> 0;
    // a spot a little away from the chapel, to fit it in the frame
    const spot = stage.door + (left ? -(40 + Math.round(r() * 35)) : 48 + Math.round(r() * 35));
    const edge = left ? offL : offR, back = Math.abs(spot - edge) / WALK, leave = len - back - 5;
    if (t < leave) {
      const w = walk(edge, spot, 0, t);
      let pose: Pose = w.done ? 'stand' : 'walk', flash = false;
      if (w.done) {
        // shots: 10 s cycles, phone raised for the first 6 s; every third shot flashes briefly
        const c = (t - Math.abs(spot - edge) / WALK) / 10, k = Math.floor(c), f = c - k;
        if (f < 0.6) pose = 'photo';
        flash = f >= 0.5 && f < 0.52 && k % 3 === 1;
      }
      out.push({ role: 'visitor', x: w.x, dir: left ? 1 : -1, pose, step: w.step, flash, look });
    } else {
      const w = walk(spot, edge, leave, t);
      if (!w.done) out.push({ role: 'visitor', x: w.x, dir: left ? -1 : 1, pose: 'walk', step: w.step, flash: false, look });
    }
  }
  return out;
}
