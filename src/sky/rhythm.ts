/* Daily rhythm of each city: how many people and vehicles are out, when the birds are busy and
   when the Matriz in Esperança holds mass. Pure functions of an instant (epoch ms, so #at= is
   respected) read on the city's own clock; no DOM, no weather. Weather only scales the result
   later, in state.ts, from the real readings.

   Keep this file free of TS-only runtime syntax (enums, namespaces): `node --test` runs it by
   stripping the types. The only import is cities.ts, which is plain data. */
import { type CityId, cityById } from './cities.ts';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Local fractional hour [0, 24) and weekday (0 = Sunday) at an instant, for a fixed UTC offset. */
export function cityClock(ms: number, utc: number): { hour: number; weekday: number } {
  const local = ms + utc * HOUR_MS;
  const into = ((local % DAY_MS) + DAY_MS) % DAY_MS;
  const day = Math.floor(local / DAY_MS);
  return { hour: into / HOUR_MS, weekday: (((day + 4) % 7) + 7) % 7 }; // 1970-01-01 was a Thursday
}

/** Level at a fractional hour from 25 hourly points (index 24 = midnight again), linear in between. */
function sample(table: readonly number[], hour: number): number {
  const i = Math.floor(hour) % 24, t = hour - Math.floor(hour);
  return table[i] + (table[i + 1] - table[i]) * t;
}

// Hourly levels (0..1, comparable across cities). Owner's art direction for Paraíba:
// Esperança thins out from 19h, is nearly empty 21-05h; its two praças peak 14-15h;
// Campina Grande and João Pessoa are busier by day and in the evening, but quiet 00-05h too.
/** Esperança streets and the other small towns (Areia, Remígio). */
const TOWN = [
  0.04, 0.03, 0.02, 0.02, 0.03, 0.08, 0.34, 0.62, 0.74, 0.76, 0.76, 0.78,
  0.7, 0.7, 0.76, 0.76, 0.7, 0.68, 0.52, 0.34, 0.16, 0.07, 0.05, 0.04, 0.04,
];
/** Praça da Matriz and Praça da Cultura: busiest 14-15h. */
const PRACA = [
  0.04, 0.03, 0.02, 0.02, 0.03, 0.08, 0.3, 0.5, 0.58, 0.6, 0.62, 0.64,
  0.66, 0.78, 0.9, 0.88, 0.72, 0.66, 0.52, 0.32, 0.16, 0.07, 0.05, 0.04, 0.04,
];
/** Small-town car traffic: a trickle at dawn, steadily more as the day goes on, peak at 17-18h. */
const TOWN_TRAFFIC = [
  0.03, 0.02, 0.02, 0.02, 0.03, 0.08, 0.18, 0.28, 0.38, 0.46, 0.54, 0.62,
  0.66, 0.7, 0.76, 0.82, 0.9, 1, 1, 0.78, 0.45, 0.2, 0.1, 0.05, 0.03,
];
/** Campina Grande and João Pessoa. */
const CITY = [
  0.12, 0.07, 0.04, 0.03, 0.04, 0.12, 0.5, 0.82, 0.92, 0.92, 0.92, 0.95,
  0.95, 0.95, 0.98, 0.98, 0.98, 1, 1, 0.92, 0.8, 0.62, 0.45, 0.28, 0.12,
];
/** Tokyo: commute peaks, quiet small hours (the table the app always used). */
const TOKYO = [
  0.25, 0.15, 0.08, 0.05, 0.05, 0.12, 0.4, 0.85, 1, 0.7, 0.55, 0.6,
  0.75, 0.65, 0.6, 0.65, 0.75, 0.95, 1, 0.9, 0.75, 0.6, 0.45, 0.35, 0.25,
];
/** Birds: a small dawn chorus and a strong surge around 17h, when they fly back to trees and wires. */
const BIRDS = [
  0, 0, 0, 0, 0, 0.25, 0.55, 0.35, 0.15, 0.12, 0.12, 0.12,
  0.12, 0.12, 0.12, 0.18, 0.5, 1, 0.55, 0.1, 0, 0, 0, 0, 0,
];

