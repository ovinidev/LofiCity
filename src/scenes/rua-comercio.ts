/* RUA DO COMÉRCIO (Esperança, PB): a row of casario with platibandas in pastel paint, the
   furniture shop the town is known for, a pharmacy with its green cross, the bakery that
   opens before dawn, a bar with plastic tables on the sidewalk at night, a sobrado with
   lit windows, motorcycles parked at the curb, and the Matriz tower over the rooftops. */
import { L, WW, blitLayer, getW, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  AMB, AMBD, ASPH, BFAR, BNEAR, CBLUE, CHURCH, CHURCHD, CRED, CYELL, FBLUE, FGREEN, FLILAC, FORNG, FPINK, FWG,
  CGREEN, HALO, HALOOK, LIGHT, STEEL, STONE, STONEL, TERRA, TILEW, VOID, WHITE, WOOD, WWARM, CBEIGE,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import {
  type Lamp, type Opening, type Plat, bandeirolas, bulbs, cart, casa, christmasStar, drawOpenings, isNight, lampLight,
  lampPool, lampPost, lampRoadPool, nightSpill, pole, text, textW, wire, wireCurve,
} from './br-kit';
import type { Scene } from './types';

const HORIZON = 112, STREET = 147, SH = 180 - STREET;
const wr = mulberry32(0xc0e7);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
const LAMPS: Lamp[] = [{ x: 126, top: 74, ground: 140, arms: 1 }, { x: 352, top: 74, ground: 140, arms: 1 }];

// ---------- buildings ----------
interface Bld { x: number; w: number; h: number; wall: number; trim: number; plat: Plat; shop: boolean; sign?: string; signBg?: number; signFg?: number; hours?: [number, number]; upper?: boolean }
const ROW: Bld[] = [
  { x: 0, w: 44, h: 34, wall: FBLUE, trim: WHITE, plat: 'frontao', shop: false },
  { x: 46, w: 56, h: 42, wall: FORNG, trim: WHITE, plat: 'deco', shop: true, sign: 'MOVEIS', signBg: WOOD, signFg: CYELL, hours: [8, 18] },
  { x: 104, w: 48, h: 58, wall: FLILAC, trim: WHITE, plat: 'balaustre', shop: false, upper: true },
  { x: 154, w: 50, h: 38, wall: TILEW, trim: CGREEN, plat: 'reta', shop: true, sign: 'FARMACIA', signBg: CGREEN, signFg: WHITE, hours: [7, 22] },
  { x: 206, w: 42, h: 32, wall: FPINK, trim: WHITE, plat: 'escada', shop: false },
  { x: 250, w: 58, h: 36, wall: CYELL, trim: CRED, plat: 'reta', shop: true, sign: 'BAR DO ZE', signBg: CRED, signFg: WHITE, hours: [16, 24] },
  { x: 310, w: 48, h: 40, wall: FORNG, trim: CBEIGE, plat: 'deco', shop: true, sign: 'PADARIA', signBg: CBEIGE, signFg: WOOD, hours: [5.5, 20] },
  { x: 360, w: 40, h: 30, wall: FGREEN, trim: WHITE, plat: 'frontao', shop: false },
  { x: 402, w: 78, h: 44, wall: TILEW, trim: CBLUE, plat: 'escada', shop: true, sign: 'MERCADINHO', signBg: CBLUE, signFg: WHITE, hours: [7, 21] },
];
const opens: Opening[][] = [];

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 16 + ((wr() * 26) | 0), top = 86 + ((wr() * 20) | 0);
    L(far, x, top, w, 140 - top, BFAR);
    for (let wy = top + 3; wy < 110; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.12) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 3) | 0);
  }
  // the Matriz tower over the rooftops, far away
  const tx = 300;
  L(far, tx, 52, 12, 50, CHURCH); L(far, tx, 52, 2, 50, CHURCHD); L(far, tx + 10, 52, 2, 50, CHURCHD);
  L(far, tx - 1, 51, 14, 1, CHURCHD); L(far, tx + 4, 57, 4, 7, VOID); L(far, tx + 4, 57, 1, 1, CHURCH); L(far, tx + 7, 57, 1, 1, CHURCH); // belfry arch
  L(far, tx + 5, 68, 2, 2, TILEW); // clock
  for (let y = 0; y < 14; y++) { const h = Math.round(6 * (1 - y / 14)); L(far, tx + 6 - h, 50 - y, h * 2, 1, TERRA); }
  L(far, tx + 5, 32, 2, 5, CHURCHD); L(far, tx + 4, 33, 4, 1, CHURCHD);
}

