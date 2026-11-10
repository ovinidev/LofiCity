/* PRAÇA DA MATRIZ (Esperança, PB): the yellow church of Nossa Senhora do Bom Conselho (drawn from
   Google Maps captures, a Jun 2025 photo, Feb 2025 Street View and the owner's own photos, used as
   reference only) with its slender central clock tower and pointed spire, cream pilasters lit amber
   from below at night. Facing the church as in the street photo: the paved praça with leafy trees,
   white LED lamp posts and the Virgin on her tiled pedestal fills the left and the front; on the
   right, R. Manoel Rodrigues de Oliveira (the road toward Campina Grande) runs past the church behind
   a yellow-painted curb, with shops, poles and wires on its far side. The road is drawn in
   perspective, receding toward the church, and all traffic stays on it. It is one-way here: every
   vehicle drives up it, away from the viewer, tail lights showing; nothing comes the other way.
   Now and then a PMPB patrol car is one of them (police-rules.ts), and on rare clock slots a parked
   viatura and an officer stand on the plaza pavers left of the road, clear of it and of the zebra. */
import { G, L, Lp, WW, blitLayer, getW, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, hashf, mulberry32 } from '../engine/math';
import {
  AMB, AMBD, ASPH, BARK, BFAR, BMID, BNEAR, CBLUE, CNAVY, CHURCH, CHURCHD, CHURCHL, CYELL, GOLD, HAIR1, HAIR2, HAIR3, LIGHT, MANTO,
  SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, STONEL, CBEIGE, MAGD, WDIM,
  TILEW, VOID, WHITE, WOOD, WWARM, WCOOL, FBLUE, FGREEN, FPINK, MAG, CRED, UMB,
} from '../engine/palette';
import { opensUmbrella } from '../actors/rain-rules';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { anyoneBetween, bikeCount, cocoNow, drawPeople, peopleCount, setCocoStand, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { CROSS0, CROSS1, ROAD_VY, STOP_ROW, curbL, curbR, spawnAway, stepRoad } from '../actors/matriz-road';
import { setCarLanes } from '../actors/cars';
import { drawPmpbSide } from '../actors/br-traffic';
import { MATRIZ_PARK, PATROL, officerLine, parkedAt, patrolDue, patrolSpawned, policeForced, tickPatrol } from '../actors/police-rules';
import { pmpbDepth } from '../actors/pmpb-draw';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { type MassState, massState } from '../sky/rhythm';
import { S } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import {
  type Lamp, type Opening, type Palm, type TowerWin, bandeirolas, bulbs, cart, cocoCart, casa, christmasStar, drawOpenings, drawPalm,
  drawTowerWins, fogueira, isNight, lampLight, lampPool, lampPost, lampRoadPool, nightSpill, pole, wire, wireCurve,
} from './br-kit';
import type { Scene } from './types';

const HORIZON = 118, STREET = 147, SH = 180 - STREET, CX = 240;
const wr = mulberry32(0xe5e7);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
let opens: Opening[] = [];
const LAMPS: Lamp[] = [{ x: 82, top: 66, ground: 140, arms: 2 }, { x: 364, top: 66, ground: 140, arms: 2 }];
const PALMS: Palm[] = [{ x: 4, ground: 140, h: 74, lean: 5, ph: 0 }, { x: 424, ground: 140, h: 70, lean: 5, ph: 2 }];
let trees: Tree[] = [];
const hotelWins: TowerWin[] = [];

// The road, in perspective: its left (plaza) curb and right (shops) curb converge just past the church's
// right corner. Row 140 is the foot of the façade; the road is 28 px wide there and widens to the bottom.
const xl = curbL, xr = curbR;
const laneX = (y: number, u: number) => xl(y) + u * (xr(y) - xl(y));
/** Ground at world (x, y) from row 134 down: plaza pavers, yellow curbs, asphalt with paint, sidewalk. */
function groundAt(x: number, y: number): number {
  const a = xl(y), b = xr(y), w = b - a;
  if (x < a - 2) return y % 3 === 0 || (x + ((y / 3) | 0) * 2) % 5 === 0 ? STONE : STONEL;
  if (x < a) return CYELL;
  if (x >= b + 2) return y % 4 === 0 || x % 6 === 0 ? STONE : STONEL;
  if (x >= b) return CYELL;
  const u = (x - a) / w, depth = 60 / (y - ROAD_VY);
  if (y >= CROSS0 && y < CROSS1) return Math.floor(((x - 324) / (y - ROAD_VY)) * 2.2) & 1 ? ASPH : TILEW; // zebra (WHITE would glow at night)
  // one-way, as in the street photo: no centre line; a dashed line sets off the parking strip by the shops
  if (Math.abs(u - 0.8) * w < Math.max(0.5, w * 0.01) && (depth | 0) % 2 === 0) return TILEW;
  if (Math.abs(u - 0.035) * w < Math.max(0.5, w * 0.008)) return TILEW; // edge line by the plaza curb
  return wr() < 0.08 ? STONE : ASPH;
}

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 14 + ((wr() * 26) | 0), top = 96 + ((wr() * 24) | 0);
    L(far, x, top, w, 140 - top, BFAR);
    for (let wy = top + 3; wy < 130; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.12) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 4) | 0);
  }
  L(far, 438, 10, 2, 110, BFAR); for (let y = 14; y < 120; y += 6) { Lp(far, 436, y, BFAR); Lp(far, 441, y, BFAR); } // cell tower
}

