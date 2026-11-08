/* RUA FAUSTINO PORTO (Esperança, PB), drawn from the owner's photo (a Street View capture, used as
   reference only; it is not in the repo). Looking down the street in one-point perspective: on the
   left the weathered pink corner house with its balustered balcony, the white "BOLOS" panel ("SE FAZ
   A DIFERENÇA", number 120) and the little cake shop under a yellow sign, then pink, green and white
   houses and a red building far down; on the right the modern two-storey block with its glass
   curtain wall over a black-marble shop front, a white concrete pole, motorcycles parked at the kerb
   and a taller grey building. A zebra crosses the street in the foreground; the road has a yellow
   centre line, a street light on the left and wires overhead.

   Traffic keeps to the roadway (away from the viewer in the right lane, oncoming in the left) and
   stops at the zebra while anyone waits at its kerb or is crossing; pedestrians walk only on the
   two sidewalks and cross on the stripes. */
import { L, WW, blitLayer, newLayer, put } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  ASPH, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CHURCHL, CRED, CYELL, FBLUE, FGREEN, FPINK, STEEL, STONE, STONEL, TILEW, VOID,
  WDIM, WOOD, WWARM, LIGHT,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { setLanes } from '../actors/people';
import { setCarLanes } from '../actors/cars';
import { type DepthRoad, carsOnCrossing } from '../actors/persp-rules';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { bandeirolas, isNight, textBit, textW, wire, wireCurve } from './br-kit';
import {
  type Facade, type Opening, type PCar, type PLamp, type View, type Walker, type WalkCfg, OPEN, drawByDepth, drawCarP, drawOpeningsP,
  drawWalker, lampLightP, lampPostP, makeCars, makeWalkers, onZebra, paintFacades, paintFront, paintGround, projX, projY,
  tapCarP, tapWalker, updateCarsP, updateWalkers, zebraBusyP,
} from './persp-kit';
import type { Scene } from './types';

// Camera matched to the photo: vanishing point, focal length (px) and eye height (m).
const V: View = { vx: 249, vy: 88, f: 274, camH: 2.1 };
const HORIZON = V.vy, Y0 = V.vy + 1, SH = 180 - Y0;
// Lateral layout, metres: left building line, left kerb, centre line, right kerb, right building line.
const XBL = -5.8, XKL = -3.9, XC = 1.5, XKR = 6.8, XBR = 8.4;
const ZEB = { z0: 10.3, z1: 15.5, XL: XKL, XR: XKR };
const wr = mulberry32(0xfa57);
const far = newLayer(), mid = newLayer();
const street: Street = { y0: Y0, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const opens: Opening[] = [];
const LAMPS: PLamp[] = [{ X: -3.7, z: 18.3, h: 5.6, arm: 2.5 }, { X: -4, z: 40, h: 5.6, arm: 2.3 }];
let tree: Tree | null = null;

const open = (kind: 'win' | 'shop', base = WDIM) => { opens.push({ kind, rank: wr(), px: [], base }); return OPEN + opens.length - 1; };
/** A grain of weathering: deterministic noise per facade point. */
const grain = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return v - Math.floor(v); };
const band = (h: number, a: number, b: number) => h >= a && h < b;

// ---------- left side ----------
/** The corner house: dark skirting, white panel with the "BOLOS" lettering, yellow sign over the cake
    shop, a balustered balcony and a weathered pink upper floor with one small window. */
