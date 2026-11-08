/* Kit for Esperança streets seen down their length (one-point perspective): Rua Faustino Porto and
   Rua José Bezerra da Costa. The street is modelled in metres (X across, positive to the right of the
   camera; Z away from it; height above the ground) and projected onto the world framebuffer:
   facades and ground are rasterised once into static layers, while vehicles, parked props and
   pedestrians are drawn every frame at their depth's scale, far to near.

   Vehicles stay on their lane on the roadway (persp-rules.ts); pedestrians walk only along the
   sidewalks and, where a scene has a zebra crossing, across it while traffic waits. */
import { L, Lp, type Layer, WW, WY0, getW, put, rect, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CNAVY, CRED, CYELL, HAIR1, HAIR2, HAIR3, HALO, HALOOK, LEDW, MAG, MAGD,
  SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, STONEL, TILEW, VOID, WCOOL, WDIM, WHITE, WWARM, LIGHT, FGREEN, FPINK,
} from '../engine/palette';
import { type DepthCar, type DepthRoad, canEnter, stepDepthCars } from '../actors/persp-rules';
import { peopleCap } from '../sky/rhythm';
import { S } from '../sky/state';
import { isNight } from './br-kit';

// ---------- projection ----------
/** Vanishing point (vx, vy) in world pixels, focal length f in px, camera height in metres. */
export interface View { vx: number; vy: number; f: number; camH: number }
export const projX = (v: View, X: number, Z: number) => v.vx + (v.f * X) / Z;
export const projY = (v: View, h: number, Z: number) => v.vy + (v.f * (v.camH - h)) / Z;
/** Pixels per decimetre at depth Z (vehicles and people are authored in decimetres). */
export const scaleAt = (v: View, Z: number) => v.f / Z / 10;

// ---------- facades ----------
/** Paint callback: s metres along the facade from its near end, h metres up; returns a palette index,
    255 for nothing, or OPEN + i to mark pixel as part of opening i (window or shop front). */
export type Paint = (s: number, h: number, Z: number) => number;
export const OPEN = 1000;
export interface Facade {
  /** Lateral plane of the facade, metres (negative = left of the camera). */
  X: number; z0: number; z1: number; h: number; paint: Paint;
  /** The facade's near end wall (seen where it rises above a lower neighbour); colour by height. */
  end?: (h: number) => number;
}
/** A window or shop front: its pixels, how it looks open (shops) or lit (windows). */
export interface Opening { kind: 'win' | 'shop'; rank: number; px: number[]; /** Window glass by day. */ base: number }

/** Rasterise facades into a layer, far to near; returns the pixels of each opening. */
export function paintFacades(ly: Layer, v: View, list: Facade[], openings: Opening[]) {
  const segs = [...list].sort((a, b) => b.z0 - a.z0);
  for (const f of segs) {
    const side = Math.sign(f.X);
    // the near end wall: plane Z = z0, from the facade line 8 m into the block
    if (f.end) {
      const xa = projX(v, f.X, f.z0), xb = projX(v, f.X + side * 8, f.z0);
      const y0 = Math.max(WY0, Math.floor(projY(v, f.h, f.z0))), y1 = Math.min(180, Math.ceil(projY(v, 0, f.z0)));
      for (let x = Math.max(0, Math.round(Math.min(xa, xb))); x <= Math.min(WW - 1, Math.round(Math.max(xa, xb))); x++)
        for (let y = y0; y < y1; y++) { const h = v.camH - ((y - v.vy) * f.z0) / v.f; if (h >= 0 && h <= f.h) Lp(ly, x, y, f.end(h)); }
    }
    const xa = projX(v, f.X, f.z1), xb = projX(v, f.X, f.z0);
    for (let x = Math.floor(Math.min(xa, xb)); x <= Math.ceil(Math.max(xa, xb)); x++) {
      if (x < 0 || x >= WW || x === v.vx) continue;
      const Z = (v.f * f.X) / (x + 0.5 - v.vx);
      if (Z < f.z0 || Z > f.z1) continue;
      const yt = Math.max(WY0, Math.floor(projY(v, f.h, Z))), yb = Math.min(180, Math.ceil(projY(v, 0, Z)));
      for (let y = yt; y < yb; y++) {
        const h = v.camH - ((y + 0.5 - v.vy) * Z) / v.f;
        if (h < 0 || h > f.h) continue;
        const c = f.paint(Z - f.z0, h, Z);
        if (c === 255) continue;
        if (c >= OPEN) { // shop fronts are painted shut (a roll-up door), windows with their glass
          const o = openings[c - OPEN];
          if (o) { o.px.push(x, y); Lp(ly, x, y, o.kind === 'shop' ? (y % 2 ? STEEL : BMID) : o.base); }
          continue;
        }
        Lp(ly, x, y, c);
      }
    }
  }
}

