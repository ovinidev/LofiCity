/* PRAÇA DA CULTURA (Praça da Cultura Francisco Souto Neto, Esperança, PB): the town's
   postcard square, drawn from Google Maps captures (Feb 2025 Street View, Feb 2020 photo) and
   the owner's own photo of the square, used as reference only. From the street, broad blue
   tiled steps (left of centre) climb a low white-tiled retaining wall with a dark green band on
   top to a red paved plaza; red steps with pale nosings rise again to the long cream-yellow
   building with white trim, coloured window panes and an outlined, arched blue central door
   under a rounded gable. Royal palms, an araucária and leafy trees, tall LED lamp posts, and on
   the right the "EU ♥ ESPERANÇA" letters (red and white, patterned) with their big red heart on
   a red base. Craft fairs fill it with white tents; in Holy Week it hosts the Paixão de Cristo;
   at Christmas the gable and roofline are outlined with lights.
   School and sports (hours are art direction, see ./praca-cultura-schedule.ts): the cream-yellow
   building is the school. On weekdays students in the public-school uniform climb the blue and red
   steps to its arched central entrance before each shift and come out of it after; the entrance
   stands open and the classroom windows are open and lit only around and during the shifts. After
   school and at weekends teenagers play a two-backpack kick-about on the left of the plaza (on
   the lower paving right of the steps in portrait, where the left is out of view) (./praca-games.ts) and two-a-side volleyball over a portable net in front of the red steps. */