function bolosHouse(): Facade {
  const shop = open('shop'), win = open('win');
  const BOL = 'BOLOS', SE = 'SE FAZ A DIFERENÇA';
  return {
    X: XBL, z0: 2, z1: 14.5, h: 7.8,
    end: (h) => (h > 7.4 ? STONE : FPINK),
    paint: (_s, h, Z) => {
      if (h > 7.5) return STONE; // cornice
      if (h >= 4.15) { // upper floor
        if (Z > 10.4 && Z < 11.1 && band(h, 4.4, 5.0)) return Z < 10.5 || Z > 11 || h < 4.47 || h > 4.93 ? TILEW : win;
        return grain(Math.floor(Z * 6), Math.floor(h * 8)) < 0.18 ? CHURCHL : FPINK;
      }
      if (h >= 2.95) { // balcony: cream balusters with oval openings on a rail
        if (h >= 4.0 || h < 3.1) return STONEL;
        const f = ((Z * 1.8) % 1) - 0.5, e = (f / 0.32) ** 2 + ((h - 3.55) / 0.38) ** 2;
        return e < 1 ? STONE : CHURCHL;
      }
      if (h >= 2.7) return STONE; // soffit
      if (Z < 9.9) { // white panel and dark skirting
        if (h < 1.15) return WOOD;
        if (Z > 6.55 && Z < 8.4 && band(h, 1.76, 2.29)) return textBit(BOL, ((Z - 6.55) / 1.85) * textW(BOL), ((2.29 - h) / 0.53) * 5) ? VOID : TILEW;
        if (Z > 6.55 && Z < 9.5 && band(h, 1.47, 1.69)) return textBit(SE, ((Z - 6.55) / 2.95) * textW(SE), ((1.69 - h) / 0.22) * 5) ? VOID : TILEW;
        if (Z > 9.0 && Z < 9.75 && band(h, 1.85, 2.1)) return textBit('120', ((Z - 9.0) / 0.75) * textW('120'), ((2.1 - h) / 0.25) * 5) ? VOID : TILEW;
        if (Z > 8.4 && Z < 9.0 && band(h, 1.47, 1.76) && (h - 1.47) / 0.29 < (Z - 8.4) / 0.6) return VOID; // the arrow tip under the lettering
        return TILEW;
      }
      if (Z < 13.1) { // the cake shop: yellow sign with red lettering over the open front
        if (band(h, 1.94, 2.65)) {
          if (Z > 10.3 && Z < 12.7 && band(h, 2.06, 2.5)) return textBit(BOL, ((Z - 10.3) / 2.4) * textW(BOL), ((2.5 - h) / 0.44) * 5) ? CRED : CYELL;
          return h < 2.0 ? WOOD : CYELL;
        }
        return h < 1.94 && Z > 10.05 && Z < 12.95 ? shop : TILEW;
      }
      if (Z < 13.6) return FPINK;
      return h < 1.0 ? WOOD : FPINK;
    },
  };
}

/** A plain house front: skirting, wall, platibanda, a door and windows at the given depths. */
function house(z0: number, z1: number, h: number, wall: number, skirt: number, doors: [number, number][], wins: [number, number][]): Facade {
  const ws = wins.map(() => open('win'));
  return {
    X: XBL, z0, z1, h, end: () => wall,
    paint: (_s, hh, Z) => {
      if (hh > h - 0.3) return TILEW;
      for (const [a, b] of doors) if (Z > a && Z < b && hh < 2.2) return Z < a + 0.08 || Z > b - 0.08 || hh > 2.12 ? TILEW : WOOD;
      for (let i = 0; i < wins.length; i++) { const [a, b] = wins[i]; if (Z > a && Z < b && band(hh, 1.1, 2.2)) return Z < a + 0.1 || Z > b - 0.1 || hh < 1.18 || hh > 2.12 ? TILEW : ws[i]; }
      return hh < 0.9 ? skirt : wall;
    },
  };
}

function leftSide(): Facade[] {
  return [
    bolosHouse(),
    house(14.5, 20.6, 3.8, FPINK, CRED, [[18.4, 19.6]], [[15.4, 17.2]]),
    { // green ground floor with a white garage door under a white upper floor
      X: XBL, z0: 20.6, z1: 33, h: 5.5, end: () => TILEW,
      paint: (_s, h, Z) => (h > 5.2 ? STONEL : h > 3 ? (Z > 24 && Z < 27 && band(h, 3.6, 4.6) ? BNEAR : TILEW) : Z > 27 && Z < 30.5 && h < 2.4 ? (Math.floor(h * 9) % 2 ? STONEL : TILEW) : FGREEN),
    },
    { X: XBL, z0: 33, z1: 45, h: 2.4, end: () => TILEW, paint: (_s, h, Z) => (Z > 38 && Z < 40.5 && h < 2.1 ? STEEL : h > 2.2 ? STONEL : TILEW) },
    house(45, 56, 3.6, CBEIGE, STONE, [[47, 48.5]], [[50, 53]]),
    house(56, 66, 4.1, TILEW, FPINK, [[63, 64.5]], [[57.5, 60.5]]),
    { // the red building down the street, windows in rows
      X: XBL, z0: 66, z1: 100, h: 8, end: () => CRED,
      paint: (_s, h, Z) => (h > 7.7 ? STONE : band(h % 2.8, 1.2, 2.2) && Z % 4 < 2.2 ? BNEAR : CRED),
    },
    house(100, 140, 4.2, CBEIGE, STONE, [], []),
  ];
}

