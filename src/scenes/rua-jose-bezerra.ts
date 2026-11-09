/* RUA JOSÉ BEZERRA DA COSTA (Esperança, PB), drawn from the owner's photo (a Street View capture,
   used as reference only; it is not in the repo). Looking down the street in one-point perspective:
   on the left a long, low wall, whitewashed above and faded pink-red below, with a grey gate and
   rooftops beyond, a white pickup and a dark car parked along it; in the left foreground a paved
   island with grass at its kerbs and a round concrete planter; down the middle a median with two
   leafy trees, a small kiosk, parked motorcycles and a double-armed street light; on the right a
   row of two- and three-storey buildings (wood cladding over a yellow sign band, a beige block, a
   grey shop), low white houses and a tree in white flower, a blue truck and a white supermarket van
   ("SUPER ESPERANÇA") at the kerb. No zebra crossing is visible, so none is drawn: pedestrians keep
   to the two sidewalks and never cross, and traffic runs both ways on the right-hand carriageway.
   On market mornings (assumed: Saturdays, a small feirinha on Wednesdays) a feira livre fills the
   unused left carriageway between the wall and the median: ./rjb-feira.ts draws it, the rules are
   in ../actors/feira-rules.ts. */
import { L, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  ASPH, BARK, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CHURCHL, CRED, CYELL, FPINK, LEAFG, LEAFGD, STEEL, STONE, STONEL,
  TILEW, VOID, WCOOL, WDIM, WOOD, CORNG, HAIR2,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { setLanes } from '../actors/people';
import { setCarLanes } from '../actors/cars';
import type { DepthRoad } from '../actors/persp-rules';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { bandeirolas, isNight, text, textW, wire, wireCurve } from './br-kit';
import { feiraBoxes, feiraBuild, feiraDebug, feiraFlow, feiraItems, feiraTap, feiraUpdate } from './rjb-feira';
import { sortZ, walkerBoost } from '../actors/feira-rules';
import {
  type Facade, type Opening, type PCar, type PKind, type PLamp, type View, type Walker, type WalkCfg, OPEN, drawByDepth, drawCarP,
  drawOpeningsP, drawWalker, lampLightP, lampPostP, makeCars, makeWalkers, paintFacades, paintFront, paintGround, projX, projY, scaleAt,
  tapCarP, tapWalker, updateCarsP, updateWalkers,
} from './persp-kit';
import type { Scene } from './types';

const V: View = { vx: 272, vy: 71, f: 274, camH: 2.1 };
const HORIZON = V.vy, Y0 = V.vy + 1, SH = 180 - Y0;
// Lateral layout, metres: the wall, its sidewalk edge, the median, the right kerb and building line.
const XW = -22, XWS = -20.8, XM0 = -6.2, XM1 = -1.7, XKR = 9.5, XBR = 12;
const MED0 = 27.6, MED1 = 62; // the median's depth
const ISL = { X0: -16, X1: -3.2, z1: 14 }; // the paved island in the left foreground
const PLANTER = { X: -5.9, z: 9.4, r: 1.5, h: 0.55 };
const wr = mulberry32(0x1b3c);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: Y0, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const opens: Opening[] = [];
const LAMPS: PLamp[] = [
  { X: -4.3, z: 45, h: 10.3, arm: 3.2 }, { X: -4.3, z: 45, h: 10.3, arm: -3.2 },
  { X: -4.2, z: 90, h: 10.5, arm: 3 }, { X: -4.2, z: 90, h: 10.5, arm: -3 },
];
const trees: Tree[] = [];
let blossom: number[] = [];

const open = (kind: 'win' | 'shop', base = WDIM) => { opens.push({ kind, rank: wr(), px: [], base }); return OPEN + opens.length - 1; };
const grain = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return v - Math.floor(v); };
const band = (h: number, a: number, b: number) => h >= a && h < b;

