/* The feira livre on Rua José Bezerra da Costa, drawn in the scene's one-point perspective: the
   barracas with their striped tarps and crates of produce, the feirantes behind them, the shoppers
   in the aisle, the unloading truck, a moto and wheelbarrows. All the rules (schedule, layout,
   crowd, queues) live in ../actors/feira-rules.ts; this file only draws them and answers taps. */
import { put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  BNEAR, CBEIGE, CBLUE, CGREEN, CNAVY, CORNG, CRED, CYELL, FBLUE, FGREEN, FLILAC, FORNG, FPINK, GOLD, HAIR1, HAIR2, HAIR3, LEAFG, LEAFGD,
  MANTO, MOMIJI, SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, STONEL, TERRA, TILEW, VOID, WOOD,
} from '../engine/palette';
import {
  type Box, type Carry, type FeiraCtx, type Goods, type Shopper, type Stall, type VendorPose, BARROWS, MAX_SHOPPERS, ROW_W, VEHICLES,
  feiraState, feiraWet, makeShoppers, moving, rowOf, serving, shopperCap, sortZ, spawnShopper, stallsFor, stepShoppers, unloaderAt, vendorPose,
} from '../actors/feira-rules';
import { S } from '../sky/state';
import { windDir, windStrength } from '../sky/wind-rules';
import { type View, drawCarP, projX, projY, scaleAt } from './persp-kit';
import type { Speaker } from './types';

let V: View = { vx: 0, vy: 0, f: 1, camH: 1 };
const SHOP: Shopper[] = makeShoppers(MAX_SHOPPERS + 4);
const rnd = mulberry32(0xfe1a);
let spawnT = 0;
const ctxNow = (): FeiraCtx => {
  const state = feiraState(S.cal.weekday, S.cal.hour), wx = { kind: S.wxKind, rain: S.rain, snow: S.snow };
  return { state, wet: feiraWet(wx), wx, stalls: stallsFor(state.kind) };
};
let ctx: FeiraCtx = { state: feiraState(-1, 0), wet: false, wx: { kind: 'unavailable', rain: 0, snow: 0 }, stalls: [] };

/** The scene's view; clears the shoppers and, if the market is on, lets it fill up before the first frame. */
export function feiraBuild(v: View) {
  V = v;
  for (const p of SHOP) p.on = false;
  for (let i = 0; i < 1200; i++) feiraUpdate(1 / 10); // two minutes, so a fresh load opens on a busy feira
}

export function feiraUpdate(dt: number) {
  ctx = ctxNow();
  if (!(dt > 0)) return; // a clock jump can hand a negative step: the market just waits
  spawnT -= dt;
  if (spawnT <= 0) { spawnT = 0.5 + rnd() * 0.8; spawnShopper(SHOP, ctx, rnd); }
  stepShoppers(SHOP, dt, ctx, rnd);
}

export const feiraFlow = () => ctx.state.flow;
/** Whether the stalls are standing (set-up, open or packing away). */
export const feiraOn = () => ctx.state.frames;

/** Boxes the pedestrians are depth-sorted against (stalls and props only while the market stands). */
export function feiraBoxes(): Box[] {
  const left: Box[] = [VEHICLES.pickup, VEHICLES.car];
  return feiraOn() ? [...left, ...ctx.stalls, VEHICLES.truck, VEHICLES.moto, ...BARROWS] : left;
}

// ---------- drawing helpers ----------
type V3 = [number, number, number]; // X, h, Z
const px = (p: V3) => projX(V, p[0], p[2]), py = (p: V3) => projY(V, p[1], p[2]);
const grain = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return v - Math.floor(v); };

/** Fills a 3D quad a(0,0) b(1,0) c(0,1) d(1,1) by sampling it finely enough for its size on screen;
    `col(u, w, x, y)` gives the colour (or -1 for nothing). */