// ---------- right side ----------
/** The modern block: a glass curtain wall in panes over a concrete band, a black-marble front, a shop
    under a roll-up door box, a dark glass front and a grey bay, a white pilaster at the near edge. */
function glassBlock(): Facade {
  const panes: number[] = [];
  for (let i = 0; i < 36; i++) panes.push(open('win', FBLUE));
  const shop = open('shop');
  return {
    X: XBR, z0: 9.6, z1: 37.5, h: 8.2,
    end: () => STONE,
    paint: (_s, h, Z) => {
      if (Z < 11.2) return Z < 10.9 ? STONEL : STONE; // white pilaster at the near edge
      if (h > 8.0) return STONEL;
      if (h >= 4.3) { // glass curtain: mullions every 1.6 m, a transom at 6.2 m
        const m = (Z - 11.2) % 1.6;
        if (m < 0.1 || Math.abs(h - 6.2) < 0.08) return BMID;
        const k = Math.floor((Z - 11.2) / 1.6) * 2 + (h > 6.2 ? 1 : 0);
        return panes[k % panes.length];
      }
      if (h >= 3.6) return h > 4.22 ? STONE : STONEL; // concrete band
      if (h < 0.15) return STONE;
      if (Z < 15.2) return grain(Math.floor(Z * 14), Math.floor(h * 14)) < 0.12 ? BMID : VOID; // black marble with veins
      if (Z < 15.8 || (Z > 23 && Z < 24)) return TILEW;
      if (Z < 23) return h > 2.7 ? STEEL : shop;
      if (Z < 30) return Math.abs(((Z - 24) % 2) - 1) < 0.05 ? STEEL : h > 2.8 ? BNEAR : WDIM;
      return STONE;
    },
  };
}

function rightSide(): Facade[] {
  const shop = open('shop');
  const w = [open('win'), open('win'), open('win'), open('win'), open('win'), open('win')];
  return [
    glassBlock(),
    { // taller grey building, green shop on the ground floor with its green sign
      X: XBR, z0: 37.5, z1: 62, h: 9, end: () => BMID,
      paint: (_s, h, Z) => {
        if (h > 8.7) return STONE;
        if (h < 3.2) { if (Z < 46) return band(h, 2.5, 3.1) ? CGREEN : h < 2.4 && Z > 38.5 && Z < 45 ? shop : FGREEN; return h < 2.3 && Z > 49 && Z < 52 ? WOOD : STONEL; }
        if (band(h % 2.9, 1.0, 2.1)) { const i = Math.floor((Z - 37.5) / 4); if ((Z - 37.5) % 4 < 2.4) return w[(i + Math.floor(h / 2.9)) % w.length]; }
        return BMID;
      },
    },
    house2(62, 75, 4.2, TILEW), house2(75, 90, 5, CBEIGE),
    { X: XBR, z0: 90, z1: 130, h: 7, end: () => CRED, paint: (_s, h, Z) => (h > 6.7 ? STONE : band(h % 2.6, 1.1, 2) && Z % 5 < 2.5 ? BNEAR : CRED) },
  ];
}
function house2(z0: number, z1: number, h: number, wall: number): Facade {
  return { X: XBR, z0, z1, h, end: () => wall, paint: (_s, hh, Z) => (hh > h - 0.3 ? STONEL : hh < 2.2 && (Z - z0) % 6 > 4.5 ? WOOD : hh < 0.8 ? STONE : wall) };
}

// ---------- the far end, poles, wires ----------
function buildFar() {
  // low skyline beyond the end of the street
  for (let x = 200; x < 300;) { const w = 6 + ((wr() * 10) | 0), top = 76 + ((wr() * 9) | 0); L(far, x, top, w, 90 - top, BFAR); x += w; }
  paintFront(mid, V, XBL, XBR, 150, 4.5, (u, h) => (h > 4.2 ? STONEL : h < 2 && Math.abs((u * 1.3) % 3) < 0.9 ? WOOD : u < -1 ? CBEIGE : u < 3 ? TILEW : FPINK));
}

