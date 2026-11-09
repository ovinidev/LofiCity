/* RUA MANOEL RODRIGUES DE OLIVEIRA (Esperança, PB), drawn from a Google Street View capture (Feb 2025)
   supplied by the owner, used as reference only; it is not in the repo. Looking down the commercial
   street from the middle of the road toward the Matriz, whose yellow tower closes the view: on the
   left the bright pink corner building with its rounded canopy and a dark roll-up door, a side street
   with a yellow-painted kerb curving round both corners, a car parked in it and a concrete pole with a
   street light at the corner, then the long grey building with red pilasters, red trim and roll-up
   doors; on the right the blue "TL" sign, the green-and-white pharmacy-like shop with its orange
   canopy and shelves of goods behind the glass, a concrete pole with a placard, a row of motorcycles
   parked nose-in at the kerb (red top boxes), a man in a yellow-and-black vest by the shop, and red
   shops further down. A zebra crosses the street in the distance under a hanging traffic light;
   wires everywhere overhead. Lettering that the photo does not show legibly is left blank.

   Assumptions (not established by the photo): the street is one-way, every vehicle driving away from
   the viewer toward the Matriz, as on the same road beside the church in praca-matriz.ts; the light
   runs a fixed-time plan (signal-rules.ts): vehicles stop at the line on red, and on yellow when they
   can, and people cross only in the pedestrian phase; shops keep commercial hours (Mon-Sat
   07:30-18:30) and the pharmacy-like shop 07:00-22:00 every day. Parked motorcycles and cars are
   static props, not traffic. */