import { G, L, Lget, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { hashf, mulberry32 } from '../engine/math';
import {
  BARK, BFAR, BNEAR, CBEIGE, CBLUE, CGREEN, CHURCH, CHURCHD, CNAVY, CRED, CYELL, FBLUE, FPINK, LEAFG, LEAFGD, LEDW, LIGHT, AMB,
  MAG, STEEL, STONE, STONEL, VOID, WHITE, WOOD, WWARM, TILEW, SKIN1, SKIN2, SKIN3, SKIN4, HAIR1, HAIR2, HAIR3, CORNG,
  WCOOL, UMB, MAGD,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { drawAmbient, setupAmbient, updateAmbient } from '../actors/ambient';
import { setBrCrossing, vehicleBetween, vehicleNearCrossing } from '../actors/br-traffic';
import { type Tree, drawTree, makeTree } from '../actors/trees';
import { opensUmbrella, umbrellaOpen } from '../actors/rain-rules';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import {
  type Lamp, type Opening, type Palm, bandeirolas, bulbs, casa, drawOpenings, drawPalm, easterDoy, isNight, lampLight,
  lampPool, lampPost, lampRoadPool, nightSpill, text, textW,
} from './br-kit';
import type { Scene } from './types';
import { dayKey } from './campo-matches';
import { type SportsState, noSchool, schoolState, sessionSeed, sportsState, sportsWindowAt, studentFlow } from './praca-cultura-schedule';
import { type Court, type Field, type Kid, KickSim, NET_H, VolleySim } from './praca-games';

const HORIZON = 108, STREET = 147, SH = 180 - STREET;
/** Rows of the layout: building ground, foot of the red steps, retaining-wall top, sidewalk. */
const BASE = 112, PLAZA = 119, WALL = 125, WALK = 140;
/** The building (centre BX) and the two flights of steps, which in the photo sit left of its centre. */
const BX = 250, B0 = 198, B1 = 302, BTOP = 94;
const RED0 = 156, RED1 = 250, BLUE0 = 96, BLUE1 = 248;
/** The zebra crossing on the road, in front of the right half of the blue steps (world x). */
const ZEBRA0 = 212, ZEBRA1 = 236;
const wr = mulberry32(0xc017);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
const LAMPS: Lamp[] = [{ x: 142, top: 46, ground: 124, arms: 2 }, { x: 318, top: 40, ground: 124, arms: 2 }];
const PALMS: Palm[] = [
  { x: 132, ground: 120, h: 86, lean: 2, ph: 1, imperial: true }, // royal palm left of the building
  { x: 288, ground: 116, h: 104, lean: -2, ph: 2.4, imperial: true }, // the tall one by the araucária
];
// "EU ♥ ESPERANÇA": blocky letters alternating red and white, each patterned in the other colour,
// and a big red heart, on a red tiled base standing on the retaining wall right of the blue steps
const SC = 3, SIGN = { x: 270, base: 119 }, SIGN_Y = SIGN.base - 5 * SC;
const EU = { x: SIGN.x + 2, w: textW('EU', SC) }, HEART = { x: EU.x + EU.w + 3, y: SIGN.base - 20, w: 24, h: 20 };
const ESP = { x: HEART.x + HEART.w + 3, w: textW('ESPERANÇA', SC) };
const SIGN_X1 = ESP.x + ESP.w + 3;
const letters: { ch: string; x: number }[] = [];
const heartPx: number[] = [];
let trees: Tree[] = [], opens: Opening[] = [];
/** The building's small arched windows in the central bay (live: open and lit during the shifts). */
const BAY_WINS: { x: number; y: number }[] = [];
/** The kick-about between two pairs of backpacks (lawn bed and paving, left) and the volleyball court in front of the red steps. */
const FIELD: Field = { x0: 8, x1: 92, y0: 116, y1: 124, mouth0: 118, mouth1: 122 };
/** Narrow (portrait) frames do not reach the left lawn bed: there the kick-about uses the lower paving
    right of the blue steps (between the retaining wall and the sidewalk), so both games stay in view. */
const FIELD_NARROW: Field = { x0: 258, x1: 342, y0: 128, y1: 136, mouth0: 130, mouth1: 134 };
/** The left field when the frame shows all of it (backpacks included), otherwise the narrow one. */
const fieldFor = (camX: number, W: number): Field => (camX <= FIELD.x0 - 3 && camX + W >= FIELD.x1 + 3 ? FIELD : FIELD_NARROW);
const COURT: Court = { x0: 184, net: 216, x1: 248, y0: 119, y1: 124 };
const panes: { x: number; y: number; c: number }[] = [];

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

/** Arched shape (semicircular top): into the mid layer, or onto the frame with `live`. */
function archL(x: number, y: number, w: number, h: number, c: number, live = false) {
  const r = w / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dy = j - r; if (j < r && (i + 0.5 - r) ** 2 + dy * dy > r * r) continue; if (live) put(x + i, y + j, c); else Lp(mid, x + i, y + j, c); }
}

/** The long cream-yellow building: white cornice and pilasters, windows with coloured panes, a raised
    central bay with small arched windows, the white-outlined arched blue door and a rounded gable. */
function buildBuilding() {
  L(mid, B0, BTOP, B1 - B0, BASE - BTOP, CHURCH);
  L(mid, B0 - 1, BTOP - 2, B1 - B0 + 2, 2, TILEW); L(mid, B0, BTOP, B1 - B0, 1, CHURCHD);
  L(mid, B0, BASE - 2, B1 - B0, 2, TILEW);
  for (const px of [B0, B1 - 2]) L(mid, px, BTOP, 2, BASE - BTOP, TILEW);
  // wings: two windows each, panes in blue and red (left) and yellow and red (right), white frames
  for (const [wx, a, b] of [[B0 + 7, CBLUE, CRED], [B0 + 21, CRED, CBLUE], [BX + 24, CYELL, CRED], [BX + 38, CRED, CYELL]] as const) {
    L(mid, wx - 1, BTOP + 4, 10, 11, TILEW);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) panes.push({ x: wx + i * 4, y: BTOP + 5 + j * 5, c: (i + j) % 2 ? b : a });
  }
  L(mid, B0 + 3, BASE - 9, 3, 7, CORNG); // the small side door
  // raised central bay with a rounded gable and a medallion
  const c0 = BX - 18, c1 = BX + 18, ctop = BTOP - 8;
  L(mid, c0, ctop, c1 - c0, BASE - ctop, CHURCH);
  L(mid, c0 - 1, ctop - 1, c1 - c0 + 2, 1, TILEW);
  for (const px of [c0, c1 - 2]) L(mid, px, ctop, 2, BASE - ctop, TILEW);
  for (let i = -14; i <= 14; i++) { const y = Math.round(ctop - 1 - Math.sqrt(Math.max(0, 1 - (i / 14) ** 2)) * 7); L(mid, BX + i, y, 1, ctop - y, CHURCH); Lp(mid, BX + i, y, TILEW); }
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5) Lp(mid, BX + i, ctop - 4 + j, i * i + j * j > 2 ? TILEW : CHURCHD);
  // two small arched windows each side of the door, in two rows
  for (const wx of [c0 + 4, c0 + 9, c1 - 12, c1 - 7]) for (const wy of [ctop + 3, ctop + 12]) { archL(wx - 1, wy - 1, 5, 8, TILEW); archL(wx, wy, 3, 6, BNEAR); BAY_WINS.push({ x: wx, y: wy }); }
  // the arched blue door with its white outline and a white step
  archL(BX - 7, BASE - 18, 14, 18, TILEW); archL(BX - 5, BASE - 16, 10, 16, CBLUE);
  L(mid, BX - 4, BASE - 10, 3, 1, FBLUE); L(mid, BX + 1, BASE - 10, 3, 1, FBLUE); L(mid, BX, BASE - 13, 1, 13, CNAVY);
  L(mid, BX - 9, BASE - 1, 18, 1, TILEW);
}

function buildSides() {
  opens = [
    ...casa(mid, 0, 46, 22, BASE, FBLUE, WHITE, 'reta', false, wr),
    ...casa(mid, 48, 50, 26, BASE, CBEIGE, CRED, 'frontao', false, wr),
    ...casa(mid, 436, 48, 24, BASE, TILEW, CBLUE, 'deco', false, wr),
  ];
}

function buildPlaza() {
  // red/pink block paving of the plaza, then red steps with pale nosings up to the building
  for (let y = BASE; y < WALL; y++) for (let x = 0; x < WW; x++) Lp(mid, x, y, y % 3 === 0 && x % 2 === 0 || (x + ((y / 3) | 0) * 3) % 6 === 0 ? FPINK : CRED);
  for (let k = 0; k < 4; k++) {
    const y = BASE + k * 2, x0 = RED0 - k * 2, x1 = RED1 + k;
    L(mid, x0, y, x1 - x0, 2, CRED); L(mid, x0, y, x1 - x0, 1, TILEW);
  }
  L(mid, RED0 - 8, PLAZA, RED1 - RED0 + 12, 1, BNEAR); // shadow at the foot of the steps
  // a low white-tiled wall along the upper level on the left, lawn beds edged in white tile at the corners
  L(mid, 0, BASE, RED0 - 2, 3, TILEW); for (let x = 1; x < RED0 - 2; x += 3) Lp(mid, x, BASE + 1, STONEL);
  for (const [x, w] of [[0, 84], [448, 32]] as const) { L(mid, x, BASE + 4, w, 4, LEAFG); L(mid, x, BASE + 7, w, 1, LEAFGD); L(mid, x, BASE + 8, w, 1, TILEW); }
}

