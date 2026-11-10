/* Pure wind rules (no DOM, unit-tested in test/wind-rules.test.ts). S.wind is the signed scene
   value built from the real Open-Meteo wind speed in live.ts:

     S.wind = clamp(km/h / 55, 0, 1.2) * sign * 0.9 + 0.05     (sign: +1 blowing west → east)

   so calm is 0.05 and the formula is offset by that 0.05. These helpers invert it: back to km/h,
   to a 0..1 visual strength and to a direction, and say when the wind is "strong" (≥ 30 km/h, i.e.
   |S.wind − 0.05| ≥ 0.4909: S.wind ≥ 0.5409 one way or ≤ −0.4409 the other). Nothing here invents
   wind; it only reads the value the real reading (or the labelled #wind= / #wx= test) put in S. */
import { type WxState, raining } from '../actors/rain-rules.ts';

/** The calm offset live.ts adds to every reading. */
export const WIND_CALM = 0.05;
/** km/h at which wind counts as strong (bandeirolas stand out, dust blows, people remark on it). */
export const STRONG_KMH = 30;
/** km/h at which the visual strength reaches 1. */
export const FULL_KMH = 45;

/** The scene value for a speed and a direction, exactly as live.ts builds it from Open-Meteo. */
export function windValue(kmh: number, sign: number): number {
  const k = Number.isFinite(kmh) ? Math.min(Math.max(kmh / 55, 0), 1.2) : 0;
  return k * (sign >= 0 ? 1 : -1) * 0.9 + WIND_CALM;
}

/** km/h back from a scene value (0 when calm or not a number). */
export function windKmh(w: number): number {
  return Number.isFinite(w) ? (Math.abs(w - WIND_CALM) * 55) / 0.9 : 0;
}

/** The S.wind magnitude at the strong threshold, for the docs and the tests: 0.4909 from calm. */
export const STRONG_DELTA = (STRONG_KMH * 0.9) / 55;

/** 0..1 visual strength: 0 when calm, 1 at FULL_KMH and above. Effects scale with this. */
export function windStrength(w: number): number {
  return Math.min(1, windKmh(w) / FULL_KMH);
}

/** Which way the wind blows on screen: +1, −1, or 0 when calm. */
export function windDir(w: number): number {
  const d = Number.isFinite(w) ? w - WIND_CALM : 0;
  return Math.abs(d) < 1e-6 ? 0 : Math.sign(d);
}

/** Wind at or above STRONG_KMH (tiny tolerance so the exact threshold value counts). */
export function strongWind(w: number): boolean {
  return windKmh(w) >= STRONG_KMH - 1e-9;
}

export interface DebrisCtx { city: string; kind: WxState; wind: number; rain: number; snow: number; wet: number }

/** Dust, dry leaves and scraps of paper along the ground: Esperança only, a genuine reading (or a
    labelled test), strong wind and dry weather (no gated rain / snow, the streets not still wet). */
export function debrisOn(c: DebrisCtx): boolean {
  return c.city === 'esperanca' && c.kind !== 'unavailable' && strongWind(c.wind)
    && !raining(c.kind, c.rain, c.snow) && c.rain + c.snow < 0.02 && c.wet < 0.3;
}

/** How many debris particles for this strength (0 below the strong threshold), within `cap`. */
export function debrisCount(w: number, cap: number): number {
  if (!strongWind(w)) return 0;
  const over = Math.min(1, (windKmh(w) - STRONG_KMH) / (FULL_KMH + 10 - STRONG_KMH));
  return Math.max(0, Math.min(cap, Math.round(cap * (0.45 + 0.55 * over))));
}

/** The #wind= test override: `#wind=40` (km/h, west → east), `#wind=-40` (the other way),
    `#wind=strong` (40 km/h) or `#wind=calm` (0). Returns the scene value and the label the HUD shows,
    or null when absent / invalid. */
export function parseWindOverride(hash: string): { wind: number; label: string } | null {
  const m = /(?:^|[#&])wind=(-?[\w.]+)/.exec(hash);
  if (!m) return null;
  const v = m[1], label = `wind=${v}`;
  if (v === 'strong') return { wind: windValue(40, 1), label };
  if (v === 'calm') return { wind: windValue(0, 1), label };
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > 200) return null;
  return { wind: windValue(Math.abs(n), n < 0 ? -1 : 1), label };
}