/** A flat face toward the camera (buildings closing the street far away), at depth Z. */
export function paintFront(ly: Layer, v: View, X0: number, X1: number, Z: number, h: number, paint: (u: number, h: number) => number) {
  const x0 = Math.round(projX(v, X0, Z)), x1 = Math.round(projX(v, X1, Z)), y0 = Math.floor(projY(v, h, Z)), y1 = Math.ceil(projY(v, 0, Z));
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
    const c = paint(X0 + ((x + 0.5 - projX(v, X0, Z)) * Z) / v.f, v.camH - ((y + 0.5 - v.vy) * Z) / v.f);
    if (c !== 255) Lp(ly, x, y, c);
  }
}

/** Fill the ground below the horizon (rows y0..179) into a street base buffer from a per-metre rule. */
export function paintGround(base: Uint8Array, y0: number, v: View, at: (X: number, Z: number, x: number, y: number) => number) {
  for (let y = y0; y < 180; y++) {
    const Z = (v.f * v.camH) / (y + 0.5 - v.vy);
    for (let x = 0; x < WW; x++) base[(y - y0) * WW + x] = at(((x + 0.5 - v.vx) * Z) / v.f, Z, x, y);
  }
}

/** Openings drawn every frame: lit windows at night, shop fronts open (interior) or shut (layer). */
export function drawOpeningsP(list: Opening[], openShops: boolean) {
  const n = isNight(), late = S.cal.hour >= 22 || S.cal.hour < 5 ? 0.2 : 0.6;
  for (const o of list) {
    let c = -1;
    if (o.kind === 'shop') { if (openShops && o.rank < 0.85) c = n ? WWARM : BNEAR; }
    else c = n && o.rank < late ? WWARM : n ? BNEAR : -1;
    if (c < 0) continue;
    for (let i = 0; i < o.px.length; i += 2) put(o.px[i], o.px[i + 1], c === WWARM && (o.px[i] + o.px[i + 1]) % 7 === 0 ? LIGHT : c);
  }
}

/** A street-light pole on the sidewalk with its arm over the road; drawn into a layer. */
export interface PLamp { X: number; z: number; h: number; arm: number }
export function lampPostP(ly: Layer, v: View, l: PLamp) {
  const x = Math.round(projX(v, l.X, l.z)), yb = Math.round(projY(v, 0, l.z)), yt = Math.round(projY(v, l.h, l.z));
  const w = Math.max(1, Math.round(scaleAt(v, l.z) * 2.2));
  L(ly, x, yt, w, yb - yt, STONEL); if (w > 1) L(ly, x + w - 1, yt, 1, yb - yt, STONE);
  const hx = Math.round(projX(v, l.X + l.arm, l.z));
  for (let i = Math.min(x, hx); i <= Math.max(x, hx); i++) Lp(ly, i, yt + Math.round(Math.abs(i - x) * 0.08), STONE);
}
/** The lamp head lights up at night and throws a pool of light on the ground around its foot. */
export function lampLightP(v: View, l: PLamp) {
  const hx = projX(v, l.X + l.arm, l.z), hy = projY(v, l.h, l.z), k = scaleAt(v, l.z);
  const on = isNight();
  rect(hx - Math.max(1, k * 3), hy, Math.max(2, k * 6), Math.max(1, k * 1.5), on ? LEDW : STONEL);
  if (!on) return;
  const R = 5; // metres
  const zn = Math.max(0.6, l.z - R);
  const x0 = Math.floor(projX(v, l.X + l.arm - R, zn)), x1 = Math.ceil(projX(v, l.X + l.arm + R, zn));
  const y0 = Math.floor(projY(v, 0, l.z + R)), y1 = Math.min(180, Math.ceil(projY(v, 0, zn)));
  for (let y = y0; y < y1; y++) {
    const Z = (v.f * v.camH) / (y + 0.5 - v.vy);
    for (let x = x0; x <= x1; x++) {
      const X = ((x + 0.5 - v.vx) * Z) / v.f, d = Math.hypot(X - l.X - l.arm, Z - l.z) / R;
      const c = getW(x, y);
      if (d < 1 && c !== 255 && HALOOK[c] && bay(sx(x), sy(y)) < 0.28 * (1 - d)) put(x, y, HALO);
    }
  }
  for (let j = -2; j <= 2; j++) for (let i = -4; i <= 4; i++) { // small halo round the head
    const c = getW(hx + i, hy + j);
    if (c !== 255 && HALOOK[c] && bay(sx(hx + i), sy(hy + j)) < 0.35 * (1 - Math.hypot(i, j * 1.6) / 5)) put(hx + i, hy + j, HALO);
  }
}