/** Arched opening: rect body with a semicircular top; into a layer, or with ly = null straight into the frame. */
function arch(ly: Uint8Array | null, x: number, y: number, w: number, h: number, c: number) {
  const r = w / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dy = j - r;
    if (j < r && (i + 0.5 - r) ** 2 + dy * dy > r * r) continue;
    if (ly) Lp(ly, x + i, y + j, c); else put(x + i, y + j, c);
  }
}
interface Glass { x: number; y: number; w: number; h: number }
/** Framed arched opening: cream surround, `c` inside. Returns the inner rect for night lighting. */
function opening(x: number, y: number, w: number, h: number, c: number): Glass {
  arch(mid, x - 1, y - 1, w + 2, h + 1, CHURCHL); arch(mid, x, y, w, h, c);
  return { x, y, w, h };
}
/** Smooth cream pilaster with a shaded right edge. */
function pilaster(x: number, y0: number, w: number, y1: number) {
  L(mid, x, y0, w, y1 - y0, CHURCHL); L(mid, x + w - 1, y0, 1, y1 - y0, CHURCH);
}
/** Little balustrade: rail on top, balusters every other pixel, plinth below. */
function balustrade(x0: number, x1: number, y: number, h: number) {
  L(mid, x0, y, x1 - x0, 2, CHURCHL);
  for (let x = x0 + 1; x < x1 - 1; x += 2) L(mid, x, y + 2, 1, h - 3, CHURCHL);
  L(mid, x0, y + h - 1, x1 - x0, 1, CHURCHL);
}

// Proportions follow the Jun 2025 facade photo: a five-bay ochre front with cream pilasters on a
// grey granite base, one slender square tower rising from the centre bay (paired windows, coat of
// arms over the main door, balcony and clock, belfry, a small lantern stage and a pointed spire).
const F0 = 166, F1 = 314; // facade edges
const TW0 = 225, TW1 = 255; // tower edges
const winTower: Glass[] = [], winSide: Glass[] = [], winOuter: Glass[] = [];
let mainDoor: Glass = { x: 0, y: 0, w: 0, h: 0 };

