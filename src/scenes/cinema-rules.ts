/* Cinema in Remígio: session schedule and the on-screen "movie" sequencing. Pure functions of an
   instant (epoch ms, so #at= is respected) on the city's own clock; no DOM, no weather (the room is
   indoors) and no Math.random: every shot comes from a seeded shuffle per session, so the same
   moment always shows the same shot.

   The schedule is art direction, not a real timetable: the room runs sessions from 14:00 to 23:00,
   one every 2h30 (14:00, 16:30, 19:00, 21:30). Each block opens with a short pre-show (house lights
   half up, people finding their seats), then the film until the next block or closing time.

   Keep this file free of TS-only runtime syntax (enums, namespaces): `node --test` runs it by
   stripping the types. */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const OPEN_H = 14;
export const CLOSE_H = 23;
/** Minutes from one session start to the next. */
export const BLOCK_MIN = 150;
/** Minutes of pre-show at the start of each session. */
export const PRESHOW_MIN = 12;

export type Phase = 'closed' | 'preshow' | 'film';
export interface Session {
  phase: Phase;
  /** Session index of the day (0 = 14:00), -1 when closed. */
  block: number;
  /** Seconds since the current phase began (0 when closed). */
  sec: number;
  /** Local hour of the next session start (today's or 14:00 tomorrow). */
  next: number;
}

/** Local fractional hour [0, 24) and local day number at an instant for a fixed UTC offset. */
export function localTime(ms: number, utc: number): { hour: number; day: number } {
  const local = ms + utc * HOUR_MS;
  return { hour: (((local % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS, day: Math.floor(local / DAY_MS) };
}

/** Session state at a local fractional hour. */
export function sessionAt(hour: number): Session {
  const blocks = Math.ceil(((CLOSE_H - OPEN_H) * 60) / BLOCK_MIN);
  if (hour < OPEN_H || hour >= CLOSE_H) return { phase: 'closed', block: -1, sec: 0, next: OPEN_H };
  // the tiny epsilon keeps boundaries like 14:12 on the right side despite float rounding
  const min = (hour - OPEN_H) * 60, block = Math.min(blocks - 1, Math.floor((min + 1e-9) / BLOCK_MIN)), into = min - block * BLOCK_MIN;
  const nextMin = (block + 1) * BLOCK_MIN, next = nextMin < (CLOSE_H - OPEN_H) * 60 ? OPEN_H + nextMin / 60 : OPEN_H;
  if (into + 1e-9 < PRESHOW_MIN) return { phase: 'preshow', block, sec: Math.max(0, into) * 60, next: OPEN_H + (block * BLOCK_MIN) / 60 };
  return { phase: 'film', block, sec: Math.max(0, into - PRESHOW_MIN) * 60, next };
}

// ---------- the movie: short shots in a seeded order ----------
export const SHOTS = ['heli', 'armor', 'shield', 'hammer', 'brawl', 'doom', 'card'] as const;
export type ShotKind = (typeof SHOTS)[number];
/** Seconds per shot, including the fade in and the black frames at its end. */
export const SHOT_S = 7;
/** Seconds of fade in from black at the start of a shot. */
export const FADE_S = 0.5;
/** Seconds of black frames at the end of every shot (trailer-style cut). */
export const BLACK_S = 0.9;

export interface Shot {
  kind: ShotKind;
  /** Shot number since the film began. */
  index: number;
  /** Per-shot seed for the layout (sides, backdrop, who fights whom). */
  seed: number;
  /** Seconds into the shot [0, SHOT_S). */
  t: number;
  /** 0 = black, 1 = fully visible (fade in, then the black tail). */
  vis: number;
}

function hash(x: number): number {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Seeded shuffle of the shot kinds for round `r` of a session. */
function round(seed: number, r: number): ShotKind[] {
  const a = [...SHOTS];
  let s = hash(seed ^ Math.imul(r + 1, 0x9e3779b1));
  for (let i = a.length - 1; i > 0; i--) {
    s = hash(s + i);
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Order of a round with its first shot never repeating the last shot of the round before. */
function order(seed: number, r: number): ShotKind[] {
  const a = round(seed, r);
  if (r > 0 && a[0] === round(seed, r - 1)[SHOTS.length - 1]) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/** Seed of a session: the local day and the session index. */
export const sessionSeed = (day: number, block: number) => hash(day * 16 + block + 0x51e);

/** The shot on screen `sec` seconds into the film of a session (seed from sessionSeed). */
export function shotIn(seed: number, sec: number): Shot {
  const index = Math.floor(Math.max(0, sec) / SHOT_S), t = Math.max(0, sec) - index * SHOT_S;
  const n = SHOTS.length, kind = order(seed, Math.floor(index / n))[index % n];
  const vis = t < FADE_S ? t / FADE_S : t >= SHOT_S - BLACK_S ? 0 : 1;
  return { kind, index, seed: hash(seed ^ (index * 0x2545)), t, vis };
}

/** The shot on screen at an instant, or null when no film is running (closed or pre-show). */
export function shotAt(ms: number, utc: number): Shot | null {
  const { hour, day } = localTime(ms, utc), s = sessionAt(hour);
  return s.phase === 'film' ? shotIn(sessionSeed(day, s.block), s.sec) : null;
}