// ---------- the wall on the left ----------
const wallTop = (Z: number) => Math.max(2.2, 3.05 - 0.009 * (Z - 18));
function wall(): Facade {
  return {
    X: XW, z0: 16, z1: 125, h: 3.05,
    paint: (_s, h, Z) => {
      const top = wallTop(Z);
      if (h > top) return 255;
      if (h > top - 0.12) return STONEL; // coping
      if (Z > 56 && Z < 61.5 && h < 2.05) return Math.floor(Z * 3) % 2 ? STEEL : STONE; // grey gate
      const g = grain(Math.floor(Z * 0.9), Math.floor(h * 2.5));
      const lower = h < 1.05 + 0.25 * Math.sin(Z * 0.7);
      if (lower) return g < 0.07 ? CRED : g < 0.14 ? STONEL : FPINK; // faded pink-red base
      return Z < 50 ? (g < 0.18 ? CBEIGE : g < 0.24 ? STONE : STONEL) : g < 0.2 ? STONEL : TILEW; // stained whitewash
    },
  };
}

// ---------- the right side ----------
function rightSide(): Facade[] {
  const s1 = open('shop'), s2 = open('shop'), s3 = open('shop');
  const w = Array.from({ length: 10 }, () => open('win'));
  return [
    { // wood-clad top floors over a yellow sign band and roll-up doors
      X: XBR, z0: 15.8, z1: 22.6, h: 8.8, end: () => STONEL,
      paint: (_s, h, Z) => {
        if (h > 8.4) return TILEW;
        if (h > 4.4) { if (Z > 16.4 && Z < 18 && band(h, 5.4, 7.2)) return w[0]; return Math.floor(h * 6) % 2 ? WOOD : HAIR2; }
        if (h > 3.3) { const d = Math.hypot(Z - 16.1, h - 3.85); return d < 0.45 ? (d < 0.3 ? VOID : CORNG) : CYELL; } // sign band, a logo at the cut edge
        if (Z > 19 && Z < 21 && h < 2.6) return Math.floor(Z * 8) % 2 ? TILEW : BNEAR; // white security grille
        if (Z > 16.2 && Z < 18.8 && h < 2.9) return s1;
        return STONEL;
      },
    },
    { // beige three-storey block with balconies and a roll-up door
      X: XBR, z0: 22.6, z1: 29.5, h: 8.9, end: () => CBEIGE,
      paint: (_s, h, Z) => {
        if (h > 8.6) return STONEL;
        if (h < 3) return Z > 23.2 && Z < 28.2 && h < 2.8 ? s2 : CBEIGE;
        if (band(h, 3.6, 3.8) || band(h, 6.3, 6.5)) return STONEL; // balcony rails
        if (Z > 24 && Z < 27.5 && (band(h, 3.8, 5.2) || band(h, 6.5, 7.9))) return w[h > 6 ? 1 : 2];
        return grain(Math.floor(Z * 4), Math.floor(h * 4)) < 0.1 ? CHURCHL : CBEIGE;
      },
    },
    { // grey two-storey shop with a dark sign board
      X: XBR, z0: 29.5, z1: 42.7, h: 6.7, end: () => STONE,
      paint: (_s, h, Z) => {
        if (h > 6.4) return STONEL;
        if (band(h, 2.7, 3.4) && Z > 30.5 && Z < 37) return BNEAR;
        if (h < 2.7) return Z > 30.5 && Z < 40 ? s3 : STONE;
        if (band(h, 3.9, 5.4) && (Z - 29.5) % 4.5 < 2.5) return w[3 + (Math.floor((Z - 29.5) / 4.5) % 3)];
        return STONE;
      },
    },
    { // low white houses
      X: XBR, z0: 42.7, z1: 64, h: 3.8, end: () => TILEW,
      paint: (_s, h, Z) => (h > 3.5 ? STONEL : h < 2.2 && (Z - 42.7) % 7 > 5.6 ? WOOD : band(h, 1.1, 2.1) && (Z - 42.7) % 7 < 2.2 ? w[6 + (Math.floor(Z / 7) % 4)] : h < 0.7 ? STONE : TILEW),
    },
    { X: XBR, z0: 64, z1: 80, h: 5.5, end: () => FPINK, paint: (_s, h) => (h > 5.2 ? STONEL : h < 2.3 ? STONE : FPINK) },
    { X: XBR, z0: 80, z1: 110, h: 4.6, end: () => CBEIGE, paint: (_s, h, Z) => (h > 4.3 ? STONEL : h < 2.2 && Z % 8 < 2 ? WOOD : CBEIGE) },
  ];
}