function buildChurch() {
  // walls and granite base
  L(mid, F0, 54, F1 - F0, 76, CHURCH);
  L(mid, F0 - 1, 130, F1 - F0 + 2, 10, STONE); L(mid, F0 - 1, 130, F1 - F0 + 2, 1, STONEL);
  for (let y = 132; y < 140; y += 2) for (let x = F0 + ((y >> 1) % 3); x < F1; x += 5) Lp(mid, x, y, STONEL);
  // side bays: sloped coping rising toward the tower
  for (let x = 202; x < TW0; x++) {
    const top = Math.round(52 - (x - 202) * 0.6), m = F0 + F1 - 1 - x;
    for (const xx of [x, m]) { L(mid, xx, top, 1, 54 - top, CHURCH); L(mid, xx, top, 1, 2, CHURCHL); }
  }
  // outer bays: flat cornice with a balustrade
  for (const [a, b] of [[F0, 202], [278, F1]]) { L(mid, a - 1, 52, b - a + 2, 2, CHURCHL); L(mid, a, 54, b - a, 1, CHURCHD); balustrade(a, b, 45, 7); }
  // pilasters: corners and between bays, each capped with a small block
  for (const x of [F0, F1 - 8]) { pilaster(x, 42, 8, 130); L(mid, x - 1, 41, 10, 2, CHURCHL); L(mid, x + 2, 38, 4, 3, CHURCHL); }
  for (const x of [196, 278]) { pilaster(x, 40, 6, 130); L(mid, x - 1, 39, 8, 2, CHURCHL); L(mid, x + 1, 36, 4, 3, CHURCHL); }
  // impost band between windows and doors
  L(mid, F0, 98, F1 - F0, 1, CHURCHL); L(mid, F0, 99, F1 - F0, 1, CHURCHD);
  // tower shaft from the centre bay up to the belfry
  L(mid, TW0, -40, TW1 - TW0, 94, CHURCH);
  pilaster(222, 54, 5, 130); pilaster(253, 54, 5, 130);
  pilaster(TW0, -40, 3, 54); pilaster(TW1 - 3, -40, 3, 54);
  L(mid, TW0 - 1, 52, TW1 - TW0 + 2, 2, CHURCHL);
  // balcony under the clock
  balustrade(221, 259, 8, 6); L(mid, 221, 14, 38, 2, CHURCHL); L(mid, 222, 16, 36, 1, CHURCHD);
  // belfry with two tall louvred openings
  L(mid, 223, -10, 34, 3, CHURCHL); L(mid, 224, -7, 32, 1, CHURCHD);
  for (const x of [231, 244]) { arch(mid, x - 1, -36, 7, 25, CHURCHL); arch(mid, x, -35, 5, 24, VOID); for (let y = -26; y < -12; y += 2) L(mid, x, y, 5, 1, CHURCHD); }
  L(mid, 222, -42, 36, 3, CHURCHL); L(mid, 223, -39, 34, 1, CHURCHD);
  for (const x of [222, 256]) { L(mid, x, -45, 2, 3, CHURCHL); Lp(mid, x, -46, CHURCHL); } // corner finials
  // lantern stage
  L(mid, 230, -54, 20, 12, CHURCH); pilaster(230, -54, 2, -42); pilaster(248, -54, 2, -42);
  for (const x of [234, 243]) arch(mid, x, -52, 3, 8, VOID);
  L(mid, 228, -56, 24, 2, CHURCHL);
  // pointed spire with a lit rib, and the cross
  for (let y = 0; y < 20; y++) {
    const half = Math.max(0, Math.round(11 * (1 - y / 20)));
    L(mid, CX - half, -57 - y, half, 1, CHURCH); L(mid, CX, -57 - y, half, 1, CHURCHD); Lp(mid, CX, -57 - y, CHURCHL);
  }
  L(mid, CX - 1, -86, 2, 10, BMID); L(mid, CX - 4, -83, 8, 2, BMID);
  // openings: paired tall tower windows, side bays (window over door), outer bays (tall narrow window)
  for (const x of [232, 244]) winTower.push(opening(x, 24, 4, 40, BNEAR));
  for (const cx of [212, 268]) { winSide.push(opening(cx - 2, 66, 4, 26, BNEAR)); opening(cx - 4, 106, 8, 32, WOOD); L(mid, cx, 110, 1, 28, BARK); }
  for (const cx of [185, 295]) winOuter.push(opening(cx - 2, 70, 4, 48, BNEAR));
  mainDoor = opening(234, 102, 12, 36, WOOD); L(mid, CX, 106, 1, 32, BARK);
  // pediment over the main door with the parish coat of arms
  for (let i = 0; i < 13; i++) { Lp(mid, 228 + i, 96 - Math.round(i * 0.8), CHURCHL); Lp(mid, 252 - i, 96 - Math.round(i * 0.8), CHURCHL); }
  L(mid, 228, 97, 25, 1, CHURCHL);
  L(mid, 237, 87, 7, 8, GOLD); L(mid, 238, 88, 5, 6, CBLUE); Lp(mid, 238, 93, GOLD); Lp(mid, 242, 93, GOLD); Lp(mid, CX, 89, TILEW);
}

function buildSides() {
  // left, behind the praça: the white four-storey block with blue bands, then a low white building
  const hw = 92, htop = 66;
  L(mid, 0, htop, hw, 140 - htop, TILEW); L(mid, 0, htop - 3, hw, 3, CBLUE); L(mid, 0, htop, hw, 1, FBLUE);
  for (let fy = htop + 4; fy < 125; fy += 15) {
    L(mid, 0, fy + 9, hw, 2, CBLUE);
    for (let wx = 4; wx < hw - 6; wx += 9) { L(mid, wx, fy + 2, 5, 6, BNEAR); L(mid, wx, fy + 8, 5, 1, STONEL); hotelWins.push({ x: wx + 1, y: fy + 4, rank: wr() }); }
  }
  L(mid, 0, 128, hw, 12, STONEL); for (let x = 6; x < hw; x += 22) L(mid, x, 129, 14, 11, STEEL); // ground floor with roll-up doors
  opens = [
    ...casa(mid, 96, 56, 36, 140, TILEW, CBLUE, 'reta', true, wr),
    // right, across the road: a low shop by the church, a taller building with balconies, more shops
    ...casa(mid, 348, 38, 42, 140, TILEW, CRED, 'balaustre', true, wr),
    ...casa(mid, 390, 46, 74, 140, CBEIGE, WHITE, 'reta', true, wr),
    ...casa(mid, 440, 40, 50, 140, FBLUE, WHITE, 'deco', true, wr),
  ];
  for (const by of [86, 104]) { L(mid, 388, by, 50, 2, TILEW); L(mid, 388, by - 5, 50, 1, STEEL); for (let x = 389; x < 437; x += 3) L(mid, x, by - 4, 1, 4, STEEL); } // balconies
  // the road between the church and the shops, vanishing past the façade
  for (let y = 134; y < 140; y++) for (let x = F1 + 1; x < 348; x++) Lp(mid, x, y, groundAt(x, y));
}