function quad(a: V3, b: V3, c: V3, d: V3, col: (u: number, w: number, x: number, y: number) => number) {
  const len = (p: V3, q: V3) => Math.hypot(px(p) - px(q), py(p) - py(q));
  const nu = Math.ceil(Math.max(len(a, b), len(c, d)) * 1.4) + 1, nw = Math.ceil(Math.max(len(a, c), len(b, d)) * 1.4) + 1;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    for (let j = 0; j <= nw; j++) {
      const w = j / nw;
      const X = (a[0] * (1 - u) + b[0] * u) * (1 - w) + (c[0] * (1 - u) + d[0] * u) * w;
      const h = (a[1] * (1 - u) + b[1] * u) * (1 - w) + (c[1] * (1 - u) + d[1] * u) * w;
      const Z = (a[2] * (1 - u) + b[2] * u) * (1 - w) + (c[2] * (1 - u) + d[2] * u) * w;
      const x = Math.round(projX(V, X, Z)), y = Math.round(projY(V, h, Z)), k = col(u, w, x, y);
      if (k >= 0) put(x, y, k);
    }
  }
}
/** A vertical post from the ground to height h. */
function post(X: number, Z: number, h: number, c: number) {
  const x = Math.round(projX(V, X, Z)), y0 = Math.round(projY(V, h, Z)), y1 = Math.round(projY(V, 0, Z));
  rect(x, y0, Math.max(1, Math.round(scaleAt(V, Z) * 0.6)), y1 - y0, c);
}

// ---------- produce ----------
/** Texture of a crate of each kind of produce, at screen pixel (x, y). */
function produce(g: Goods, x: number, y: number): number {
  const r = grain(x, y);
  switch (g) {
    case 'laranja': return r < 0.22 ? FORNG : r < 0.3 ? TERRA : CORNG;
    case 'banana': return (x + y) % 3 === 0 ? GOLD : r < 0.12 ? WOOD : CYELL;
    case 'tomate': return r < 0.25 ? MOMIJI : r < 0.3 ? TILEW : CRED;
    case 'verdura': return r < 0.35 ? LEAFGD : r < 0.6 ? FGREEN : LEAFG;
    case 'melao': return r < 0.3 ? CYELL : r < 0.36 ? GOLD : CBEIGE;
    case 'melancia': return x % 3 === 0 ? LEAFGD : r < 0.15 ? LEAFG : CGREEN;
    case 'batata': return r < 0.3 ? WOOD : r < 0.55 ? TERRA : HAIR2;
    case 'cebola': return r < 0.45 ? FLILAC : r < 0.6 ? CBEIGE : MOMIJI;
    case 'abacaxi': return y % 2 === 0 && r < 0.4 ? LEAFG : r < 0.3 ? TERRA : GOLD;
    case 'pimentao': return r < 0.5 ? CGREEN : r < 0.7 ? CRED : LEAFGD;
  }
}

const AWNINGS: readonly [number, number][] = [[CRED, TILEW], [CBLUE, TILEW], [CYELL, CORNG], [CGREEN, TILEW], [FPINK, TILEW], [CORNG, CYELL], [MANTO, FBLUE], [CRED, CYELL], [FBLUE, TILEW]];
const CLOTHS = [CBLUE, TILEW, CRED, WOOD, WOOD, STEEL];

/** One barraca: the table with its cloth or slats, crates of produce, the scale and a price board,
    and the tarp on four poles. Stock 0..1 empties the crates (dawn, xepa, packing up). */
