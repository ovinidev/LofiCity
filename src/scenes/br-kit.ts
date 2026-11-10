/* Props shared by the Paraíba scenes: casario facades with platibandas, white LED street
   lights, concrete poles with sagging wires, palms that sway in the wind, bandeirolas for the
   festa and São João, the Christmas star on the lamp posts, a street-food cart (a coconut-water cart on hot days) and a bonfire. */
import { G, L, Lp, type Layer, getW, put, rect, sx, sy } from '../engine/gfx';
import { bay, type Rng } from '../engine/math';
import {
  AMB, AMBD, BARK, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CNAVY, CRED, CYELL, SKIN2, FOG, FWG, HALO, HALOOK, LEAFG, LEAFGD,
  LEDW, LIGHT, STEEL, STONE, STONEL, TILEW, VOID, WCOOL, WDIM, WHITE, WOOD, WWARM, FPINK, BRIGHT, REFL, BFAR,
} from '../engine/palette';
import { S } from '../sky/state';
import { windDir, windStrength } from '../sky/wind-rules';

const night = () => S.dayK < 0.45 || (S.cloud > 0.9 && S.dayK < 0.65);

// ---------- static pieces (drawn into layers) ----------

export interface Opening { x: number; y: number; w: number; h: number; kind: 'win' | 'door' | 'shop'; rank: number; tv: boolean }
export type Plat = 'reta' | 'deco' | 'frontao' | 'escada' | 'balaustre';

/**
 * A casario facade standing on `ground`: platibanda on top, painted wall, tiled skirting,
 * doors and shuttered windows (homes) or roll-up steel doors (shops). Returns the openings
 * so the scene can light windows at night.
 */
export function casa(ly: Layer, x: number, w: number, h: number, ground: number, wall: number, trim: number, plat: Plat, shop: boolean, rng: Rng): Opening[] {
  const top = ground - h, out: Opening[] = [];
  if (trim === WHITE) trim = TILEW; // painted white walls darken at night; WHITE itself is a light source
  if (wall === WHITE) wall = TILEW;
  L(ly, x, top, w, h, wall);
  L(ly, x, ground - 3, w, 3, trim); // barrado
  // platibanda
  const ph = plat === 'escada' || plat === 'frontao' ? 7 : 5;
  L(ly, x, top - ph + 2, w, ph - 2, wall);
  L(ly, x - 1, top + 2, w + 2, 1, trim);
  L(ly, x, top - ph + 2, w, 1, trim);
  const mid = x + (w >> 1);
  if (plat === 'deco') for (let gx = x + 3; gx < x + w - 2; gx += 4) L(ly, gx, top - ph + 3, 1, ph - 2, trim);
  if (plat === 'escada') { L(ly, mid - 8, top - ph - 1, 16, 3, wall); L(ly, mid - 8, top - ph - 1, 16, 1, trim); L(ly, mid - 4, top - ph - 3, 8, 2, wall); L(ly, mid - 4, top - ph - 3, 8, 1, trim); }
  if (plat === 'frontao') for (let i = 0; i < 9; i++) { L(ly, mid - 9 + i, top - ph + 1 - Math.round(i * 0.5), 18 - i * 2, 1, wall); Lp(ly, mid - 9 + i, top - ph + 1 - Math.round(i * 0.5), trim); Lp(ly, mid + 8 - i, top - ph + 1 - Math.round(i * 0.5), trim); }
  if (plat === 'balaustre') { L(ly, x, top - ph + 2, w, ph - 2, 255); L(ly, x, top - ph + 2, w, 1, trim); for (let bx = x + 1; bx < x + w - 1; bx += 2) L(ly, bx, top - ph + 3, 1, ph - 3, trim); L(ly, x, top + 1, w, 2, trim); }
  // what sits on Brazilian roofs and walls: blue water tanks, satellite dishes, AC units
  const q = rng();
  if (q < 0.45) { const tx = x + 3 + Math.floor(rng() * Math.max(1, w - 14)), ty = top - ph - 5; L(ly, tx, ty, 9, 6, CBLUE); L(ly, tx - 1, ty - 1, 11, 1, CBLUE); L(ly, tx, ty + 2, 9, 1, BNEAR); }
  else if (q < 0.7) { const dx = x + w - 10 - Math.floor(rng() * 6), dy = top - ph - 6; for (let i = 0; i < 7; i++) Lp(ly, dx + i, dy + Math.round(Math.abs(i - 3) ** 1.6 / 3), STONEL); L(ly, dx + 3, dy + 2, 1, 5, STEEL); }
  if (!shop && rng() < 0.35 && h > 30) { const ax = x + 2 + Math.floor(rng() * (w - 9)); L(ly, ax, top + 5, 6, 4, STONEL); for (let i = 0; i < 6; i += 2) Lp(ly, ax + i, top + 6, STONE); }
  // openings
  if (shop) {
    const n = w > 34 ? 2 : 1, dw = Math.floor((w - 6 - (n - 1) * 4) / n);
    for (let i = 0; i < n; i++) {
      const dx = x + 3 + i * (dw + 4), dh = Math.min(h - 8, 18);
      L(ly, dx - 1, ground - dh - 1, dw + 2, dh + 1, trim);
      out.push({ x: dx, y: ground - dh, w: dw, h: dh, kind: 'shop', rank: rng(), tv: false });
    }
    L(ly, x + 2, top + 4, w - 4, 4, trim); // sign board
  } else {
    const dx = rng() < 0.5 ? x + 3 : x + w - 10;
    L(ly, dx - 1, ground - 16, 8, 16, trim); L(ly, dx, ground - 15, 6, 15, rng() < 0.5 ? WOOD : trim === WHITE ? CBLUE : WOOD);
    out.push({ x: dx, y: ground - 15, w: 6, h: 15, kind: 'door', rank: rng(), tv: false });
    for (let wx = x + 3; wx + 8 <= x + w - 2; wx += 11) {
      if (wx + 8 > dx - 1 && wx < dx + 8) continue;
      L(ly, wx - 1, ground - 16, 9, 10, trim);
      out.push({ x: wx, y: ground - 15, w: 7, h: 8, kind: 'win', rank: rng(), tv: rng() < 0.3 });
    }
  }
  return out;
}