// ---------- vehicles ----------
export type PKind = 'moto' | 'car' | 'pickup' | 'van' | 'bus';
export interface PCar extends DepthCar { kind: PKind; body: number; rider: number; helmet: number; X: number }
const rr = mulberry32(0x9e25);
const rpick = <T>(a: readonly T[]): T => a[(rr() * a.length) | 0];
const LEN: Record<PKind, number> = { moto: 2, car: 4.2, pickup: 5, van: 4.4, bus: 11 };

export function makeCars(n: number): PCar[] {
  return Array.from({ length: n }, () => ({ on: false, z: 0, dir: 1 as const, sp: 0, cruise: 0, len: 4, kind: 'car' as PKind, body: TILEW, rider: CRED, helmet: VOID, X: 0 }));
}

/** Spawn one vehicle if the hour and the entry point allow it; `laneX` gives the lane for each direction. */
export function spawnCar(cars: PCar[], road: DepthRoad, laneX: (dir: 1 | -1) => number, buses = true) {
  const c = cars.find((o) => !o.on);
  if (!c) return;
  const dir: 1 | -1 = rr() < 0.5 ? 1 : -1, k = rr(), h = S.cal.hour;
  const kind: PKind = k < 0.48 ? 'moto' : k < 0.82 ? 'car' : k < 0.93 ? 'pickup' : k < 0.97 || !buses || h < 6 || h > 22 ? 'van' : 'bus';
  if (!canEnter(cars, dir, LEN[kind], road)) return;
  c.kind = kind; c.len = LEN[kind]; c.dir = dir; c.X = laneX(dir);
  c.body = kind === 'bus' ? TILEW : kind === 'moto' ? rpick([CRED, CRED, VOID, CBLUE, STONEL]) : rpick([TILEW, TILEW, TILEW, STONEL, STONEL, VOID, CRED, CBLUE, STONE]);
  c.rider = rpick([CRED, CBLUE, VOID, CYELL, TILEW, FGREEN]); c.helmet = rpick([VOID, VOID, TILEW, CRED, CBLUE]);
  c.cruise = (kind === 'moto' ? 9 : kind === 'bus' ? 6 : 7.5) * (0.85 + rr() * 0.3); c.sp = c.cruise; // m/s, town speeds
  c.z = dir > 0 ? road.zNear : road.zFar; c.on = true;
}

let spawnT = 0.5;
/** Spawns at the hour's traffic level and moves everyone (with the crossing state already set on the road). */
export function updateCarsP(cars: PCar[], dt: number, road: DepthRoad, laneX: (dir: 1 | -1) => number, density = 1) {
  spawnT -= dt * (0.04 + 0.5 * S.traffic) * density;
  if (spawnT <= 0) { spawnT = 0.8 + rr() * 2; spawnCar(cars, road, laneX); }
  stepDepthCars(cars, dt, road);
}