function buildFront() {
  for (let y = 140; y < STREET; y++) for (let x = 0; x < WW; x++) Lp(front, x, y, groundAt(x, y));
  for (const l of LAMPS) lampPost(front, l);
  for (const x of [104, 266]) { L(front, x, 136, 18, 2, STONEL); L(front, x + 1, 138, 2, 2, STONE); L(front, x + 15, 138, 2, 2, STONE); } // benches
  // Nossa Senhora on her tiled pedestal
  L(front, 147, 122, 14, 18, TILEW); for (let y = 124; y < 140; y += 3) L(front, 147, y, 14, 1, WHITE);
  L(front, 145, 118, 18, 4, WHITE);
  L(front, 150, 98, 8, 20, MANTO); for (let y = 100; y < 118; y += 3) Lp(front, 151 + (y % 5), y, GOLD);
  L(front, 152, 93, 4, 5, SKIN2); L(front, 151, 92, 6, 2, MANTO); L(front, 155, 101, 3, 3, WHITE);
  // poles and wires only on the shops' side of the road
  pole(front, 352, 140, 82); pole(front, 456, 140, 82);
  for (const [a, b, c, d, g] of WIRES) wire(front, a, b, c, d, g);
}
const WIRES: [number, number, number, number, number][] = [[353, 61, 457, 61, 8], [353, 64, 457, 64, 10], [353, 68, 457, 68, 6], [457, 61, 480, 52, 1]];

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = groundAt(x, STREET + d);
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 6), rx = 8 + wr() * 18, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
const CHURCHY = new Set([CHURCH, CHURCHD, CHURCHL]);
/** Amber floodlights at the foot of each pilaster and up the tower, fading upward. */
function uplights() {
  if (!isNight()) return;
  const bands: [number, number, number, number][] = [
    [F0 - 2, 12, 130, 90], [F1 - 10, 12, 130, 90], [194, 10, 130, 92], [276, 10, 130, 92],
    [220, 10, 130, 172], [250, 10, 130, 172], [221, 38, 17, 30], [228, 24, -40, 40],
  ];
  for (const [x0, w, yb, h] of bands) for (let y = yb - h; y < yb; y++) {
    const k = 1 - (yb - y) / h;
    for (let x = x0; x < x0 + w; x++) {
      const c = getW(x, y);
      if (!CHURCHY.has(c)) continue;
      const b = bay(sx(x), sy(y)), e = k * (c === CHURCHL ? 1.2 : 1);
      if (b < e * 0.45) put(x, y, LIGHT); else if (b < e * 0.8) put(x, y, AMB); else if (b < e) put(x, y, AMBD);
    }
  }
  for (const [x, y] of [[CX, -81], [CX - 3, -82], [CX + 3, -82]]) put(x, y, LIGHT);
}

function clock() {
  const cy = 0, n = isNight();
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const d = i * i + j * j; if (d <= 36) put(CX + i, cy + j, d > 25 ? CHURCHL : n ? LIGHT : WHITE); }
  const h = S.cal.hour, hrs = ((h % 12) / 12) * Math.PI * 2, min = (h % 1) * Math.PI * 2;
  for (let k = 0; k <= 3; k++) put(CX + Math.sin(hrs) * k, cy - Math.cos(hrs) * k, VOID);
  for (let k = 0; k <= 5; k++) put(CX + Math.sin(min) * k, cy - Math.cos(min) * k, VOID);
}

function windows() {
  const n = isNight();
  if (n && (S.festa || mass.doorsOpen)) {
    for (const g of [...winTower, ...winSide]) arch(null, g.x, g.y, g.w, g.h, WWARM);
    for (const g of winOuter) arch(null, g.x, g.y, g.w, g.h, AMB);
  }
  if (mass.doorsOpen || (n && S.festa)) { // main door open on the lit nave (dimmer against daylight)
    const x = mainDoor.x + 2, y = mainDoor.y + 6, w = mainDoor.w - 4, h = mainDoor.h - 6;
    arch(null, x, y, w, h, n ? WWARM : AMBD);
    if (!n) { put(x + 2, y + 9, LIGHT); put(x + w - 3, y + 9, LIGHT); for (let i = 1; i < w - 1; i++) put(x + i, y + 13, AMB); } // candles, altar
  }
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.5 ? (f.rank < 0.1 ? WCOOL : WWARM) : BFAR);
  if (((S.ms / 1000) | 0) % 2 === 0) put(438, 9, MAG);
}