/** Whether a shop front is open now (some stay shut even in opening hours). */
const shopOpen = (o: Opening, openShops: boolean) => openShops && o.rank < 0.75;
/** Whether a window is lit now: at night only, fewer late at night. */
const windowLit = (o: Opening) => night() && o.rank < (S.cal.hour >= 22 || S.cal.hour < 5 ? 0.25 : 0.65);

/** Shutters, roll-up doors and lit rooms, drawn every frame. */
export function drawOpenings(list: Opening[], openShops: boolean) {
  const n = night(), t = S.ms / 1000;
  for (const o of list) {
    if (o.kind === 'shop') {
      const open = shopOpen(o, openShops);
      if (open) {
        rect(o.x, o.y, o.w, o.h, n ? WWARM : BNEAR);
        if (n) for (let i = 0; i < o.w; i += 5) rect(o.x + i, o.y + 2, 2, o.h - 2, LIGHT);
        rect(o.x, o.y, o.w, 2, STEEL);
      } else {
        rect(o.x, o.y, o.w, o.h, STEEL);
        for (let j = o.y + 1; j < o.y + o.h; j += 2) rect(o.x, j, o.w, 1, BMID);
      }
      continue;
    }
    if (o.kind === 'door') continue;
    const lit = windowLit(o);
    if (!lit) { rect(o.x, o.y, o.w, o.h, n ? BNEAR : WDIM); for (let j = o.y; j < o.y + o.h; j += 2) rect(o.x, j, o.w, 1, n ? VOID : BMID); continue; }
    const tv = o.tv && Math.sin(t * 7 + o.x) + Math.sin(t * 3.1 + o.y) > 0.3;
    rect(o.x, o.y, o.w, o.h, tv ? WCOOL : WWARM);
    rect(o.x + (o.w >> 1), o.y, 1, o.h, BNEAR); // window bars
  }
}