/** The side of a parked vehicle that faces the street's axis (its near face is drawn with the traffic). */
function box(X: number, z0: number, z1: number, h: number, body: number, cabFrom: number, cabTo: number, cabH: number): Facade {
  return {
    X, z0, z1, h: Math.max(h, cabH),
    paint: (s, hh) => {
      const wheel = [0.7, z1 - z0 - 0.8].some((c) => Math.hypot(s - c, hh - 0.32) < 0.33);
      if (wheel) return VOID;
      if (hh < 0.35) return 255;
      if (hh < h) return hh < 0.45 ? STEEL : body;
      if (s > cabFrom && s < cabTo && hh < cabH) return hh > cabH - 0.12 ? body : s < cabFrom + 0.15 || s > cabTo - 0.15 ? body : WCOOL;
      return 255;
    },
  };
}
// Each parked vehicle's side gets its own layer, drawn in depth order with the moving traffic and the
// pedestrians: the truck and the van at the right kerb overlap each other on screen, and the feira's
// stalls and shoppers stand beyond the pickup and the dark car along the wall.
const truckSide = newLayer(), vanSide = newLayer(), pickupSide = newLayer(), carSide = newLayer();

// ---------- far, poles, wires, ground ----------
function buildFar() {
  // rooftops beyond the wall and a tall sign frame, trees at the far left
  for (let x = 60; x < 230;) { const w = 6 + ((wr() * 14) | 0), top = 53 + ((wr() * 8) | 0); L(far, x, top, w, 72 - top, wr() < 0.5 ? STONE : STONEL); x += w + ((wr() * 4) | 0); }
  L(far, 66, 46, 10, 12, BNEAR); L(far, 70, 58, 2, 8, STEEL);
  for (let x = 0; x < 40; x++) for (let y = 49; y < 60; y++) if (Math.hypot((x % 14) - 7, y - 55) < 6 + grain(x, y) * 2) Lp(far, x, y, (x + y) % 5 ? LEAFG : LEAFGD);
  for (let x = 236; x < 320;) { const w = 5 + ((wr() * 9) | 0), top = 60 + ((wr() * 8) | 0); L(far, x, top, w, 72 - top, BFAR); x += w; }
  // the street's far end, buildings facing down it
  paintFront(mid, V, -9, XBR, 140, 5, (u, h) => (h > 4.7 ? STONEL : u > -3 && u < 2 ? (h > 2 ? CRED : FPINK) : h < 2 && Math.abs(u % 3) < 1 ? WOOD : u < 0 ? TILEW : CBEIGE));
}

function pole(X: number, z: number, h: number) {
  const x = Math.round(projX(V, X, z)), yb = Math.round(projY(V, 0, z)), yt = Math.round(projY(V, h, z)), w = Math.max(1, Math.round((V.f / z) * 0.25));
  L(mid, x, yt, w, yb - yt, STONEL); if (w > 2) L(mid, x + w - 1, yt, 1, yb - yt, STONE);
  const arm = Math.round((V.f / z) * 0.8); L(mid, x - arm, yt + 2, 2 * arm + w, 1, STONE);
  return { x: x + (w >> 1), y: yt + 2 };
}

const WIRES: [number, number, number, number, number][] = [];
function buildPoles() {
  const a = pole(XWS + 0.3, 33, 7.3), b = pole(XWS + 0.6, 80, 8.5), c = pole(XKR + 0.2, 37, 8), d = pole(XKR + 0.2, 75, 7.5);
  const m = pole(LAMPS[0].X, LAMPS[0].z, LAMPS[0].h), m2 = pole(LAMPS[2].X, LAMPS[2].z, LAMPS[2].h);
  for (const l of LAMPS) lampPostP(mid, V, l);
  WIRES.push([a.x, a.y, c.x, c.y, 5], [a.x, a.y + 2, c.x, c.y + 2, 7], [a.x, a.y, b.x, b.y, 2], [c.x, c.y, d.x, d.y, 2], [m.x, m.y, m2.x, m2.y, 1]);
  WIRES.push([a.x, a.y, 0, 20, 3], [a.x, a.y + 2, 0, 40, 4], [c.x, c.y, 480, -10, 3], [c.x, c.y + 2, 480, 30, 4]);
  for (const [x0, y0, x1, y1, s] of WIRES) wire(mid, x0, y0, x1, y1, s);
}

