/* PRAÇA DA CULTURA (Praça da Cultura Francisco Souto Neto, Esperança, PB): the town's
   postcard square, drawn from Google Maps captures (Feb 2025 Street View, Feb 2020 photo).
   From the street, broad blue tiled steps climb a low white-tiled retaining wall (dark green
   band on top) to a raised red paved plaza; red steps rise again to the long cream building
   with red-framed windows and a rounded central gable. Coconut and royal palms, a Norfolk pine
   and leafy trees, tall LED lamp posts, and the "EU ♥ ESPERANÇA" letters with their big red
   heart on a red tiled base. Craft fairs fill it with white tents; in Holy Week it hosts the
   Paixão de Cristo; at Christmas the gable and roofline are outlined with lights. */
import { L, Lget, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  BARK, BFAR, BNEAR, CBEIGE, CBLUE, CGREEN, CHURCHL, CRED, CYELL, FBLUE, FPINK, LEAFG, LEAFGD, LEDW, LIGHT, AMB, MAG, STEEL,
  STONE, STONEL, VOID, WHITE, WOOD, WWARM, TILEW, SKIN2, HAIR1,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import {
  type Lamp, type Opening, type Palm, bandeirolas, bulbs, casa, drawOpenings, drawPalm, easterDoy, isNight, lampLight,
  lampPost, text, textW,
} from './br-kit';
import type { Scene } from './types';

const HORIZON = 108, STREET = 147, SH = 180 - STREET, CX = 240;
/** Rows of the layout: building ground, plaza paving, retaining-wall top, sidewalk. */
const BASE = 112, PLAZA = 116, WALL = 125, WALK = 140;
const wr = mulberry32(0xc017);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
const LAMPS: Lamp[] = [{ x: 150, top: 56, ground: 124, arms: 2 }, { x: 294, top: 56, ground: 124, arms: 2 }];
const PALMS: Palm[] = [
  { x: 168, ground: 118, h: 74, lean: 5, ph: 1 }, // coconut palm left of the steps
  { x: 276, ground: 116, h: 92, lean: -2, ph: 2.4, imperial: true }, // royal palms
  { x: 404, ground: 116, h: 86, lean: 2, ph: 0.7, imperial: true },
  { x: 18, ground: 122, h: 64, lean: 4, ph: 3 },
];
// "EU ♥ ESPERANÇA": blocky letters (white with a red flower pattern) and a big red heart on a red tiled base
const SIGN = { x: 306, y: 108, base: 119 }; // heart stays inside the 240-px portrait view (x 120..360)
const EU = { x: SIGN.x + 2, w: textW('EU', 2) }, HEART = { x: EU.x + EU.w + 3, y: 102, w: 19, h: 17 };
const ESP = { x: HEART.x + HEART.w + 3, w: textW('ESPERANÇA', 2) };
const heartPx: number[] = [];
let trees: Tree[] = [], opens: Opening[] = [];
const bldgWins: { x: number; y: number }[] = [];

function buildFar() {
  for (let x = -4; x < WW;) {
    const w = 14 + ((wr() * 22) | 0), top = 92 + ((wr() * 14) | 0);
    L(far, x, top, w, BASE + 2 - top, BFAR);
    for (let wy = top + 3; wy < BASE; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.14) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 3) | 0);
  }
}

/** Norfolk Island pine (araucária): straight trunk, flat tiers of branches narrowing upward. */
function araucaria(x: number, ground: number, h: number) {
  L(mid, x, ground - h, 1, h, BARK);
  for (let y = ground - h + 3, k = 0; y < ground - 14; y += 5, k++) {
    const u = (y - (ground - h)) / h, half = Math.round(2 + u * 12);
    for (let i = -half; i <= half; i++) { const droop = Math.round((i * i) / (half * half + 1) * 2); Lp(mid, x + i, y + droop, LEAFGD); if (Math.abs(i) < half - 1 && (i + k) % 3) Lp(mid, x + i, y + droop - 1, LEAFG); }
  }
  L(mid, x - 1, ground - h - 2, 3, 3, LEAFG);
}

