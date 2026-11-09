/* Partage Shopping (Campina Grande): opening hours shared by the street front (partage-shopping.ts)
   and the mall's inside (partage-interior.ts), so the doors, the lit signs, the shop shutters and the
   crowd inside always agree at the same instant. Pure functions of the city's weekday and local
   fractional hour; no DOM, no weather (the inside is indoors) and no randomness.

   The hours are art direction, not the mall's real timetable: Monday to Saturday 10h-22h, Sundays
   14h-20h. The shops pull their shutters down one after another over the last minutes before
   closing; the people inside thin out over the same minutes.

   The cinema on the upper floor keeps the cinema schedule of cinema-rules.ts (14:00-23:00); its door
   inside the mall opens while both the mall and the cinema are.

   Keep this file free of TS-only runtime syntax (enums, namespaces): `node --test` runs it by
   stripping the types. */
import { doorTap as cinemaDoor } from './cinema-rules.ts';

/** [opening, closing) local hours for a weekday (0 = Sunday). */
export function hoursOn(weekday: number): readonly [number, number] {
  return weekday === 0 ? [14, 20] : [10, 22];
}

/** Whether the mall is open at a local fractional hour of that weekday. */
export function mallOpen(weekday: number, hour: number): boolean {
  const [a, b] = hoursOn(weekday);
  return hour >= a && hour < b;
}

/** The door: in while open, otherwise a short pt-BR note with the next opening hour. */
export function doorTap(weekday: number, hour: number): { enter: true } | { enter: false; say: string } {
  if (mallOpen(weekday, hour)) return { enter: true };
  const [a] = hoursOn(weekday);
  if (hour < a) return { enter: false, say: `Fechado, abre às ${a}h` };
  return { enter: false, say: `Fechado, abre amanhã às ${hoursOn((weekday + 1) % 7)[0]}h` };
}

/** Minutes before closing over which the shops pull their shutters down, one after another. */
export const SHUTTER_MIN = 15;
/** Minutes one shutter takes to come all the way down. */
export const SHUTTER_ROLL_MIN = 3;

/** How far shop `i` (of `n`) has its shutter down: 0 up (open), 1 down (closed). All up while open
    outside the last SHUTTER_MIN minutes; staggered down over them; all down while the mall is closed. */
export function shutterAt(weekday: number, hour: number, i: number, n: number): number {
  if (!mallOpen(weekday, hour)) return 1;
  const left = (hoursOn(weekday)[1] - hour) * 60; // minutes to closing
  const span = SHUTTER_MIN - SHUTTER_ROLL_MIN - 1; // the last one is all the way down a minute before closing
  const start = SHUTTER_MIN - (n > 1 ? (((i * 7) % n) / (n - 1)) * span : 0); // a fixed shuffled order
  return Math.max(0, Math.min(1, (start - left) / SHUTTER_ROLL_MIN));
}

/** How many people walk the mall's corridors, as a factor on the city's rhythm (S.busy): none while
    closed, more in the evening and at weekends, thinning out over the last SHUTTER_MIN minutes. */
export function insideCrowd(weekday: number, hour: number): number {
  if (!mallOpen(weekday, hour)) return 0;
  const eve = hour >= 17 ? 1.4 : 1, wkend = weekday === 0 || weekday === 6 ? 1.3 : 1;
  const left = (hoursOn(weekday)[1] - hour) * 60;
  return 1.2 * eve * wkend * (left < SHUTTER_MIN ? Math.max(0.1, left / SHUTTER_MIN) * 0.5 : 1);
}

/** The cinema's door inside the mall: in while the mall is open and a session is on (or about to be);
    otherwise the cinema's own note ("Fechado, volta às 14h"). */
export function cinemaDoorTap(weekday: number, hour: number): { enter: true } | { enter: false; say: string } {
  if (!mallOpen(weekday, hour)) return doorTap(weekday, hour);
  return cinemaDoor(hour);
}