function pole(X: number, z: number, h: number) {
  const x = Math.round(projX(V, X, z)), yb = Math.round(projY(V, 0, z)), yt = Math.round(projY(V, h, z)), w = Math.max(1, Math.round((V.f / z) * 0.25));
  L(mid, x, yt, w, yb - yt, STONEL); if (w > 2) L(mid, x + w - 1, yt, 1, yb - yt, STONE);
  const arm = Math.round((V.f / z) * 0.8); L(mid, x - arm, yt + 2, 2 * arm + w, 1, STONE);
  return { x: x + (w >> 1), y: yt + 2 };
}

const WIRES: [number, number, number, number, number][] = [];
function buildPoles() {
  const a = pole(LAMPS[0].X, LAMPS[0].z, 5.9), b = pole(6.9, 13.4, 10), c = pole(LAMPS[1].X, LAMPS[1].z, 5.9), d = pole(6.9, 45, 8.5), e = pole(-4.1, 70, 5.8);
  for (const l of LAMPS) lampPostP(mid, V, l);
  WIRES.push([a.x, a.y, b.x, b.y, 6], [a.x, a.y + 2, b.x, b.y + 3, 8], [a.x, a.y, c.x, c.y, 2], [c.x, c.y, e.x, e.y, 1], [b.x, b.y, d.x, d.y, 3], [b.x, b.y + 3, d.x, d.y + 1, 4], [c.x, c.y, d.x, d.y, 2]);
  // wires off the top of the frame toward the near poles (out of view behind the camera)
  WIRES.push([a.x, a.y, 0, -20, 4], [b.x, b.y, 470, -60, 2], [b.x, b.y + 3, 300, -70, 3]);
  for (const [x0, y0, x1, y1, s] of WIRES) wire(mid, x0, y0, x1, y1, s);
  // yellow sign post at the near right corner
  const px = Math.round(projX(V, 8.1, 10.9)), py0 = Math.round(projY(V, 0, 10.9)), py1 = Math.round(projY(V, 3, 10.9));
  L(mid, px, py1, 3, py0 - py1, CYELL); L(mid, px - 2, py1 - 6, 7, 6, VOID);
}

function groundAt(X: number, Z: number): number {
  if (X < XBL || X > XBR) return STONE;
  if (X < XKL) return (Z % 1.2 < 0.07 || (X - XBL) % 1.2 < 0.06) ? STONE : STONEL; // left sidewalk
  if (X < XKL + 0.15) return TILEW; // kerb
  if (X > XKR) return X < XKR + 0.15 ? TILEW : Z % 1.2 < 0.07 ? STONE : STONEL; // kerb and right sidewalk
  if (Z > ZEB.z0 && Z < ZEB.z1 && X > XKL + 0.4 && X < XKR - 0.4) return Math.floor((X - XKL - 0.4) / 0.55) % 2 ? ASPH : TILEW; // zebra
  if (Math.abs(X - XC) < 0.08 && (Z % 4.5 < 3 || Z < ZEB.z1 + 6)) return CYELL; // centre line
  return wr() < 0.07 ? STONE : ASPH;
}

function buildGround() {
  paintGround(street.base, Y0, V, (X, Z) => groundAt(X, Z));
  for (let p = 0; p < 6; p++) { // puddle spots, in metres on the roadway
    const cx = XKL + 1 + wr() * (XKR - XKL - 2), cz = 7 + wr() * 30, rx = 0.8 + wr() * 1.4, rz = 1.5 + wr() * 3;
    for (let y = Y0; y < 180; y++) {
      const Z = (V.f * V.camH) / (y + 0.5 - V.vy);
      for (let x = 0; x < WW; x++) { const X = ((x + 0.5 - V.vx) * Z) / V.f, a = (X - cx) / rx, b = (Z - cz) / rz; if (a * a + b * b < 1) street.pud[(y - Y0) * WW + x] = 1; }
    }
  }
}

// ---------- actors ----------
const CARS: PCar[] = makeCars(7);
const WALKERS: Walker[] = makeWalkers(8);
const ROAD: DepthRoad = { zNear: 3, zFar: 140, gap: 1.6, stopGap: 1.2, crossing: { z0: ZEB.z0, z1: ZEB.z1, occupied: false } };
const laneX = (dir: 1 | -1) => (dir > 0 ? 3.2 : -1.2);
const WALK: WalkCfg = { walks: [{ X0: XBL + 0.2, X1: XKL - 0.2 }, { X0: XKR + 0.25, X1: XBR - 0.15 }], zNear: 3.5, zFar: 70, zebra: ZEB };
/** Motorcycles parked nose-in at the right kerb, and two cars further down (as in the photo). */
const PARKED = [
  ...[19.5, 21.5, 23.6, 26, 29.5].map((z, i) => ({ z, dir: 1, kind: 'moto' as const, body: [CRED, VOID, CRED, VOID, CRED][i], rider: 0, helmet: 0, X: 5.7 })),
  { z: 57, dir: 1, kind: 'car' as const, body: STONEL, rider: 0, helmet: 0, X: 5.4 },
  { z: 100, dir: 1, kind: 'car' as const, body: CBLUE, rider: 0, helmet: 0, X: 5.2 },
];
let conflicts = 0, crossings = 0, prevCross = 0;

