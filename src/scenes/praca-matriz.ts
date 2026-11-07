/* PRAÇA DA MATRIZ (Esperança, PB): the ochre church of Nossa Senhora do Bom Conselho with its
   central clock tower and spire, rusticated pilasters lit amber from below at night, white LED
   lamp posts, palms, the Virgin on her tiled pedestal, wires across the street and motorcycles. */
import { L, Lp, WW, blitLayer, getW, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  AMB, AMBD, ASPH, BFAR, BNEAR, CBLUE, CHURCH, CHURCHD, CHURCHL, CYELL, GOLD, LIGHT, MANTO, SKIN2, STONE, STONEL,
  TERRA, TILEW, VOID, WHITE, WOOD, WWARM, WCOOL, FBLUE, FGREEN, FPINK, MAG, CRED,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { S } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import {
  type Lamp, type Opening, type Palm, bandeirolas, bulbs, cart, casa, christmasStar, drawOpenings, drawPalm, fogueira,
  isNight, lampLight, lampPost, pole, wire, wireCurve,
} from './br-kit';
import type { Scene } from './types';

const HORIZON = 118, STREET = 147, SH = 180 - STREET, CX = 240;
const wr = mulberry32(0xe5e7);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
let opens: Opening[] = [];
const LAMPS: Lamp[] = [{ x: 118, top: 66, ground: 140, arms: 2 }, { x: 362, top: 66, ground: 140, arms: 2 }];
const PALMS: Palm[] = [{ x: 70, ground: 140, h: 78, lean: -6, ph: 0 }, { x: 420, ground: 140, h: 70, lean: 5, ph: 2 }];

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 14 + ((wr() * 26) | 0), top = 96 + ((wr() * 24) | 0);
    L(far, x, top, w, 140 - top, BFAR);
    for (let wy = top + 3; wy < 130; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.12) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 4) | 0);
  }
  L(far, 438, 10, 2, 110, BFAR); for (let y = 14; y < 120; y += 6) { Lp(far, 436, y, BFAR); Lp(far, 441, y, BFAR); } // cell tower
}

/** Arched opening: rect body with a semicircular top. */
function arch(ly: Uint8Array, x: number, y: number, w: number, h: number, c: number) {
  const r = w / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dy = j - r;
    if (j < r && (i + 0.5 - r) ** 2 + dy * dy > r * r) continue;
    Lp(ly, x + i, y + j, c);
  }
}
function rustic(x: number, y0: number, w: number, y1: number) {
  L(mid, x, y0, w, y1 - y0, CHURCHD);
  for (let y = y0 + 4; y < y1; y += 5) L(mid, x, y, w, 1, CHURCH);
  for (let y = y0; y < y1; y += 5) Lp(mid, x + (((y / 5) | 0) % 2 ? 3 : w - 4), y + 2, CHURCH);
}

function buildChurch() {
  // gable behind the balustrades, rising to the tower
  for (let x = 186; x < 296; x++) { const top = Math.round(62 - (40 - Math.abs(x - CX)) * 0.4); if (Math.abs(x - CX) < 40) { L(mid, x, top, 1, 62 - top, CHURCH); Lp(mid, x, top, CHURCHL); } }
  L(mid, 170, 62, 140, 72, CHURCH);
  L(mid, 166, 134, 148, 6, CHURCHD); L(mid, 166, 134, 148, 1, CHURCHL);
  for (const [x, w] of [[170, 14], [296, 14], [222, 6], [252, 6]]) rustic(x, 62, w, 134);
  L(mid, 168, 60, 144, 3, CHURCHL); L(mid, 168, 64, 144, 1, CHURCHL);
  // balustrades + pinnacles
  for (const [a, b] of [[184, 222], [258, 296]]) { L(mid, a, 50, b - a, 2, CHURCHL); for (let x = a + 1; x < b; x += 3) L(mid, x, 52, 1, 8, CHURCHL); }
  for (const x of [170, 296]) { L(mid, x + 1, 42, 12, 18, CHURCHD); L(mid, x - 1, 40, 16, 2, CHURCHL); L(mid, x + 4, 37, 6, 3, CHURCHL); }
  // tower
  L(mid, 222, 2, 36, 60, CHURCH); rustic(222, 2, 5, 62); rustic(253, 2, 5, 62);
  L(mid, 220, 44, 40, 2, CHURCHL); for (let x = 221; x < 259; x += 3) L(mid, x, 38, 1, 6, CHURCHL); L(mid, 220, 37, 40, 1, CHURCHL);
  L(mid, 220, 0, 40, 2, CHURCHL);
  L(mid, 225, -28, 30, 28, CHURCH); rustic(225, -28, 4, 0); rustic(251, -28, 4, 0);
  arch(mid, 231, -24, 6, 20, VOID); arch(mid, 243, -24, 6, 20, VOID);
  for (let y = -16; y < -4; y += 2) { L(mid, 231, y, 6, 1, CHURCHD); L(mid, 243, y, 6, 1, CHURCHD); }
  L(mid, 223, -31, 34, 3, CHURCHL);
  for (let y = 0; y < 34; y++) { const half = Math.round(15 * (1 - y / 34)); L(mid, CX - half, -32 - y, half * 2, 1, TERRA); L(mid, CX, -32 - y, half, 1, y % 3 ? TERRA : CHURCHD); }
  L(mid, CX - 1, -76, 2, 11, GOLD); L(mid, CX - 4, -73, 8, 2, GOLD);
  // doors, windows, emblem
  arch(mid, 230, 108, 20, 26, CHURCHL); arch(mid, 232, 110, 16, 24, WOOD); arch(mid, 233, 111, 14, 7, CYELL);
  for (const x of [194, 272]) { arch(mid, x, 114, 16, 20, CHURCHL); arch(mid, x + 2, 116, 12, 18, WOOD); arch(mid, x + 3, 117, 10, 5, CYELL); }
  for (const x of [196, 274]) { arch(mid, x, 76, 12, 24, CHURCHL); arch(mid, x + 2, 78, 8, 21, BNEAR); L(mid, x - 2, 96, 16, 1, VOID); for (let i = x - 2; i < x + 14; i += 2) L(mid, i, 97, 1, 3, VOID); }
  for (const x of [187, 290]) arch(mid, x, 72, 4, 52, BNEAR);
  for (const x of [233, 243]) arch(mid, x, 66, 4, 30, BNEAR);
  for (let i = 0; i < 12; i++) { Lp(mid, 228 + i, 104 - (i >> 1), CHURCHL); Lp(mid, 252 - i, 104 - (i >> 1), CHURCHL); }
  L(mid, 237, 97, 6, 6, GOLD); L(mid, 238, 98, 4, 4, CBLUE);
  arch(mid, 238, 52, 4, 7, WWARM);
}