// ---------- mass: a small congregation by the church door ----------
// Around mass (rhythm.ts massState: every day 18h, Sundays also 07/09h) and, through the daily visiting
// windows (doors open 09-12h and 16-19h), single people dropping in to pray: the faithful walk in
// from the sides, linger chatting near the door, go in; at the end they come out and walk off.
// Separate from the street pedestrians, so the rest of the praça keeps its quiet evening.
interface Fiel { on: boolean; x: number; tx: number; dir: number; sp: number; ph: number; wait: number; out: boolean; top: number; low: number; skin: number; hair: number; skirt: boolean; seed: number }
const fr = mulberry32(0xf1e15);
const fpick = <T>(a: readonly T[]): T => a[(fr() * a.length) | 0];
const FIEIS: Fiel[] = Array.from({ length: 8 }, () => ({ on: false, x: 0, tx: 0, dir: 1, sp: 8, ph: 0, wait: 0, out: false, top: WHITE, low: VOID, skin: SKIN2, hair: HAIR1, skirt: false, seed: 0 }));
/** Spawn counter: each one's fixed umbrella roll (rain-rules.ts), without drawing from fr. */
let fielSeq = 0;
const FIEL_Y = 141; // the sidewalk in front of the steps
let fielT = 0, visitT = 6;
let mass: MassState = massState(0);

function spawnFiel(out: boolean, visit = false) {
  const f = FIEIS.find((o) => !o.on);
  if (!f) return;
  f.skirt = fr() < 0.55; f.top = fpick([WHITE, WHITE, CBLUE, MANTO, CRED, CYELL, FPINK, TILEW]); f.low = f.skirt ? f.top : fpick([VOID, BNEAR, CBLUE, STONE]);
  f.skin = fpick([SKIN1, SKIN2, SKIN2, SKIN3, SKIN4]); f.hair = fpick([HAIR1, HAIR1, HAIR2, HAIR3, HAIR3]);
  f.sp = 7 + fr() * 4; f.ph = fr() * 4; f.out = out; f.on = true; f.seed = ++fielSeq;
  if (out) { f.x = CX - 4 + fr() * 8; f.dir = fr() < 0.5 ? -1 : 1; }
  else {
    f.dir = fr() < 0.5 ? 1 : -1; f.x = f.dir > 0 ? G.camX - 8 : G.camX + G.W + 8;
    f.tx = Math.round(CX + (fr() - 0.5) * (visit ? 20 : 48)); f.wait = visit ? 0.4 + fr() * 1.2 : mass.active ? 0.5 : 2 + fr() * 8; // latecomers and visitors go straight in
  }
}

function updateMass(dt: number) {
  mass = massState(S.ms);
  fielT -= dt;
  if (fielT <= 0) {
    fielT = mass.leaving ? 0.8 + fr() * 1.7 : 4 + fr() * 6;
    if (mass.arriving || mass.leaving) spawnFiel(mass.leaving);
  }
  visitT -= dt;
  if (visitT <= 0) { // someone stops by to pray: in, or out after a while
    visitT = 9 + fr() * 14;
    if (mass.visiting && !mass.arriving && !mass.leaving && !mass.active) spawnFiel(fr() < 0.45, true);
  }
  for (const f of FIEIS) {
    if (!f.on) continue;
    if (f.out) {
      f.x += f.dir * f.sp * dt; f.ph += dt * f.sp * 0.42;
      if (f.x < G.camX - 12 || f.x > G.camX + G.W + 12) f.on = false;
      continue;
    }
    if (!mass.doorsOpen) { f.on = false; continue; }
    const d = f.tx - f.x;
    if (Math.abs(d) > 1) { f.dir = Math.sign(d); f.x += f.dir * f.sp * dt; f.ph += dt * f.sp * 0.42; }
    else if (f.tx !== CX) { f.wait -= dt; if (f.wait <= 0) f.tx = CX; } // chatting by the door, then in
    else f.on = false; // through the door
  }
}

