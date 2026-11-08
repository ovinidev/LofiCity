/* ARMAZÉM PARAÍBA (Esperança, PB), drawn from the owner's photo (a Street View capture, used as
   reference only; it is not in the repo). The orange store front seen across the road: a white banner
   with an orange swoosh, the round "ARMAZÉM PARAÍBA" logo at both ends and "FIADO SÓ AQUI" in big
   white letters; under it the open front full of goods on shelves, the black "LIQUIDANDO" sign over a
   row of white fridges behind a railing, a red banner at the corner and a concrete pole in front. On
   the right an open lot climbs to a white wall and a grey brick building; then the long orange wall
   with the logo, "PEGUE AQUI", the phone number "3222-5000" and a painted mascot; a grey modern
   building and a cream colonial front with red trim. Motorcycles are parked nose-in at the kerb and a
   silver hatchback further along; a lattice mast rises behind the banner. No zebra in the photo.

   The red banner's lettering and the small placards on the orange wall are not legible in the photo
   and are left without lettering. Opening hours are art direction, not the store's real timetable. */
import { L, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  ASPH, BARK, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CHURCHL, CORNG, CRED, CYELL, FORNG, GOLD, SKIN3, STEEL, STONE, STONEL,
  TILEW, VOID, WDIM, WOOD, LIGHT, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { type Opening, bandeirolas, drawOpenings, isNight, pole, text, textW, wire, wireCurve } from './br-kit';
import type { Scene } from './types';

const HORIZON = 112, STREET = 147, SH = 180 - STREET, GROUND = 138;
const wr = mulberry32(0xa4a2);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const shops: Opening[] = [];
const wins: Opening[] = [];
const S0 = 22, S1 = 243; // the store front

function disc(ly: Uint8Array, cx: number, cy: number, r: number, paint: (dx: number, dy: number) => number) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.6) Lp(ly, cx + dx, cy + dy, paint(dx, dy));
}

/** The round logo: orange top, dark brown bottom, a white band with "PARAIBA" in red, "ARMAZEM" above. */
function logoBadge(ly: Uint8Array, cx: number, cy: number, r: number, words: boolean) {
  disc(ly, cx, cy, r + 1, () => CRED);
  disc(ly, cx, cy, r, (_dx, dy) => (dy > 3 ? BARK : dy >= -2 ? TILEW : FORNG));
  if (!words) return;
  text(ly, 'PARAIBA', cx - (textW('PARAIBA') >> 1), cy - 1, CRED);
  text(ly, 'ARMAZEM', cx - (textW('ARMAZEM') >> 1), cy - 9, BARK);
}

function buildFar() {
  for (let x = -4; x < WW;) { const w = 16 + ((wr() * 24) | 0), top = 84 + ((wr() * 16) | 0); L(far, x, top, w, GROUND - top, BFAR); x += w + ((wr() * 3) | 0); }
  // the lattice mast behind the banner
  L(far, 193, 2, 1, 62, CRED); L(far, 199, 2, 1, 62, CRED);
  for (let y = 2; y < 64; y += 6) { for (let i = 0; i < 6; i++) { Lp(far, 194 + i, y + i, (y / 6) % 2 ? TILEW : CRED); Lp(far, 199 - i, y + i, CRED); } L(far, 193, y, 7, 1, CRED); }
}