/** The long cream building behind the square: red-framed windows in threes, white trim, rounded central gable. */
function buildBuilding() {
  const x0 = 172, x1 = 308, top = 92;
  L(mid, x0, top, x1 - x0, BASE - top, CHURCHL);
  L(mid, x0 - 1, top - 2, x1 - x0 + 2, 2, TILEW); L(mid, x0, BASE - 3, x1 - x0, 3, CRED); L(mid, x0, BASE - 4, x1 - x0, 1, TILEW);
  for (const px of [x0, x0 + 26, CX - 16, CX + 14, x1 - 28, x1 - 2]) L(mid, px, top, 2, BASE - top - 4, TILEW);
  // small pediments over the end bays
  for (const cx of [x0 + 13, x1 - 14]) for (let i = 0; i < 9; i++) { Lp(mid, cx - 8 + i, top - 3 - (i >> 1), TILEW); Lp(mid, cx + 8 - i, top - 3 - (i >> 1), TILEW); L(mid, cx - 7 + i, top - 2 - (i >> 1), 15 - i * 2, 1, CHURCHL); }
  // central bay rising into a rounded gable with a medallion
  L(mid, CX - 14, top - 10, 28, 10, CHURCHL);
  for (let i = -16; i <= 16; i++) { const y = Math.round(top - 10 - Math.sqrt(Math.max(0, 1 - (i / 16) ** 2)) * 8); L(mid, CX + i, y, 1, top - 10 - y + 1, CHURCHL); Lp(mid, CX + i, y, TILEW); }
  L(mid, CX - 16, top - 10, 32, 1, TILEW);
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 10) Lp(mid, CX + i, top - 12 + j, i * i + j * j > 4 ? TILEW : CRED);
  // arched entrance with a red frame and white columns
  for (let j = 0; j < 16; j++) for (let i = 0; i < 12; i++) { const r = 6, dy = j - r; if (j < r && (i + 0.5 - r) ** 2 + dy * dy > r * r) continue; Lp(mid, CX - 6 + i, top - 4 + j, j < 1 || i < 1 || i > 10 ? CRED : WOOD); }
  L(mid, CX - 9, top - 2, 2, 18, TILEW); L(mid, CX + 7, top - 2, 2, 18, TILEW);
  // windows in groups of three, red frames
  for (const gx of [x0 + 7, x0 + 33, CX + 20, x1 - 21]) {
    L(mid, gx - 1, top + 4, 13, 11, CRED);
    for (let k = 0; k < 3; k++) bldgWins.push({ x: gx + k * 4, y: top + 5 });
  }
}

function buildSides() {
  opens = [
    ...casa(mid, 0, 46, 22, BASE, FBLUE, WHITE, 'reta', false, wr),
    ...casa(mid, 48, 50, 26, BASE, CBEIGE, CRED, 'frontao', false, wr),
    ...casa(mid, 436, 48, 24, BASE, TILEW, CBLUE, 'deco', false, wr),
  ];
  araucaria(326, BASE, 66);
}

function buildPlaza() {
  // red/pink block paving of the raised plaza, then red steps up to the building
  for (let y = BASE; y < WALL; y++) for (let x = 0; x < WW; x++) Lp(mid, x, y, y % 3 === 0 && x % 2 === 0 || (x + ((y / 3) | 0) * 3) % 6 === 0 ? FPINK : CRED);
  for (let k = 0; k < 2; k++) { L(mid, 194 - k * 4, BASE + k * 2, 92 + k * 8, 2, CRED); L(mid, 194 - k * 4, BASE + k * 2, 92 + k * 8, 1, FPINK); }
  L(mid, 186, PLAZA, 108, 1, BNEAR); // shadow at the foot of the steps
  // lawn beds edged in white tile at the plaza's corners
  for (const [x, w] of [[0, 120], [436, 44]] as const) { L(mid, x, BASE + 1, w, 4, LEAFG); L(mid, x, BASE + 4, w, 1, LEAFGD); L(mid, x, BASE + 5, w, 1, TILEW); }
}