function buildFront() {
  // low retaining wall in small white tiles with a dark green band on top
  L(front, 0, WALL, WW, WALK - WALL, TILEW);
  for (let y = WALL + 3; y < WALK; y += 3) for (let x = (y % 2) * 2; x < WW; x += 4) Lp(front, x, y, STONEL);
  L(front, 0, WALL, WW, 2, CGREEN); L(front, 0, WALL + 2, WW, 1, STONEL);
  // broad blue steps from the sidewalk up to the plaza, left of centre as in the photo
  for (let k = 0; k < 5; k++) {
    const y = WALL + k * 3, x0 = BLUE0 - k * 3, x1 = BLUE1 + k;
    L(front, x0, y, x1 - x0, 3, CBLUE); L(front, x0, y, x1 - x0, 1, FBLUE);
    L(front, x0 - 2, y, 2, WALK - y, TILEW); L(front, x1, y, 2, WALK - y, TILEW); // tiled cheeks
  }
  // small yellow steps at the far right corner
  for (let k = 0; k < 4; k++) { L(front, 462 - k * 3, WALL + 3 + k * 3, 18 + k * 3, 3, CYELL); L(front, 462 - k * 3, WALL + 3 + k * 3, 18 + k * 3, 1, TILEW); }
  // concrete sidewalk with a white kerb
  L(front, 0, WALK, WW, 7, STONEL);
  for (let x = 0; x < WW; x += 12) L(front, x, WALK + 1, 1, 5, STONE);
  L(front, 0, 146, WW, 1, TILEW);
  for (const l of LAMPS) lampPost(front, l);
  // the sign: red tiled base, then the letters (alternating red / white, patterned) and the heart
  L(front, SIGN.x - 2, SIGN.base, SIGN_X1 - SIGN.x + 2, WALL - SIGN.base, CRED);
  for (let x = SIGN.x - 2; x < SIGN_X1; x += 3) Lp(front, x, SIGN.base + 3, FPINK);
  L(front, SIGN.x - 2, SIGN.base, SIGN_X1 - SIGN.x + 2, 1, FPINK);
  let x = EU.x;
  for (const ch of 'EU') { letters.push({ ch, x }); x += 4 * SC; }
  x = ESP.x;
  for (const ch of 'ESPERANÇA') { letters.push({ ch, x }); x += 4 * SC; }
  letters.forEach(({ ch, x: lx }, i) => {
    const fill = i % 2 ? TILEW : CRED, dots = i % 2 ? CRED : TILEW;
    text(front, ch, lx + 1, SIGN_Y + 1, BNEAR, SC); text(front, ch, lx, SIGN_Y, fill, SC);
    for (let y = SIGN_Y; y < SIGN.base + SC; y++) for (let xx = lx; xx < lx + 3 * SC; xx++) if (Lget(front, xx, y) === fill && (xx - lx) % SC === 1 && (y - SIGN_Y) % SC === 1 && (xx + y) % 2 === 0) Lp(front, xx, y, dots);
  });
  const { x: hx, y: hy, w, h } = HEART;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = ((i + 0.5 - w / 2) / (w / 2)) * 1.15, Y = ((h * 0.42 - (j + 0.5)) / (h / 2)) * 1.3;
    if ((X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0) heartPx.push(hx + i, hy + j);
  }
  for (let k = 0; k < heartPx.length; k += 2) Lp(front, heartPx[k] + 1, heartPx[k + 1] + 1, BNEAR);
  for (let k = 0; k < heartPx.length; k += 2) Lp(front, heartPx[k], heartPx[k + 1], CRED);
  L(front, hx + 5, hy + 3, 3, 2, FPINK); // highlight
}

function buildGround() {
  // concrete road: pale slabs with joints
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = d % 11 === 0 || x % 40 === 0 ? STONE : wr() < 0.12 ? STONE : STONEL;
  // the zebra in front of the blue steps: white bars along the traffic, stacked across the road
  for (let d = 1; d < SH; d++) for (let x = ZEBRA0; x < ZEBRA1; x++) street.base[d * WW + x] = (d + 1) % 5 < 3 ? TILEW : STONE;
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
  drawOpenings(opens, hourIn(S.cal.hour, 8, 18) && S.cal.weekday !== 0);
  schoolLights();
  // Christmas: lights along the gable and roofline
  if (S.natal && n) {
    for (let x = B0; x < B1; x += 3) put(x, BTOP - 3, ((x + ((t * 3) | 0)) % 9) ? LIGHT : AMB);
    for (let i = -14; i <= 14; i += 2) put(BX + i, Math.round(BTOP - 9 - Math.sqrt(Math.max(0, 1 - (i / 14) ** 2)) * 7) - 1, LIGHT);
  }
}

/** The sign glows at night, the heart in pulsing pink neon. */
function signLights() {
  if (!isNight()) return;
  for (const { ch, x } of letters) text(null, ch, x, SIGN_Y, LEDW, SC);
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
  rect(104, 88, 1, 36, STEEL); rect(140, 88, 1, 36, STEEL); rect(104, 88, 37, 9, WHITE);
  text(null, 'ARTESANATO', 106, 90, CRED);
}

