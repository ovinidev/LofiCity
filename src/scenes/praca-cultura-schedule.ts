/* Praça da Cultura (Esperança): when the school is open, when its students arrive and leave, and
   when teenagers play volleyball and football on the plaza. The school is the large cream-yellow
   building at the back of the square (owner's direction); its arched central entrance is where
   the students go in and come out.

   ART DIRECTION, NOT THE SCHOOL'S REAL TIMETABLE. Assumed hours, local Esperança time, Monday to
   Friday only, outside holidays and vacations (below):
   - morning shift 07:00-12:00, afternoon shift 13:00-17:30;
   - students arrive from 30 min before a shift until 10 min after it starts, busiest just before
     the bell, and leave over the 20 min after it ends;
   - the entrance stands open from the first arrivals (06:30) to the last leavers (17:50), and stays
     open over the short lull between the shifts (12:20-12:30: a 10-minute shut door between the
     morning leavers and the afternoon arrivals looked like a glitch, so the gap is closed); the
     classroom windows are open and lit only inside a shift; on Saturdays, Sundays and outside
     these hours the entrance is shut and every window is closed and dark.
   School holidays and vacations (also assumed, typical of a Brazilian public school; not this
   school's published calendar): no students, the entrance shut and the windows dark on
   - the national holidays: 1 Jan, 21 Apr (Tiradentes), 1 May, 7 Sep, 12 Oct, 2 Nov, 15 Nov,
     20 Nov (Consciência Negra), 25 Dec, and the ones that move with Easter: Carnival Monday and
     Tuesday (Easter - 48 / - 47), Good Friday (- 2) and Corpus Christi (+ 60);
   - the mid-year recess: all of July;
   - the long recess: 20 December to 31 January.
   The sports windows below keep their own rules on those days.
   Sports on the plaza (also assumed): weekdays 14:00-17:30 (the morning-shift teenagers, after
   lunch), Saturdays 08:00-11:30 and 14:00-17:30, Sundays 08:00-11:30 and 15:00-17:30. Never at
   night or in the small hours, and never while students are arriving or leaving (their way to the
   entrance crosses the plaza and the volleyball court; the windows are set so, see the tests).
   They need a real weather reading with no rain: real rain pauses a game already running (and
   nobody starts one), unknown weather means nobody plays.

   Pure module: no DOM, no engine imports; the weather comes in from the scene (real reading only). */
import { type WxState, raining } from '../actors/rain-rules.ts';
import { easterDoy } from '../sky/time.ts';

export interface Shift { start: number; end: number }
export const SHIFTS: readonly Shift[] = [{ start: 7, end: 12 }, { start: 13, end: 17.5 }];
/** Students start arriving this long before a shift, the last ones come in this late, and the
    leavers come out over this long after the end (hours). */
export const ARRIVE_H = 0.5, LATE_H = 10 / 60, LEAVE_H = 20 / 60;
/** Arrivals are busiest this long before the bell (hours). */
const PEAK_H = 0.1;

/** Monday to Friday (weekday 0 = Sunday). */
export const schoolDay = (weekday: number) => weekday >= 1 && weekday <= 5;

// ---------- holidays and vacations (art direction, see the header) ----------
/** Fixed national holidays, [month 1-12, day]. */
export const FIXED_HOLIDAYS: readonly (readonly [number, number])[] = [[1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25]];
/** Holidays that move with Easter, in days from Easter Sunday: Carnival Monday and Tuesday, Good Friday, Corpus Christi. */
export const EASTER_HOLIDAYS: readonly number[] = [-48, -47, -2, 60];
/** Vacation windows [month, first day, month, last day], inclusive: July, and 20 Dec to 31 Jan (in two pieces). */
export const VACATIONS: readonly (readonly [number, number, number, number])[] = [[7, 1, 7, 31], [12, 20, 12, 31], [1, 1, 1, 31]];

const doyOfDate = (year: number, month: number, day: number) => Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 864e5);

/** No school on this local date (`doy`: day of year from 0, as S.cal.doy): a national holiday or a vacation day. */
export function noSchool(year: number, doy: number): boolean {
  if (FIXED_HOLIDAYS.some(([m, d]) => doyOfDate(year, m, d) === doy)) return true;
  const e = easterDoy(year);
  if (EASTER_HOLIDAYS.some((k) => e + k === doy)) return true;
  return VACATIONS.some(([m0, d0, m1, d1]) => doy >= doyOfDate(year, m0, d0) && doy <= doyOfDate(year, m1, d1));
}