/** Concrete utility pole. */
export function pole(ly: Layer, x: number, ground: number, h: number) {
  L(ly, x, ground - h, 3, h, STONEL); L(ly, x + 2, ground - h, 1, h, STONE);
  L(ly, x - 4, ground - h + 3, 11, 1, STONE);
  L(ly, x - 3, ground - h + 8, 2, 3, BMID); L(ly, x + 4, ground - h + 8, 2, 3, BMID); // transformer
}

/** Sagging wire between two points. */
export function wire(ly: Layer, x0: number, y0: number, x1: number, y1: number, sag: number, c = VOID) {
  const n = Math.abs(x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    Lp(ly, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), c);
  }
}

// ---------- LED street light ----------
export interface Lamp { x: number; top: number; ground: number; arms: 1 | 2 }

export function lampPost(ly: Layer, l: Lamp) {
  L(ly, l.x, l.top, 2, l.ground - l.top, WHITE); L(ly, l.x + 1, l.top, 1, l.ground - l.top, STEEL);
  L(ly, l.x - 1, l.ground - 4, 4, 4, STEEL);
  const sides = l.arms === 2 ? [-1, 1] : [1];
  for (const s of sides) {
    for (let i = 0; i < 12; i++) Lp(ly, l.x + (s > 0 ? 2 : -1) + i * s, l.top + 3 - Math.round(Math.sqrt(i) * 1.2), WHITE);
    L(ly, l.x + (s > 0 ? 11 : -16), l.top - 2, 7, 2, STEEL);
  }
}

/** Heads glow at night and throw a cone of white light on the ground. */
export function lampLight(l: Lamp) {
  const on = night(), sides = l.arms === 2 ? [-1, 1] : [1];
  for (const s of sides) {
    const hx = l.x + (s > 0 ? 11 : -16);
    rect(hx + 1, l.top, 5, 1, on ? LEDW : STONEL);
    if (!on) continue;
    const cx = hx + 3;
    for (let y = l.top + 1; y < l.ground + 6; y++) {
      const d = (y - l.top) / (l.ground - l.top), half = 2 + d * 16;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        const c = getW(x, y);
        if (c === 255 || !HALOOK[c]) continue;
        const k = (1 - Math.abs(x - cx) / half) * (0.05 + 0.16 * d * d * d);
        if (bay(sx(x), sy(y)) < k) put(x, y, HALO);
      }
    }
    for (let j = -3; j <= 3; j++) for (let i = -5; i <= 7; i++) {
      const c = getW(hx + i, l.top + j);
      if (c !== 255 && HALOOK[c] && bay(sx(hx + i), sy(l.top + j)) < 0.3 * (1 - Math.hypot(i - 1, j * 1.6) / 7)) put(hx + i, l.top + j, HALO);
    }
  }
}

// ---------- warm night light (opt-in: the Esperança scenes call these) ----------
/** Warm light dithered over lit-able pixels in an ellipse centred on (cx, cy): a pale core fading
    through amber, sparse enough that the street still reads as night. Does nothing by day. */
export function warmPool(cx: number, cy: number, rx: number, ry: number, peak = 0.45) {
  if (!night()) return;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (d >= 1) continue;
    const c = getW(x, y);
    if (c === 255 || !HALOOK[c]) continue;
    const k = peak * (1 - d) ** 1.4, b = bay(sx(x), sy(y));
    if (b < k * 0.4) put(x, y, HALO);
    else if (b < k) put(x, y, d < 0.6 ? WWARM : AMBD);
  }
}

const headXs = (l: Lamp) => (l.arms === 2 ? [l.x - 13, l.x + 14] : [l.x + 14]);
/** The bright pool a street light throws on the sidewalk at its foot (draw after the sidewalk layer,
    before the people on it). */