function drawFiel(f: Fiel) {
  const X = Math.round(f.x), y = FIEL_Y, walking = Math.abs(f.tx - f.x) > 1 || f.out;
  const st = walking ? [1, 0, 1, 0][(f.ph | 0) & 3] : 0;
  for (let rr = 0; rr < 5; rr++) {
    const off = rr >= 2 ? st : 0, c = rr === 4 ? VOID : f.skirt && rr >= 2 ? f.skin : f.low;
    put(X - 1 - off, y - 4 + rr, c); put(X + 1 + off, y - 4 + rr, c);
  }
  rect(X - 1, y - 10, 3, f.skirt ? 8 : 6, f.top);
  rect(X - 1, y - 14, 3, 3, f.skin); rect(X - 1, y - 15, 3, 1, f.hair); put(X - f.dir, y - 14, f.hair);
  if (f.skirt) put(X - f.dir, y - 13, f.hair);
  // an umbrella only in real rain (as on the cinema front), from a fixed roll per person
  if (opensUmbrella(S.wxKind, S.rain, S.snow, hashf(f.seed * 7 + 3))) { rect(X - 3, y - 19, 7, 2, UMB); rect(X + 1, y - 17, 1, 6, STEEL); }
}

// ---------- traffic: only on the road right of the church, in perspective ----------
// One-way (rules in actors/matriz-road.ts): every vehicle enters below the frame and drives up the
// road, away from the viewer, toward the church and on past it, tail lights showing. It keeps to the
// lane left of the dashed parking strip. Each vehicle is a rear view scaled by its row; they stop
// for anyone on the zebra.
type RKind = 'moto' | 'car' | 'pickup' | 'bus' | 'pmpb';
interface RCar { on: boolean; y: number; sp: number; kind: RKind; body: number; rider: number; helmet: number }
const rr = mulberry32(0x7a11);
const NO_HELMET = 255; // rider without a helmet (never a palette index)
const rpick = <T>(a: readonly T[]): T => a[(rr() * a.length) | 0];
const RC: RCar[] = Array.from({ length: 10 }, () => ({ on: false, y: 0, sp: 1, kind: 'car' as RKind, body: TILEW, rider: CRED, helmet: VOID }));
const LANE_U = 0.42; // centre of the driving lane, across the road (0 = plaza curb, 1 = shops' curb)
// 1 at row 146, where a car is about a person's height; damped (^0.7) so near vehicles don't swamp the frame
const scaleAt = (y: number) => ((xr(y) - xl(y)) / 56) ** 0.7;
let rcT = 0.5, held = 0, towardViewer = 0;

function spawnCar() {
  const c = spawnAway(RC);
  if (!c) return;
  const k = rr(), h = S.cal.hour;
  c.kind = k < 0.45 ? 'moto' : k < 0.85 ? 'car' : k < 0.95 || h < 6 || h > 22 ? 'pickup' : 'bus';
  c.body = c.kind === 'bus' ? TILEW : c.kind === 'moto' ? rpick([CRED, CRED, VOID, CBLUE, STONEL]) : rpick([TILEW, TILEW, TILEW, STONEL, STONEL, VOID, CRED, CBLUE, STONE]);
  c.rider = rpick([CRED, CBLUE, VOID, CYELL, TILEW, FGREEN]); c.helmet = rpick([VOID, VOID, VOID, TILEW, CRED, CBLUE, NO_HELMET]); // most wear one
  // the shared PMPB cooldown (police-rules.ts): same road, same one-way and zebra rules (matriz-road.ts)
  if (patrolDue(PATROL, { city: S.city.id, forced: policeForced(location.hash) }, RC.some((o) => o !== c && o.on && o.kind === 'pmpb'))) {
    c.kind = 'pmpb'; c.body = TILEW; patrolSpawned(PATROL, h);
  }
  c.sp = (c.kind === 'moto' ? 1.2 : c.kind === 'bus' ? 0.8 : c.kind === 'pmpb' ? 0.9 : 1) * (0.85 + rr() * 0.3);
}

/** The parked viatura and its officer (rare clock slots, or the #police=1 test). */
const parkedNow = () => parkedAt(S.ms, S.cal.hour, S.city.id, policeForced(location.hash));
/** An officer in a plain navy uniform and cap, standing by the car and facing the street. */
function drawOfficer(x: number, yF: number) {
  const X = x + 1;
  for (let j = 0; j < 5; j++) { const c = j === 4 ? VOID : CNAVY; put(X - 1, yF - 4 + j, c); put(X, yF - 4 + j, c); }
  rect(X - 2, yF - 10, 4, 6, CNAVY); rect(X - 2, yF - 5, 4, 1, VOID); // shirt, belt
  put(X + 1, yF - 9, GOLD); put(X - 2, yF - 9, CRED); // badge, shoulder patch
  put(X - 3, yF - 9, CNAVY); put(X - 3, yF - 8, CNAVY); put(X - 3, yF - 7, SKIN3); // arm at the side
  rect(X - 1, yF - 13, 3, 3, SKIN3); put(X + 1, yF - 12, VOID); // face, eye toward the road
  rect(X - 2, yF - 14, 4, 1, CNAVY); put(X + 2, yF - 14, VOID); // cap and its peak
}
function drawParked() {
  const p = MATRIZ_PARK;
  drawPmpbSide(p.x, p.y, p.dir, true); // parked: lights off, the bar dark
  drawOfficer(p.officerX, p.y);
}