/** A vehicle seen from the front (oncoming) or the back (going away), at its depth's scale. `parked` skips lights. */
export function drawCarP(v: View, c: { z: number; dir: number; kind: PKind; body: number; rider: number; helmet: number; X: number }, parked = false) {
  if (c.z < 0.8) return;
  const k = scaleAt(v, c.z), cx = projX(v, c.X, c.z), gy = projY(v, 0, c.z), n = isNight() && !parked, front = c.dir < 0;
  const X = (u: number) => Math.round(cx + u * k), Y = (h: number) => Math.round(gy - h * k);
  const R = (u0: number, u1: number, h1: number, h0: number, col: number) => rect(X(u0), Y(h1), Math.max(1, X(u1) - X(u0)), Math.max(1, Y(h0) - Y(h1)), col);
  const head = n ? WHITE : CBEIGE, tail = n ? MAG : MAGD;
  if (c.kind === 'moto') {
    R(-1, 1, 6, 0, VOID); R(-2, 2, 9, 5, c.body); R(-3.5, 3.5, 10, 9, STEEL); // tyre, body, handlebar
    if (!parked) { R(-2.6, 2.6, 15, 8.5, c.rider); R(-1.8, 1.8, 18, 14.5, c.helmet); }
    R(-0.8, 0.8, 8, 6.5, parked ? BNEAR : front ? head : tail);
  } else {
    const bus = c.kind === 'bus', hw = bus ? 12.5 : 8.5, H = bus ? 30 : c.kind === 'van' ? 19 : c.kind === 'pickup' ? 16 : 14.5;
    R(-hw - 0.5, hw + 0.5, 0.6, -0.4, VOID); // shadow
    R(-hw + 0.5, -hw + 3, 3, 0, VOID); R(hw - 3, hw - 0.5, 3, 0, VOID); // tyres
    R(-hw, hw, bus || c.kind === 'van' ? H : 9, 2, c.body);
    if (bus) { R(-hw + 1.5, hw - 1.5, H - 3, H - 13, n ? LIGHT : WDIM); R(-hw, hw, 12, 10.5, CGREEN); }
    else if (c.kind === 'van') R(-hw + 2, hw - 2, H - 2, H - 7, n ? WDIM : WCOOL);
    else { R(-hw + 2, hw - 2, H, 9, c.body); R(-hw + 3, hw - 3, H - 1, 9.4, n ? WDIM : WCOOL); }
    R(-hw, hw, 3.4, 2, STEEL); // bumper
    R(-2, 2, 6, 4, front ? BNEAR : TILEW); // grille / plate
    R(-hw + 0.5, -hw + 3, 7.5, 6, parked ? STEEL : front ? head : tail); R(hw - 3, hw - 0.5, 7.5, 6, parked ? STEEL : front ? head : tail);
  }
  if (!n) return;
  if (front) { // headlight pool on the road ahead of it, toward the viewer
    const len = Math.round(14 * k), hw = (c.kind === 'moto' ? 3 : 9) * k;
    for (let j = 1; j <= len; j++) for (let x = Math.floor(cx - hw - j * 0.4); x <= cx + hw + j * 0.4; x++)
      if (bay(sx(x), sy(gy + j)) < 0.3 * (1 - j / (len + 1))) put(x, gy + j, HALO);
  } else for (let j = 1; j <= Math.round(3 * k); j++) for (let x = X(-8); x <= X(8); x++) if (bay(sx(x), sy(gy + j)) < 0.12) put(x, gy + j, MAGD);
}

export function tapCarP(v: View, cars: PCar[], x: number, y: number): { x: number; y: number; sfx: 'moto' | 'car' | 'bus' | 'truck' } | null {
  for (const c of cars) {
    if (!c.on || c.z < 1) continue;
    const k = scaleAt(v, c.z), cx = projX(v, c.X, c.z), gy = projY(v, 0, c.z), hw = (c.kind === 'bus' ? 13 : c.kind === 'moto' ? 3.5 : 9) * k + 2;
    const H = (c.kind === 'bus' ? 30 : c.kind === 'moto' ? 18 : 16) * k + 2;
    if (Math.abs(x - cx) <= hw && y <= gy + 2 && y >= gy - H) return { x: cx, y: gy - H, sfx: c.kind === 'moto' ? 'moto' : c.kind === 'bus' ? 'bus' : c.kind === 'van' ? 'truck' : 'car' };
  }
  return null;
}