function buildRow() {
  for (const b of ROW) {
    const o = casa(mid, b.x, b.w, b.h, 140, b.wall, b.trim, b.plat, b.shop, wr);
    const top = 140 - b.h;
    if (b.upper) for (let wx = b.x + 5; wx + 8 <= b.x + b.w - 3; wx += 13) { L(mid, wx - 1, top + 8, 9, 13, b.trim); L(mid, wx - 2, top + 20, 11, 1, VOID); o.push({ x: wx, y: top + 9, w: 7, h: 11, kind: 'win', rank: wr(), tv: wr() < 0.3 }); }
    if (b.sign) {
      const sw = Math.max(textW(b.sign) + 6, 24), sx0 = b.x + ((b.w - sw) >> 1);
      L(mid, sx0, top + 4, sw, 9, b.signBg!); L(mid, sx0, top + 12, sw, 1, VOID);
      text(mid, b.sign, sx0 + ((sw - textW(b.sign)) >> 1), top + 6, b.signFg!);
    }
    opens.push(o);
  }
  // farmácia cross bracket
  L(mid, 202, 106, 4, 1, STEEL);
}

function buildFront() {
  L(front, 0, 140, WW, 7, STONE);
  for (let x = 0; x < WW; x += 8) L(front, x, 141, 1, 5, STONEL); // calçada joints
  L(front, 0, 146, WW, 1, STONEL);
  for (const l of LAMPS) lampPost(front, l);
  for (const x of [58, 262, 446]) pole(front, x, 140, 84);
  const W = [[59, 60, 263, 60, 9], [59, 63, 263, 63, 12], [263, 60, 447, 60, 9], [263, 63, 447, 63, 12], [59, 66, 263, 66, 7], [263, 66, 447, 66, 7]];
  for (const [a, b, c, d, s] of W) wire(front, a, b, c, d, s);
  for (const [x0, x1, y1] of [[59, 30, 104], [263, 230, 106], [263, 290, 102], [447, 420, 96], [59, 80, 98]]) wire(front, x0, 70, x1, y1, 2);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const q = wr(); street.base[d * WW + x] = q < 0.08 ? STONE : q < 0.1 ? STONEL : ASPH; }
  for (let x = 6; x < WW; x += 22) for (let i = 0; i < 10; i++) street.base[16 * WW + x + i] = CYELL;
  for (let p = 0; p < 6; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 20, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
const openNow = (b: Bld) => {
  if (!b.hours) return false;
  const [a, z] = b.hours, h = S.cal.hour, sun = S.cal.weekday === 0;
  if (sun && b.sign !== 'BAR DO ZE' && b.sign !== 'FARMACIA' && b.sign !== 'PADARIA') return false;
  return hourIn(h, a, z % 24);
};

function signsAndLights() {
  const n = isNight(), t = S.ms / 1000;
  // pharmacy cross, blinking gently when open
  const farm = openNow(ROW[3]), on = farm && n && Math.sin(t * 2) > -0.6;
  const cx = 205, cy = 110, c = on ? FWG : farm ? CGREEN : BNEAR;
  rect(cx - 1, cy - 4, 3, 9, c); rect(cx - 4, cy - 1, 9, 3, c);
  if (on) glow(cx, cy, 9, FWG);
  // lit sign boards at night
  for (const b of ROW) if (b.sign && n && openNow(b)) {
    const top = 140 - b.h, sw = Math.max(textW(b.sign) + 6, 24), x0 = b.x + ((b.w - sw) >> 1);
    for (let i = 0; i < sw; i += 3) put(x0 + i, top + 13, LIGHT);
  }
  // Matriz uplight in the distance
  if (n) for (let y = 40; y < 102; y++) for (let x = 296; x < 316; x++) {
    const v = getW(x, y);
    if ((v === CHURCH || v === CHURCHD || v === TERRA) && bay(sx(x), sy(y)) < 0.25 + 0.45 * ((y - 40) / 62)) put(x, y, (y > 70 ? AMB : AMBD));
  }
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.45 ? WWARM : BFAR);
}