export function lampPool(l: Lamp) {
  if (night()) for (const cx of headXs(l)) warmPool(cx, l.ground + 3, 24, 5, 0.6);
}
/** The wider, fainter pool it throws on the road around `roadY` (draw after the street pass, before
    the vehicles). */
export function lampRoadPool(l: Lamp, roadY: number) {
  if (night()) for (const cx of headXs(l)) warmPool(cx, roadY, 36, 9, 0.38);
}
/** Just the arm and head of a street light, for one fixed to a concrete utility pole. */
export function lampArm(ly: Layer, l: Lamp) {
  for (let i = 0; i < 12; i++) Lp(ly, l.x + 2 + i, l.top + 3 - Math.round(Math.sqrt(i) * 1.2), STEEL);
  L(ly, l.x + 11, l.top - 2, 7, 2, STEEL);
}

/** Light spilling out at night: a warm wash on the wall round each lit window, a pool on the
    sidewalk in front of open shops, and the small light most shopkeepers leave on over a shut front.
    Same open / lit rules as drawOpenings; draw after the sidewalk layer. */
export function nightSpill(list: Opening[], openShops: boolean) {
  if (!night()) return;
  for (const o of list) {
    const cx = o.x + o.w / 2;
    if (o.kind === 'shop') {
      if (shopOpen(o, openShops)) { warmPool(cx, o.y + o.h + 2, o.w * 0.75 + 4, 5, 0.55); continue; }
      if (o.rank >= 0.5) continue;
      rect(cx - 1, o.y - 2, 3, 1, LIGHT); // the light over the shutter
      warmPool(cx, o.y + 2, Math.min(14, o.w * 0.6), 6, 0.4);
      warmPool(cx, o.y + o.h + 2, Math.min(16, o.w * 0.6), 3, 0.3);
    } else if (o.kind === 'win' && windowLit(o)) warmPool(cx, o.y + o.h / 2, o.w * 0.5 + 4, o.h * 0.5 + 3, 0.22);
  }
}

/** The shooting star the town hangs on its lamp posts at Christmas. */
export function christmasStar(cx: number, cy: number, s: number) {
  const on = night(), t = S.ms / 1000;
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / 10) * Math.PI * 2 - Math.PI / 2;
    const r0 = k % 2 ? 2.2 * s : 5 * s, r1 = k % 2 ? 5 * s : 2.2 * s;
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, x = cx + Math.cos(a0) * r0 * (1 - u) + Math.cos(a1) * r1 * u, y = cy + Math.sin(a0) * r0 * (1 - u) + Math.sin(a1) * r1 * u;
      put(x, y, on ? ((i + k + ((t * 4) | 0)) % 5 ? LIGHT : WHITE) : CBEIGE);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = cx - 6 * s - i * 1.4, y = cy + 2 + Math.sin(i / 14 * Math.PI) * -3 + i * 0.6;
    if (i % 2 === 0) put(x, y, on ? ((i + ((t * 6) | 0)) % 4 ? AMB : LIGHT) : CBEIGE);
  }
}

// ---------- palms ----------
/** Coconut palm by default; `imperial` draws a royal palm: straight grey trunk, green crownshaft. */
export interface Palm { x: number; ground: number; h: number; lean: number; ph: number; imperial?: boolean }