function groundAt(X: number, Z: number): number {
  if (X < XW || X > XBR) return STONE;
  if (X < XWS) return Z % 1.5 < 0.08 ? STONE : STONEL; // narrow sidewalk along the wall
  if (X > XKR) return X < XKR + 0.18 ? TILEW : Z % 1.2 < 0.07 ? STONE : STONEL; // kerb and right sidewalk
  const kerb = (inside: boolean, edge: number) => (inside ? (edge < 0.18 ? TILEW : edge < 0.5 && grain(Math.floor(X * 9), Math.floor(Z * 9)) < 0.35 ? LEAFGD : STONEL) : -1);
  if (Z < ISL.z1 && X > ISL.X0 && X < ISL.X1) return kerb(true, Math.min(ISL.X1 - X, ISL.z1 - Z)); // the island, grass at its kerbs
  if (Z > MED0 && Z < MED1 && X > XM0 && X < XM1) { const e = Math.min(X - XM0, XM1 - X, Z - MED0, MED1 - Z); return e < 0.18 ? TILEW : grain(Math.floor(X * 6), Math.floor(Z * 3)) < 0.3 ? BARK : STONE; }
  return grain(Math.floor(X * 13), Math.floor(Z * 7)) < 0.07 ? STONE : ASPH;
}

function buildGround() {
  paintGround(street.base, Y0, V, (X, Z) => groundAt(X, Z));
  for (let p = 0; p < 6; p++) {
    const cx = XM1 + wr() * (XKR - XM1), cz = 6 + wr() * 30, rx = 0.8 + wr() * 1.5, rz = 1.5 + wr() * 3;
    for (let y = Y0; y < 180; y++) {
      const Z = (V.f * V.camH) / (y + 0.5 - V.vy);
      for (let x = 0; x < WW; x++) { const X = ((x + 0.5 - V.vx) * Z) / V.f, a = (X - cx) / rx, b = (Z - cz) / rz; if (a * a + b * b < 1) street.pud[(y - Y0) * WW + x] = 1; }
    }
  }
}

/** The round concrete planter on the island: a white ring with soil and a small plant, into the front layer. */
function buildPlanter() {
  const { X, z, r, h } = PLANTER, k = V.f / z;
  for (let a = 0; a <= Math.PI; a += 0.004) { // the side, front half
    const px = Math.round(projX(V, X + r * Math.cos(a), z - r * Math.sin(a))), zz = z - r * Math.sin(a);
    const y0 = Math.round(projY(V, h, zz)), y1 = Math.round(projY(V, 0, zz));
    L(front, px, y0, 1, y1 - y0, Math.cos(a) > 0.55 ? STONE : STONEL);
  }
  const step = 0.6 / k;
  for (let dz = -r; dz <= r; dz += step) for (let dx = -r; dx <= r; dx += step) {
    const d = Math.hypot(dx, dz);
    if (d > r) continue;
    const c = d > r - 0.22 ? TILEW : d < 0.25 && grain(Math.floor(dx * 20), Math.floor(dz * 20)) < 0.6 ? LEAFG : grain(Math.floor(dx * 8), Math.floor(dz * 8)) < 0.2 ? LEAFGD : WOOD;
    Lp(front, Math.round(projX(V, X + dx, z + dz)), Math.round(projY(V, h, z + dz)), c);
  }
  for (let i = 0; i < 9; i++) Lp(front, Math.round(projX(V, X + 0.05 * (i % 3 - 1), z)), Math.round(projY(V, h + 0.08 * i, z)), i % 2 ? LEAFG : LEAFGD); // the sapling
}