/** Holy Week: the Paixão de Cristo staged on the plaza in front of the building. */
function passion() {
  if (!paixao()) return;
  const n = isNight(), g = PLAZA + 2, X = RED0 + 46;
  rect(X - 34, g - 6, 68, 6, VOID); rect(X - 34, g - 6, 68, 1, STONEL);
  rect(X - 1, g - 34, 3, 28, WOOD); rect(X - 9, g - 28, 19, 3, WOOD);
  for (const [dx, robe] of [[-24, CRED], [-14, WHITE], [12, CBLUE], [22, WHITE]] as const) {
    rect(X + dx, g - 18, 4, 12, robe); rect(X + dx, g - 22, 4, 4, SKIN2); rect(X + dx, g - 23, 4, 2, HAIR1);
  }
  if (n) for (let y = g - 34; y < g - 6; y++) for (let x = X - 30; x < X + 30; x++) if (((x * 3 + y * 7) & 7) === 0) put(x, y, LIGHT); // stage lights
}

// ---------- the school ----------
// Hours are art direction (./praca-cultura-schedule.ts): weekday shifts 07:00-12:00 and 13:00-17:30.
let school = schoolState(1, 0);

/** The building as the school. Shift on: the classroom windows open on lit rooms (each coloured
    casement folded to one side, the bay's arched windows lit). Entrance open (first arrivals to
    last leavers): the blue door stands open on the hall, a leaf against each jamb. Otherwise the
    casements are shut on their coloured panes, the arched windows dark and the door closed as drawn
    in the mid layer. */
function schoolLights() {
  for (const p of panes) {
    if (!school.lit) { rect(p.x, p.y, 3, 4, p.c); continue; }
    rect(p.x, p.y, 3, 4, WCOOL); rect((p.x - B0) % 4 < 2 ? p.x : p.x + 2, p.y, 1, 4, p.c);
  }
  if (school.lit) for (const w of BAY_WINS) { archL(w.x, w.y, 3, 6, WCOOL, true); put(w.x + 1, w.y + 5, CHURCHD); }
  if (!school.entranceOpen) return;
  archL(BX - 5, BASE - 16, 10, 16, BNEAR, true); // the hall inside
  rect(BX - 3, BASE - 12, 6, 11, VOID); rect(BX - 3, BASE - 2, 6, 1, school.lit ? WCOOL : STONE);
  for (const x of [BX - 5, BX + 3]) { rect(x, BASE - 13, 2, 13, CBLUE); put(x < BX ? x : x + 1, BASE - 10, FBLUE); }
}

// ---------- students ----------
// On weekdays they come along the sidewalk and up the blue steps (or along the plaza from the left),
// then up the red steps to the building's arched entrance, and vanish into it; after the shift they
// come out of it and go the same ways back. These moments never overlap the games on the plaza.
// A small pool of their own, so the passer-by pool and its hourly caps are untouched.
type View = 0 | 1 | 2; // side, back (walking away up the steps), front (coming down)
interface Student { on: boolean; pts: number[]; k: number; x: number; y: number; sp: number; ph: number; dir: number; view: View; H: number; skin: number; hair: number; long: boolean; bag: number; umb: number }
const STUDENTS = 10, SIDE_Y = 144, TOP_Y = 121, DOOR_Y = BASE;
const sr = mulberry32(0x5c01a);
const spick = <T>(a: readonly T[]): T => a[(sr() * a.length) | 0];
const PUPILS: Student[] = Array.from({ length: STUDENTS }, () => ({ on: false, pts: [], k: 0, x: 0, y: 0, sp: 14, ph: 0, dir: 1, view: 0 as View, H: 15, skin: SKIN2, hair: HAIR1, long: false, bag: VOID, umb: 255 }));
let arriveT = 0, leaveT = 0, entered = 0, cameOut = 0;

function spawnStudent(arriving: boolean) {
  const s = PUPILS.find((o) => !o.on);
  if (!s) return;
  s.H = sr() < 0.4 ? 11 + ((sr() * 2) | 0) : 14 + ((sr() * 2) | 0); // fundamental kids and teenagers
  s.skin = spick([SKIN1, SKIN2, SKIN2, SKIN3, SKIN3, SKIN4]); s.hair = spick([HAIR1, HAIR1, HAIR1, HAIR2]); s.long = sr() < 0.45;
  s.bag = spick([VOID, CNAVY, CRED, CBLUE, MAGD, CGREEN]); s.sp = 13 + sr() * 5; s.ph = sr() * 4;
  s.umb = opensUmbrella(S.wxKind, S.rain, S.snow, sr()) ? spick([UMB, CNAVY, CRED, CBLUE, CYELL]) : 255;
  // up the right end of the blue steps, then the right end of the red ones, then in at the door
  const climb = 234 + sr() * 12, up = 238 + sr() * 8, door = BX + (sr() - 0.5) * 6;
  const left = G.camX - 8, right = G.camX + G.W + 8, edge = sr() < 0.5 ? left : right;
  // the way between the street and the top of the red steps, street end first
  const path = sr() < 0.3 ? [left, TOP_Y, up, TOP_Y] : [edge, SIDE_Y, climb, SIDE_Y, climb, TOP_Y, up, TOP_Y];
  path.push(up, DOOR_Y + 1);
  const back: number[] = [];
  for (let i = path.length - 2; i >= 0; i -= 2) back.push(path[i], path[i + 1]);
  s.pts = arriving ? [...path, door, DOOR_Y] : [door, DOOR_Y, ...back];
  s.k = 2; s.x = s.pts[0]; s.y = s.pts[1]; s.dir = 1; s.view = 0; s.on = true;
  if (!arriving) cameOut++;
}