function buildStore() {
  // grey building with cobogó panels at the far left
  L(mid, 0, 70, S0, GROUND - 70, STONEL);
  for (let y = 74; y < 120; y += 3) for (let x = 2; x < S0 - 2; x += 3) L(mid, x, y, 2, 2, BMID);
  // the banner: white with an orange swoosh, the two badges and FIADO SÓ AQUI
  L(mid, S0, 60, S1 - S0, 38, TILEW); L(mid, S0, 60, S1 - S0, 1, STONE);
  for (let x = S0; x < S1; x++) { const y = Math.round(84 + Math.sin((x - S0) / 40) * 3); L(mid, x, y, 1, 98 - y, x % 37 < 2 ? FORNG : CORNG); L(mid, x, y - 2, 1, 1, FORNG); }
  logoBadge(mid, 55, 78, 16, true); logoBadge(mid, 218, 78, 16, true);
  // white letters with a dark drop shadow, on an orange streak of the swoosh
  const msg = 'FIADO SO AQUI', mx = 136 - (textW(msg, 2) >> 1), my = 70;
  for (let x = mx - 6; x < mx + textW(msg, 2) + 6; x++) { const lift = Math.round(Math.sin((x - mx) / 30) * 1.5); L(mid, x, my - 3 + lift, 1, 16, (x + lift) % 23 < 2 ? FORNG : CORNG); }
  text(mid, msg, mx + 1, my + 1, BNEAR, 2);
  text(mid, msg, mx, my, TILEW, 2);
  Lp(mid, mx + 7 * 8 + 4, my - 2, TILEW); Lp(mid, mx + 7 * 8 + 3, my - 1, TILEW); // the accent of SÓ
  // the orange store front below the banner
  L(mid, S0, 98, S1 - S0, GROUND - 98, FORNG); L(mid, S0, 98, S1 - S0, 1, CORNG);
  L(mid, S0, GROUND - 6, S1 - S0, 6, FORNG); L(mid, S0, GROUND - 6, S1 - S0, 1, CORNG);
  shops.push({ x: 28, y: 101, w: 98, h: GROUND - 107, kind: 'shop', rank: 0, tv: false }); // shelves of goods
  shops.push({ x: 128, y: 101, w: 30, h: GROUND - 101, kind: 'shop', rank: 0.1, tv: false }); // the door
  shops.push({ x: 166, y: 112, w: 62, h: GROUND - 118, kind: 'shop', rank: 0.2, tv: false }); // fridges behind the railing
  // LIQUIDANDO: black board with a small logo
  L(mid, 170, 101, 60, 10, VOID); L(mid, 170, 111, 60, 1, BMID);
  disc(mid, 176, 106, 3, (_dx, dy) => (dy > 0 ? BARK : FORNG));
  text(mid, 'LIQUIDANDO', 182, 103, TILEW); for (let x = 182; x < 182 + textW('LIQUIDANDO'); x++) Lp(mid, x, 109, CYELL);
  // the red banner at the corner (its lettering is not legible in the photo)
  L(mid, 232, 92, 10, 40, CRED); for (let y = 96; y < 128; y += 4) L(mid, 234, y, 6, 2, TILEW);
}

