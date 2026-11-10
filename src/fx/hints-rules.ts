/* When the "you can tap this" hints show (src/fx/hints.ts). Pure, so it can be tested:
   only in the first seconds after a scene is entered, faded in and out, and not once the user
   has already used a door or a bus (they know). Doors and boardable vehicles only. */

export type HintKind = 'door' | 'bus';
/** `back`: a way out of where you are (a SAÍDA sign), which keeps showing even after a door or bus was used. */
export interface HintSpot { x: number; y: number; kind: HintKind; back?: boolean }

/** Seconds a scene shows its hints, counted from entering it. */
export const HINT_START = 0.8;
export const HINT_END = 9;
const FADE = 0.7;

/** 0 (hidden) to 1 (full) for the seconds since the scene was entered. The renderer draws whole for any
    value above 0 (no flicker), so the ramps only set the window's edges. */
export function hintAlpha(sinceEnter: number, used: boolean): number {
  if (used || !(sinceEnter >= HINT_START) || sinceEnter >= HINT_END) return 0;
  return Math.min(1, (sinceEnter - HINT_START) / FADE, (HINT_END - sinceEnter) / FADE);
}

/** Bob offset in pixels (0..2) and a 0/1 blink, both functions of the clock (no randomness). */
export const hintBob = (clock: number): number => Math.round(1 + Math.sin(clock * 5));
export const hintBlink = (clock: number): boolean => Math.floor(clock * 3) % 2 === 0;