// ---------- pedestrians ----------
/** A sidewalk (lateral band, metres) people walk along. */
export interface Walk { X0: number; X1: number; /** Nearest depth where this sidewalk is in view (default: the config's zNear). */ z0?: number }
/** A zebra crossing: depth band and the two kerbs it joins. */
export interface ZebraP { z0: number; z1: number; XL: number; XR: number }
type Phase = 'walk' | 'wait' | 'cross';
export interface Walker {
  on: boolean; X: number; z: number; dz: number; walk: number; phase: Phase; sp: number; ph: number; wait: number; tx: number; crossed: boolean;
  top: number; low: number; skin: number; hair: number; skirt: boolean;
}
const wr = mulberry32(0x77a1c);
const wpick = <T>(a: readonly T[]): T => a[(wr() * a.length) | 0];
export function makeWalkers(n: number): Walker[] {
  return Array.from({ length: n }, () => ({ on: false, X: 0, z: 0, dz: 1, walk: 0, phase: 'walk' as Phase, sp: 1.2, ph: 0, wait: 0, tx: 0, crossed: false, top: TILEW, low: VOID, skin: SKIN2, hair: HAIR1, skirt: false }));
}

export interface WalkCfg { walks: Walk[]; zNear: number; zFar: number; zebra?: ZebraP | null }
let walkT = 0.5;

function spawnWalker(ws: Walker[], cfg: WalkCfg) {
  const w = ws.find((o) => !o.on);
  if (!w) return;
  w.walk = (wr() * cfg.walks.length) | 0;
  const wk = cfg.walks[w.walk];
  w.X = wk.X0 + 0.3 + wr() * (wk.X1 - wk.X0 - 0.6);
  w.dz = wr() < 0.5 ? 1 : -1;
  const zn = Math.max(cfg.zNear, wk.z0 ?? 0);
  w.z = w.dz > 0 ? zn : zn + (cfg.zFar - zn) * (0.4 + wr() * 0.6);
  w.sp = 1.1 + wr() * 0.5; w.ph = wr() * 4; w.phase = 'walk'; w.crossed = false;
  w.skirt = wr() < 0.35; w.top = wpick([TILEW, CBLUE, CRED, CYELL, FPINK, STEEL, CGREEN, VOID, CBEIGE]);
  w.low = w.skirt ? w.top : wpick([VOID, BNEAR, CNAVY, CBLUE, STONE]);
  w.skin = wpick([SKIN1, SKIN2, SKIN2, SKIN3, SKIN3, SKIN4]); w.hair = wpick([HAIR1, HAIR1, HAIR2, HAIR3]);
  w.on = true;
}

/** Whether someone waits at the kerb or is on the crossing (the traffic must wait). */
export const zebraBusyP = (ws: Walker[]) => ws.some((w) => w.on && (w.phase === 'wait' || w.phase === 'cross'));

/**
 * Pedestrians walk along the sidewalks toward or away from the viewer. With a zebra, some who reach
 * it wait at the kerb until no vehicle is on or near the stripes, then cross to the other sidewalk
 * and carry on there. `carsNear` says whether a vehicle is on the crossing or its stop lines.
 */