function buildRight() {
  // the open lot: white wall and grey brick building behind, a driveway with a low stone wall
  L(mid, 246, 92, 52, 30, STONE); for (let y = 93; y < 121; y += 3) for (let x = 246 + ((y / 3) % 2) * 2; x < 298; x += 5) L(mid, x, y, 4, 1, BMID);
  for (let x = 262; x < 386; x++) { const top = 80 + Math.round(Math.abs(Math.sin(x / 9)) * 2); L(mid, x, top, 1, 122 - top, TILEW); }
  L(mid, 318, 92, 6, 4, BNEAR);
  for (let x = 243; x < 290; x++) { const t = 122 + Math.round((x - 243) * 0.1); L(mid, x, t, 1, GROUND - t, (x + t) % 7 ? CBEIGE : STONE); }
  for (let x = 266; x < 290; x++) L(mid, x, 124, 1, GROUND - 124, (x * 3 + 7) % 5 ? STONE : BMID); // low stone wall
  L(mid, 262, 114, 14, 5, TILEW); L(mid, 264, 112, 9, 2, TILEW); L(mid, 265, 113, 7, 1, WDIM); L(mid, 263, 119, 3, 2, VOID); L(mid, 272, 119, 3, 2, VOID); // a car far up the lot
  // the long orange wall: badge, sticker, phone number, placard, PEGUE AQUI and the mascot
  L(mid, 290, 108, 98, GROUND - 108, GOLD); L(mid, 290, 108, 98, 1, CORNG); L(mid, 290, GROUND - 3, 98, 3, CORNG);
  logoBadge(mid, 307, 123, 14, false);
  text(mid, 'PARAIBA', 307 - (textW('PARAIBA') >> 1), 122, CRED);
  L(mid, 324, 112, 16, 6, TILEW); L(mid, 325, 113, 9, 4, CRED); // the small sticker
  text(mid, '3222-5000', 334, 119, BNEAR);
  L(mid, 346, 109, 14, 8, TILEW); L(mid, 346, 109, 14, 2, CBLUE); // placard, not legible
  text(mid, 'PEGUE AQUI', 322, 128, CRED); Lp(mid, 363, 127, CRED); Lp(mid, 363, 129, CRED);
  // the mascot: a smiling man in a white shirt
  L(mid, 377, 112, 6, 5, SKIN3); L(mid, 377, 111, 6, 1, VOID); Lp(mid, 378, 114, VOID); Lp(mid, 381, 114, VOID);
  L(mid, 376, 117, 8, 8, TILEW); L(mid, 377, 125, 2, 7, CBLUE); L(mid, 381, 125, 2, 7, CBLUE); L(mid, 374, 118, 2, 5, TILEW);
  // grey modern building with a glazed balcony and a roll-up door
  L(mid, 388, 58, 34, GROUND - 58, STONE); L(mid, 388, 58, 34, 2, STONEL);
  L(mid, 392, 66, 26, 16, BMID); wins.push({ x: 394, y: 68, w: 22, h: 12, kind: 'win', rank: wr(), tv: true });
  L(mid, 392, 84, 26, 2, STONEL); L(mid, 400, 92, 10, 4, CRED);
  shops.push({ x: 392, y: 112, w: 26, h: GROUND - 112, kind: 'shop', rank: 0.9, tv: false });
  // the cream colonial front with red trim, pediment and tall windows
  L(mid, 422, 64, 58, GROUND - 64, CHURCHL); L(mid, 421, 70, 60, 3, CRED); L(mid, 421, 64, 60, 1, CRED);
  for (let i = 0; i < 10; i++) L(mid, 446 + i, 54 + (10 - i), 26 - i * 2, 1, i % 3 ? CHURCHL : CRED);
  L(mid, 454, 54, 10, 2, CRED);
  for (const x of [422, 442, 476]) L(mid, x, 73, 3, GROUND - 73, CRED);
  for (const x of [428, 452, 464]) { L(mid, x - 1, 79, 9, 22, CRED); wins.push({ x, y: 80, w: 7, h: 20, kind: 'win', rank: wr(), tv: false }); }
  L(mid, 446, 112, 14, GROUND - 112, STEEL); L(mid, 422, GROUND - 3, 58, 3, STONE);
}