function updateTraffic(dt: number) {
  tickPatrol(PATROL, dt, S.city.id);
  rcT -= dt * (0.04 + 0.95 * S.traffic); // builds up with the day (rhythm.ts)
  if (rcT <= 0) { rcT = 0.6 + rr() * 2; spawnCar(); }
  const crossing = anyoneBetween(xl(144) - 4, xr(144) + 4) || FIEIS.some((f) => f.on && f.x > xl(141) - 4 && f.x < xr(141) + 4);
  const before = RC.map((c) => c.y);
  stepRoad(RC, dt, crossing); // stop short of the zebra; a vehicle already on it carries on
  held = crossing ? RC.filter((c) => c.on && c.y >= STOP_ROW && c.y < STOP_ROW + 0.5).length : 0;
  RC.forEach((c, i) => { if (c.on && c.y > before[i]) towardViewer++; }); // debug: must stay 0 (one-way)
}

/** One vehicle seen from the back (going away), at its row's scale. */
function drawRoadCar(c: RCar) {
  const k = scaleAt(c.y), cx = laneX(c.y, LANE_U), gy = Math.round(c.y), n = isNight();
  const X = (u: number) => Math.round(cx + u * k), Y = (h: number) => Math.round(gy - h * k);
  // rect between unit coords: u across (0 = lane centre), h height above the road
  const R = (u0: number, u1: number, h1: number, h0: number, col: number) => rect(X(u0), Y(h1), Math.max(1, X(u1) - X(u0)), Math.max(1, Y(h0) - Y(h1)), col);
  const tail = n ? MAG : MAGD;
  if (c.kind === 'moto') {
    R(-1, 1, 3.5, 0, VOID); R(-1.6, 1.6, 6, 3, c.body);
    R(-2.2, 2.2, 11, 5.5, c.rider);
    if (c.helmet !== NO_HELMET) R(-1.6, 1.6, 13.5, 10.5, c.helmet);
    else R(-1.2, 1.2, 13.3, 10.5, HAIR1); // bare head: the back of it
    R(-0.6, 0.6, 5.5, 4.2, tail);
  } else {
    const bus = c.kind === 'bus', hw = bus ? 10.5 : 8.5, H = bus ? 20 : c.kind === 'pickup' ? 13.5 : 12.5;
    R(-hw - 0.5, hw + 0.5, 0.6, -0.4, VOID); // shadow
    R(-hw + 0.5, -hw + 3, 2.5, 0, VOID); R(hw - 3, hw - 0.5, 2.5, 0, VOID); // tyres
    R(-hw, hw, bus ? H : 8, 2, c.body);
    if (bus) { R(-hw + 1.5, hw - 1.5, H - 2, H - 10, n ? LIGHT : WDIM); R(-hw, hw, 9, 8, FGREEN); }
    else { R(-hw + 2, hw - 2, H, 8, c.body); R(-hw + 3, hw - 3, H - 0.8, 8.2, n ? WDIM : WCOOL); }
    R(-hw, hw, 3, 2, STEEL); // bumper
    R(-2, 2, 5, 3.4, TILEW); // number plate
    R(-hw + 0.5, -hw + 3, 6.5, 5, tail); R(hw - 3, hw - 0.5, 6.5, 5, tail);
    if (c.kind === 'pmpb') pmpbDepth(R, hw, H, 8, false, n);
  }
  if (!n) return; // red tail-light glow on the road just behind it
  for (let j = 1; j <= Math.round(3 * k); j++) for (let x = X(-8); x <= X(8); x++) if (bay(sx(x), sy(gy + j)) < 0.12) put(x, gy + j, MAGD);
}

function drawTraffic(near: boolean) {
  const list = RC.filter((c) => c.on && (c.y >= STREET) === near).sort((a, b) => a.y - b.y);
  let parked = near && parkedNow(); // in depth order with the near traffic
  for (const c of list) {
    if (parked && c.y > MATRIZ_PARK.y) { drawParked(); parked = false; }
    drawRoadCar(c);
  }
  if (parked) drawParked();
}

function update(dt: number) {
  updateAnimals(dt); updateMass(dt);
  const crowd = S.procissao ? 5 : S.festa && S.cal.hour >= 18 ? 3 : 1.3;
  tickSpawns(dt, crowd); updatePeople(dt); updateTraffic(dt);
}