function drawStall(s: Stall) {
  const { X0, X1, z0, z1 } = s, k = scaleAt(V, z0), st = ctx.state;
  const [a1, a2] = AWNINGS[Math.floor(s.seed * AWNINGS.length)], cloth = CLOTHS[Math.floor(s.seed * 61) % CLOTHS.length];
  const hT = 0.85, hG = 0.97, Xm = (X0 + X1) / 2, e0 = z0 - 0.2, e1 = z1 + 0.2;
  // far poles, the table's side toward the street axis (seen for both rows) and the produce on top
  post(X0, z1, st.tarps ? 2.75 : 2.2, STEEL); post(X1, z1, st.tarps ? 2.15 : 2.2, STEEL);
  const slats = cloth === WOOD || cloth === STEEL;
  const skirt = (_u: number, w: number, x: number) => (w > 0.88 ? (slats ? STONE : cloth) : slats ? ((x & 1) ? cloth : HAIR2) : (w < 0.12 ? BNEAR : cloth));
  quad([X1, hT, z0], [X1, hT, z1], [X1, 0.15, z0], [X1, 0.15, z1], (u, w, x) => skirt(u, 1 - w, x));
  const n = s.goods.length, full = Math.ceil(st.stock * n - 1e-6);
  quad([X0, hG, z0], [X1, hG, z0], [X0, hG, z1], [X1, hG, z1], (u, w, x, y) => {
    const cell = Math.min(n - 1, Math.floor(w * n)), edge = Math.abs(w * n - Math.round(w * n)) < 0.08 || u < 0.06 || u > 0.94;
    if (edge) return WOOD;
    return cell < full ? produce(s.goods[cell], x, y) : HAIR2; // an empty crate
  });
  // the front: crate faces with produce peeking over, the table cloth below
  quad([X0, hG, z0], [X1, hG, z0], [X0, hT - 0.12, z0], [X1, hT - 0.12, z0], (_u, w, x, y) => (w < 0.35 && full > 0 ? produce(s.goods[0], x, y) : (x + y) % 4 === 0 ? HAIR2 : WOOD));
  quad([X0, hT - 0.12, z0], [X1, hT - 0.12, z0], [X0, 0.15, z0], [X1, 0.15, z0], (u, w, x) => skirt(u, 1 - w, x));
  // a crate on the ground by the near leg, a watermelon or two beside the big stalls
  if (st.stock > 0.2) quad([X1 - 0.5, 0.35, z0 - 0.35], [X1 - 0.05, 0.35, z0 - 0.35], [X1 - 0.5, 0, z0 - 0.35], [X1 - 0.05, 0, z0 - 0.35], (_u, w, x, y) => (w < 0.3 ? produce(s.goods[n - 1], x, y) : (y & 1) ? WOOD : HAIR2));
  // the near poles, the hanging scale and a little chalk price board with generic numbers
  post(X0, z0, st.tarps ? 2.75 : 2.2, STEEL); post(X1, z0, st.tarps ? 2.15 : 2.2, STEEL);
  if (st.stock > 0) {
    const sx = Math.round(projX(V, X1 - 0.15, z0)), sy = Math.round(projY(V, 1.45, z0));
    put(sx, sy - 1, STEEL); rect(sx - Math.max(1, Math.round(k)), sy, Math.max(2, Math.round(2 * k)), Math.max(1, Math.round(k * 0.6)), STONEL);
    const bx = Math.round(projX(V, Xm, z0)), by = Math.round(projY(V, hG + 0.42, z0)), bw = Math.max(3, Math.round(4 * k)), bh = Math.max(2, Math.round(2.6 * k));
    rect(bx, by, bw, bh, BNEAR);
    if (bw >= 4) for (let i = 1; i < bw - 1; i += 2) put(bx + i, by + (bh >> 1), TILEW); // "2,50"-ish chalk marks, no real prices
  }
  if (!st.tarps) return;
  // the tarp: the slope toward the street axis (its top is seen from here) and the open gable in front
  quad([Xm, 2.75, e0], [Xm, 2.75, e1], [X1 + 0.3, 2.15, e0], [X1 + 0.3, 2.15, e1], (u, w) => (w > 0.9 ? a2 : Math.floor(u * 6) % 2 ? a1 : a2));
  // the open gable in front: the tarp's underside, shaded (a quad with both far corners on the ridge)
  quad([X0 - 0.3, 2.15, e0], [X1 + 0.3, 2.15, e0], [Xm, 2.75, e0], [Xm, 2.75, e0], (_u, _w, x, y) => ((x + y) % 3 === 0 ? BNEAR : a1));
  // the valance along the front edge
  quad([X0 - 0.3, 2.2, e0], [X1 + 0.3, 2.2, e0], [X0 - 0.3, 2.05, e0], [X1 + 0.3, 2.05, e0], (u) => (Math.floor(u * 8) % 2 ? a1 : a2));
  // the valance's loose hem flaps in the wind: a ripple running downwind, clearly in strong wind (wind-rules.ts)
  const ws = windStrength(S.wind);
  if (ws > 0.25) {
    const xa = Math.round(projX(V, X0 - 0.3, e0)), xb = Math.round(projX(V, X1 + 0.3, e0)), yb = Math.round(projY(V, 2.05, e0));
    const t = S.ms / 1000, dir = windDir(S.wind) || 1, span = Math.max(1, xb - xa);
    for (let x = xa; x <= xb; x++) {
      const wave = Math.sin(x * 0.9 - dir * t * (5 + ws * 7) + s.seed * 20);
      if (wave <= 0.85 - ws * 0.9) continue;
      const c = Math.floor(((x - xa) / span) * 8) % 2 ? a1 : a2;
      put(x, yb + 1, c); if (wave > 0.75 && ws > 0.6) put(x, yb + 2, c);
    }
  }
}