const PRACAS = new Set(['praca-matriz', 'praca-cultura']);

function tables(city: CityId, scene: string): { people: readonly number[]; traffic: readonly number[] } {
  if (city === 'tokyo') return { people: TOKYO, traffic: TOKYO };
  if (city === 'campina' || city === 'joaopessoa') return { people: CITY, traffic: CITY };
  return { people: city === 'esperanca' && PRACAS.has(scene) ? PRACA : TOWN, traffic: TOWN_TRAFFIC };
}

/** People and traffic levels (0..1) for a city and scene at an instant, before weather. */
export function density(city: CityId, scene: string, ms: number): { people: number; traffic: number } {
  const { hour } = cityClock(ms, cityById(city).utc), t = tables(city, scene);
  return { people: sample(t.people, hour), traffic: sample(t.traffic, hour) };
}

/** Bird activity (0..1): how often birds leave and land on the wires and how many flocks cross. Time only. */
export function birdActivity(city: CityId, ms: number): number {
  return sample(BIRDS, cityClock(ms, cityById(city).utc).hour);
}

/** Most pedestrians on screen at once for a crowd level, so quiet hours stay visibly empty. */
export function peopleCap(level: number): number {
  return Math.max(1, Math.min(22, Math.round(1 + 21 * level)));
}

// ---------- Matriz de Nossa Senhora do Bom Conselho (Esperança, Brasília time) ----------
// Assumed schedule (owner's direction, not an official parish timetable): mass every day at 18h
// (Sundays also 07 and 09h), one hour each. The doors stand open every day from 09 to 12h and from
// 16 to 19h so people drop in to pray; around a mass they open earlier and close later.
export const MASS_SUNDAY = [7, 9, 18] as const;
export const MASS_WEEKDAY = [18] as const;
/** Daily hours with the doors open for visits: [from, to). */
export const OPEN_WINDOWS = [[9, 12], [16, 19]] as const;
const ESPERANCA_UTC = -3;
/** Doors open and the faithful start arriving this long before mass. */
const GATHER_H = 20 / 60;
/** People keep arriving for the first minutes, and leave over the last minutes and just after. */
const LATE_H = 5 / 60, LEAVE_FROM_H = 55 / 60, LEAVE_TO_H = 65 / 60;

export interface MassState {
  /** Inside the one-hour mass. */
  active: boolean;
  /** Doors open: a visiting window, or from the gathering until the last people have left. */
  doorsOpen: boolean;
  /** The congregation is arriving (gathering by the door, entering). */
  arriving: boolean;
  /** Mass is ending and people come out. */
  leaving: boolean;
  /** Inside a daily visiting window: people drop in and out one by one. */
  visiting: boolean;
}

/** Mass start hours for a weekday (0 = Sunday). */
export function massHours(weekday: number): readonly number[] {
  return weekday === 0 ? MASS_SUNDAY : MASS_WEEKDAY;
}

/** Where the Matriz is in its mass schedule at an instant (Esperança's clock). */
export function massState(ms: number): MassState {
  const { hour, weekday } = cityClock(ms, ESPERANCA_UTC);
  const st: MassState = { active: false, doorsOpen: false, arriving: false, leaving: false, visiting: false };
  for (const [a, z] of OPEN_WINDOWS) if (hour >= a && hour < z) st.visiting = st.doorsOpen = true;
  for (const s of massHours(weekday)) {
    const d = hour - s; // hours since the start (masses never cross midnight)
    if (d >= 0 && d < 1) st.active = true;
    if (d >= -GATHER_H && d < LEAVE_TO_H) st.doorsOpen = true;
    if (d >= -GATHER_H && d < LATE_H) st.arriving = true;
    if (d >= LEAVE_FROM_H && d < LEAVE_TO_H) st.leaving = true;
  }
  return st;
}

/** True during mass at the Matriz (every day 18h, Sundays also 07 and 09h, one hour each). */
export const massActive = (ms: number): boolean => massState(ms).active;