export function drawPalm(p: Palm) {
  // gentle when calm; strong wind (≥ 30 km/h, wind-rules.ts) bends the crown downwind and sways it faster
  const t = S.ms / 1000, st = windStrength(S.wind), dir = windDir(S.wind);
  const sway = Math.sin(t * (0.9 + st * 1.2) + p.ph) * (0.6 + st * 4) + dir * st * 5;
  const tx = (u: number) => p.x + p.lean * u * u + sway * u * u * 0.5;
  for (let y = 0; y < p.h; y++) {
    const u = y / p.h, x = Math.round(tx(u)), yy = p.ground - y;
    if (p.imperial) { const crown = y > p.h - 7; put(x, yy, crown ? LEAFG : STONEL); put(x + 1, yy, crown ? LEAFGD : y % 9 === 0 ? STONEL : STONE); }
    else { put(x, yy, y % 4 === 0 ? WOOD : BARK); put(x + 1, yy, y % 4 === 1 ? BARK : WOOD); }
  }
  const cx = tx(1), cy = p.ground - p.h;
  const fronds = [-2.9, -2.4, -1.9, -1.3, -0.7, -0.25, 0.25];
  fronds.forEach((a0, i) => {
    // fronds stream downwind: the upwind ones fold over, all of them thrash faster in a gale
    const a = a0 + Math.sin(t * (1.3 + st * 3) + i + p.ph) * 0.06 * (1 + st * 4) + dir * st * 0.55 * (Math.cos(a0) * dir < 0 ? 1.4 : 0.8), len = 18 + (i % 3) * 3;
    for (let k = 1; k <= len; k++) {
      const u = k / len, x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k + u * u * 9;
      put(x, y, LEAFG);
      if (k > 3 && k % 2 === 0) { put(x, y + 1, LEAFGD); put(x + (Math.cos(a) > 0 ? -1 : 1), y + 2, u > 0.6 ? LEAFGD : LEAFG); }
    }
  });
  rect(cx - 1, cy - 1, 3, 3, LEAFGD); if (!p.imperial) { put(cx - 1, cy + 2, WOOD); put(cx + 1, cy + 2, WOOD); } // coconuts
}

// ---------- festivities ----------
const FLAG = [CRED, CYELL, CBLUE, CGREEN, WHITE, FPINK];
/** A string of paper bandeirolas between two points, fluttering in the wind: a flick of the tip in a
    breeze; in strong wind (≥ 30 km/h) the string lifts and swings and the flags stream out downwind. */
export function bandeirolas(x0: number, y0: number, x1: number, y1: number, sag: number, seed: number) {
  const n = Math.abs(x1 - x0), t = S.ms / 1000, st = windStrength(S.wind), dir = windDir(S.wind) || 1;
  const swing = Math.sin(t * (1 + st * 1.5) + seed) * st * 2.5; // the whole string swings, the middle most
  for (let i = 0; i <= n; i++) {
    const u = i / n, mid = 4 * u * (1 - u);
    const x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + sag * mid * (1 - st * 0.35) + swing * mid);
    put(x, y, BNEAR);
    if (i % 4 === 1) {
      const c = FLAG[(i / 4 + seed) % FLAG.length | 0], wave = Math.sin(t * (3 + st * 6) + i * 0.7);
      if (st < 0.6) { // hanging: the tip flicks sideways now and then
        const fl = wave * (0.2 + st * 3) > 0.6 ? 1 : 0;
        rect(x, y + 1, 3, 2, c); put(x + 1 + fl, y + 3, c);
      } else { // streaming: blown out to the side, flapping up and down
        const lift = wave > 0.3 ? 1 : 0, bx = dir > 0 ? x : x - 1;
        rect(bx, y + 1 - lift, 3, 2, c); put(dir > 0 ? x + 3 : x - 2, y + 1 + (wave > -0.2 ? 0 : 1) - lift, c);
      }
    }
  }
}

/** A string of warm bulbs (festa nights). */
export function bulbs(x0: number, y0: number, x1: number, y1: number, sag: number) {
  const n = Math.abs(x1 - x0), on = night(), t = S.ms / 1000;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u));
    put(x, y, BNEAR);
    if (i % 6 === 3) put(x, y + 1, on ? ((i + ((t * 2) | 0)) % 3 ? LIGHT : AMB) : CBEIGE);
  }
}