// ---------- people ----------
interface Look { top: number; low: number; skin: number; hair: number; skirt: boolean; hat: number; bag: number; umb: number }
const TOPS = [TILEW, CBLUE, CRED, CYELL, FPINK, STEEL, CGREEN, VOID, CBEIGE, FBLUE, CORNG];
function lookOf(seed: number, elder = false): Look {
  const r = mulberry32(seed + 1), pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const skirt = r() < 0.4, top = pick(TOPS);
  return {
    top, low: skirt ? pick([CBLUE, CRED, FPINK, CNAVY, CBEIGE]) : pick([VOID, BNEAR, CNAVY, CBLUE, STONE]), skirt,
    skin: pick([SKIN1, SKIN2, SKIN2, SKIN3, SKIN3, SKIN4]), hair: elder ? pick([STONEL, TILEW, STONE]) : pick([HAIR1, HAIR1, HAIR2, HAIR3]),
    hat: r() < (elder ? 0.5 : 0.2) ? pick([CBEIGE, CBEIGE, TILEW, CRED, CBLUE]) : -1, bag: pick([TILEW, TILEW, CBLUE, FPINK, CYELL, CRED]),
    umb: pick([CRED, CBLUE, VOID, CGREEN, FPINK, CYELL]),
  };
}

type View3 = 'front' | 'back' | 'side';
interface PersonOpt { view: View3; step: number; small?: boolean; stoop?: boolean; apron?: number; pose?: VendorPose | 'reach'; face?: number; carry?: Carry; load?: number; umbrella?: boolean }