function buildFront() {
  // low retaining wall in small white tiles with a dark green band on top
  L(front, 0, WALL, WW, WALK - WALL, TILEW);
  for (let y = WALL + 3; y < WALK; y += 3) for (let x = (y % 2) * 2; x < WW; x += 4) Lp(front, x, y, STONEL);
  L(front, 0, WALL, WW, 2, CGREEN); L(front, 0, WALL + 2, WW, 1, STONEL);
  // broad blue steps from the sidewalk up to the plaza
  for (let k = 0; k < 5; k++) {
    const y = WALL + k * 3, x0 = 168 - k * 3, x1 = 312 + k * 3;
    L(front, x0, y, x1 - x0, 3, CBLUE); L(front, x0, y, x1 - x0, 1, FBLUE);
    L(front, x0 - 2, y, 2, WALK - y, TILEW); L(front, x1, y, 2, WALK - y, TILEW); // tiled cheeks
  }
  // concrete sidewalk with a white kerb
  L(front, 0, WALK, WW, 7, STONEL);
  for (let x = 0; x < WW; x += 12) L(front, x, WALK + 1, 1, 5, STONE);
  L(front, 0, 146, WW, 1, TILEW);
  for (const l of LAMPS) lampPost(front, l);
  // the sign: red tiled base, letters, heart
  const bx0 = SIGN.x - 2, bx1 = ESP.x + ESP.w + 3;
  L(front, bx0, SIGN.base, bx1 - bx0, WALL - SIGN.base, CRED);
  for (let x = bx0; x < bx1; x += 3) Lp(front, x, SIGN.base + 2, FPINK);
  L(front, bx0, SIGN.base, bx1 - bx0, 1, FPINK);
  for (const [s, x] of [['EU', EU.x], ['ESPERANÇA', ESP.x]] as const) {
    text(front, s, x + 1, SIGN.y + 1, BNEAR, 2); text(front, s, x, SIGN.y, TILEW, 2);
  }
  for (let y = SIGN.y; y < SIGN.base; y++) for (let x = EU.x; x < bx1; x++) if (Lget(front, x, y) === TILEW && (x * 3 + y * 5) % 7 === 0) Lp(front, x, y, CRED);
  const { x: hx, y: hy, w, h } = HEART;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = ((i + 0.5 - w / 2) / (w / 2)) * 1.15, Y = ((h * 0.42 - (j + 0.5)) / (h / 2)) * 1.3;
    if ((X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0) heartPx.push(hx + i, hy + j);
  }
  for (let k = 0; k < heartPx.length; k += 2) Lp(front, heartPx[k] + 1, heartPx[k + 1] + 1, BNEAR);
  for (let k = 0; k < heartPx.length; k += 2) Lp(front, heartPx[k], heartPx[k + 1], CRED);
  L(front, hx + 4, hy + 3, 2, 2, FPINK); // highlight
}

function buildGround() {
  // concrete road: pale slabs with joints
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = d % 11 === 0 || x % 40 === 0 ? STONE : wr() < 0.12 ? STONE : STONEL;
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 16, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- calendar ----------
const paixao = () => { const e = easterDoy(S.cal.year), d = S.cal.doy; return (d === e - 3 || d === e - 2) && hourIn(S.cal.hour, 18.5, 22); };
const feira = () => S.cal.weekday === 6 && S.cal.day <= 7 && hourIn(S.cal.hour, 8.5, 17);
const weekendNight = () => (S.cal.weekday === 5 || S.cal.weekday === 6) && hourIn(S.cal.hour, 19, 24);

// ---------- dynamic ----------
function lit() {
  const n = isNight(), t = S.ms / 1000;
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.45 ? WWARM : BFAR);
  for (const w of bldgWins) rect(w.x, w.y, 3, 9, n && (w.x * 7 + w.y) % 5 < 2 ? WWARM : BNEAR);
  drawOpenings(opens, hourIn(S.cal.hour, 8, 18) && S.cal.weekday !== 0);
  // Christmas: lights along the gable and roofline
  if (S.natal && n) {
    for (let x = 172; x < 308; x += 3) put(x, 89, ((x + ((t * 3) | 0)) % 9) ? LIGHT : AMB);
    for (let i = -16; i <= 16; i += 2) put(CX + i, Math.round(82 - Math.sqrt(Math.max(0, 1 - (i / 16) ** 2)) * 8) - 1, LIGHT);
  }
}

/** The sign glows at night, the heart in pulsing pink neon. */
function signLights() {
  if (!isNight()) return;
  text(null, 'EU', EU.x, SIGN.y, LEDW, 2); text(null, 'ESPERANÇA', ESP.x, SIGN.y, LEDW, 2);
  const c = Math.sin(S.ms / 500) > -0.7 ? MAG : CRED;
  for (let k = 0; k < heartPx.length; k += 2) put(heartPx[k], heartPx[k + 1], c);
}

/** Fairy lights wound round the tree trunks (festive nights). */
function trunkLights() {
  if (!isNight() || !(S.natal || S.festa || S.saoJoao || weekendNight())) return;
  const t = S.ms / 1000;
  for (const tr of trees) {
    const [tx, ty, tw, th] = tr.trunk;
    for (let y = ty; y < ty + th; y += 2) put(tx + (((y >> 1) & 1) ? tw - 1 : 0), y, ((y + ((t * 4) | 0)) % 6) ? AMB : LIGHT);
  }
}

