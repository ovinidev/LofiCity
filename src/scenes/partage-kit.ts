/* Shared by the two scenes inside Partage Shopping (partage-interior.ts, the shops' gallery, and
   partage-alimentacao.ts, the food court and the cinema's front): the mall's own light and the real
   rain running down its skylights. */
import { WW, put } from '../engine/gfx';
import { hashf } from '../engine/math';
import {
  CGREEN, CLOUD, CLOUDD, DAY_RGB, EMISSIVE, FWG, GLOWI, GLOWO, HAZE, MOON, NIGHT_RGB, NPAL, PAL32, RAINB, SKY1, SKY2, SKY3, SKY4, SUN,
} from '../engine/palette';
import { raining } from '../actors/rain-rules';
import { S } from '../sky/state';

/** The sky through the skylights and the glass keeps the global grade; everything else is lit by the mall. */
const KEEP = new Set<number>([SKY1, SKY2, SKY3, SKY4, HAZE, GLOWO, GLOWI, CLOUD, CLOUDD, SUN, MOON]);

/** The mall lights itself: the same by day and night (a touch warmer at night), dimmed to the security
    lights while closed. The green exit signs stay lit, as in any building. */
export function mallGrade(open: boolean) {
  const k = open ? 1 : 0.32, warm = open ? 1 - S.dayK : 0;
  for (let i = 0; i < NPAL; i++) {
    if (KEEP.has(i)) continue;
    const lit = EMISSIVE[i], c = lit ? NIGHT_RGB[i] : DAY_RGB[i], kk = lit ? (open ? 1 : 0.6) : k;
    const r = Math.min(255, c[0] * kk + 10 * warm) | 0, g = Math.min(255, c[1] * kk + 4 * warm) | 0, b = Math.max(0, Math.min(255, c[2] * kk - 6 * warm)) | 0;
    PAL32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  for (const [i, h] of [[CGREEN, [30, 120, 60]], [FWG, [190, 255, 200]]] as const) PAL32[i] = (255 << 24) | (h[2] << 16) | (h[1] << 8) | h[0];
}

/** Real rain (or the labelled #wx= test) beads and runs down the skylight panes between rows top and bot;
    `inPane` (optional) keeps the drops on the glass where the skylight is not one long band. */
export function skylightRain(top: number, bot: number, inPane: (x: number, y: number) => boolean = () => true) {
  if (!raining(S.wxKind, S.rain, S.snow)) return;
  const t = S.ms / 1000, n = Math.round(60 + 240 * Math.min(1, S.rain));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hashf(i * 17.3) * WW), y = top + Math.floor(((hashf(i * 5.1) * 36 + t * (4 + hashf(i) * 6)) % (bot - top)));
    if (!inPane(x, y)) continue;
    put(x, y, RAINB); if (i & 1 && inPane(x, y - 1)) put(x, y - 1, RAINB);
  }
}