function buildSides() {
  opens = [
    ...casa(mid, 0, 46, 34, 140, FGREEN, WHITE, 'escada', false, wr),
    ...casa(mid, 48, 54, 40, 140, TILEW, CBLUE, 'reta', true, wr),
    ...casa(mid, 104, 56, 30, 140, FPINK, WHITE, 'deco', true, wr),
    ...casa(mid, 318, 60, 46, 140, TILEW, CRED, 'balaustre', true, wr),
    ...casa(mid, 380, 46, 32, 140, FBLUE, WHITE, 'frontao', false, wr),
    ...casa(mid, 428, 52, 36, 140, CYELL, WHITE, 'deco', true, wr),
  ];
}

function buildFront() {
  L(front, 0, 140, WW, 7, STONE);
  for (let x = 0; x < WW; x += 6) for (let y = 141; y < 146; y += 3) Lp(front, x + (y % 2) * 3, y, STONEL);
  L(front, 0, 146, WW, 1, STONEL);
  for (const l of LAMPS) lampPost(front, l);
  for (const x of [96, 366]) { L(front, x, 136, 18, 2, STONEL); L(front, x + 1, 138, 2, 2, STONE); L(front, x + 15, 138, 2, 2, STONE); } // benches
  // Nossa Senhora on her tiled pedestal
  L(front, 147, 122, 14, 18, TILEW); for (let y = 124; y < 140; y += 3) L(front, 147, y, 14, 1, WHITE);
  L(front, 145, 118, 18, 4, WHITE);
  L(front, 150, 98, 8, 20, MANTO); for (let y = 100; y < 118; y += 3) Lp(front, 151 + (y % 5), y, GOLD);
  L(front, 152, 93, 4, 5, SKIN2); L(front, 151, 92, 6, 2, MANTO); L(front, 155, 101, 3, 3, WHITE);
  pole(front, 20, 140, 82); pole(front, 456, 140, 82);
  wire(front, 21, 61, 457, 61, 16); wire(front, 21, 64, 457, 64, 20); wire(front, 21, 68, 457, 68, 13);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.1 ? STONE : ASPH;
  for (let x = 4; x < WW; x += 20) for (let d = 16; d < 17; d++) for (let i = 0; i < 10; i++) street.base[d * WW + x + i] = CYELL;
  for (let x = 300; x < 344; x += 6) for (let d = 2; d < SH - 2; d++) for (let i = 0; i < 3; i++) street.base[d * WW + x + i] = TILEW; // crosswalk paint (WHITE would glow at night)
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 6), rx = 8 + wr() * 18, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
const CHURCHY = new Set([CHURCH, CHURCHD, CHURCHL, TERRA]);
/** Amber floodlights at the foot of each pilaster, fading upward. */
function uplights() {
  if (!isNight()) return;
  const bands: [number, number, number, number][] = [[168, 18, 134, 74], [294, 18, 134, 74], [220, 10, 134, 132], [250, 10, 134, 132], [223, 8, 0, 30], [249, 8, 0, 30], [218, 44, 46, 10], [225, 30, -30, 40]];
  for (const [x0, w, yb, h] of bands) for (let y = yb - h; y < yb; y++) {
    const k = 1 - (yb - y) / h;
    for (let x = x0; x < x0 + w; x++) {
      const c = getW(x, y);
      if (!CHURCHY.has(c)) continue;
      const b = bay(sx(x), sy(y)), e = k * (c === CHURCHL ? 1.2 : 1);
      if (b < e * 0.45) put(x, y, LIGHT); else if (b < e * 0.8) put(x, y, AMB); else if (b < e) put(x, y, AMBD);
    }
  }
  for (const [x, y] of [[CX, -71], [CX - 3, -72], [CX + 3, -72]]) put(x, y, LIGHT);
}