export function updateWalkers(ws: Walker[], dt: number, cfg: WalkCfg, carsNear: () => boolean, density = 1) {
  walkT -= dt * 0.5 * S.busy * density;
  if (walkT <= 0) { walkT = 0.6 + wr() * 1.6; if (ws.filter((w) => w.on).length < Math.min(ws.length, peopleCap(S.busy * density))) spawnWalker(ws, cfg); }
  const zb = cfg.zebra;
  for (const w of ws) {
    if (!w.on) continue;
    if (w.phase === 'walk') {
      w.z += w.dz * w.sp * dt; w.ph += dt * w.sp * 3;
      if (zb && !w.crossed && w.z > zb.z0 + 0.4 && w.z < zb.z1 - 0.4 && wr() < dt * 0.25) { w.phase = 'wait'; w.wait = 0.6 + wr(); }
      if (w.z < Math.max(cfg.zNear, cfg.walks[w.walk].z0 ?? 0) - 0.5 || w.z > cfg.zFar) w.on = false;
    } else if (w.phase === 'wait') {
      w.wait -= dt;
      if (w.wait <= 0 && !carsNear()) {
        w.phase = 'cross';
        const other = cfg.walks.findIndex((k, i) => i !== w.walk && Math.sign(k.X0) !== Math.sign(cfg.walks[w.walk].X0));
        w.walk = other < 0 ? w.walk : other;
        const wk = cfg.walks[w.walk]; w.tx = wk.X0 + 0.3 + wr() * (wk.X1 - wk.X0 - 0.6);
      }
    } else {
      const d = w.tx - w.X, step = w.sp * dt;
      w.ph += dt * w.sp * 3;
      if (Math.abs(d) <= step) { w.X = w.tx; w.phase = 'walk'; w.crossed = true; if (wr() < 0.5) w.dz = -w.dz as 1 | -1; }
      else w.X += Math.sign(d) * step;
    }
  }
}

/** Debug: walkers on the roadway part of the crossing right now. */
export const onZebra = (ws: Walker[], zb: ZebraP | null | undefined) => (zb ? ws.filter((w) => w.on && w.phase === 'cross' && w.X > zb.XL && w.X < zb.XR).length : 0);

/** A pedestrian at its depth's scale: back view walking away, front view walking toward, side view crossing. */
export function drawWalker(v: View, w: Walker) {
  if (w.z < 0.8) return;
  const k = scaleAt(v, w.z), cx = projX(v, w.X, w.z), gy = projY(v, 0, w.z);
  const X = (u: number) => Math.round(cx + u * k), Y = (h: number) => Math.round(gy - h * k);
  const R = (u0: number, u1: number, h1: number, h0: number, col: number) => rect(X(u0), Y(h1), Math.max(1, X(u1) - X(u0)), Math.max(1, Y(h0) - Y(h1)), col);
  const st = w.phase === 'wait' ? 0 : Math.sin(w.ph * 2), side = w.phase === 'cross';
  if (side) { const a = st * 1.6; R(-1 + a, 0.6 + a, 8, 0, w.skirt ? w.skin : w.low); R(-0.6 - a, 1 - a, 8, 0, w.skirt ? w.skin : w.low); }
  else { const lift = Math.abs(st) > 0.5 ? 0.8 : 0; R(-1.8, -0.4, 8, st > 0 ? lift : 0, w.skirt ? w.skin : w.low); R(0.4, 1.8, 8, st < 0 ? lift : 0, w.skirt ? w.skin : w.low); }
  if (w.skirt) R(-2, 2, 9, 5.5, w.low);
  R(side ? -1.4 : -2.2, side ? 1.4 : 2.2, 14, 8, w.top);
  R(-1.3, 1.3, 16.8, 14, w.skin);
  if (w.dz > 0 && !side) R(-1.4, 1.4, 17.2, 14.6, w.hair); // seen from behind
  else R(-1.4, 1.4, 17.2, 16.2, w.hair);
  if (w.skirt && !side) R(-1.5, 1.5, 16.5, 13.5, w.hair);
}

export function tapWalker(v: View, ws: Walker[], x: number, y: number): { x: number; y: number; sfx: 'oi' } | null {
  for (const w of ws) {
    if (!w.on || w.z < 1) continue;
    const k = scaleAt(v, w.z), cx = projX(v, w.X, w.z), gy = projY(v, 0, w.z);
    if (Math.abs(x - cx) <= 3 * k + 2 && y <= gy + 2 && y >= gy - 18 * k - 2) return { x: cx, y: gy - 18 * k, sfx: 'oi' };
  }
  return null;
}

/** Draw a mix of depth-sorted things far to near. */
export function drawByDepth(items: { z: number; draw: () => void }[]) {
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.draw();
}