/** Espetinho cart with a striped umbrella, a bulb and grill smoke. */
export function cart(x: number, ground: number, open: boolean) {
  const t = S.ms / 1000, on = night();
  rect(x, ground - 9, 18, 6, CRED); rect(x, ground - 9, 18, 1, WHITE); rect(x + 2, ground - 7, 14, 1, WHITE);
  rect(x + 2, ground - 3, 3, 3, VOID); rect(x + 13, ground - 3, 3, 3, VOID);
  rect(x + 8, ground - 26, 1, 17, STEEL);
  for (let i = -11; i <= 11; i++) {
    const y = ground - 27 + Math.round((i * i) / 30);
    put(x + 8 + i, y, ((i + 11) >> 2) % 2 ? CYELL : CRED); put(x + 8 + i, y - 1, Math.abs(i) < 9 ? (((i + 11) >> 2) % 2 ? CYELL : CRED) : 255);
  }
  if (!open) return;
  if (on) { put(x + 8, ground - 24, LIGHT); for (let j = -3; j <= 6; j++) for (let i = -8; i <= 8; i++) { const c = getW(x + 8 + i, ground - 20 + j); if (c !== 255 && HALOOK[c] && bay(sx(x + 8 + i), sy(ground - 20 + j)) < 0.25 * (1 - Math.hypot(i, j) / 9)) put(x + 8 + i, ground - 20 + j, HALO); } }
  rect(x + 3, ground - 10, 12, 1, on ? AMB : AMBD); // grill coals
  for (let k = 0; k < 6; k++) {
    const age = (t * 0.6 + k / 6) % 1, sx0 = x + 5 + k * 1.5 + Math.sin(t + k) * 2 + S.wind * age * 20, sy0 = ground - 11 - age * 18;
    if (bay(sx(sx0), sy(sy0)) < 0.7 * (1 - age)) put(sx0, sy0, age < 0.5 ? STONEL : FOG);
  }
}

/** The same cart selling coconut water on hot days (draw it over a closed cart(), at the same x): a pile of
    green coconuts on the counter, the vendor in a straw hat beside it and a small cloth sign. The
    caller decides when (cocoNow() in actors/people.ts: daytime and a real hot reading only). */
export function cocoCart(x: number, ground: number) {
  // a small cloth sign tied under the umbrella
  rect(x - 9, ground - 25, 29, 12, WHITE); rect(x - 9, ground - 14, 29, 1, CBEIGE);
  text(null, 'AGUA', x - 2, ground - 24, CRED);
  text(null, 'DE COCO', x - 8, ground - 19, LEAFGD);
  // coconuts: a row of five with three on top, each with a lighter top-left
  for (let i = 0; i < 5; i++) { rect(x + 2 + i * 3, ground - 11, 3, 2, i & 1 ? LEAFG : CGREEN); put(x + 2 + i * 3, ground - 11, LEAFGD); }
  for (let i = 0; i < 3; i++) { rect(x + 5 + i * 3, ground - 13, 3, 2, i & 1 ? CGREEN : LEAFG); put(x + 5 + i * 3, ground - 13, LEAFGD); }
  rect(x + 3, ground - 10, 12, 1, WHITE); // ice under them
  // vendor standing at the cart's right end, facing the street
  const vx = x + 24, t = S.ms / 1000, wave = Math.sin(t * 1.3) > 0.85 ? 1 : 0;
  rect(vx - 1, ground - 6, 1, 6, CNAVY); rect(vx + 1, ground - 6, 1, 6, CNAVY); put(vx - 1, ground - 1, VOID); put(vx + 1, ground - 1, VOID);
  rect(vx - 2, ground - 12, 5, 6, CYELL); put(vx - 3, ground - 10 - wave * 2, SKIN2); put(vx - 3, ground - 11, CYELL);
  rect(vx - 1, ground - 15, 3, 3, SKIN2); put(vx, ground - 14, VOID);
  rect(vx - 3, ground - 16, 7, 1, CBEIGE); rect(vx - 1, ground - 17, 3, 1, CBEIGE); put(vx - 1, ground - 16, WOOD); // straw hat
}