/** The kiosk on the median and its green board. */
function buildKiosk() {
  paintFront(mid, V, -5.5, -3.2, 41, 2.6, (u, h) => (h > 2.35 ? STONEL : h < 0.25 ? STONE : u > -5.3 && u < -3.4 && h > 0.9 && h < 2.1 ? BNEAR : BMID));
  paintFront(mid, V, -2.1, -1.8, 40, 1.15, (_u, h) => (h > 0.4 ? CGREEN : STEEL));
}

// ---------- actors ----------
const CARS: PCar[] = makeCars(7);
const WALKERS: Walker[] = makeWalkers(10);
const ROAD: DepthRoad = { zNear: 3, zFar: 140, gap: 1.6, stopGap: 1.2, crossing: null };
const laneX = (dir: 1 | -1) => (dir > 0 ? 3.8 : 0.8);
const WALK: WalkCfg = { walks: [{ X0: XW + 0.1, X1: XWS - 0.1, z0: 20 }, { X0: XKR + 0.3, X1: XBR - 0.2, z0: 13 }], zNear: 3.5, zFar: 75, zebra: null };
interface Parked { z: number; dir: number; kind: PKind; body: number; rider: number; helmet: number; X: number }
const PARKED: Parked[] = [
  { z: 13.6, dir: -1, kind: 'pickup', body: TILEW, rider: 0, helmet: 0, X: -15 },
  { z: 31, dir: -1, kind: 'car', body: VOID, rider: 0, helmet: 0, X: -13.45 },
  { z: 45, dir: -1, kind: 'car', body: TILEW, rider: 0, helmet: 0, X: 7.6 },
  { z: 75, dir: -1, kind: 'car', body: BNEAR, rider: 0, helmet: 0, X: 7.8 },
  { z: 16, dir: 1, kind: 'van', body: CBLUE, rider: 0, helmet: 0, X: 7.9 }, // the truck seen from behind
  { z: 10, dir: 1, kind: 'van', body: TILEW, rider: 0, helmet: 0, X: 6.0 },
  { z: 39, dir: 1, kind: 'moto', body: CRED, rider: 0, helmet: 0, X: -5.6 },
  { z: 39.6, dir: 1, kind: 'moto', body: VOID, rider: 0, helmet: 0, X: -4.9 },
];
const VAN = PARKED[5];

/** The supermarket's livery on the van's rear doors: green and red stripes, "SUPER" and "ESPERANÇA". */
function vanLivery() {
  const k = scaleAt(V, VAN.z), cx = projX(V, VAN.X, VAN.z), gy = projY(V, 0, VAN.z);
  const X = (u: number) => Math.round(cx + u * k), Y = (h: number) => Math.round(gy - h * k);
  rect(X(-8.5), Y(6), X(8.5) - X(-8.5), Math.max(1, Y(3.6) - Y(6)), CGREEN);
  rect(X(-8.5), Y(7), X(8.5) - X(-8.5), Math.max(1, Y(6) - Y(7)), CRED);
  const tw = textW('SUPER'), ew = textW('ESPERANÇA');
  if (X(7) - X(-7) >= ew) {
    text(null, 'SUPER', Math.round(cx - tw / 2), Y(12.5), CRED);
    text(null, 'ESPERANÇA', Math.round(cx - ew / 2), Y(12.5) + 7, CRED);
  }
  rect(X(-6), Y(13.5), 3, 2, CGREEN); rect(X(-6), Y(13.5) + 2, 3, 2, CRED); // the little logo blocks
}

function update(dt: number) {
  updateAnimals(dt);
  updateCarsP(CARS, dt, ROAD, laneX);
  feiraUpdate(dt);
  updateWalkers(WALKERS, dt, WALK, () => false, walkerBoost(feiraFlow())); // market mornings bring more people out
}