function updateStudents(dt: number) {
  const f = studentFlow(S.cal.weekday, S.cal.hour, noSchool(S.cal.year, S.cal.doy));
  if (f.arrive > 0) { arriveT -= dt * f.arrive; if (arriveT <= 0) { arriveT = 0.9 + sr() * 1.2; spawnStudent(true); } }
  if (f.leave > 0) { leaveT -= dt * f.leave; if (leaveT <= 0) { leaveT = 0.7 + sr() * 1.0; spawnStudent(false); } }
  for (const s of PUPILS) {
    if (!s.on) continue;
    const tx = s.pts[s.k], ty = s.pts[s.k + 1], dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    const steep = Math.abs(dy) > Math.abs(dx), sp = s.sp * (steep ? 0.55 : 1) * dt;
    if (d <= sp) { s.x = tx; s.y = ty; s.k += 2; if (s.k >= s.pts.length) { s.on = false; if (ty === DOOR_Y) entered++; } continue; }
    s.x += (dx / d) * sp; s.y += (dy / d) * sp; s.ph += sp * 0.42;
    s.view = steep ? (dy < 0 ? 1 : 2) : 0;
    if (!steep) s.dir = dx > 0 ? 1 : -1;
  }
}

/** A student in the Esperança public-school uniform: white tee, blue trousers, backpack. */
function drawStudent(s: Student) {
  const X = Math.round(s.x), y = Math.round(s.y), H = s.H, f = s.dir, st = (s.ph | 0) & 1;
  const legL = H <= 12 ? 4 : 5, yHead = y - H + 1, yT = yHead + 4, yLeg = y - legL + 1;
  for (let r = 0; r < legL; r++) {
    const c = r === legL - 1 ? VOID : CBLUE;
    if (s.view === 0) { const o = r >= 2 ? st : 0; put(X - 1 - o, yLeg + r, c); put(X + 1 + o, yLeg + r, c); }
    else { put(X - 1, yLeg + r - (r >= 2 && st ? 1 : 0), c); put(X + 1, yLeg + r - (r >= 2 && !st ? 1 : 0), c); }
  }
  rect(X - 1, yT, 3, yLeg - yT, WHITE);
  if (s.view === 0) { put(X + (st ? f : 0), yT + 2, s.skin); rect(f > 0 ? X - 3 : X + 2, yT + 1, 2, 4, s.bag); }
  else { rect(X - 2, yT + 1, 1, 2, s.skin); rect(X + 2, yT + 1, 1, 2, s.skin); }
  if (s.view === 1) rect(X - 1, yT + 1, 3, 4, s.bag); // the backpack, seen from behind
  if (s.view === 2) { put(X - 1, yT, s.bag); put(X + 1, yT, s.bag); } // its straps
  rect(X - 1, yHead + 1, 3, 3, s.skin); rect(X - 1, yHead, 3, 1, s.hair);
  if (s.view === 1) rect(X - 1, yHead + 1, 3, 2, s.hair);
  else if (s.view === 0) put(X - f, yHead + 1, s.hair);
  if (s.long) {
    if (s.view === 0) { put(X - f, yHead + 2, s.hair); put(X - f, yHead + 3, s.hair); }
    else if (s.view === 1) rect(X - 1, yHead + 3, 3, 2, s.hair);
    else { put(X - 2, yHead + 1, s.hair); put(X + 2, yHead + 1, s.hair); }
  }
  if (s.umb !== 255 && umbrellaOpen(false, S.wxKind, S.rain, S.snow)) { rect(X - 3, yHead - 4, 7, 1, s.umb); rect(X - 4, yHead - 3, 9, 1, s.umb); for (let j = yHead - 2; j < yHead + 3; j++) put(X + 1, j, STEEL); }
}

// ---------- sports on the plaza ----------
// When they play is in ./praca-cultura-schedule.ts (weekday afternoons after school, weekend mornings
// and afternoons, daylight only, never in real rain or with the weather unknown); the games are in
// ./praca-games.ts. Real rain pauses a running game: the players wait at the back of their area.
interface Look { skin: number; hair: number; shirt: number; shorts: number; H: number }
let sports: SportsState = 'off', kick: KickSim | null = null, volley: VolleySim | null = null, sportsKey = -1;
let kickLooks: Look[] = [], volleyLooks: Look[] = [], kickField: Field = FIELD;
const SHIRTS = [CRED, CYELL, CGREEN, CORNG, FPINK, CBLUE, VOID];

function looksFor(kids: Kid[], seed: number, shirts: [number, number], shorts: [number, number]): Look[] {
  const r = mulberry32(seed);
  return kids.map((k) => ({ skin: [SKIN1, SKIN2, SKIN2, SKIN3, SKIN3, SKIN4][(r() * 6) | 0], hair: r() < 0.75 ? HAIR1 : HAIR2, shirt: shirts[k.team], shorts: shorts[k.team], H: 12 + ((r() * 3) | 0) }));
}