function update(dt: number) {
  updateAnimals(dt);
  ROAD.crossing!.occupied = zebraBusyP(WALKERS);
  updateCarsP(CARS, dt, ROAD, laneX);
  updateWalkers(WALKERS, dt, WALK, () => carsOnCrossing(CARS, ROAD), 1);
  const on = onZebra(WALKERS, ZEB);
  if (on && carsOnCrossing(CARS, { ...ROAD, stopGap: 0 })) conflicts++;
  if (on < prevCross) crossings++;
  prevCross = on;
}

function shopsOpen() { const h = S.cal.hour; return S.cal.weekday !== 0 && hourIn(h, 7.5, 19); }

const FOG = [{ y: HORIZON + 2, h: 7, sp: 0.5 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  drawStreet(street);
  blitLayer(mid); // facades and poles reach below the horizon: put them back over the street pass
  drawOpeningsP(opens, shopsOpen());
  if (isNight()) for (let x = 230; x < 270; x += 5) put(x, Math.round(projY(V, 2.5, 150)), (x / 5) % 3 ? WWARM : LIGHT); // lit windows at the far end
  if (tree) drawTree(tree);
  drawFarPrecip();
  for (const l of LAMPS) lampLightP(V, l);
  if (S.festa || S.saoJoao) { const [x0, y0, x1, y1] = WIRES[0]; bandeirolas(x0, y0 + 4, x1, y1 + 4, 10, 2); }
  drawAnimalsPerched();
  drawByDepth([
    ...PARKED.map((p) => ({ z: p.z, draw: () => drawCarP(V, p, true) })),
    ...CARS.filter((c) => c.on).map((c) => ({ z: c.z, draw: () => drawCarP(V, c) })),
    ...WALKERS.filter((w) => w.on).map((w) => ({ z: w.z, draw: () => drawWalker(V, w) })),
  ]);
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const ruaFaustino: Scene = {
  id: 'rua-faustino',
  name: 'Rua Faustino Porto',
  build() {
    if (!built) {
      paintFacades(mid, V, [...leftSide(), ...rightSide()], opens);
      buildFar(); buildPoles(); buildGround();
      const tz = 135, k = V.f / tz;
      tree = makeTree(Math.round(projX(V, -1.5, tz)), Math.round(projY(V, 0, tz)), (k * 6.5) / 58, wr);
      built = true;
    }
    setLanes([{ y: 400 }], { bikes: false }); // clears the side-on pedestrians: this scene has its own, on the sidewalks
    setCarLanes(400, 400, 'br'); // clears the side-on traffic: this scene runs its own, on the roadway only
    for (const c of CARS) c.on = false;
    for (const w of WALKERS) w.on = false;
    setupAnimals({ ground: [], dogs: 0, wires: WIRES.slice(0, 2).map(([a, b, c, d, s]) => wireCurve(a, b, c, d, s)), lamps: LAMPS.map((l) => ({ x: projX(V, l.X + l.arm, l.z), y: projY(V, l.h, l.z) })) });
    configure({ roofs: [], tips: [], lamps: LAMPS.map((l) => ({ x: projX(V, l.X + l.arm, l.z), y: projY(V, l.h, l.z) })), ground0: HORIZON + 14, horizon: HORIZON });
    for (let i = 0; i < 300; i++) update(1 / 30);
    conflicts = 0; crossings = 0;
  },
  update,
  render,
  debug() { return `active  walkers x${WALKERS.filter((w) => w.on).length}  road x${CARS.filter((c) => c.on).length}  faixa x${onZebra(WALKERS, ZEB)} travessias ${crossings} conflitos ${conflicts}`; },
  tap(x, y) { return tapWalker(V, WALKERS, x, y) ?? tapCarP(V, CARS, x, y); },
};