/** A person at (X, z) at their depth's scale, as in persp-kit's walkers, with what they carry. */
function person(X: number, z: number, L: Look, o: PersonOpt) {
  if (z < 0.8) return;
  const k = scaleAt(V, z) * (o.small ? 0.62 : 1), cx = projX(V, X, z), gy = projY(V, 0, z);
  const Xs = (u: number) => Math.round(cx + u * k), Y = (h: number) => Math.round(gy - h * k);
  const R = (u0: number, u1: number, h1: number, h0: number, col: number) => rect(Xs(u0), Y(h1), Math.max(1, Xs(u1) - Xs(u0)), Math.max(1, Y(h0) - Y(h1)), col);
  const st = o.step, side = o.view === 'side', f = o.face ?? 1, dn = o.stoop || o.pose === 'arrange' ? 1.6 : 0;
  // a trolley rolls beside them, the wheelbarrow goes in front
  if (o.carry === 'trolley') {
    const s = side ? -f : 1;
    R(Math.min(s * 2.8, s * 5.4), Math.max(s * 2.8, s * 5.4), 9, 1.2, CRED);
    for (let h = 2; h < 9; h += 2.5) R(Math.min(s * 2.8, s * 5.4), Math.max(s * 2.8, s * 5.4), h + 0.5, h, CNAVY);
    R(Math.min(s * 3, s * 5.2), Math.max(s * 3, s * 5.2), 1.4, 0, VOID);
    R(Math.min(s * 3.4, s * 3.9), Math.max(s * 3.4, s * 3.9), 11.5, 9, STEEL);
    if ((o.load ?? 0) > 0) R(Math.min(s * 3, s * 5), Math.max(s * 3, s * 5), 10.4, 9, LEAFG);
  }
  // legs
  const leg = o.small ? L.low : L.skirt ? L.skin : L.low;
  if (side) { const a = st * 1.6; R(-1 + a, 0.6 + a, 8, 0, leg); R(-0.6 - a, 1 - a, 8, 0, leg); }
  else { const lift = Math.abs(st) > 0.5 ? 0.8 : 0; R(-1.8, -0.4, 8, st > 0 ? lift : 0, leg); R(0.4, 1.8, 8, st < 0 ? lift : 0, leg); }
  if (L.skirt && !o.small) R(-2, 2, 9, 5.5, L.low);
  // body, apron, head, hair, hat
  R(side ? -1.4 : -2.2, side ? 1.4 : 2.2, 14 - dn, 8, L.top);
  if (o.apron !== undefined && o.view !== 'back') R(side ? -1.2 : -1.8, side ? 1.2 : 1.8, 12 - dn, 7, o.apron);
  R(-1.3, 1.3, 16.8 - dn, 14 - dn, L.skin);
  if (o.view === 'back') R(-1.4, 1.4, 17.2 - dn, 14.6 - dn, L.hair);
  else R(-1.4, 1.4, 17.2 - dn, 16.2 - dn, L.hair);
  if (L.skirt && !side && !o.small) R(-1.5, 1.5, 16.5 - dn, 13.5 - dn, L.hair);
  if (L.hat >= 0) { R(-1.6, 1.6, 18 - dn, 16.6 - dn, L.hat); if (L.hat === CBEIGE) R(-2.6, 2.6, 16.9 - dn, 16.4 - dn, L.hat); }
  // arms and hands: what they are doing
  const t = S.ms / 1000, p = o.pose;
  if (p === 'call') { if (Math.sin(t * 5 + X) > -0.2) R(2.2, 3.2, 19.5, 14, L.skin); else R(1.2, 2.4, 16.6, 14, L.skin); }
  else if (p === 'weigh') { R(-3, 3, 11.5, 10.5, L.skin); R(-1.2, 2.2, 12.2, 11.5, STEEL); R(-0.4, 1.4, 13, 12.2, CORNG); }
  else if (p === 'bag') { R(1.8, 3, 11.5, 10.5, L.skin); R(2, 4.2, 12, 8.5, (Math.floor(t) % 2) ? TILEW : CBLUE); }
  else if (p === 'arrange') R(-2.6, 2.6, 10 - dn + 1.5, 9 - dn + 1.5, L.skin);
  else if (p === 'carry') { R(-3, 3, 12.5, 9.5, WOOD); R(-2.6, 2.6, 13.4, 12.5, CORNG); }
  else if (p === 'reach') R(f < 0 ? -3.8 : 1.2, f < 0 ? -1.2 : 3.8, 11.8, 11, L.skin);
  // what a shopper carries in the hand
  const load = o.load ?? 0, s2 = side ? -f : 1;
  if (o.carry === 'bag') {
    R(s2 > 0 ? 2.2 : -3.6, s2 > 0 ? 3.6 : -2.2, load ? 9.5 : 8.8, load ? 5.5 : 7.2, L.bag);
    if (load > 1 && !side) R(-3.6, -2.2, 9.5, 5.5, TILEW);
  } else if (o.carry === 'basket') {
    const u0 = s2 > 0 ? 2.2 : -4.6, u1 = s2 > 0 ? 4.6 : -2.2;
    R(u0, u1, 9.5, 6, CBEIGE); R(u0, u1, 8, 7.4, WOOD); R(u0 + 0.8, u1 - 0.8, 11, 9.5, WOOD);
    if (load) R(u0 + 0.3, u1 - 0.3, 10, 9.4, load > 1 ? CORNG : LEAFG);
  }
  if (o.umbrella) { R(-0.2, 0.2, 18.5, 13, STEEL); R(-5, 5, 20, 18.5, L.umb); R(-3, 3, 21, 20, L.umb); }
}

/** A wheelbarrow with crates: pushed by a porter, or parked. */
function barrow(X: number, z: number, full: boolean) {
  const k = scaleAt(V, z), cx = projX(V, X, z), gy = projY(V, 0, z);
  const Xs = (u: number) => Math.round(cx + u * k), Y = (h: number) => Math.round(gy - h * k);
  const R = (u0: number, u1: number, h1: number, h0: number, col: number) => rect(Xs(u0), Y(h1), Math.max(1, Xs(u1) - Xs(u0)), Math.max(1, Y(h0) - Y(h1)), col);
  R(-0.8, 0.8, 2, 0, VOID); R(-3.4, 3.4, 5.5, 2.4, STEEL); R(-3, 3, 3, 2.4, STONE);
  if (full) { R(-3, 0, 7.5, 5.5, WOOD); R(-2.8, -0.2, 7.9, 7.5, CORNG); R(0.2, 3, 7, 5.5, HAIR2); R(0.4, 2.8, 7.4, 7, LEAFG); }
}