function glow(cx: number, cy: number, R: number, c: number) {
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const v = getW(cx + i, cy + j), d = Math.hypot(i, j) / R;
    if (v !== 255 && HALOOK[v] && d < 1 && d > 0.35 && bay(sx(cx + i), sy(cy + j)) < 0.3 * (1 - d)) put(cx + i, cy + j, c === FWG ? CGREEN : HALO);
  }
}

/** Plastic tables and chairs outside the bar, with a few regulars, from late afternoon. */
function barTables() {
  if (!openNow(ROW[5]) || S.rain > 0.3) return;
  const n = isNight();
  for (const [x, guests] of [[256, 2], [276, 3], [296, 1]] as const) {
    rect(x, 138, 9, 1, CRED); rect(x + 4, 139, 1, 3, CRED); // table
    put(x + 2, 136, CGREEN); put(x + 2, 137, CGREEN); put(x + 6, 137, CBEIGE); // bottle and glass
    for (let g = 0; g < guests; g++) {
      const gx = x - 4 + g * 7 + (g === 2 ? 3 : 0), shirt = [CBLUE, WHITE, CRED, CYELL][(gx + g) % 4];
      rect(gx, 139, 3, 1, CRED); rect(gx, 140, 1, 2, CRED); rect(gx + 2, 140, 1, 2, CRED); // chair
      rect(gx, 133, 3, 6, shirt); rect(gx, 130, 3, 3, (gx & 1) ? WOOD : CBEIGE); put(gx + 1, 129, VOID);
    }
  }
  if (n) bulbs(250, 104, 308, 104, 3);
}

function parkedMotos() {
  for (const [x, c] of [[176, CRED], [186, VOID], [334, CBLUE]] as const) {
    const y = 152;
    rect(x, y - 3, 3, 3, VOID); rect(x + 7, y - 3, 3, 3, VOID);
    rect(x + 1, y - 5, 8, 2, c); rect(x + 2, y - 6, 4, 1, VOID); put(x + 9, y - 7, STEEL); put(x + 9, y - 6, STEEL);
  }
}

function update(dt: number) {
  updateAnimals(dt);
  const evening = S.cal.hour >= 17 && S.cal.hour < 22;
  tickSpawns(dt, (S.festa || S.saoJoao) && evening ? 2.2 : 1.2); updatePeople(dt); updateCars(dt, 0.9);
}

const FOG = [{ y: 104, h: 9, sp: 0.5 }, { y: 140, h: 6, sp: -0.4 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  ROW.forEach((b, i) => drawOpenings(opens[i], openNow(b)));
  signsAndLights(); drawFarPrecip();
  blitLayer(front);
  for (const l of LAMPS) { lampLight(l); lampPool(l); }
  ROW.forEach((b, i) => nightSpill(opens[i], openNow(b)));
  if (S.natal) for (const l of LAMPS) christmasStar(l.x + 14, l.top - 10, 1);
  if (S.festa || S.saoJoao) { bandeirolas(59, 74, 263, 74, 12, 1); bandeirolas(263, 74, 447, 74, 12, 4); }
  barTables();
  cart(222, 146, S.stallOpen);
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); for (const l of LAMPS) lampRoadPool(l, 158); parkedMotos(); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const ruaComercio: Scene = {
  id: 'rua-comercio',
  name: 'Rua do Comércio',
  build() {
    if (!built) { buildFar(); buildRow(); buildFront(); buildGround(); built = true; }
    setLanes([{ y: 143 }, { y: 145 }]);
    setupAnimals({ ground: [143, 145], dogs: 2, sleepSpots: [230, 330], lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })),
      wires: [wireCurve(59, 60, 263, 60, 9), wireCurve(59, 63, 263, 63, 12), wireCurve(263, 60, 447, 60, 9), wireCurve(263, 63, 447, 63, 12)],
      walls: ROW.filter((b) => !b.sign).map((b) => ({ x0: b.x, x1: b.x + b.w, y: 140 - b.h - 3 })) });
    setCarLanes(162, 174, 'br');
    configure({
      roofs: ROW.map((b) => ({ x0: b.x, x1: b.x + b.w, y: 140 - b.h - 3 })),
      tips: [{ x: 104, y: 82, end: 140 }, { x: 250, y: 104, end: 140 }], lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })), ground0: 140, horizon: HORIZON,
    });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  open ${ROW.filter(openNow).map((b) => b.sign).join(', ') || '-'}`; },
};