/** Entrance windows closer than this (hours) are merged: nobody shuts the door for a few minutes between shifts. */
const MERGE_H = 0.25;

export interface SchoolState {
  /** Index of the shift in class (0 morning, 1 afternoon), or -1. */
  shift: number;
  inClass: boolean;
  arriving: boolean;
  leaving: boolean;
  /** The arched central entrance stands open. */
  entranceOpen: boolean;
  /** Classroom windows open and lit. */
  lit: boolean;
}

/** The school at a local weekday and fractional hour; `closed`: a holiday or vacation day (noSchool). */
export function schoolState(weekday: number, hour: number, closed = false): SchoolState {
  const st: SchoolState = { shift: -1, inClass: false, arriving: false, leaving: false, entranceOpen: false, lit: false };
  if (!schoolDay(weekday) || closed) return st;
  SHIFTS.forEach((s, i) => {
    if (hour >= s.start && hour < s.end) { st.inClass = true; st.shift = i; }
    if (hour >= s.start - ARRIVE_H && hour < s.start + LATE_H) st.arriving = true;
    if (hour >= s.end && hour < s.end + LEAVE_H) st.leaving = true;
    if (hour >= s.start - ARRIVE_H && hour < s.end + LEAVE_H) st.entranceOpen = true;
    const next = SHIFTS[i + 1]; // a short lull before the next shift's arrivals keeps the door open
    if (next && next.start - ARRIVE_H - (s.end + LEAVE_H) < MERGE_H && hour >= s.end + LEAVE_H && hour < next.start - ARRIVE_H) st.entranceOpen = true;
  });
  st.lit = st.inClass;
  return st;
}

/** How strongly students are arriving and leaving (0..1 each) at a local weekday and hour; `closed` as in schoolState. */
export function studentFlow(weekday: number, hour: number, closed = false): { arrive: number; leave: number } {
  let arrive = 0, leave = 0;
  if (!schoolDay(weekday) || closed) return { arrive, leave };
  for (const s of SHIFTS) {
    const d = hour - s.start;
    if (hour >= s.start - ARRIVE_H && hour < s.start + LATE_H) arrive = Math.max(arrive, d < -PEAK_H ? 0.15 + 0.85 * (d + ARRIVE_H) / (ARRIVE_H - PEAK_H) : 1 - 0.85 * (d + PEAK_H) / (LATE_H + PEAK_H));
    const e = hour - s.end;
    if (hour >= s.end && hour < s.end + LEAVE_H) leave = Math.max(leave, 1 - 0.85 * e / LEAVE_H);
  }
  return { arrive, leave };
}

// ---------- sports on the plaza ----------

export const SPORTS_WEEKDAY: readonly (readonly [number, number])[] = [[14, 17.5]];
export const SPORTS_SATURDAY: readonly (readonly [number, number])[] = [[8, 11.5], [14, 17.5]];
export const SPORTS_SUNDAY: readonly (readonly [number, number])[] = [[8, 11.5], [15, 17.5]];

export const sportsWindows = (weekday: number) => (weekday === 0 ? SPORTS_SUNDAY : weekday === 6 ? SPORTS_SATURDAY : SPORTS_WEEKDAY);

/** Index of the play window in progress, or -1. */
export function sportsWindowAt(weekday: number, hour: number): number {
  return sportsWindows(weekday).findIndex(([a, b]) => hour >= a && hour < b);
}

export interface WxNow { kind: WxState; rain: number; snow: number }
/** off: nobody plays. play: a game is on. rain: inside a window but it is really raining, so a game
    already running pauses (the players wait at the back of the plaza) and none starts. */
export type SportsState = 'off' | 'play' | 'rain';

/** Whether the teenagers play now. `blocked`: the plaza is taken (craft fair, Paixão de Cristo). */
export function sportsState(weekday: number, hour: number, wx: WxNow, blocked = false): SportsState {
  if (blocked || sportsWindowAt(weekday, hour) < 0 || wx.kind === 'unavailable') return 'off';
  return raining(wx.kind, wx.rain, wx.snow) ? 'rain' : 'play';
}

/** A stable seed for one sport's session in one window of a local date (`day` from dayKey). */
export const sessionSeed = (day: number, win: number, sport: 0 | 1) => (Math.imul(day * 8 + win * 2 + sport, 0x9e3779b1) ^ 0x5c0a1a) >>> 0;