import { L, Lp, type Layer, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  AMB, ASPH, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CHURCH, CHURCHD, CHURCHL, CNAVY, CORNG, CRED, CYELL, FORNG, FPINK, FWG, HAIR1, HALO,
  LEAFG, LEAFGD, LIGHT, MAGD, MANTO, SAKURA, SAKURAD, SIGR, SKIN3, STEEL, STONE, STONEL, TILEW, VOID, WCOOL, WDIM, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { setLanes } from '../actors/people';
import { setCarLanes } from '../actors/cars';
import { type DepthRoad, carsOnCrossing, toStopLine } from '../actors/persp-rules';
import { type SignalState, type SignalTiming, pedestrianMayStart, signalAt } from '../actors/signal-rules';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { bandeirolas, isNight, textBit, textW, wire, wireCurve } from './br-kit';
import {
  type Facade, type Opening, type PCar, type PLamp, type View, type Walker, type WalkCfg, OPEN, drawByDepth, drawCarP, drawOpeningsP,
  drawWalker, lampLightP, lampPostP, makeCars, makeWalkers, onZebra, paintFacades, paintFront, paintGround, projX, projY, scaleAt,
  tapCarP, tapWalker, updateCarsP, updateWalkers,
} from './persp-kit';
import type { Scene } from './types';

// Camera matched to the photo: vanishing point near the centre (the Matriz tower), the wide Street View
// lens (a short focal length), eye height 2.3 m.
const V: View = { vx: 240, vy: 36, f: 200, camH: 2.3 };
const HORIZON = V.vy, Y0 = V.vy + 1, SH = 180 - Y0;
// Lateral layout, metres: left building line and kerb, right kerb and building line.
const XBL = -9, XKL = -6.2, XKR = 4.4, XBR = 6.8;
// The side street on the left: its kerb lines (depths), the corner radius, and the buildings either side.
const SS0 = 15.8, SS1 = 23.4, R = 2, PINK_END = 13, GREY_START = 26.2;
const ZEB = { z0: 44, z1: 47.5, XL: XKL, XR: XKR };
/** The traffic light: a pole at the right kerb past the zebra, its arm over the road and the head hanging from it. */
const SIG = { X: 4.9, z: 49.5, h: 6.6, headX: 0.6, headH: 6.1 };
const wr = mulberry32(0x3a17e);
const far = newLayer(), mid = newLayer(), poleL = newLayer(), poleR = newLayer();
const street: Street = { y0: Y0, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const opens: Opening[] = [];
const LAMPS: PLamp[] = [{ X: -6.7, z: 14.6, h: 8.6, arm: 2.4 }, { X: 4.75, z: 32, h: 8.2, arm: -2.2 }, { X: -6.7, z: 62, h: 8.2, arm: 2.4 }];

const open = (kind: 'win' | 'shop', base = WDIM) => { opens.push({ kind, rank: wr(), px: [], base }); return OPEN + opens.length - 1; };
const grain = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return v - Math.floor(v); };
const band = (h: number, a: number, b: number) => h >= a && h < b;

// ---------- left side ----------
/** The bright pink corner building: arched upper windows, the canopy band, a dark roll-up door and a shop front. */
function pinkBuilding(): Facade {
  const shop = open('shop'), ws = [open('win'), open('win'), open('win'), open('win')];
  return {
    X: XBL, z0: 1, z1: PINK_END, h: 7.6,
    end: (h) => (h > 7.25 ? FPINK : band(h, 2.85, 3.55) ? MAGD : h < 0.35 ? MAGD : SAKURAD),
    paint: (_s, h, Z) => {
      if (h > 7.25) return h > 7.45 ? SAKURA : FPINK; // cornice
      if (h > 3.55) { // upper floor: arched windows between relief pilasters
        const loc = (Z - 1.4) % 3.2, i = Math.floor((Z - 1.4) / 3.2);
        if (loc < 0.14) return MAGD;
        const top = 5.7 + 0.55 * Math.sqrt(Math.max(0, 1 - ((loc - 1.5) / 0.75) ** 2));
        if (loc > 0.75 && loc < 2.25 && h > 4.3 && h < top) return loc < 0.87 || loc > 2.13 || h < 4.4 || h > top - 0.1 ? FPINK : ws[i % 4];
        return SAKURAD;
      }
      if (h > 2.85) return MAGD; // behind the canopy
      if (Z > 2.5 && Z < 7 && h < 2.75) return Math.floor(h * 9) % 2 ? CNAVY : VOID; // dark roll-up door
      if (Z > 7.8 && Z < 12.4 && h > 0.4 && h < 2.6) return Z < 7.9 || Z > 12.3 ? FPINK : shop;
      return h < 0.35 ? MAGD : SAKURAD;
    },
  };
}

/** The long grey building with red pilasters, red trim, a dark window band and roll-up doors. */
function greyBuilding(): Facade {
  const shops = Array.from({ length: 5 }, () => open('shop')), ws = Array.from({ length: 5 }, () => open('win'));
  return {
    X: XBL, z0: GREY_START, z1: 48, h: 8.3,
    end: (h) => (h > 8 || band(h, 3.1, 3.5) ? CRED : h < 0.3 ? STONE : STONEL),
    paint: (_s, h, Z) => {
      if (h > 8) return CRED;
      const loc = (Z - GREY_START) % 3.8, i = Math.floor((Z - GREY_START) / 3.8);
      if (loc < 0.45) return CRED; // red pilasters
      if (band(h, 3.1, 3.5)) return CRED;
      if (h > 3.5) {
        if (Z > 38 && band(h, 4.2, 7.2)) return h < 4.32 || h > 7.08 ? CRED : TILEW; // a blank sign panel on the far bays
        return band(h, 4.6, 6.8) && loc > 0.8 && loc < 3.4 ? ws[i % 5] : STONEL;
      }
      if (h < 2.85 && loc > 0.6 && loc < 3.6) return shops[i % 5];
      return STONE;
    },
  };
}

function leftFar(): Facade[] {
  const s = [open('shop'), open('shop'), open('shop')];
  return [
    { X: XBL, z0: 48, z1: 58, h: 5.2, end: () => TILEW,
      paint: (_s, h, Z) => (h > 4.9 ? STONEL : band(h, 3, 3.8) ? (Z > 49 && Z < 57 ? CRED : TILEW) : h < 2.8 && Z > 49 && Z < 57 ? s[0] : TILEW) },
    { X: XBL, z0: 58, z1: 74, h: 6, end: () => CRED,
      paint: (_s, h, Z) => (h > 5.7 ? STONEL : band(h, 2.8, 3.3) ? TILEW : h < 2.7 && (Z - 58) % 6 < 4.5 ? s[1] : CRED) },
    { X: XBL, z0: 74, z1: 100, h: 4.6, end: () => CBEIGE, paint: (_s, h, Z) => (h > 4.3 ? STONEL : h < 2.5 && (Z - 74) % 7 < 4 ? s[2] : CBEIGE) },
    { X: XBL, z0: 100, z1: 135, h: 5, end: () => FPINK, paint: (_s, h) => (h > 4.7 ? STONEL : h < 2.3 ? STONE : FPINK) },
  ];
}

// ---------- right side ----------
const TL = 'TL';
/** The building with the bright blue "TL" sign over a white ground floor. */
function tlBuilding(): Facade {
  const shop = open('shop'), win = open('win');
  return {
    X: XBR, z0: 1.5, z1: 11.5, h: 8.4,
    paint: (_s, h, Z) => {
      if (h > 8.1) return STONEL;
      if (h > 5.6) return Z > 3 && Z < 9 && band(h, 6.3, 7.5) ? win : BMID;
      if (h > 3.45) { // the sign: white letters on blue (on this side, reading left to right runs toward the viewer)
        if (Z > 6 && Z < 10.6 && band(h, 3.8, 5.3)) return textBit(TL, ((10.6 - Z) / 4.6) * textW(TL), ((5.3 - h) / 1.5) * 5) ? TILEW : MANTO;
        return MANTO;
      }
      if (h > 3.2) return CNAVY; // the strip under the sign (its small lettering is not legible)
      if (Z > 10.2) return LEAFG;
      if (Z > 3 && Z < 9.8 && h < 2.9) return shop;
      return h < 0.3 ? STONE : TILEW;
    },
  };
}

/** The green-and-white corner shop with the orange canopy and a glass front (goods drawn per frame). */
let glass: Opening;
function pharmacy(): Facade {
  const g = open('shop'); glass = opens[g - OPEN];
  return {
    X: XBR, z0: 11.5, z1: 25, h: 7.2,
    end: () => LEAFG,
    paint: (_s, h, Z) => {
      if (Z < 12.5) return Z > 12.35 ? LEAFGD : LEAFG; // green pilaster at the corner
      if (h > 6.5) return LEAFG;
      if (h > 6.4) return LEAFGD;
      if (h > 4) { // white panel: a red logo mark; the red lettering is not legible, so left blank
        if (Z > 13 && Z < 14.6 && band(h, 4.6, 6)) return Math.abs(Z - 13.8 - (h - 5.3)) < 0.14 ? TILEW : CRED;
        return TILEW;
      }
      if (h > 3.4) return CORNG;
      if (Z > 12.8 && Z < 24.3 && h > 0.35 && h < 3.3) return (Z - 12.8) % 2.3 < 0.08 ? STEEL : g;
      return h < 0.35 ? STONE : TILEW;
    },
  };
}

function rightFar(): Facade[] {
  const s = [open('shop'), open('shop'), open('shop'), open('shop')], w = [open('win'), open('win'), open('win')];
  return [
    { X: XBR, z0: 25, z1: 31, h: 4.6, end: () => TILEW,
      paint: (_s, h, Z) => (h > 4.3 ? STONEL : h < 2.9 && Z > 25.9 && Z < 30.2 ? s[0] : h < 0.3 ? STONE : TILEW) },
    { // red shops with a dark sign board (its lettering is not legible: left blank)
      X: XBR, z0: 31, z1: 60, h: 6.2, end: () => CRED,
      paint: (_s, h, Z) => {
        if (h > 5.9) return STONEL;
        if (band(h, 3.3, 4.6) && Z > 32 && Z < 46) return h < 3.42 || h > 4.48 ? TILEW : BNEAR;
        if (h > 4.8 && h < 5.6 && (Z - 31) % 5 < 2.4) return w[Math.floor(Z / 5) % 3];
        if (band(h, 2.8, 3.2)) return TILEW; // white awning edge
        if (h < 2.8 && (Z - 31) % 7 < 5) return s[1 + (Math.floor((Z - 31) / 7) % 2)];
        return CRED;
      },
    },
    { X: XBR, z0: 60, z1: 74, h: 5, end: () => TILEW, paint: (_s, h, Z) => (h > 4.7 ? STONEL : band(h, 2.7, 3.2) ? CBLUE : h < 2.6 && Z > 61 && Z < 72 ? s[3] : TILEW) },
    { X: XBR, z0: 74, z1: 95, h: 5.5, end: () => CRED, paint: (_s, h) => (h > 5.2 ? STONEL : h < 2.4 ? STONE : CRED) },
    { X: XBR, z0: 95, z1: 135, h: 4.4, end: () => CBEIGE, paint: (_s, h, Z) => (h > 4.1 ? STONEL : h < 2.2 && Z % 8 < 3 ? WOOD : CBEIGE) },
  ];
}

/** The rounded canopies (pink and orange) stand out from their walls: painted after the facades. */
const canopies = (): Facade[] => [
  { X: XBL + 0.85, z0: 1, z1: PINK_END + 0.4, h: 3.55, paint: (_s, h) => (h < 2.98 ? 255 : h < 3.07 ? SAKURA : h < 3.45 ? SAKURAD : FPINK) },
  { X: XBR - 0.75, z0: 12.5, z1: 24.9, h: 4.05, paint: (_s, h) => (h < 3.4 ? 255 : h < 3.48 ? CHURCHD : h < 3.93 ? CORNG : FORNG) },
];

/** The car parked in the side street, seen side-on across the gap. */
function sideStreetCar() {
  paintFront(mid, V, -14.6, -10.4, 19.5, 1.5, (u, h) => {
    const s = u + 14.6; // metres from its left end
    if ([0.8, 3.4].some((c) => Math.hypot(s - c, h - 0.32) < 0.32)) return VOID;
    if (h < 0.3) return 255;
    if (h < 0.85) return h < 0.4 ? BMID : STEEL;
    if (s > 0.9 && s < 3.4 && h < 1.42) return h > 1.32 || Math.abs(s - 2.2) < 0.06 ? STEEL : WCOOL;
    return 255;
  });
}

// ---------- the far end and the Matriz tower ----------
function buildFar() {
  for (let x = 150; x < 340;) { const w = 5 + ((wr() * 9) | 0), top = 28 + ((wr() * 5) | 0); L(far, x, top, w, HORIZON + 2 - top, BFAR); x += w; }
  // the Matriz's tower on the horizon: shaft, cornices, belfry, spire and cross
  const Z = 165, X0 = -3.2, X1 = 1.2, H = 24;
  const x0 = Math.round(projX(V, X0, Z)), x1 = Math.round(projX(V, X1, Z)), k = V.f / Z;
  for (let x = x0; x < x1; x++) for (let y = Math.round(projY(V, H, Z)); y < HORIZON + 2; y++) {
    const h = V.camH - ((y + 0.5 - V.vy) * Z) / V.f;
    const c = band(h, 15, 16) || band(h, 22.2, 23.2) ? CHURCHL : band(h, 17.5, 21) && x > x0 && x < x1 - 1 ? VOID : x === x1 - 1 ? CHURCHD : CHURCH;
    Lp(far, x, y, c);
  }
  const cx = (x0 + x1 - 1) / 2, ys = Math.round(projY(V, H, Z)), sp = Math.round(6 * k);
  for (let j = 0; j < sp; j++) { const hw = ((x1 - x0) / 2) * (1 - j / sp); L(far, Math.round(cx - hw), ys - j - 1, Math.max(1, Math.round(2 * hw)), 1, j % 3 ? CHURCH : CHURCHL); }
  L(far, Math.round(cx), ys - sp - 4, 1, 4, STONEL); L(far, Math.round(cx) - 1, ys - sp - 3, 3, 1, STONEL);
  // the buildings closing the street
  paintFront(mid, V, XBL, XBR, 135, 5, (u, h) => (h > 4.7 ? STONEL : h < 2.2 && Math.abs((u * 1.2) % 3) < 1 ? WOOD : u < -2 ? TILEW : u < 2.5 ? CRED : CBEIGE));
}

// ---------- poles, wires, signal ----------
function pole(ly: Layer, X: number, z: number, h: number) {
  const x = Math.round(projX(V, X, z)), yb = Math.round(projY(V, 0, z)), yt = Math.round(projY(V, h, z)), w = Math.max(1, Math.round((V.f / z) * 0.25));
  L(ly, x, yt, w, yb - yt, STONEL); if (w > 2) L(ly, x + w - 1, yt, 1, yb - yt, STONE);
  const arm = Math.round((V.f / z) * 0.8); L(ly, x - arm, yt + 2, 2 * arm + w, 1, STONE);
  return { x: x + (w >> 1), y: yt + 2 };
}

const WIRES: [number, number, number, number, number][] = [];
function buildPoles() {
  const a = pole(poleL, LAMPS[0].X, LAMPS[0].z, 9.6), b = pole(mid, -6.7, 38, 8.8), c = pole(mid, LAMPS[2].X, LAMPS[2].z, 8.6), e = pole(mid, -6.7, 90, 8.2);
  const p = pole(poleR, 4.75, 10, 9.8), q = pole(mid, LAMPS[1].X, LAMPS[1].z, 8.8), r = pole(mid, 4.8, 66, 8.4), s = pole(mid, 4.8, 95, 8.2);
  lampPostP(poleL, V, LAMPS[0]);
  for (const l of LAMPS.slice(1)) lampPostP(mid, V, l);
  // a blank placard on the near right pole
  paintFront(poleR, V, 4.35, 5.25, 9.95, 3.1, (_u, h) => (h < 2.3 ? 255 : h < 2.36 || h > 3.04 ? STEEL : TILEW));
  WIRES.push([a.x, a.y, p.x, p.y, 9], [a.x, a.y + 3, p.x, p.y + 3, 12], [a.x, a.y, b.x, b.y, 3], [b.x, b.y, c.x, c.y, 2], [c.x, c.y, e.x, e.y, 1],
    [p.x, p.y, q.x, q.y, 3], [q.x, q.y, r.x, r.y, 2], [r.x, r.y, s.x, s.y, 1], [b.x, b.y, q.x, q.y, 4], [b.x, b.y + 2, q.x, q.y + 2, 5], [c.x, c.y, r.x, r.y, 2],
    [a.x, a.y + 2, q.x, q.y, 6], [p.x, p.y + 2, b.x, b.y + 2, 5]);
  // wires off the frame toward the poles behind the camera
  WIRES.push([a.x, a.y, 0, -60, 4], [a.x, a.y + 3, -20, -10, 3], [p.x, p.y, 480, -90, 3], [p.x, p.y + 3, 500, -40, 4], [p.x, p.y + 1, 330, -95, 6], [p.x, p.y, 120, -95, 10]);
  for (const [x0, y0, x1, y1, sg] of WIRES) wire(mid, x0, y0, x1, y1, sg);
  // the signal pole and its arm over the road
  const sx0 = Math.round(projX(V, SIG.X, SIG.z)), syb = Math.round(projY(V, 0, SIG.z)), syt = Math.round(projY(V, SIG.h, SIG.z));
  L(mid, sx0, syt, 1, syb - syt, STEEL);
  const ax = Math.round(projX(V, SIG.headX - 0.3, SIG.z));
  L(mid, ax, syt, sx0 - ax, 1, STEEL);
}

/** One lamp of the signal head; a lit lamp glows a little at night. */
function sigLamp(x: number, y: number, on: boolean, c: number) {
  rect(x, y, 2, 2, on ? c : BNEAR);
  if (on && isNight()) { put(x - 1, y, c); put(x + 2, y + 1, c); put(x, y - 1, HALO); put(x + 1, y + 2, HALO); }
}
/** The head hanging over the road, facing the traffic (which all comes from the viewer's side). */
function drawSignal(s: SignalState) {
  const x = Math.round(projX(V, SIG.headX, SIG.z)) - 2, y = Math.round(projY(V, SIG.headH, SIG.z)), ya = Math.round(projY(V, SIG.h, SIG.z));
  rect(x + 1, ya, 1, y - ya, STEEL);
  rect(x - 1, y, 6, 10, VOID); rect(x - 1, y, 6, 1, BMID);
  sigLamp(x + 1, y + 1, s.phase === 'red', SIGR); sigLamp(x + 1, y + 4, s.phase === 'yellow', AMB); sigLamp(x + 1, y + 7, s.phase === 'green', FWG);
}

// ---------- ground ----------
/** Signed distance (m) into the left sidewalk blocks either side of the side street; negative on a roadway. */
function kerbD(X: number, Z: number): number {
  if (Z < SS0) return X > XKL - R && Z > SS0 - R ? R - Math.hypot(X - (XKL - R), Z - (SS0 - R)) : Math.min(XKL - X, SS0 - Z);
  if (Z > SS1) return X > XKL - R && Z < SS1 + R ? R - Math.hypot(X - (XKL - R), Z - (SS1 + R)) : Math.min(XKL - X, Z - SS1);
  return -1;
}

function groundAt(X: number, Z: number): number {
  if (X > XBR) return STONE;
  if (X > XKR) return X < XKR + 0.18 ? TILEW : Z % 1.2 < 0.07 || (X - XKR) % 1.2 < 0.06 ? STONE : STONEL; // kerb and right sidewalk
  const d = kerbD(X, Z);
  if (d >= 0) return d < 0.18 ? CYELL : Z % 1.1 < 0.06 ? STONE : STONEL; // the yellow-painted kerb and left sidewalk
  if (Z > ZEB.z0 && Z < ZEB.z1 && X > XKL + 0.3 && X < XKR - 0.3) return Math.floor((X - XKL - 0.3) / 0.55) % 2 ? ASPH : TILEW; // zebra
  if (X > XKL && X < XKR && Math.abs(Z - (ZEB.z0 - 1.1)) < 0.12) return TILEW; // stop line
  return grain(Math.floor(X * 13), Math.floor(Z * 7)) < 0.07 ? STONE : ASPH;
}

function buildGround() {
  paintGround(street.base, Y0, V, (X, Z) => groundAt(X, Z));
  for (let p = 0; p < 6; p++) { // puddle spots, in metres on the roadway
    const cx = XKL + 1 + wr() * (XKR - XKL - 2), cz = 6 + wr() * 30, rx = 0.8 + wr() * 1.4, rz = 1.5 + wr() * 3;
    for (let y = Y0; y < 180; y++) {
      const Z = (V.f * V.camH) / (y + 0.5 - V.vy);
      for (let x = 0; x < WW; x++) { const X = ((x + 0.5 - V.vx) * Z) / V.f, a = (X - cx) / rx, b = (Z - cz) / rz; if (a * a + b * b < 1) street.pud[(y - Y0) * WW + x] = 1; }
    }
  }
}

/** Goods on the pharmacy shelves, per glass pixel: [x, y, day colour, night colour]. */
const goods: number[] = [];
function buildGoods() {
  const cols = [CRED, CYELL, LEAFG, TILEW, CBLUE, CORNG, FPINK, TILEW, CYELL];
  for (let i = 0; i < glass.px.length; i += 2) {
    const x = glass.px[i], y = glass.px[i + 1], Z = (V.f * XBR) / (x + 0.5 - V.vx), h = V.camH - ((y + 0.5 - V.vy) * Z) / V.f;
    const shelf = h % 0.42 < 0.07, item = grain(Math.floor(Z * 4.5), Math.floor(h / 0.42));
    const day = shelf ? STONEL : item < 0.12 ? BNEAR : cols[Math.floor(item * 97) % cols.length];
    goods.push(x, y, day, shelf ? LIGHT : item < 0.12 ? WWARM : day);
  }
}
function drawGoods(on: boolean) {
  if (!on) return; // closed: the roll-up door painted in the layer
  const n = isNight();
  for (let i = 0; i < goods.length; i += 4) put(goods[i], goods[i + 1], goods[i + (n ? 3 : 2)]);
}

// ---------- actors ----------
const CARS: PCar[] = makeCars(7);
const WALKERS: Walker[] = makeWalkers(8);
/** One-way: every vehicle drives away from the viewer, in one lane left of the parked motorcycles. */
const ONE_WAY = 1 as const;
const ROAD: DepthRoad = { zNear: 3, zFar: 140, gap: 1.6, stopGap: 1.2, crossing: { z0: ZEB.z0, z1: ZEB.z1, occupied: false, signal: 'green' } };
const laneX = () => 0.3;
const WALK: WalkCfg = {
  walks: [
    { X0: XBL + 0.15, X1: XKL - 0.2, z0: SS1 + 0.6 }, // left, past the side street (first: where people crossing from the right arrive)
    { X0: XKR + 0.3, X1: XBR - 1.15 }, // right, clear of the man by the shop
    { X0: XBL + 0.15, X1: XKL - 0.2, z1: SS0 - 0.6 }, // left, in front of the pink building: they turn into the side street
  ],
  zNear: 3.5, zFar: 75, zebra: ZEB,
};
/** Seconds a pedestrian needs to cross (about 15 m from one sidewalk to the other at the slowest
    walking pace), for the pedestrian phase. */
const CROSS_TIME = 14;
/** The fixed-time plan, with a red long enough for that crossing (signal-rules.ts SIGNAL otherwise). */
const SIG_T: SignalTiming = { green: 24, yellow: 4, red: 26, clear: 2 };
let sigT = 0;
const sig = (): SignalState => signalAt(sigT, SIG_T);

/** The motorcycles parked nose-in at the right kerb, angled toward it (static props). */
interface Moto { X: number; z: number; body: number; box: boolean }
const MOTO_COLS = [VOID, CRED, CBLUE, VOID, CRED, STONEL, VOID, CRED, CBLUE, BNEAR, CRED, VOID];
const MOTOS: Moto[] = Array.from({ length: 22 }, (_, i) => ({ X: 3.55, z: 5.8 + i * 1.15 + (i % 3) * 0.08, body: MOTO_COLS[i % MOTO_COLS.length], box: i % 3 !== 2 && i % 5 !== 0 }));
/** A filled disc of radius r metres at (X, h, Z). */
function blob(X: number, h: number, Z: number, r: number, c: number) {
  const k = V.f / Z, x = projX(V, X, Z), y = projY(V, h, Z), rr = Math.max(0.5, r * k);
  if (rr < 1.2) { rect(Math.round(x - rr), Math.round(y - rr), Math.max(1, Math.round(2 * rr)), Math.max(1, Math.round(2 * rr)), c); return; }
  for (let j = Math.ceil(-rr); j <= rr; j++) { const w = Math.sqrt(rr * rr - j * j); rect(Math.round(x - w), Math.round(y + j), Math.max(1, Math.round(2 * w)), 1, c); }
}
function seg(X0: number, h0: number, Z0: number, X1: number, h1: number, Z1: number, r: number, c: number) {
  const n = Math.max(2, Math.ceil(Math.hypot(projX(V, X1, Z1) - projX(V, X0, Z0), projY(V, h1, Z1) - projY(V, h0, Z0))));
  for (let i = 0; i <= n; i++) { const t = i / n; blob(X0 + (X1 - X0) * t, h0 + (h1 - h0) * t, Z0 + (Z1 - Z0) * t, r, c); }
}
function drawMoto(m: Moto) {
  const rX = m.X - 0.45, rZ = m.z - 0.5, fX = m.X + 0.5, fZ = m.z + 0.45; // rear wheel by the road, front wheel at the kerb
  blob(rX, 0.3, rZ, 0.3, VOID); blob(fX, 0.3, fZ, 0.28, VOID);
  blob(rX, 0.3, rZ, 0.1, STEEL); blob(fX, 0.3, fZ, 0.09, STEEL);
  seg(rX, 0.55, rZ, fX, 0.6, fZ, 0.07, STEEL); // frame
  seg(rX + 0.1, 0.8, rZ + 0.1, m.X + 0.15, 0.84, m.z + 0.15, 0.1, VOID); // seat
  seg(m.X + 0.1, 0.84, m.z + 0.1, fX - 0.15, 0.92, fZ - 0.15, 0.13, m.body); // tank
  seg(fX - 0.05, 1.1, fZ - 0.35, fX + 0.05, 1.1, fZ + 0.3, 0.035, STEEL); // handlebar
  if (m.box) seg(rX - 0.05, 1.04, rZ - 0.05, rX + 0.1, 1.04, rZ + 0.1, 0.19, CRED); // red top box
}
/** Two cars parked at the right kerb beyond the zebra (seen from behind). */
const PARKED = [
  { z: 56, dir: 1, kind: 'car' as const, body: STONEL, rider: 0, helmet: 0, X: 3.4 },
  { z: 70, dir: 1, kind: 'car' as const, body: CRED, rider: 0, helmet: 0, X: 3.5 },
];
/** The man in a yellow-and-black vest standing by the shop (during shop hours). */
const VEST: Walker = { ...makeWalkers(1)[0], on: false, X: XBR - 0.7, z: 10.6, dz: -1, phase: 'wait', top: CYELL, low: CNAVY, skin: SKIN3, hair: HAIR1, skirt: false };
function drawVest() {
  drawWalker(V, VEST);
  const k = scaleAt(V, VEST.z), cx = projX(V, VEST.X, VEST.z), gy = projY(V, 0, VEST.z);
  rect(Math.round(cx - 2.2 * k), Math.round(gy - 11.6 * k), Math.max(1, Math.round(4.4 * k)), Math.max(1, Math.round(0.9 * k)), VOID); // the vest's black band
  rect(Math.round(cx - 0.4 * k), Math.round(gy - 14 * k), Math.max(1, Math.round(0.8 * k)), Math.max(1, Math.round(6 * k)), VOID);
}

let conflicts = 0, crossings = 0, prevCross = 0, redRuns = 0;
function update(dt: number) {
  updateAnimals(dt);
  sigT += dt;
  const s = sig(), c = ROAD.crossing!;
  c.signal = s.phase;
  c.occupied = WALKERS.some((w) => w.on && w.phase === 'cross');
  // debug: a vehicle that was before its line, not committed on yellow, and is past it on red
  const before = CARS.map((v) => v.on && !v.committed && toStopLine(v, ROAD) >= 0);
  updateCarsP(CARS, dt, ROAD, laneX, 1, ONE_WAY);
  if (s.phase === 'red') CARS.forEach((v, i) => { if (before[i] && v.on && toStopLine(v, ROAD) < -0.5) redRuns++; });
  updateWalkers(WALKERS, dt, WALK, () => carsOnCrossing(CARS, ROAD) || !pedestrianMayStart(sig(), CROSS_TIME, SIG_T), 1);
  const on = onZebra(WALKERS, ZEB);
  if (on && carsOnCrossing(CARS, { ...ROAD, stopGap: 0 })) conflicts++;
  if (on < prevCross) crossings++;
  prevCross = on;
  VEST.on = shopsOpen();
}

const shopsOpen = () => S.cal.weekday !== 0 && hourIn(S.cal.hour, 7.5, 18.5);
const pharmacyOpen = () => hourIn(S.cal.hour, 7, 22);
let shopOpens: Opening[] = [];

const FOG = [{ y: HORIZON + 2, h: 7, sp: 0.5 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  drawStreet(street);
  blitLayer(mid); // facades and poles reach below the horizon: put them back over the street pass
  drawOpeningsP(shopOpens, shopsOpen());
  drawGoods(pharmacyOpen());
  if (isNight()) for (let x = 226; x < 262; x += 5) put(x, Math.round(projY(V, 2.4, 135)), (x / 5) % 3 ? WWARM : LIGHT); // lit windows at the far end
  drawFarPrecip();
  for (const l of LAMPS) lampLightP(V, l);
  drawSignal(sig());
  if (S.festa || S.saoJoao) { const [x0, y0, x1, y1] = WIRES[0]; bandeirolas(x0, y0 + 4, x1, y1 + 4, 10, 3); }
  drawAnimalsPerched();
  drawByDepth([
    ...MOTOS.map((m) => ({ z: m.z, draw: () => drawMoto(m) })),
    ...PARKED.map((p) => ({ z: p.z, draw: () => drawCarP(V, p, true) })),
    { z: LAMPS[0].z, draw: () => blitLayer(poleL) }, { z: 10, draw: () => blitLayer(poleR) },
    ...(VEST.on ? [{ z: VEST.z, draw: drawVest }] : []),
    ...CARS.filter((c) => c.on).map((c) => ({ z: c.z, draw: () => drawCarP(V, c) })),
    ...WALKERS.filter((w) => w.on).map((w) => ({ z: w.z, draw: () => drawWalker(V, w) })),
  ]);
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const ruaManoelRodrigues: Scene = {
  id: 'rua-manoel-rodrigues',
  name: 'Rua Manoel Rodrigues de Oliveira',
  build() {
    if (!built) {
      buildFar();
      // far to near where the side street opens: the grey building's corner, the parked car, then the pink corner
      paintFacades(mid, V, [greyBuilding(), ...leftFar(), tlBuilding(), pharmacy(), ...rightFar()], opens);
      sideStreetCar();
      paintFacades(mid, V, [pinkBuilding()], opens);
      paintFacades(mid, V, canopies(), opens);
      shopOpens = opens.filter((o) => o !== glass);
      buildGoods(); buildPoles(); buildGround();
      built = true;
    }
    setLanes([{ y: 400 }], { bikes: false }); // clears the side-on pedestrians: this scene has its own, on the sidewalks
    setCarLanes(400, 400, 'br'); // clears the side-on traffic: this scene runs its own, on the roadway only
    for (const c of CARS) c.on = false;
    for (const w of WALKERS) w.on = false;
    const lampHeads = LAMPS.map((l) => ({ x: projX(V, l.X + l.arm, l.z), y: projY(V, l.h, l.z) }));
    setupAnimals({ ground: [], dogs: 0, wires: WIRES.slice(0, 2).map(([a, b, c, d, s]) => wireCurve(a, b, c, d, s)), lamps: lampHeads });
    configure({ roofs: [], tips: [], lamps: lampHeads, ground0: HORIZON + 14, horizon: HORIZON });
    for (let i = 0; i < 300; i++) update(1 / 30);
    conflicts = 0; crossings = 0; redRuns = 0;
  },
  update,
  render,
  debug() {
    const s = sig();
    return `active  walkers x${WALKERS.filter((w) => w.on).length}  road x${CARS.filter((c) => c.on).length}  sinal ${s.phase} ${s.left.toFixed(0)}s`
      + `  faixa x${onZebra(WALKERS, ZEB)} travessias ${crossings} conflitos ${conflicts} avanços ${redRuns}`;
  },
  tap(x, y) { return (VEST.on ? tapWalker(V, [VEST], x, y) : null) ?? tapWalker(V, WALKERS, x, y) ?? tapCarP(V, CARS, x, y); },
};
