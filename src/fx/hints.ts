/* "You can tap this" hints for doors and boardable vehicles, shown only in the first seconds of a
   scene (rules in hints-rules.ts). A door gets a bouncing arrow, a bus a small bus icon that
   blinks a "tap" tick. Drawn in code like everything else; the phase comes from the clock. */
import { put } from '../engine/gfx';
import { CYELL, VOID, WHITE } from '../engine/palette';
import { hintAlpha, hintBlink, hintBob, type HintSpot } from './hints-rules';

const ARROW = ['XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const BUS = ['.XXXXXXX.', 'XWWXWWXWX', 'XXXXXXXXX', '.XX...XX.'];
const TICK = ['.X.', 'XXX', '.X.'];

function glyph(rows: string[], x0: number, y0: number, color: (ch: string) => number) {
  // a full dark outline first, so the icon reads on a lit sign or a dark sky alike
  for (const pass of [0, 1]) rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    if (pass === 1) put(x0 + i, y0 + j, color(ch));
    else for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(x0 + i + dx, y0 + j + dy, VOID);
  }));
}

/** Draws the hints for the spots given; `since` is seconds since the scene was entered. */
export function drawHints(spots: HintSpot[], since: number, used: boolean, clock: number) {
  // shown whole for the whole window: a dither during the fade read as a flicker
  const bob = hintBob(clock);
  for (const s of spots) {
    if (hintAlpha(since, used && !s.back) <= 0) continue;
    if (s.kind === 'door') glyph(ARROW, Math.round(s.x) - 3, Math.round(s.y) - 9 + bob, () => WHITE);
    else {
      glyph(BUS, Math.round(s.x) - 4, Math.round(s.y) - 7 - (bob >> 1), (ch) => (ch === 'W' ? WHITE : CYELL));
      if (hintBlink(clock)) glyph(TICK, Math.round(s.x) - 1, Math.round(s.y) - 12 - (bob >> 1), () => WHITE);
    }
  }
}