function buildFront() {
  // sidewalk: brown pattern tiles, white kerb
  for (let y = GROUND; y < 146; y++) for (let x = 0; x < WW; x++) Lp(front, x, y, ((x + y * 2) % 6 < 3) !== ((x - y * 2) % 6 < 3) ? CBEIGE : STONE);
  L(front, 0, 146, WW, 1, TILEW);
  // the concrete pole in front of the store, with a blue placard; wires
  pole(front, 112, GROUND, 104); L(front, 116, 98, 4, 8, CBLUE);
  for (const [x0, y0, x1, y1, s] of [[0, 30, 113, 36, 2], [113, 36, 480, 22, 14], [113, 38, 480, 30, 16], [113, 40, 300, 0, 3], [150, 0, 480, 48, 8]] as const) wire(front, x0, y0, x1, y1, s);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.08 ? STONE : ASPH;
  for (let x = 4; x < WW; x += 26) for (let i = 0; i < 12; i++) street.base[16 * WW + x + i] = TILEW; // dashed centre line
  for (let p = 0; p < 6; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 18, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
const storeOpen = () => S.cal.weekday !== 0 && hourIn(S.cal.hour, 8, S.cal.weekday === 6 ? 13 : 18);

/** Goods on the shelves and white fridges behind the railing, when the store is open. */
function goods() {
  if (!storeOpen()) return;
  const cols = [CRED, TILEW, CBLUE, CYELL, STONEL, CGREEN, WOOD, CRED];
  for (let s = 0; s < 4; s++) { const y = 104 + s * 7; rect(30, y + 5, 94, 1, STONE); for (let x = 31; x < 123; x += 4) rect(x, y + 1, 3, 4, cols[(x * 7 + s * 3) % cols.length]); }
  for (const x of [168, 176, 184, 196, 204, 212]) { rect(x, 113, 7, GROUND - 119, TILEW); rect(x + 5, 117, 1, 4, STONE); }
  rect(166, 121, 62, 1, STEEL); rect(166, 126, 62, 1, STEEL); for (let x = 166; x < 228; x += 10) rect(x, 121, 1, 11, STEEL);
}

function parked() {
  // motorcycles nose-in at the kerb in front of the store, a blue and white scooter, the silver hatch
  for (const [x, c] of [[6, BNEAR], [22, STONEL], [40, VOID]] as const) {
    rect(x, 151, 3, 4, VOID); rect(x + 9, 151, 3, 4, VOID); rect(x + 2, 147, 9, 3, c); rect(x + 4, 145, 5, 2, VOID); rect(x + 11, 143, 1, 3, STEEL);
  }
  rect(200, 151, 2, 3, VOID); rect(207, 151, 2, 3, VOID); rect(200, 148, 9, 3, TILEW); rect(201, 147, 5, 1, CBLUE); rect(208, 144, 1, 4, STEEL);
  rect(364, 145, 46, 7, STONEL); rect(372, 140, 28, 5, STONEL); rect(374, 141, 24, 3, WDIM); rect(386, 141, 1, 3, STONEL);
  rect(368, 151, 6, 3, VOID); rect(398, 151, 6, 3, VOID); put(409, 147, isNight() ? LIGHT : TILEW);
  rect(450, 145, 30, 7, BNEAR); rect(456, 140, 24, 5, BNEAR); rect(458, 141, 22, 3, WDIM); rect(454, 151, 6, 3, VOID);
}

function update(dt: number) {
  updateAnimals(dt);
  tickSpawns(dt, S.festa || S.saoJoao ? 1.6 : 1); updatePeople(dt); updateCars(dt, 0.9);
}

const FOG = [{ y: 106, h: 8, sp: 0.5 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  drawOpenings(shops, storeOpen()); drawOpenings(wins, false); goods();
  if (isNight() && storeOpen()) for (let x = S0 + 2; x < S1; x += 4) put(x, 99, WWARM);
  drawFarPrecip();
  blitLayer(front);
  if (S.festa || S.saoJoao) bandeirolas(113, 44, 480, 30, 14, 5);
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); parked(); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const armazemParaiba: Scene = {
  id: 'armazem-paraiba',
  name: 'Armazém Paraíba',
  build() {
    if (!built) { buildFar(); buildStore(); buildRight(); buildFront(); buildGround(); built = true; }
    setLanes([{ y: 140 }, { y: 142 }, { y: 144 }], { bikes: false });
    setupAnimals({ ground: [141, 144], dogs: 2, sleepSpots: [250, 300], lamps: [],
      wires: [wireCurve(113, 36, 480, 22, 14), wireCurve(113, 38, 480, 30, 16)],
      walls: [{ x0: 292, x1: 386, y: 107 }, { x0: 0, x1: 20, y: 69 }] });
    setCarLanes(162, 175, 'br');
    configure({ roofs: [{ x0: S0, x1: S1, y: 59 }, { x0: 388, x1: 422, y: 57 }], tips: [{ x: S0 + 1, y: 99, end: GROUND }, { x: S1 - 1, y: 99, end: GROUND }],
      lamps: [], ground0: GROUND, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  loja ${storeOpen() ? 'aberta' : 'fechada'}`; },
};
