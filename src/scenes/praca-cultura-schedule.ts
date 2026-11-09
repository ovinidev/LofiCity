/* Praça da Cultura (Esperança): when the little public school beside the plaza is open, when its
   students arrive and leave, and when teenagers play volleyball and football on the plaza.

   ART DIRECTION, NOT THE SCHOOL'S REAL TIMETABLE. Assumed hours, local Esperança time, Monday to
   Friday only (no holidays or school vacations are modelled):
   - morning shift 07:00-12:00, afternoon shift 13:00-17:30;
   - students arrive from 30 min before a shift until 10 min after it starts, busiest just before
     the bell, and leave over the 20 min after it ends;
   - the gate is open from the first arrivals to the last leavers of each shift; the classroom
     windows are lit only inside a shift; on Saturdays, Sundays and outside these hours the gate is
     shut and every window is dark.
   Sports on the plaza (also assumed): weekdays 14:00-17:30 (the morning-shift teenagers, after
   lunch), Saturdays 08:00-11:30 and 14:00-17:30, Sundays 08:00-11:30 and 15:00-17:30. Never at
   night or in the small hours. They need a real weather reading with no rain: real rain pauses a
   game already running (and nobody starts one), unknown weather means nobody plays.

   Pure module: no DOM, no engine imports; the weather comes in from the scene (real reading only). */
import { type WxState, raining } from '../actors/rain-rules.ts';

export interface Shift { start: number; end: number }
export const SHIFTS: readonly Shift[] = [{ start: 7, end: 12 }, { start: 13, end: 17.5 }];
/** Students start arriving this long before a shift, the last ones come in this late, and the
    leavers come out over this long after the end (hours). */
export const ARRIVE_H = 0.5, LATE_H = 10 / 60, LEAVE_H = 20 / 60;
/** Arrivals are busiest this long before the bell (hours). */
const PEAK_H = 0.1;

/** Monday to Friday (weekday 0 = Sunday). */
export const schoolDay = (weekday: number) => weekday >= 1 && weekday <= 5;

export interface SchoolState {
  /** Index of the shift in class (0 morning, 1 afternoon), or -1. */
  shift: number;
  inClass: boolean;
  arriving: boolean;
  leaving: boolean;
  gateOpen: boolean;
  /** Classroom windows lit. */
  lit: boolean;
}

/** The school at a local weekday and fractional hour. */
export function schoolState(weekday: number, hour: number): SchoolState {
  const st: SchoolState = { shift: -1, inClass: false, arriving: false, leaving: false, gateOpen: false, lit: false };
  if (!schoolDay(weekday)) return st;
  SHIFTS.forEach((s, i) => {
    if (hour >= s.start && hour < s.end) { st.inClass = true; st.shift = i; }
    if (hour >= s.start - ARRIVE_H && hour < s.start + LATE_H) st.arriving = true;
    if (hour >= s.end && hour < s.end + LEAVE_H) st.leaving = true;
    if (hour >= s.start - ARRIVE_H && hour < s.end + LEAVE_H) st.gateOpen = true;
  });
  st.lit = st.inClass;
  return st;
}

/** How strongly students are arriving and leaving (0..1 each) at a local weekday and hour. */
export function studentFlow(weekday: number, hour: number): { arrive: number; leave: number } {
  let arrive = 0, leave = 0;
  if (!schoolDay(weekday)) return { arrive, leave };
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