function updateSports(dt: number) {
  const { weekday, hour } = S.cal, win = sportsWindowAt(weekday, hour), day = dayKey(S.cal);
  sports = sportsState(weekday, hour, { kind: S.wxKind, rain: S.rain, snow: S.snow }, feira() || paixao());
  const key = sports === 'off' ? -1 : day * 4 + win;
  const field = fieldFor(G.camX, G.W);
  if (key !== sportsKey || (kick && kickField !== field)) { kick = null; volley = null; sportsKey = key; } // a rotated screen restarts the games on the field in view
  if (sports === 'off') return;
  if (!kick && sports === 'play') { // nobody turns up in the rain; a game already on just pauses
    const ks = sessionSeed(day, win, 0), vs = sessionSeed(day, win, 1);
    kick = new KickSim(field, ks); kickField = field; volley = new VolleySim(COURT, vs);
    // the kick-about: the school-uniform side against a coloured one; volleyball in two colours
    const a = vs % 7, b = (a + 1 + ((vs >>> 4) % 6)) % 7;
    kickLooks = looksFor(kick.kids, ks, [WHITE, SHIRTS[ks % 6]], [CBLUE, VOID]);
    volleyLooks = looksFor(volley.kids, vs, [SHIRTS[a], SHIRTS[b]], [VOID, CNAVY]);
  }
  kick?.step(dt, sports === 'rain'); volley?.step(dt, sports === 'rain');
}

function drawKid(p: Kid, k: Look) {
  const x = Math.round(p.x) - 1, feet = Math.round(p.y - p.jump), H = k.H, step = Math.sin(p.ph);
  const legH = Math.round(H * 0.36), bodyH = Math.round(H * 0.34), top = feet - H;
  put(x, Math.round(p.y), BNEAR); put(x + 2, Math.round(p.y), BNEAR); // shadow
  const a = Math.round(step);
  rect(x + a, feet - legH, 1, legH, k.skin); rect(x + 2 - a, feet - legH, 1, legH, k.skin);
  put(x + a, feet - 1, VOID); put(x + 2 - a, feet - 1, VOID);
  rect(x, feet - legH - 2, 3, 2, k.shorts);
  rect(x, top + 3, 3, bodyH, k.shirt);
  if (p.jump > 0.8) { put(x - 1, top + 2, k.skin); put(x + 3, top + 2, k.skin); }
  else { put(x + (step > 0 ? 3 : -1), top + 4, k.skin); put(x + (step > 0 ? -1 : 3), top + 5, k.skin); }
  rect(x, top, 3, 3, k.skin); rect(x, top, 3, 1, k.hair);
}

function drawSports() {
  if (kick) {
    const F = kickField;
    for (const [i, gx] of [F.x0, F.x1].entries()) for (const gy of [F.mouth0, F.mouth1]) { rect(gx - 1, gy - 3, 3, 3, i ? CRED : CNAVY); put(gx, gy - 3, STEEL); } // backpacks for posts
    const b = kick.ball;
    kick.kids.forEach((p, i) => drawKid(p, kickLooks[i]));
    put(b.x, b.y, BNEAR); rect(Math.round(b.x), Math.round(b.y - b.z) - 2, 2, 2, WHITE); put(Math.round(b.x) + 1, Math.round(b.y - b.z) - 1, VOID);
  }
  if (volley) {
    const C = COURT;
    for (const [cx, cy] of [[C.x0, C.y0], [C.x1, C.y0], [C.x0, C.y1], [C.x1, C.y1]]) rect(cx, cy, 2, 1, CYELL); // chinelos marking the corners
    const pl = volley.kids, order = pl.map((_, i) => i).sort((a, b) => pl[a].y - pl[b].y), mid = (C.y0 + C.y1) / 2;
    for (const i of order) if (pl[i].y < mid) drawKid(pl[i], volleyLooks[i]);
    // the portable net, slanting slightly with depth so it reads in this view: two posts, the mesh under a white tape
    const nx = (y: number) => C.net + (y - mid) * 1.2;
    for (let y = C.y0; y <= C.y1; y += 0.5) {
      const x = Math.round(nx(y)), top = Math.round(y - NET_H);
      put(x, top, WHITE); if ((x + top) % 2 === 0) { put(x, top + 1, VOID); put(x, top + 3, VOID); } else put(x, top + 2, VOID);
    }
    for (const y of [C.y0, C.y1]) rect(Math.round(nx(y)), y - NET_H - 1, 1, NET_H + 1, y === C.y1 ? STEEL : STONE);
    for (const i of order) if (pl[i].y >= mid) drawKid(pl[i], volleyLooks[i]);
    const b = volley.ball;
    put(b.x, b.y, BNEAR); rect(Math.round(b.x), Math.round(b.y - b.z) - 2, 2, 2, WHITE); put(Math.round(b.x) + 1, Math.round(b.y - b.z) - 1, CBLUE); put(Math.round(b.x), Math.round(b.y - b.z) - 2, CYELL);
  }
}