/** Who stands at a stall: the feirante (plus a helper at some), and what they're doing. */
function vendors(s: Stall): { X: number; z: number; look: Look; pose: VendorPose; view: View3; apron: number }[] {
  const r = rowOf(s), zc = (s.z0 + s.z1) / 2, t = S.ms / 1000, ph = ctx.state.phase;
  const view: View3 = s.row === 'W' ? 'front' : 'back';
  const out = [{ X: r.vendorX, z: zc, look: lookOf(Math.floor(s.seed * 1e6)), pose: vendorPose(s.seed, t, ph, serving(SHOP, s.id)), view, apron: s.id % 3 ? TILEW : CBLUE }];
  if (s.helper && ph !== 'setup') out.push({ X: r.vendorX, z: zc + 0.95, look: lookOf(Math.floor(s.seed * 7e5) + 3), pose: vendorPose(s.seed + 0.37, t, ph === 'open' ? 'setup' : ph, false), view, apron: CGREEN });
  return out;
}

const TRUCK = { z: 64.5, dir: 1, kind: 'pickup' as const, body: CBEIGE, rider: 0, helmet: 0, X: (VEHICLES.truck.X0 + VEHICLES.truck.X1) / 2 };
const MOTO = { z: (VEHICLES.moto.z0 + VEHICLES.moto.z1) / 2, dir: 1, kind: 'moto' as const, body: CRED, rider: 0, helmet: 0, X: (VEHICLES.moto.X0 + VEHICLES.moto.X1) / 2 };
const unloaderPos = (u: number) => ({ X: -13.6 + (ROW_W.spotX + 0.4 - -13.6) * u, z: 61.5 + (59.2 - 61.5) * u });

/** Everything of the feira to draw this frame, depth-keyed for drawByDepth. */
export function feiraItems(): { z: number; draw: () => void }[] {
  if (!feiraOn()) return [];
  const items: { z: number; draw: () => void }[] = [];
  const boxes = feiraBoxes();
  for (const s of ctx.stalls) {
    items.push({ z: s.z1, draw: () => drawStall(s) });
    for (const v of vendors(s)) items.push({ z: sortZ(v.X, v.z, boxes), draw: () => person(v.X, v.z, v.look, { view: v.view, step: 0, apron: v.apron, pose: v.pose }) });
  }
  // the truck at the far end with crates on its bed, and its unloader walking crates to the stalls
  items.push({ z: TRUCK.z, draw: () => {
    drawCarP(V, TRUCK, true);
    const k = scaleAt(V, TRUCK.z), cx = projX(V, TRUCK.X, TRUCK.z), gy = projY(V, 0, TRUCK.z), n = Math.round(4 * ctx.state.stock + 1);
    for (let i = 0; i < n; i++) rect(cx + (-6 + (i % 3) * 4) * k, gy - (14 + Math.floor(i / 3) * 3) * k, 3.6 * k, 3 * k, [WOOD, CORNG, LEAFG, CYELL][i % 4]);
  } });
  const un = unloaderAt(S.ms / 1000), up = unloaderPos(un.u), unLook = lookOf(4242);
  items.push({ z: sortZ(up.X, up.z, boxes), draw: () => person(up.X, up.z, unLook, { view: 'side', step: Math.sin(S.ms / 160), face: un.loaded ? -1 : 1, pose: un.loaded ? 'carry' : undefined }) });
  items.push({ z: MOTO.z, draw: () => {
    drawCarP(V, MOTO, true);
    const k = scaleAt(V, MOTO.z), cx = projX(V, MOTO.X, MOTO.z), gy = projY(V, 0, MOTO.z);
    rect(cx - 2.6 * k, gy - 13 * k, 5.2 * k, 3.6 * k, WOOD); rect(cx - 2.2 * k, gy - 13.6 * k, 4.4 * k, 0.8 * k + 1, CYELL);
  } });
  for (const b of BARROWS) items.push({ z: b.z1, draw: () => barrow((b.X0 + b.X1) / 2, (b.z0 + b.z1) / 2, ctx.state.stock > 0.15) });
  // the shoppers
  for (const p of SHOP) {
    if (!p.on) continue;
    items.push({ z: sortZ(p.X, p.z, boxes), draw: () => drawShopper(p) });
  }
  return items;
}