function fair() {
  if (!feira()) return;
  const g = 124;
  for (const x of [8, 44, 80]) {
    for (let j = 0; j < 8; j++) { const half = Math.round(2 + j * 1.6); rect(x + 12 - half, g - 24 + j, half * 2, 1, WHITE); }
    rect(x, g - 16, 24, 2, WHITE); rect(x, g - 14, 1, 14, STEEL); rect(x + 23, g - 14, 1, 14, STEEL);
    rect(x + 3, g - 7, 18, 2, WOOD); for (let i = 0; i < 6; i++) rect(x + 4 + i * 3, g - 9, 2, 2, [CRED, CYELL, CBLUE, CGREEN, FPINK, WHITE][(i + x) % 6]);
  }
  // truss with the fair banner
  rect(112, 88, 1, 36, STEEL); rect(148, 88, 1, 36, STEEL); rect(112, 88, 37, 9, WHITE);
  text(null, 'ARTESANATO', 114, 90, CRED);
}

/** Holy Week: the Paixão de Cristo staged on the plaza in front of the building. */
function passion() {
  if (!paixao()) return;
  const n = isNight(), g = PLAZA + 2;
  rect(CX - 34, g - 6, 68, 6, VOID); rect(CX - 34, g - 6, 68, 1, STONEL);
  rect(CX - 1, g - 34, 3, 28, WOOD); rect(CX - 9, g - 28, 19, 3, WOOD);
  for (const [dx, robe] of [[-24, CRED], [-14, WHITE], [12, CBLUE], [22, WHITE]] as const) {
    rect(CX + dx, g - 18, 4, 12, robe); rect(CX + dx, g - 22, 4, 4, SKIN2); rect(CX + dx, g - 23, 4, 2, HAIR1);
  }
  if (n) for (let y = g - 34; y < g - 6; y++) for (let x = CX - 30; x < CX + 30; x++) if (((x * 3 + y * 7) & 7) === 0) put(x, y, LIGHT); // stage lights
}

function update(dt: number) {
  updateAnimals(dt);
  const k = paixao() ? 5 : feira() ? 2.6 : weekendNight() ? 2.2 : S.festa || S.saoJoao ? 2 : 1.2;
  tickSpawns(dt, k); updatePeople(dt); updateCars(dt, 0.7);
}

const FOG = [{ y: 102, h: 9, sp: 0.5 }, { y: 138, h: 6, sp: -0.4 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); lit(); drawFarPrecip();
  for (const tr of trees) drawTree(tr);
  trunkLights();
  fair(); passion();
  blitLayer(front); signLights();
  for (const p of PALMS) drawPalm(p);
  for (const l of LAMPS) lampLight(l);
  if (S.festa || S.saoJoao) { bandeirolas(150, 58, 310, 58, 12, 2); bulbs(0, 70, 150, 58, 6); bulbs(310, 58, 480, 70, 6); }
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const pracaCultura: Scene = {
  id: 'praca-cultura',
  name: 'Praça da Cultura',
  build() {
    if (!built) {
      buildFar(); buildSides(); buildBuilding(); buildPlaza(); buildFront(); buildGround();
      trees = [makeTree(118, 120, 1.05, wr, 'street'), makeTree(452, 120, 1.0, wr, 'street'), makeTree(56, 118, 0.85, wr, 'street')];
      built = true;
    }
    setLanes([{ y: 122 }, { y: 142 }, { y: 144 }, { y: 146 }]);
    setupAnimals({ ground: [142, 146], dogs: 2, sleepSpots: [150], lamps: LAMPS.flatMap((l) => [{ x: l.x - 13, y: l.top }, { x: l.x + 14, y: l.top }]),
      walls: [{ x0: 0, x1: 160, y: WALL }, { x0: 324, x1: 480, y: WALL }, { x0: 172, x1: 224, y: 90 }, { x0: 256, x1: 308, y: 90 }] });
    setCarLanes(160, 174, 'br');
    configure({ roofs: [{ x0: 172, x1: 308, y: 90 }], tips: [{ x: 173, y: 91, end: BASE }, { x: 307, y: 91, end: BASE }], lamps: LAMPS.map((l) => ({ x: l.x, y: l.top })), ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  feira ${feira()}  paixão ${paixao()}  fim de semana ${weekendNight()}`; },
};