// ---------- people crossing the road on the zebra ----------
// A few pedestrians use the crossing: some walk along the sidewalk, wait at the kerb and cross toward
// the viewer (off the bottom of the frame); others come up from the near kerb and walk off along the
// sidewalk. They step out only once no vehicle is on the stripes or past a stop line; from the moment
// one waits at the kerb until they are across, the traffic stops before the crossing (br-traffic.ts).
type XPhase = 'approach' | 'wait' | 'cross' | 'leave';
interface Crosser { on: boolean; phase: XPhase; x: number; y: number; tx: number; dir: number; vy: number; sp: number; ph: number; wait: number; top: number; low: number; skin: number; hair: number; skirt: boolean; seed: number }
const xr = mulberry32(0x2eb4a);
const xpick = <T>(a: readonly T[]): T => a[(xr() * a.length) | 0];
const CROSSERS: Crosser[] = Array.from({ length: 3 }, () => ({ on: false, phase: 'approach' as XPhase, x: 0, y: 0, tx: 0, dir: 1, vy: 1, sp: 10, ph: 0, wait: 0, top: WHITE, low: VOID, skin: SKIN2, hair: HAIR1, skirt: false, seed: 0 }));
const KERB = 146, FAR_KERB = 188; // the sidewalk lane, and the near kerb just below the frame
/** Spawn counter: each crosser's fixed umbrella roll (rain-rules.ts), without drawing from xr. */
let crossSeq = 0;
let crossT = 2, crossings = 0, conflicts = 0;

function spawnCrosser() {
  const c = CROSSERS.find((o) => !o.on);
  if (!c) return;
  c.skirt = xr() < 0.4; c.top = xpick([WHITE, CBLUE, CRED, CYELL, FPINK, TILEW, CGREEN, STEEL]); c.low = c.skirt ? c.top : xpick([VOID, BNEAR, CNAVY, STONE]);
  c.skin = xpick([SKIN1, SKIN2, SKIN2, SKIN3, SKIN4]); c.hair = xpick([HAIR1, HAIR1, HAIR2, HAIR3]);
  c.sp = 9 + xr() * 5; c.ph = xr() * 4; c.tx = ZEBRA0 + 5 + xr() * (ZEBRA1 - ZEBRA0 - 10); c.on = true; c.seed = ++crossSeq;
  if (xr() < 0.55) { // along the sidewalk to the kerb, then across toward the viewer
    c.dir = xr() < 0.5 ? 1 : -1; c.x = c.dir > 0 ? G.camX - 8 : G.camX + G.W + 8; c.y = KERB; c.vy = 1; c.phase = 'approach';
  } else { // from the near kerb up to the sidewalk, then off along it
    c.x = c.tx; c.y = FAR_KERB; c.vy = -1; c.dir = xr() < 0.5 ? 1 : -1; c.phase = 'wait'; c.wait = 0.6 + xr();
  }
}

/** Someone is on the crossing, or at the kerb about to step onto it. */
const zebraBusy = () => CROSSERS.some((c) => c.on && (c.phase === 'wait' || c.phase === 'cross'));

function updateCrossers(dt: number) {
  crossT -= dt * (0.1 + 0.6 * S.busy);
  if (crossT <= 0) { crossT = 3 + xr() * 5; spawnCrosser(); }
  for (const c of CROSSERS) {
    if (!c.on) continue;
    if (c.phase === 'approach' || c.phase === 'leave') {
      const d = c.tx - c.x;
      c.x += c.dir * c.sp * dt; c.ph += dt * c.sp * 0.42;
      if (c.phase === 'approach' && d * c.dir <= 0) { c.x = c.tx; c.phase = 'wait'; c.wait = 0.6 + xr(); }
      if (c.phase === 'leave' && (c.x < G.camX - 12 || c.x > G.camX + G.W + 12)) c.on = false;
    } else if (c.phase === 'wait') {
      c.wait -= dt; // the traffic already sees them waiting and slows; they step out once it has
      if (c.wait <= 0 && !vehicleNearCrossing()) c.phase = 'cross';
    } else {
      c.y += c.vy * c.sp * 0.8 * dt; c.ph += dt * c.sp * 0.42;
      if (c.vy > 0 && c.y > FAR_KERB) { c.on = false; crossings++; }
      if (c.vy < 0 && c.y <= KERB) { c.y = KERB; c.phase = 'leave'; c.tx = c.dir > 0 ? G.camX + G.W + 20 : G.camX - 20; crossings++; }
    }
  }
}

/** Debug check: a vehicle must never be on the stripes while someone is crossing. */
const onRoad = () => CROSSERS.filter((c) => c.on && c.phase === 'cross' && c.y > STREET && c.y < FAR_KERB).length;

/** A crosser: side view along the sidewalk, front or back view on the crossing. */
function drawCrosser(c: Crosser) {
  const X = Math.round(c.x), y = Math.round(c.y), walking = c.phase !== 'wait';
  const st = walking ? [1, 0, 1, 0][(c.ph | 0) & 3] : 0, across = c.phase === 'cross' || c.phase === 'wait';
  for (let r = 0; r < 5; r++) {
    const c2 = r === 4 ? VOID : c.skirt && r >= 2 ? c.skin : c.low;
    if (across) { put(X - 1, y - 4 + r - (r >= 2 && st ? 1 : 0), c2); put(X + 1, y - 4 + r - (r >= 2 && !st && walking ? 1 : 0), c2); }
    else { const off = r >= 2 ? st : 0; put(X - 1 - off, y - 4 + r, c2); put(X + 1 + off, y - 4 + r, c2); }
  }
  rect(X - 1, y - 10, 3, c.skirt ? 8 : 6, c.top);
  rect(X - 1, y - 14, 3, 3, c.skin); rect(X - 1, y - 15, 3, 1, c.hair);
  if (across && c.vy < 0) rect(X - 1, y - 14, 3, 2, c.hair); // seen from behind, walking up toward the steps
  else if (!across) put(X - c.dir, y - 14, c.hair);
  // an umbrella only in real rain (as on the cinema front), from the crosser's fixed roll
  if (opensUmbrella(S.wxKind, S.rain, S.snow, hashf(c.seed * 7 + 9))) { rect(X - 3, y - 19, 7, 2, UMB); rect(X + 1, y - 17, 1, 6, STEEL); }
}