const FOG = [{ y: 110, h: 10, sp: 0.5 }, { y: 140, h: 6, sp: -0.4 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); drawOpenings(opens, S.cal.hour >= 7 && S.cal.hour < 19 && S.cal.weekday !== 0); drawTowerWins(hotelWins); windows(); clock(); uplights();
  drawFarPrecip();
  for (const t of trees) drawTree(t);
  blitLayer(front);
  for (const p of PALMS) drawPalm(p);
  for (const l of LAMPS) { lampLight(l); lampPool(l); }
  nightSpill(opens, S.cal.hour >= 7 && S.cal.hour < 19 && S.cal.weekday !== 0);
  if (S.natal) for (const l of LAMPS) christmasStar(l.x + 1, l.top - 12, 1);
  if (S.festa || S.saoJoao) { bandeirolas(96, 70, 222, 58, 8, 0); bandeirolas(258, 58, 364, 70, 8, 3); if (S.festa) { bulbs(0, 74, 82, 70, 6); bulbs(378, 70, 480, 74, 6); } }
  if (S.saoJoao && S.cal.day >= 22 && S.cal.day <= 24 && S.cal.hour >= 18) fogueira(440, 146);
  cart(282, 146, S.stallOpen); if (cocoNow()) cocoCart(282, 146);
  drawAnimalsPerched(); drawTraffic(false); for (const f of FIEIS) if (f.on) drawFiel(f); drawPeople(); drawAnimalsGround();
  drawStreet(street); for (const l of LAMPS) lampRoadPool(l, 156); drawTraffic(true); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const praca: Scene = {
  id: 'praca-matriz',
  name: 'Praça da Matriz',
  build() {
    if (!built) {
      buildFar(); buildChurch(); buildSides(); buildFront(); buildGround();
      trees = [makeTree(34, 140, 1.0, wr), makeTree(134, 140, 0.85, wr)];
      built = true;
    }
    setLanes([{ y: 142 }, { y: 144 }, { y: 146 }], { bikes: false }); // only people on foot cross in front of the church
    setCocoStand(288, 145); // customers at the cart on hot days (they buy, then drink beside it)
    setupAnimals({ ground: [143, 145], dogs: 2, sleepSpots: [60, 250], lamps: LAMPS.flatMap((l) => [{ x: l.x - 13, y: l.top }, { x: l.x + 14, y: l.top }]),
      wires: WIRES.slice(0, 3).map(([a, b, c, d, g]) => wireCurve(a, b, c, d, g)),
      walls: [{ x0: 0, x1: 92, y: 63 }, { x0: 96, x1: 152, y: 104 }, { x0: 390, x1: 436, y: 66 }, { x0: F0, x1: 196, y: 45 }, { x0: 284, x1: F1, y: 45 }] });
    setCarLanes(158, 172, 'br'); // clears the shared side-on traffic: this scene runs its own, on the road only
    for (const c of RC) c.on = false;
    configure({ roofs: [{ x0: F0, x1: F1, y: 52 }], tips: [{ x: F0 + 1, y: 54, end: 130 }, { x: F1 - 2, y: 54, end: 130 }], lamps: LAMPS.map((l) => ({ x: l.x, y: l.top })), ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  bici x${bikeCount()}  road x${RC.filter((c) => c.on).length} held ${held} oncoming ${towardViewer}  fiéis x${FIEIS.filter((f) => f.on).length}  mass ${mass.active ? 'on' : mass.doorsOpen ? 'doors' : 'off'}  festa ${S.festa} procissão ${S.procissao} natal ${S.natal}`; },
  // tap a vehicle and it honks; tap the church (façade, tower or spire) and the bell strikes once
  tap(x, y) {
    // the parked viatura or its officer: a greeting for the hour (no siren, no sound)
    const p = MATRIZ_PARK;
    if (parkedNow() && x >= p.x - 1 && x <= p.officerX + 4 && y >= p.y - 17 && y <= p.y + 1) {
      return { x: p.officerX + 1, y: p.y - 15, say: officerLine(S.cal.hour, Math.floor(S.ms / 5000)) }; // tap() also serves the hover cursor: keep it free of state
    }
    for (const c of RC) {
      if (!c.on) continue;
      const k = scaleAt(c.y), cx = laneX(c.y, LANE_U), hw = (c.kind === 'bus' ? 11 : c.kind === 'moto' ? 3 : 9) * k + 2;
      if (Math.abs(x - cx) <= hw && y <= c.y + 2 && y >= c.y - (c.kind === 'bus' ? 21 : 14) * k - 2) return { x: cx, y: c.y - 14 * k, sfx: c.kind === 'moto' ? 'moto' : c.kind === 'bus' ? 'bus' : 'car' };
    }
    const tower = x >= 220 && x < 260 && y >= -76 && y < 62, facade = x >= 166 && x < 314 && y >= 37 && y < 140;
    return tower || facade ? { x: CX, y: -14, sfx: 'bell' } : null;
  },
};
