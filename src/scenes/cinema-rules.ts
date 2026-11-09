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

/** Number of sessions a day. */
const BLOCKS = Math.ceil(((CLOSE_H - OPEN_H) * 60) / BLOCK_MIN);
/** Local hour each session starts (14, 16.5, 19, 21.5), derived from the constants above. */
export const SESSION_STARTS: readonly number[] = Array.from({ length: BLOCKS }, (_, i) => OPEN_H + (i * BLOCK_MIN) / 60);
/** Local hour the film of each session starts, after its pre-show. */
export const FILM_STARTS: readonly number[] = SESSION_STARTS.map((h) => h + PRESHOW_MIN / 60);
/** Local hour the film of each session ends: the next session's start, or closing time. */
export const FILM_ENDS: readonly number[] = SESSION_STARTS.map((_, i) => SESSION_STARTS[i + 1] ?? CLOSE_H);

/** A session time as the room writes it: 14 -> "14H", 16.5 -> "16H30". */
export function hourLabel(h: number): string {
  const hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60);
  return `${hh}H${mm ? String(mm).padStart(2, '0') : ''}`;
}

/** Session state at a local fractional hour. */
export function sessionAt(hour: number): Session {
  const blocks = BLOCKS;
  if (hour < OPEN_H || hour >= CLOSE_H) return { phase: 'closed', block: -1, sec: 0, next: OPEN_H };
  // the tiny epsilon keeps boundaries like 14:12 on the right side despite float rounding
  const min = (hour - OPEN_H) * 60, block = Math.min(blocks - 1, Math.floor((min + 1e-9) / BLOCK_MIN)), into = min - block * BLOCK_MIN;
  const nextMin = (block + 1) * BLOCK_MIN, next = nextMin < (CLOSE_H - OPEN_H) * 60 ? OPEN_H + nextMin / 60 : OPEN_H;
  if (into + 1e-9 < PRESHOW_MIN) return { phase: 'preshow', block, sec: Math.max(0, into) * 60, next: OPEN_H + (block * BLOCK_MIN) / 60 };
  return { phase: 'film', block, sec: Math.max(0, into - PRESHOW_MIN) * 60, next };
}

// ---------- what the room and the street front show (both read the same session state) ----------
/** The lit notice on the screen inside: the closed-room card, the pre-show slide, or null while the film runs. */
export function screenNotice(hour: number): string[] | null {
  const s = sessionAt(hour);
  if (s.phase === 'closed') return ['SALA VAZIA', `PRÓXIMA SESSÃO ${hourLabel(OPEN_H)}`];
  if (s.phase === 'preshow') return [`SESSÃO ${hourLabel(s.next)}`];
  return null;
}

export type RowState = 'done' | 'now' | 'next' | 'later';
export interface Board {
  phase: Phase;
  /** One row per session of the day, in order. */
  rows: { label: string; start: number; state: RowState }[];
  /** The status line under the times. */
  status: string;
}

/** The showtimes board on the street front: every session time, the running or next one
    highlighted, and a status line, all from sessionAt (so it always agrees with the room). */
export function boardAt(hour: number): Board {
  const s = sessionAt(hour);
  const rows = SESSION_STARTS.map((start, i) => {
    let state: RowState;
    if (s.phase === 'closed') state = i === 0 ? 'next' : 'later';
    else state = i < s.block ? 'done' : i === s.block ? 'now' : i === s.block + 1 && s.phase === 'film' ? 'next' : 'later';
    return { label: hourLabel(start), start, state };
  });
  const status = s.phase === 'closed' ? 'FECHADO' : s.phase === 'preshow' ? 'VAI COMEÇAR' : 'EM EXIBIÇÃO';
  return { phase: s.phase, rows, status };
}

/** Tapping the street door: in while the room is open, otherwise a short note and no entry. */
export function doorTap(hour: number): { enter: true } | { enter: false; say: string } {
  return sessionAt(hour).phase === 'closed' ? { enter: false, say: `Fechado, volta às ${OPEN_H}h` } : { enter: true };
}

// ---------- the crowd at the street door (bounded, nothing while the room is closed) ----------
/** At most this many people queue at the door. */
export const QUEUE_MAX = 4;
/** Minutes before a session start that its queue begins to form (only while the room is open). */
export const QUEUE_LEAD_MIN = 15;
/** At most this many people come out when a film ends, one every EXIT_GAP_S seconds. */
export const EXIT_MAX = 5;
export const EXIT_GAP_S = 35;
/** Minutes the last audience takes to leave before closing time (the credits of the last film). */
export const LAST_EXIT_MIN = 5;

/** How many people stand in the queue at the door: it forms in the minutes before a session and
    goes in during the pre-show, one by one, until the film starts. 0 whenever the room is closed. */
export function queueAt(hour: number): number {
  if (sessionAt(hour).phase === 'closed') return 0;
  for (const s of SESSION_STARTS) {
    const lead = s - QUEUE_LEAD_MIN / 60, film = s + PRESHOW_MIN / 60;
    if (hour >= lead && hour < s) return Math.min(QUEUE_MAX, 1 + Math.floor(((hour - lead) / (s - lead)) * QUEUE_MAX));
    if (hour >= s && hour < film) return Math.max(1, Math.ceil(QUEUE_MAX * (1 - (hour - s) / (film - s))));
  }
  return 0;
}

/** Seconds since each person leaving the film came out of the door (newest last), when a film ends:
    right after it ends, or, for the last session, in the minutes before closing. Empty when closed. */
export function exitsAt(hour: number): number[] {
  if (sessionAt(hour).phase === 'closed') return [];
  const out: number[] = [];
  for (const e of FILM_ENDS) {
    const from = e >= CLOSE_H ? e - LAST_EXIT_MIN / 60 : e, sec = (hour - from) * 3600;
    if (sec < 0 || sec >= EXIT_MAX * EXIT_GAP_S + 60) continue;
    for (let k = 0; k < EXIT_MAX; k++) if (sec >= k * EXIT_GAP_S) out.push(sec - k * EXIT_GAP_S);
  }
  return out;
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
export function shotAt(ms: number, utc: number, salt = 0): Shot | null {
  const { hour, day } = localTime(ms, utc), s = sessionAt(hour);
  return s.phase === 'film' ? shotIn((sessionSeed(day, s.block) ^ salt) >>> 0, s.sec) : null;
}