function clock() {
  const cy = 22, n = isNight();
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const d = i * i + j * j; if (d <= 36) put(CX + i, cy + j, d > 25 ? CHURCHL : n ? LIGHT : WHITE); }
  const h = S.cal.hour, hrs = ((h % 12) / 12) * Math.PI * 2, min = (h % 1) * Math.PI * 2;
  for (let k = 0; k <= 3; k++) put(CX + Math.sin(hrs) * k, cy - Math.cos(hrs) * k, VOID);
  for (let k = 0; k <= 5; k++) put(CX + Math.sin(min) * k, cy - Math.cos(min) * k, VOID);
}

function windows() {
  const n = isNight(), lit = n && (S.festa || S.cal.hour >= 18 && S.cal.hour < 21 || S.cal.weekday === 0 && S.cal.hour < 11);
  for (const x of [235, 245]) rect(x - 2, 72, 4, 24, lit ? WWARM : BNEAR);
  for (const x of [198, 276]) rect(x, 82, 8, 13, lit ? WWARM : BNEAR);
  for (const x of [187, 290]) rect(x, 76, 4, 48, lit ? AMB : BNEAR);
  if (lit) rect(234, 118, 12, 16, WWARM); // main door open
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.5 ? (f.rank < 0.1 ? WCOOL : WWARM) : BFAR);
  if (((S.ms / 1000) | 0) % 2 === 0) put(438, 9, MAG);
}

function update(dt: number) {
  updateAnimals(dt);
  const crowd = S.procissao ? 5 : S.festa && S.cal.hour >= 18 ? 3 : 1.3;
  tickSpawns(dt, crowd); updatePeople(dt); updateCars(dt, 1);
}

const FOG = [{ y: 110, h: 10, sp: 0.5 }, { y: 140, h: 6, sp: -0.4 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); drawOpenings(opens, S.cal.hour >= 7 && S.cal.hour < 19 && S.cal.weekday !== 0); windows(); clock(); uplights();
  drawFarPrecip();
  blitLayer(front);
  for (const p of PALMS) drawPalm(p);
  for (const l of LAMPS) lampLight(l);
  if (S.natal) for (const l of LAMPS) christmasStar(l.x + 1, l.top - 12, 1);
  if (S.festa || S.saoJoao) { bandeirolas(118, 70, 222, 58, 8, 0); bandeirolas(258, 58, 362, 70, 8, 3); if (S.festa) { bulbs(0, 74, 118, 70, 6); bulbs(362, 70, 480, 74, 6); } }
  if (S.saoJoao && S.cal.day >= 22 && S.cal.day <= 24 && S.cal.hour >= 18) fogueira(440, 146);
  cart(326, 146, S.stallOpen);
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const praca: Scene = {
  id: 'praca-matriz',
  name: 'Praça da Matriz',
  build() {
    if (!built) { buildFar(); buildChurch(); buildSides(); buildFront(); buildGround(); built = true; }
    setLanes([{ y: 142 }, { y: 144 }, { y: 146 }]);
    setupAnimals({ ground: [143, 145], dogs: 2, sleepSpots: [60, 300], lamps: [{ x: 106, y: 66 }, { x: 130, y: 66 }, { x: 350, y: 66 }, { x: 374, y: 66 }],
      wires: [wireCurve(21, 61, 457, 61, 16), wireCurve(21, 64, 457, 64, 20), wireCurve(21, 68, 457, 68, 13)],
      walls: [{ x0: 0, x1: 46, y: 101 }, { x0: 104, x1: 160, y: 105 }, { x0: 380, x1: 426, y: 103 }, { x0: 168, x1: 186, y: 60 }] });
    setCarLanes(158, 172, 'br');
    configure({ roofs: [{ x0: 168, x1: 312, y: 60 }], tips: [{ x: 170, y: 62, end: 140 }, { x: 309, y: 62, end: 140 }], lamps: LAMPS.map((l) => ({ x: l.x, y: l.top })), ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  festa ${S.festa} procissão ${S.procissao} natal ${S.natal}`; },
  // tap the church (façade, tower or spire) and the bell strikes once
  tap(x, y) {
    const tower = x >= 220 && x < 260 && y >= -76 && y < 62, facade = x >= 166 && x < 314 && y >= 37 && y < 140;
    return tower || facade ? { x: CX, y: -14, sfx: 'bell' } : null;
  },
};