function update(dt: number) {
  updateAnimals(dt);
  const k = paixao() ? 5 : feira() ? 2.6 : weekendNight() ? 2.2 : S.festa || S.saoJoao ? 2 : 1.2;
  school = schoolState(S.cal.weekday, S.cal.hour, noSchool(S.cal.year, S.cal.doy)); // holidays and vacations: shut and dark
  tickSpawns(dt, k); updatePeople(dt); updateCrossers(dt); updateStudents(dt); updateSports(dt); updateCars(dt, 0.7); updateAmbient(dt);
  if (onRoad() && vehicleBetween(ZEBRA0, ZEBRA1)) conflicts++;
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
  for (const l of LAMPS) { lampLight(l); lampPool(l); }
  nightSpill(opens, hourIn(S.cal.hour, 8, 18) && S.cal.weekday !== 0);
  if (S.festa || S.saoJoao) { bandeirolas(142, 46, 318, 40, 12, 2); bulbs(0, 62, 142, 46, 6); bulbs(318, 40, 480, 62, 6); }
  drawSports(); for (const s of PUPILS) if (s.on) drawStudent(s);
  drawAnimalsPerched(); drawPeople(); drawAmbient(); drawAnimalsGround();
  drawStreet(street); for (const l of LAMPS) lampRoadPool(l, 156); for (const c of CROSSERS) if (c.on) drawCrosser(c); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const pracaCultura: Scene = {
  id: 'praca-cultura',
  name: 'Praça da Cultura',
  build() {
    if (!built) {
      buildFar(); buildSides(); buildBuilding(); araucaria(282, BASE + 2, 78); buildPlaza(); buildFront(); buildGround();
      trees = [makeTree(44, 122, 1.25, wr, 'street'), makeTree(176, 112, 0.75, wr, 'street'), makeTree(352, 120, 1.15, wr, 'street'), makeTree(398, 120, 0.85, wr, 'street')];
      built = true;
    }
    setLanes([{ y: 122 }, { y: 142 }, { y: 144 }, { y: 146 }]);
    setupAnimals({ ground: [142, 146], dogs: 2, sleepSpots: [150], lamps: LAMPS.flatMap((l) => [{ x: l.x - 13, y: l.top }, { x: l.x + 14, y: l.top }]),
      walls: [{ x0: 0, x1: BLUE0 - 16, y: WALL }, { x0: BLUE1 + 8, x1: SIGN.x - 4, y: WALL }, { x0: B0, x1: BX - 20, y: BTOP - 2 }, { x0: BX + 20, x1: B1, y: BTOP - 2 }] });
    setCarLanes(160, 174, 'br');
    setBrCrossing({ x0: ZEBRA0, x1: ZEBRA1, occupied: zebraBusy }); // after setCarLanes, which clears it for every other scene
    for (const c of CROSSERS) c.on = false;
    for (const s of PUPILS) s.on = false;
    kick = null; volley = null; sportsKey = -1;
    // on the front pavement: vendor and kid away from the zebra; pigeons on the plaza path; cat on the low wall
    setupAmbient('praca-cultura', { walk: 146, stop: 330, kid: 400, feed: { x: 150, y: 122 }, wall: { x0: 0, x1: BLUE0 - 16, y: WALL } });
    configure({ roofs: [{ x0: B0, x1: B1, y: BTOP - 2 }], tips: [{ x: B0 + 1, y: BTOP - 1, end: BASE }, { x: B1 - 1, y: BTOP - 1, end: BASE }], lamps: LAMPS.map((l) => ({ x: l.x, y: l.top })), ground0: 140, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  // Students and the teenagers playing can be tapped: they speak as students / players.
  tap(x, y) {
    for (const s of PUPILS) {
      if (!s.on || Math.abs(x - s.x) > 2.5 || y > s.y + 1 || y < s.y - s.H - 1) continue;
      return { x: s.x, y: s.y - s.H - 1, speaker: { role: 'student', track: () => (s.on ? { x: s.x, y: s.y - s.H - 1 } : null) } };
    }
    for (const [sim, looks, role] of [[kick, kickLooks, 'player'], [volley, volleyLooks, 'volley']] as const) {
      if (!sim) continue;
      for (const [i, p] of sim.kids.entries()) {
        if (Math.abs(x - p.x) > 2.5 || y > p.y + 1 || y < p.y - looks[i].H - 1) continue;
        const at = () => ({ x: p.x, y: p.y - looks[i].H - 1 });
        return { ...at(), speaker: { role, track: () => (kick === sim || volley === sim ? at() : null) } };
      }
    }
    return null;
  },
  debug() {
    const sc = school.inClass ? `aula ${school.shift ? 'tarde' : 'manhã'}` : school.entranceOpen ? 'porta aberta' : 'fechada';
    const sp = sports === 'off' ? 'off' : `${sports} bola ${kick?.score.join('x') ?? '-'} vôlei ${volley?.score.join('x') ?? '-'}`;
    return `active  people x${peopleCount()}  faixa x${onRoad()} travessias ${crossings} conflitos ${conflicts}  escola ${sc} alunos x${PUPILS.filter((s) => s.on).length} entraram ${entered} saíram ${cameOut}  esporte ${sp}  feira ${feira()}  paixão ${paixao()}`;
  },
};
