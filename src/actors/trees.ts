/* Seasonal trees: a canopy built from overlapping circles, recoloured each frame
   from the season (bare winter branches, sakura bloom, summer green, momiji red),
   with snow settling on the canopy top and on bare branches. The canopy (never the trunk) sways
   with the real wind (S.wind through sky/wind-rules.ts): still when calm, a pixel at a light
   breeze, a clear lean and sway in strong wind, the top more than the bottom. */
import { put, rect } from '../engine/gfx';
import { bay, type Rng } from '../engine/math';
import { BARK, LEAF1, LEAF2, LEAFG, LEAFGD, MOMIJI, PETAL, SAKURA, SAKURAD, SNOW } from '../engine/palette';
import { S } from '../sky/state';
import { windDir, windStrength } from '../sky/wind-rules';

export type TreeKind = 'street' | 'sakura' | 'maple' | 'pine';
/** top / bot: the canopy's rows (for the sway), ph: its own sway phase. */
export interface Tree { kind: TreeKind; px: number[]; branches: number[][]; trunk: number[]; top: number; bot: number; ph: number }

/** cx = trunk centre, gy = ground row, s = scale (1 ≈ 50 px tall). */
export function makeTree(cx: number, gy: number, s: number, rng: Rng, kind: TreeKind = 'street'): Tree {
  const top = gy - Math.round(58 * s);
  const circles = kind === 'pine'
    ? [[0, 6, 9], [-9, 14, 8], [9, 15, 8], [0, 20, 11], [-14, 24, 7], [14, 25, 7], [0, -2, 6]]
    : [[0, 6, 13], [-12, 14, 10], [12, 14, 11], [-4, 19, 9], [6, -1, 8], [-16, 20, 6], [17, 20, 6]];
  const C = circles.map(([dx, dy, r]) => [cx + dx * s, top + dy * s, r * s]);
  const inside = (x: number, y: number) => C.some(([X, Y, r]) => (x - X) ** 2 + (y - Y) ** 2 <= r * r);
  const px: number[] = [];
  for (let y = Math.floor(top - 12 * s); y < gy - 18 * s; y++)
    for (let x = Math.floor(cx - 30 * s); x < cx + 30 * s; x++) {
      if (!inside(x, y)) continue;
      const shade = (y - top - 8 * s) / (10 * s) + (x - cx + 4) / (30 * s) + bay(x, y) * 0.8 > 0.9 ? 1 : 0;
      px.push(x, y, rng(), rng(), shade, inside(x, y - 1) ? 0 : 1, rng());
    }
  const b = (a: number, c: number, d: number, e: number) => [cx + a * s, gy + c * s, cx + d * s, gy + e * s];
  const branches = [b(0, -39, -12, -53), b(1, -41, 13, -55), b(0, -43, 0, -65), b(-8, -49, -18, -48), b(10, -51, 19, -49), b(0, -55, -6, -65), b(4, -57, 10, -67)];
  return { kind, top: top - 12 * s, bot: gy - 18 * s, ph: cx * 0.37, px, branches, trunk: [Math.round(cx - 1 * s), Math.round(gy - 43 * s), Math.max(2, Math.round(3 * s)), Math.round(43 * s)] };
}

/** Sideways canopy offset (px) for a row at height share u (0 = canopy bottom, 1 = top). */
function swayAt(t: Tree, u: number) {
  const st = windStrength(S.wind);
  if (st < 0.05) return 0;
  const k = t.kind === 'pine' ? 0.6 : 1, time = S.ms / 1000;
  const lean = windDir(S.wind) * st * 2.4, sway = Math.sin(time * (1.1 + st * 1.4) + t.ph) * (0.3 + st * 2);
  return Math.round((lean + sway) * k * (0.35 + 0.65 * u));
}

function line(x0: number, y0: number, x1: number, y1: number, snowTop: boolean) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    put(x, y, BARK);
    if (snowTop && bay(x, y) < S.snowCover) put(x, y - 1, SNOW);
  }
}

export function drawTree(t: Tree) {
  const cov = S.snowCover;
  let { density, pink, red } = S.tree;
  if (t.kind === 'pine') { density = 1; pink = 0; red = 0; }
  if (t.kind === 'maple') red = Math.min(1, red * 1.3);
  if (t.kind !== 'sakura') pink = 0;
  const [tx, ty, tw, th] = t.trunk;
  rect(tx, ty, tw, th, BARK);
  const span = Math.max(1, t.bot - t.top), tip = swayAt(t, 0.6);
  if (t.kind !== 'pine') for (const [a, b, c, d] of t.branches) line(a, b, c + tip, d, density < 0.3 && cov > 0.15);
  const px = t.px;
  // offsets per canopy height band, computed once per frame (rows of the same band move together)
  const o0 = swayAt(t, 0.15), o1 = swayAt(t, 0.5), o2 = swayAt(t, 0.85);
  for (let i = 0; i < px.length; i += 7) {
    if (px[i + 2] >= density) continue;
    const pk = px[i + 3], sh = px[i + 4], tex = px[i + 6];
    let c: number;
    if (pk < pink) c = sh ? (tex < 0.25 ? SAKURA : SAKURAD) : tex < 0.2 ? PETAL : tex < 0.3 ? SAKURAD : SAKURA;
    else if (pk < red) c = sh ? (tex < 0.5 ? LEAF1 : MOMIJI) : tex < 0.3 ? LEAF2 : tex < 0.45 ? LEAF1 : MOMIJI;
    else c = t.kind === 'pine' ? (sh || tex < 0.3 ? LEAFGD : LEAFG) : sh ? (tex < 0.2 ? LEAFG : LEAFGD) : tex < 0.25 ? LEAFGD : LEAFG;
    if (px[i + 5] && cov > 0.1 && bay(px[i], px[i + 1]) < cov) c = SNOW; // snow stays with its leaves
    const u = (t.bot - px[i + 1]) / span;
    put(px[i] + (u < 0.33 ? o0 : u < 0.66 ? o1 : o2), px[i + 1], c);
  }
}