/** São João bonfire. */
export function fogueira(x: number, ground: number) {
  const t = S.ms / 1000;
  rect(x - 7, ground - 2, 14, 2, WOOD); rect(x - 5, ground - 4, 10, 2, BARK);
  for (let i = -5; i <= 5; i++) {
    const h = 9 - Math.abs(i) * 1.4 + Math.sin(t * 9 + i * 1.7) * 2.5;
    for (let j = 0; j < h; j++) put(x + i, ground - 4 - j, j > h - 3 ? CRED : j > h * 0.5 ? AMB : LIGHT);
  }
  for (let k = 0; k < 5; k++) {
    const age = (t * 0.8 + k / 5) % 1;
    put(x + Math.sin(k * 7 + t) * 4, ground - 12 - age * 22, age < 0.6 ? AMB : AMBD);
  }
  if (night()) for (let j = -14; j <= 4; j++) for (let i = -18; i <= 18; i++) {
    const c = getW(x + i, ground + j), d = Math.hypot(i, j * 1.4) / 19;
    if (c !== 255 && HALOOK[c] && d < 1 && bay(sx(x + i), sy(ground + j)) < 0.35 * (1 - d) * (0.85 + 0.15 * Math.sin(t * 11))) put(x + i, ground + j, d < 0.4 ? HALO : AMBD);
  }
}

export const isNight = night;

/** A sagging wire as a function of x, for birds to perch on (same curve as wire()). */
export function wireCurve(x0: number, y0: number, x1: number, y1: number, sag: number) {
  return { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y: (x: number) => { const t = (x - x0) / (x1 - x0); return y0 + (y1 - y0) * t + sag * 4 * t * (1 - t); } };
}

// ---------- 3x5 pixel font (signs, letreiros) ----------
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
  Z: '111001010100111', 'Ç': '011100100100011', '♥': '000101111111010', ' ': '000000000000000',
  Q: '010101101111011', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
  '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  '-': '000000111000000', '.': '000000000000010',
};
/** Draw text into a layer (`ly`) or, with ly = null, straight into the frame; `s` scales each pixel. */
export function text(ly: Layer | null, str: string, x: number, y: number, c: number, s = 1, heart = c) {
  for (const ch of str) {
    const g = FONT[ch] ?? FONT[' '], col = ch === '♥' ? heart : c;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') {
      if (ly) L(ly, x + i * s, y + j * s, s, s, col); else rect(x + i * s, y + j * s, s, s, col);
    }
    if (ch === 'Ç') { if (ly) L(ly, x + s, y + 5 * s, s, s, c); else rect(x + s, y + 5 * s, s, s, c); }
    x += 4 * s;
  }
}
export const textW = (str: string, s = 1) => (str.length * 4 - 1) * s;
/** The lit green SAÍDA sign of the places you go inside (the mall, the bus), straight into the frame:
    a steel rim, the green board, the letters with the accent and a little arrow out. Tapping it is the
    scene's way back out. Its colours (CGREEN board, FWG letters) stay lit in an interior's grade(). */
export function saidaSign(x: number, y: number, w: number, h = 10) {
  rect(x - 1, y - 1, w + 2, h + 2, STEEL); rect(x, y, w, h, CGREEN);
  const tx = x + ((w - textW('SAIDA')) >> 1) + 1, ty = y + h - 6;
  text(null, 'SAIDA', tx, ty, FWG); put(tx + 9, ty - 2, FWG); put(tx + 10, ty - 3, FWG); // the acute accent of SAÍDA
  put(x + 2, ty + 2, FWG); put(x + 3, ty + 1, FWG); put(x + 3, ty + 3, FWG); // an arrow out
}
/** Whether cell (u, v) of `str` in the 3x5 font is lit: u counts columns across the whole string
    (4 per character, the 4th is the gap), v rows 0..4. For signs painted on walls in perspective. */
export function textBit(str: string, u: number, v: number): boolean {
  if (u < 0 || v < 0 || v >= 5) return false;
  const k = Math.floor(u / 4), i = Math.floor(u) % 4;
  if (k >= str.length || i > 2) return false;
  return (FONT[str[k]] ?? FONT[' '])[Math.floor(v) * 3 + i] === '1';
}

/** Easter Sunday as a day of year (moved to the DOM-free sky/time.ts so pure rules can use it). */
export { easterDoy } from '../sky/time';

