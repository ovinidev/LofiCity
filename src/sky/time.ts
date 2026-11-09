/* Clocks and astronomy for the selected city. Offsets are fixed (no DST in either city).
   The sun and the moon use the city's latitude, and its longitude turns clock time into
   solar time, so Esperança's short equatorial twilight and Tokyo's long summer evenings
   both come out right. */
import type { City } from './cities';

export interface Cal { year: number; month: number; day: number; weekday: number; hour: number; doy: number; }

export function calendar(ms: number, city: City): Cal {
  const d = new Date(ms + city.utc * 3.6e6);
  const year = d.getUTCFullYear();
  const doy = Math.floor((d.getTime() - Date.UTC(year, 0, 1)) / 864e5);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return { year, month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay(), hour, doy };
}

const D2R = Math.PI / 180;

/** Clock hour → local solar hour (longitude correction plus the equation of time). */
export function solarHour(doy: number, hour: number, city: City): number {
  const b = (2 * Math.PI / 365) * (doy - 81);
  const eot = (9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)) / 60;
  return hour + city.lon / 15 - city.utc + eot;
}

/** Solar elevation in degrees. */
export function sunElev(doy: number, hour: number, city: City): number {
  const lat = city.lat * D2R;
  const decl = -23.44 * D2R * Math.cos((2 * Math.PI / 365) * (doy + 10));
  const ha = (solarHour(doy, hour, city) - 12) * 15 * D2R;
  return Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)) / D2R;
}

/** Moon phase in [0,1): 0 new, 0.5 full. */
export function moonPhase(ms: number): number {
  const p = ((ms - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

/** Hours from local solar noon to the moon's transit, wrapped to [-12, 12). */
export function moonHourAngle(solar: number, phase: number): number {
  let h = solar - 12 - phase * 24;
  h = ((h % 24) + 36) % 24 - 12;
  return h;
}
export function moonElev(ha: number, city: City): number {
  return Math.asin(Math.cos(city.lat * D2R) * Math.cos(ha * 15 * D2R)) / D2R;
}

/** Month day (1-based) to day of year, ignoring leap years (good enough for seasons). */
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export const doyOf = (month: number, day: number) => CUM[month] + day - 1;
export const inDoy = (doy: number, a: number, b: number) => (a <= b ? doy >= a && doy <= b : doy >= a || doy <= b);

/** Easter Sunday (Gregorian), as a day of year; Holy Week events key off it. */
export function easterDoy(year: number): number {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 864e5);
}