function drawShopper(p: Shopper) {
  const lead = p.lead >= 0 ? SHOP[p.lead] : p, mv = moving(p, SHOP), atStall = lead.state !== 'walk' && lead.stall >= 0;
  const st = atStall ? SHOP_STALL(lead) : null, face = st ? -rowOf(st).side : 1;
  const view: View3 = atStall ? 'side' : p.dz > 0 ? 'back' : 'front';
  const look = lookOf(p.look, p.age === 'elder');
  if (p.carry === 'barrow') barrow(p.X, p.z + p.dz * 1.1, true);
  const busy = lead === p && p.state === 'buy';
  person(p.X, p.z, look, {
    view, step: mv ? Math.sin(p.ph * 2) : 0, small: p.age === 'child', stoop: p.age === 'elder', face, carry: p.carry === 'barrow' ? 'none' : p.carry,
    load: p.load, pose: busy ? 'reach' : undefined, umbrella: p.umbrella && ctx.wet && !(atStall && !mv), // under the tarp they close it
  });
}
const SHOP_STALL = (p: Shopper): Stall | null => ctx.stalls.find((s) => s.id === p.stall) ?? null;

// ---------- taps ----------
type TapHit = { x: number; y: number; speaker?: Speaker; sfx?: 'truck' };
function hitPerson(X: number, z: number, x: number, y: number, small = false): boolean {
  if (z < 1) return false;
  const k = scaleAt(V, z) * (small ? 0.62 : 1), cx = projX(V, X, z), gy = projY(V, 0, z);
  return Math.abs(x - cx) <= 3 * k + 2 && y <= gy + 2 && y >= gy - 18 * k - 2;
}
const head = (X: number, z: number) => ({ x: projX(V, X, z), y: projY(V, 0, z) - 18 * scaleAt(V, z) });

/** A tap on a shopper (they talk), a feirante or their stall (the feirante calls out), or the truck. */
export function feiraTap(x: number, y: number): TapHit | null {
  if (!feiraOn()) return null;
  const people: { X: number; z: number; role: 'vendor' | 'shopper'; small: boolean; track?: () => { x: number; y: number } | null }[] = [];
  SHOP.forEach((p) => { if (p.on) people.push({ X: p.X, z: p.z, role: 'shopper', small: p.age === 'child', track: () => (p.on ? head(p.X, p.z) : null) }); });
  for (const s of ctx.stalls) for (const v of vendors(s)) people.push({ X: v.X, z: v.z, role: 'vendor', small: false });
  people.sort((a, b) => a.z - b.z);
  for (const q of people) if (hitPerson(q.X, q.z, x, y, q.small)) { const h = head(q.X, q.z); return { ...h, speaker: { role: q.role, track: q.track } }; }
  for (const s of [...ctx.stalls].sort((a, b) => a.z0 - b.z0)) {
    const x0 = projX(V, s.X0 - 0.3, s.z0), x1 = projX(V, s.X1 + 0.3, s.z1), y0 = projY(V, ctx.state.tarps ? 2.75 : 1.2, s.z0), y1 = projY(V, 0, s.z0);
    if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= y0 && y <= y1) {
      const v = vendors(s)[0];
      return { ...head(v.X, v.z), speaker: { role: 'vendor' } };
    }
  }
  const k = scaleAt(V, TRUCK.z), tx = projX(V, TRUCK.X, TRUCK.z), ty = projY(V, 0, TRUCK.z);
  if (Math.abs(x - tx) <= 9 * k + 2 && y <= ty + 2 && y >= ty - 18 * k) return { x: tx, y: ty - 18 * k, sfx: 'truck' };
  return null;
}

export function feiraDebug(): string {
  const st = ctx.state;
  if (st.phase === 'none') return '  feira -';
  const on = SHOP.filter((p) => p.on);
  return `  feira ${st.kind} ${st.phase} shoppers x${on.length}/${shopperCap(st.flow, ctx.wet)} buying x${on.filter((p) => p.state === 'buy').length} umb x${on.filter((p) => p.umbrella).length} stalls x${ctx.stalls.length}`;
}