// ---------- water, towers, cobbles, lanterns ----------

/**
 * Still water between world rows y0..y1: mirrors what is drawn above the waterline, broken by
 * ripples that grow with the wind, tinted toward `tint` with depth. Lights stay bright.
 */
export function water(y0: number, y1: number, x0: number, x1: number, tint: number, deep: number, stretch = 1.4) {
  const { buf, W, H } = G, t = S.ms / 1000, wind = Math.abs(S.wind) * 2 + S.rain;
  const Y0 = Math.max(0, sy(y0)), Y1 = Math.min(H, sy(y1)), X0 = Math.max(0, sx(x0)), X1 = Math.min(W, sx(x1));
  for (let Y = Y0; Y < Y1; Y++) {
    const d = Y - sy(y0), k = d / Math.max(1, sy(y1) - sy(y0)), src = sy(y0) - 1 - Math.round(d * stretch);
    const off = Math.round(Math.sin(Y * 0.9 + t * 1.6) * (0.5 + wind) + Math.sin(Y * 2.3 - t * 1.1) * 0.5);
    for (let X = X0; X < X1; X++) {
      const sxx = Math.min(W - 1, Math.max(0, X + off)), s0 = src >= 0 ? buf[src * W + sxx] : deep, b = bay(X, Y);
      buf[Y * W + X] = BRIGHT[s0] ? (b < 0.75 ? REFL[s0] : tint) : b < 0.55 - k * 0.35 ? s0 : b < 0.9 ? tint : deep;
    }
  }
}

export interface TowerWin { x: number; y: number; rank: number }
/** A high-rise: plain slab with a window grid, optional coloured band down one side. */
export function tower(ly: Layer, x: number, w: number, top: number, ground: number, body: number, band: number | null, rng: Rng, wins: TowerWin[]) {
  L(ly, x, top, w, ground - top, body); L(ly, x, top - 2, w, 2, STONE);
  if (band !== null) L(ly, x + w - 4, top, 4, ground - top, band);
  for (let wy = top + 3; wy < ground - 4; wy += 4) for (let wx = x + 2; wx < x + w - (band !== null ? 6 : 2); wx += 3) {
    Lp(ly, wx, wy, BFAR); Lp(ly, wx + 1, wy, BFAR); wins.push({ x: wx, y: wy, rank: rng() });
  }
}
export function drawTowerWins(wins: TowerWin[]) {
  const n = night(), late = S.cal.hour >= 23 || S.cal.hour < 5 ? 0.2 : 0.55;
  for (const w of wins) { const c = n && w.rank < late ? (w.rank < 0.08 ? WCOOL : WWARM) : BFAR; put(w.x, w.y, c); put(w.x + 1, w.y, c); }
}

/** Paralelepípedo: grey cobbles in offset rows, for historic streets. */
export function cobbles(base: Uint8Array, rows: number, width: number, rng: Rng) {
  for (let d = 0; d < rows; d++) for (let x = 0; x < width; x++) {
    const row = d >> 1, edge = (d & 1) === 0 || (x + (row & 1) * 2) % 4 === 0;
    base[d * width + x] = edge ? BMID : rng() < 0.3 ? STONEL : STONE;
  }
}

/** Colonial wall lantern with a warm halo at night. */
export function lantern(x: number, y: number) {
  const n = night();
  put(x, y - 1, VOID); rect(x - 1, y, 3, 1, VOID); rect(x - 1, y + 1, 3, 3, n ? LIGHT : STONEL); rect(x - 1, y + 4, 3, 1, VOID);
  if (!n) return;
  for (let j = -6; j <= 12; j++) for (let i = -9; i <= 9; i++) {
    const c = getW(x + i, y + 2 + j), d = Math.hypot(i, j * 0.9) / 11;
    if (c !== 255 && HALOOK[c] && d < 1 && bay(sx(x + i), sy(y + 2 + j)) < 0.32 * (1 - d)) put(x + i, y + 2 + j, d < 0.35 ? HALO : AMBD);
  }
}