const shopsOpen = () => S.cal.weekday !== 0 && hourIn(S.cal.hour, 7.5, 18.5);
const FOG = [{ y: HORIZON + 2, h: 7, sp: 0.5 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  drawStreet(street);
  blitLayer(mid); blitLayer(front);
  drawOpeningsP(opens, shopsOpen());
  for (const t of trees) drawTree(t);
  for (let i = 0; i < blossom.length; i += 2) put(blossom[i], blossom[i + 1], TILEW);
  drawFarPrecip();
  for (const l of LAMPS) lampLightP(V, l);
  if (S.festa || S.saoJoao) { const [x0, y0, x1, y1] = WIRES[0]; bandeirolas(x0, y0 + 4, x1, y1 + 4, 10, 1); }
  drawAnimalsPerched();
  const boxes = feiraBoxes();
  drawByDepth([
    ...PARKED.map((p) => ({ z: p.z, draw: () => { drawCarP(V, p, true); if (p === VAN) vanLivery(); } })),
    { z: 19.5, draw: () => blitLayer(truckSide) }, { z: 12.2, draw: () => blitLayer(vanSide) },
    { z: 18.6, draw: () => blitLayer(pickupSide) }, { z: 35.2, draw: () => blitLayer(carSide) },
    ...CARS.filter((c) => c.on).map((c) => ({ z: c.z, draw: () => drawCarP(V, c) })),
    ...WALKERS.filter((w) => w.on).map((w) => ({ z: sortZ(w.X, w.z, boxes), draw: () => drawWalker(V, w) })),
    ...feiraItems(),
  ]);
  if (isNight()) for (let x = 250; x < 300; x += 6) put(x, Math.round(projY(V, 2.6, 140)), (x / 6) % 3 ? CYELL : TILEW);
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const ruaJoseBezerra: Scene = {
  id: 'rua-jose-bezerra',
  name: 'Rua José Bezerra da Costa',
  build() {
    if (!built) {
      buildFar();
      paintFacades(mid, V, [wall(), ...rightSide()], opens);
      paintFacades(pickupSide, V, [box(-14.15, 13.6, 18.6, 1.15, TILEW, 0.3, 2.4, 1.8)], opens); // white pickup along the wall
      paintFacades(carSide, V, [box(-12.6, 31, 35.2, 1.0, VOID, 0.9, 3.3, 1.45)], opens); // dark car
      paintFacades(truckSide, V, [box(7.05, 16, 23, 1.3, CBLUE, 0, 0, 0)], opens); // the blue truck's flatbed
      paintFacades(vanSide, V, [box(5.15, 10, 14.4, 1.95, TILEW, 0, 0, 0)], opens); // the van's side
      buildKiosk(); buildPoles(); buildGround(); buildPlanter();
      for (const [X, z, hgt] of [[-4.6, 37, 6], [-3.6, 70, 7]] as const) {
        const k = V.f / z;
        trees.push(makeTree(Math.round(projX(V, X, z)), Math.round(projY(V, 0, z)), (k * hgt) / 58, wr));
      }
      const fz = 50, fk = V.f / fz, ft = makeTree(Math.round(projX(V, 10.6, fz)), Math.round(projY(V, 0, fz)), (fk * 5.5) / 58, wr);
      trees.push(ft);
      for (let i = 0; i < ft.px.length; i += 7) if (ft.px[i + 6] < 0.3) blossom.push(ft.px[i], ft.px[i + 1]); // white flowers
      built = true;
    }
    setLanes([{ y: 400 }], { bikes: false }); // clears the side-on pedestrians: this scene has its own, on the sidewalks
    setCarLanes(400, 400, 'br'); // clears the side-on traffic: this scene runs its own, on the roadway only
    for (const c of CARS) c.on = false;
    for (const w of WALKERS) w.on = false;
    setupAnimals({ ground: [], dogs: 0, wires: WIRES.slice(0, 2).map(([a, b, c, d, s]) => wireCurve(a, b, c, d, s)), lamps: LAMPS.map((l) => ({ x: projX(V, l.X + l.arm, l.z), y: projY(V, l.h, l.z) })) });
    configure({ roofs: [], tips: [], lamps: LAMPS.map((l) => ({ x: projX(V, l.X + l.arm, l.z), y: projY(V, l.h, l.z) })), ground0: HORIZON + 14, horizon: HORIZON });
    feiraBuild(V);
    for (let i = 0; i < 300; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  walkers x${WALKERS.filter((w) => w.on).length}  road x${CARS.filter((c) => c.on).length}${feiraDebug()}`; },
  tap(x, y) { return tapWalker(V, WALKERS, x, y) ?? feiraTap(x, y) ?? tapCarP(V, CARS, x, y); },
};
