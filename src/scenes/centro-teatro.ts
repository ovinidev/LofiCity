/* CENTRO: CASA DE AMIGOS (Esperança, PB), the frontage across the wide avenue (the PB-121 through
   the centre), drawn from the owner's photo (a Street View capture, used as reference only; it is not
   in the repo). In the middle the tall cream-tiled block with two bands of dark glass, a white canopy
   over the open shop floor, red-white-blue bands on its pillars, and on top a white billboard with
   the "DECORAMA" logo (blue letters on a brown block), "CASA DE AMIGOS" under it, small brand panels
   either side, a rounded parapet and a row of floodlights. On the left: an orange house with tiled
   roofs and the "ZARB" board, the lilac building with "JM BOLOS", the red "ÓTICAS DINIZ" signs, a
   yellow sign and a grey building, a concrete pole and a street light. On the right: the white
   colonial front with red pilasters and four roll-up doors, "TUDO 10" and "LOJÃO" signs, a tall red
   sign at the edge, motorcycles parked at the far kerb, and in the foreground the corner of the near
   sidewalk with the traffic-light pole. A zebra crosses the avenue on the left, as in the photo.

   The avenue is one-way here, left to right (both lanes). A fixed-time traffic light controls the
   zebra (signal-rules.ts): a signal post at the far kerb just past the stripes, repeated on the head
   hanging from the arm of the near pole, and a pedestrian head on that pole. Vehicles stop at the
   stop line on red, and on yellow when they can stop in time; people step out only while vehicles
   have red (never in the clearance seconds) and the road by the stripes is clear.

   The photo shows no theatre sign, so none is drawn. The small brand panels on the billboard and the
   red sign at the right edge are not legible in the photo and are left without lettering. */
import { L, Lp, WW, blitLayer, getW, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  ASPH, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CNAVY, CRED, CYELL, FBLUE, FLILAC, FORNG, GOLD, LIGHT, MAGD, STEEL, STONE,
  STONEL, TERRA, TILEW, VOID, WDIM, WHITE, WOOD, SKIN1, SKIN2, SKIN3, SKIN4, HAIR1, HAIR2, HAIR3, FPINK, AMB, FWG, SIGR, HALOOK,
} from '../engine/palette';
import { type SignalState, cycleLength, pedestrianLight, pedestrianMayStart, signalAt } from '../actors/signal-rules';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import {
  brQueued, brSignalStats, setBrCrossing, setBrOneWay, setBrSignal, vehicleBetween, vehicleNearCrossing,
} from '../actors/br-traffic';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import {
  type Lamp, type Opening, bandeirolas, christmasStar, drawOpenings, isNight, lampLight, lampPool, lampPost, lampRoadPool, nightSpill, pole,
  text, textW, wire, wireCurve,
} from './br-kit';
import type { Scene } from './types';

const HORIZON = 110, STREET = 147, SH = 180 - STREET, GROUND = 140;
/** The zebra on the left of the avenue (world x), as in the photo. */
const ZEBRA0 = 70, ZEBRA1 = 96;
/** The stop line, a few px before the stripes (br-traffic's STOP_GAP), and the signal post at the far kerb. */
const STOP_X = ZEBRA0 - 3, SIG_X = ZEBRA1 + 4;
const wr = mulberry32(0xca5a);
const far = newLayer(), mid = newLayer(), front = newLayer(), near = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const LAMPS: Lamp[] = [{ x: 150, top: 70, ground: GROUND, arms: 1 }];
/** Shop fronts (drawn open or shut each frame) and the dark glass bands of the tall block. */
const shops: Opening[] = [];
const glass: Opening[] = [];
// the tall block
const B0 = 190, B1 = 295, BX = 242;

function buildFar() {
  for (let x = -4; x < WW;) { const w = 14 + ((wr() * 22) | 0), top = 72 + ((wr() * 18) | 0); L(far, x, top, w, GROUND - top, BFAR); x += w + ((wr() * 3) | 0); }
}

/** The tall block with the billboard. */
function buildBlock() {
  // rounded parapet behind the billboard
  for (let i = -13; i <= 13; i++) { const y = Math.round(34 - Math.sqrt(1 - (i / 13) ** 2) * 8); L(mid, BX + i, y, 1, 36 - y, CBEIGE); Lp(mid, BX + i, y, STONE); }
  // facade: cream tiles
  L(mid, B0, 70, B1 - B0, GROUND - 70, CBEIGE);
  for (let y = 72; y < 111; y += 4) L(mid, B0, y, B1 - B0, 1, STONEL);
  for (let x = B0 + 3; x < B1; x += 6) L(mid, x, 70, 1, 41, STONEL);
  L(mid, B0, 70, 2, GROUND - 70, STONE); L(mid, B1 - 2, 70, 2, GROUND - 70, STONE);
  // two bands of dark glass, each in two panels
  for (const [y0, y1] of [[71, 86], [91, 107]] as const) for (const [x0, x1] of [[B0 + 2, 248], [256, B1 - 2]] as const) {
    L(mid, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, STONE);
    for (let x = x0; x < x1; x += 8) glass.push({ x, y: y0, w: Math.min(7, x1 - x), h: y1 - y0, kind: 'win', rank: wr(), tv: false });
  }
  // white canopy, the open shop floor in two bays, pillars with red-white-blue bands
  L(mid, 181, 111, 122, 3, TILEW); L(mid, 181, 114, 122, 1, STONE);
  shops.push({ x: B0 + 3, y: 116, w: 248 - B0 - 3, h: GROUND - 116, kind: 'shop', rank: 0, tv: false });
  shops.push({ x: 258, y: 116, w: B1 - 261, h: GROUND - 116, kind: 'shop', rank: 0.1, tv: false });
  for (const px of [B0, 248, B1 - 3]) { L(mid, px, 114, px === 248 ? 10 : 3, GROUND - 114, CBEIGE); L(mid, px, 121, px === 248 ? 10 : 3, 3, CRED); L(mid, px, 124, px === 248 ? 10 : 3, 2, TILEW); L(mid, px, 126, px === 248 ? 10 : 3, 3, CBLUE); }
  // the billboard
  L(mid, B0 - 1, 34, B1 - B0 + 2, 37, TILEW); L(mid, B0 - 1, 34, B1 - B0 + 2, 1, STONE); L(mid, B0 - 1, 70, B1 - B0 + 2, 1, STONE);
  for (const x of [B0 + 2, B1 - 17]) for (const [y, c] of [[38, STONEL], [45, CBLUE], [52, CRED], [59, STONEL]] as const) L(mid, x, y, 14, 5, c); // small brand panels
  // floodlights on posts along the top
  for (let x = B0 + 4; x < B1; x += 13) { L(mid, x, 23, 1, 11, STEEL); L(mid, x - 1, 22, 3, 2, STONE); }
  logo(mid);
}

/** "DECORAMA" in blue letters with a brown 3D block behind, and "CASA DE AMIGOS" under it. */
function logo(ly: Uint8Array | null) {
  const w = textW('DECORAMA', 2), x = BX - (w >> 1), y = 46;
  if (ly) {
    for (let j = 0; j < 16; j++) L(ly, x - 5 + (j >> 2), y - 4 + j, w + 8, 1, WOOD); // slanted brown block
    text(ly, 'DECORAMA', x + 2, y + 2, VOID, 2);
  }
  text(ly, 'DECORAMA', x + 1, y + 1, CNAVY, 2);
  text(ly, 'DECORAMA', x, y, FBLUE, 2);
  text(ly, 'CASA DE AMIGOS', BX - (textW('CASA DE AMIGOS') >> 1), 64, CNAVY);
}

/** A shop board with lettering centred on it. */
function board(x: number, y: number, w: number, h: number, bg: number, str: string, fg: number, s = 1, ty = -1) {
  L(mid, x, y, w, h, bg); L(mid, x, y + h, w, 1, VOID);
  if (str) text(mid, str, x + ((w - textW(str, s)) >> 1), ty < 0 ? y + ((h - 5 * s) >> 1) : ty, fg, s);
}

function buildLeft() {
  // orange house with tiled roofs and the ZARB board
  L(mid, 0, 66, 57, GROUND - 66, FORNG);
  for (let x = 0; x < 58; x++) { L(mid, x, 60 + Math.round(x * 0.08), 1, 3, TERRA); if (x % 3 === 0) Lp(mid, x, 61 + Math.round(x * 0.08), WOOD); }
  for (let x = 0; x < 50; x++) { L(mid, x, 86 + Math.round(x * 0.1), 1, 3, TERRA); if (x % 3 === 1) Lp(mid, x, 87 + Math.round(x * 0.1), WOOD); }
  L(mid, 6, 72, 10, 10, WDIM); L(mid, 24, 72, 10, 10, WDIM); L(mid, 6, 76, 10, 1, TILEW); L(mid, 24, 76, 10, 1, TILEW);
  board(2, 100, 40, 15, TILEW, 'ZARB', VOID, 2);
  L(mid, 0, 115, 57, 2, STONE);
  shops.push({ x: 4, y: 118, w: 48, h: GROUND - 118, kind: 'shop', rank: 0.2, tv: false });
  // lilac building, three storeys, with JM BOLOS
  L(mid, 57, 64, 67, GROUND - 64, FLILAC); L(mid, 56, 63, 69, 2, TILEW);
  for (const x of [71, 83, 95]) { L(mid, x - 1, 74, 9, 10, TILEW); glass.push({ x, y: 75, w: 7, h: 8, kind: 'win', rank: wr(), tv: wr() < 0.3 }); }
  for (const x of [64, 108]) { L(mid, x - 1, 86, 9, 9, TILEW); glass.push({ x, y: 87, w: 7, h: 7, kind: 'win', rank: wr(), tv: false }); }
  board(76, 100, 35, 15, MAGD, 'JM BOLOS', GOLD);
  Lp(mid, 78, 102, GOLD); Lp(mid, 79, 101, GOLD); Lp(mid, 80, 102, GOLD); // the little crown over the name
  shops.push({ x: 60, y: 118, w: 50, h: GROUND - 118, kind: 'shop', rank: 0.3, tv: false });
  // grey building behind, red ÓTICAS DINIZ signs
  L(mid, 124, 70, 28, GROUND - 70, STONE); L(mid, 130, 76, 6, 8, BNEAR); L(mid, 141, 76, 6, 8, BNEAR);
  L(mid, 111, 96, 41, 20, CRED); L(mid, 111, 116, 41, 1, VOID);
  text(mid, 'OTICAS', 113, 98, TILEW); text(mid, 'DINIZ', 112, 104, TILEW, 2);
  board(128, 117, 24, 7, CRED, 'DINIZ', TILEW);
  shops.push({ x: 113, y: 125, w: 36, h: GROUND - 125, kind: 'shop', rank: 0.4, tv: false });
  // the yellow sign (not legible in the photo) and the grey building next to the tall block
  L(mid, 152, 84, 34, GROUND - 84, STONE); L(mid, 160, 90, 7, 9, BNEAR); L(mid, 172, 90, 7, 9, BNEAR);
  L(mid, 150, 110, 34, 9, CYELL); L(mid, 150, 119, 34, 1, VOID); L(mid, 153, 112, 6, 5, VOID);
  shops.push({ x: 154, y: 122, w: 26, h: GROUND - 122, kind: 'shop', rank: 0.5, tv: false });
}

function buildRight() {
  // white colonial front with red pilasters, stepped parapet, blind panels and four roll-up doors
  L(mid, 297, 98, 68, GROUND - 98, TILEW);
  for (let x = 297; x < 365; x += 4) L(mid, x, 94 + ((x >> 2) % 2) * 2, 3, 4, (x >> 2) % 3 ? TILEW : CRED);
  L(mid, 296, 100, 70, 2, CRED); L(mid, 296, 104, 70, 1, CRED);
  for (const x of [297, 319, 341, 362]) L(mid, x, 100, 3, GROUND - 100, CRED);
  for (const x of [302, 324, 346]) { L(mid, x, 107, 13, 10, CRED); L(mid, x + 1, 108, 11, 8, TILEW); }
  for (const [x, w] of [[300, 10], [310, 9], [322, 18], [344, 17]] as const) {
    L(mid, x, 120, w, GROUND - 120, TILEW);
    for (let y = 121; y < GROUND; y += 2) L(mid, x, y, w, 1, STONEL);
  }
  // TUDO 10: teal upper floor, blue sign with a yellow disc
  L(mid, 365, 88, 43, GROUND - 88, FBLUE); L(mid, 364, 87, 45, 1, TILEW);
  L(mid, 372, 94, 28, 9, STONEL); // upper sign, not legible in the photo
  board(366, 110, 42, 10, CBLUE, '', TILEW);
  text(mid, 'TUDO', 369, 112, TILEW);
  for (let j = -5; j <= 5; j++) for (let i = -6; i <= 6; i++) if ((i / 6) ** 2 + (j / 5) ** 2 <= 1) Lp(mid, 398 + i, 115 + j, CYELL);
  text(mid, '10', 395, 113, CRED);
  shops.push({ x: 369, y: 123, w: 36, h: GROUND - 123, kind: 'shop', rank: 0.15, tv: false });
  // the big grey building behind, LOJÃO
  L(mid, 408, 81, 72, GROUND - 81, BMID); for (let y = 86; y < 108; y += 6) for (let x = 412; x < 456; x += 8) L(mid, x, y, 5, 3, BNEAR);
  L(mid, 408, 98, 50, GROUND - 98, TILEW); L(mid, 408, 98, 50, 1, STONE);
  board(408, 110, 50, 11, CRED, '', TILEW);
  for (let j = -4; j <= 4; j++) for (let i = -13; i <= 13; i++) if ((i / 13) ** 2 + (j / 4) ** 2 <= 1) Lp(mid, 431 + i, 115 + j, CYELL);
  text(mid, 'LOJAO', 431 - (textW('LOJAO') >> 1), 113, CRED); Lp(mid, 436, 111, CRED); Lp(mid, 437, 112, CRED); Lp(mid, 438, 111, CRED); // the tilde of LOJÃO
  shops.push({ x: 411, y: 124, w: 44, h: GROUND - 124, kind: 'shop', rank: 0.25, tv: false });
  // the tall red sign at the right edge (its lettering is cut off in the photo)
  L(mid, 458, 44, 22, 57, CRED); L(mid, 458, 44, 1, 57, VOID);
  for (let y = 50; y < 96; y++) Lp(mid, 462 +Math.round(Math.sin(y / 8) * 3), y, TILEW);
  L(mid, 458, 101, 22, GROUND - 101, STONEL);
  shops.push({ x: 460, y: 122, w: 20, h: GROUND - 122, kind: 'shop', rank: 0.6, tv: false });
}

function buildFront() {
  L(front, 0, GROUND, WW, 7, STONE);
  for (let x = 0; x < WW; x += 8) L(front, x, GROUND + 1, 1, 5, STONEL);
  L(front, 0, 146, WW, 1, STONEL);
  for (const l of LAMPS) lampPost(front, l);
  pole(front, 165, GROUND, 74);
  // wires from the pole across to the traffic-light pole and off the frame, as in the photo
  for (const [x0, y0, x1, y1, s] of [[166, 68, 480, 40, 10], [166, 70, 480, 50, 12], [166, 72, 380, 58, 6], [0, 46, 166, 68, 6], [0, 52, 166, 70, 8], [0, 40, 480, 30, 22]] as const) wire(front, x0, y0, x1, y1, s);
  // the near sidewalk corner (bottom right) and the traffic-light pole standing on it
  for (let x = 356; x < WW; x++) { const top = 176 + (x < 372 ? Math.round(((372 - x) / 16) ** 2 * 4) : 0); if (top < 180) { L(near, x, top, 1, 180 - top, STONEL); Lp(near, x, top, TILEW); } }
  for (let x = 356; x < WW; x++) { const top = 176 + (x < 372 ? Math.round(((372 - x) / 16) ** 2 * 4) : 0); if (top < 180) L(near, x, top, 1, 1, CYELL); }
  L(near, 378, 36, 4, 144, STEEL); L(near, 381, 36, 1, 144, BMID);
  for (let i = 0; i < 64; i++) L(near, 378 - i, 36 + Math.round(i * 0.3), 1, 2, STEEL); // arm reaching over the avenue
  L(near, 305, 55, 7, 17, VOID); L(near, 305, 55, 7, 1, BMID); L(near, 307, 54, 3, 1, STEEL); // signal head hanging from the arm (repeats the post's phase)
  // the signal post at the far kerb just past the zebra: a vehicle head on top, a pedestrian head below
  L(front, SIG_X, 106, 2, GROUND - 106, STEEL); L(front, SIG_X + 1, 106, 1, GROUND - 106, BMID); L(front, SIG_X - 1, GROUND - 2, 4, 2, STONE);
  L(front, SIG_X - 2, 92, 6, 15, VOID); L(front, SIG_X - 2, 92, 6, 1, BMID);
  L(front, SIG_X + 2, 110, 4, 8, VOID);
  L(near, 318, 44, 12, 18, CGREEN); L(near, 319, 45, 10, 16, CGREEN); L(near, 318, 44, 12, 1, TILEW); // street-name sign, not legible
  L(near, 375, 118, 4, 9, VOID); // pedestrian signal box
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.08 ? STONE : ASPH;
  for (let x = 6; x < WW; x += 24) for (let i = 0; i < 12; i++) if (x + i < ZEBRA0 - 4 || x + i > ZEBRA1 + 4) street.base[14 * WW + x + i] = TILEW; // lane dashes
  for (let d = 1; d < SH; d++) for (let x = ZEBRA0; x < ZEBRA1; x++) street.base[d * WW + x] = (d + 1) % 5 < 3 ? TILEW : ASPH;
  for (let d = 1; d < SH; d++) street.base[d * WW + STOP_X] = street.base[d * WW + STOP_X + 1] = TILEW; // stop line, just ahead of a stopped front
  for (let p = 0; p < 6; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 18, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
const shopsOpen = () => S.cal.weekday !== 0 && hourIn(S.cal.hour, 8, 18);

/** Appliances and furniture on the open shop floor of the tall block. */
function shopFloor() {
  if (!shopsOpen()) return;
  for (const x of [196, 206, 216, 262, 272]) { rect(x, 128, 7, 12, TILEW); rect(x + 1, 130, 5, 1, STONEL); rect(x + 5, 133, 1, 3, STEEL); }
  rect(282, 132, 10, 5, WOOD); rect(282, 137, 1, 3, WOOD); rect(291, 137, 1, 3, WOOD); rect(228, 131, 14, 6, CBLUE); rect(228, 131, 14, 1, FBLUE);
}

/** At night the floodlights on top light up the billboard. */
function billboard() {
  if (!isNight()) return;
  for (let y = 35; y < 70; y++) for (let x = B0; x < B1; x++) if (getW(x, y) === TILEW) put(x, y, WHITE);
  for (let x = B0 + 4; x < B1; x += 13) { put(x, 22, LIGHT); put(x - 1, 22, LIGHT); put(x + 1, 22, LIGHT); }
  logo(null);
}

/** Motorcycles parked at the far kerb on the right, and a white car at the end of the row. */
function parked() {
  const cols = [VOID, CRED, STONEL, VOID, TILEW, CRED, VOID, STONE, CRED, VOID, TILEW, VOID];
  cols.forEach((c, i) => {
    const x = 330 + i * 10, y = 152;
    rect(x, y - 3, 2, 3, VOID); rect(x + 6, y - 3, 2, 3, VOID);
    rect(x + 1, y - 5, 6, 2, c); rect(x + 1, y - 6, 3, 1, VOID); put(x + 7, y - 7, STEEL); put(x + 7, y - 6, STEEL);
  });
  rect(450, 146, 30, 6, TILEW); rect(456, 142, 18, 4, TILEW); rect(457, 143, 16, 2, WDIM); rect(453, 150, 4, 3, VOID); rect(472, 150, 4, 3, VOID);
}

// ---------- people crossing on the zebra ----------
// As at Praça da Cultura: some walk the sidewalk to the kerb, wait and cross toward the viewer (off
// the bottom); others come up from the near side and walk off along the sidewalk. They step out only
// when no vehicle is on the stripes or past a stop line, and traffic stops while one waits or crosses.
type XPhase = 'approach' | 'wait' | 'cross' | 'leave';
interface Crosser { on: boolean; phase: XPhase; x: number; y: number; tx: number; dir: number; vy: number; sp: number; ph: number; wait: number; top: number; low: number; skin: number; hair: number }
const xr = mulberry32(0xce17a);
const xpick = <T>(a: readonly T[]): T => a[(xr() * a.length) | 0];
const CROSSERS: Crosser[] = Array.from({ length: 3 }, () => ({ on: false, phase: 'approach' as XPhase, x: 0, y: 0, tx: 0, dir: 1, vy: 1, sp: 10, ph: 0, wait: 0, top: TILEW, low: VOID, skin: SKIN2, hair: HAIR1 }));
const KERB = 146, FAR_KERB = 188;
let crossT = 3, crossings = 0, conflicts = 0;

// ---------- the traffic light ----------
/** Seconds into the signal cycle, advanced with the simulation. */
let sigT = 0;
const sig = (): SignalState => signalAt(sigT);
/** The slowest crosser covers the 42 px between the kerbs in under 6 s. */
const CROSS_TIME = 6;
/** People who stepped out while the light did not allow it (should stay 0; debug). */
let badStarts = 0;

/** A 3x3 lamp; lit ones glow round the head at night. */
function lamp(x: number, y: number, on: boolean, c: number) {
  rect(x, y, 3, 3, on ? c : BNEAR);
  if (!on || !isNight()) return;
  for (let j = -3; j <= 5; j++) for (let i = -3; i <= 5; i++) {
    const g = getW(x + i, y + j), d = Math.hypot(i - 1, j - 1) / 4.5;
    if (d < 1 && g !== 255 && (HALOOK[g] || g === VOID) && bay(sx(x + i), sy(y + j)) < 0.35 * (1 - d)) put(x + i, y + j, c);
  }
  rect(x, y, 3, 3, c);
}
/** Vehicle head: red, yellow, green from the top; pedestrian head: red figure over green figure. */
function vehicleHead(x: number, y: number, s: SignalState) {
  lamp(x, y, s.phase === 'red', SIGR); lamp(x, y + 5, s.phase === 'yellow', AMB); lamp(x, y + 10, s.phase === 'green', FWG);
}
function pedHead(x: number, y: number, walk: boolean) {
  rect(x, y, 2, 3, walk ? BNEAR : SIGR); rect(x, y + 3, 2, 3, walk ? FWG : BNEAR);
}
function drawSignals() {
  const s = sig(), walk = pedestrianLight(s, CROSS_TIME) === 'walk';
  vehicleHead(SIG_X - 1, 93, s); pedHead(SIG_X + 3, 111, walk);
}
function drawNearSignals() {
  const s = sig();
  vehicleHead(307, 57, s); pedHead(376, 119, pedestrianLight(s, CROSS_TIME) === 'walk');
}

function spawnCrosser() {
  const c = CROSSERS.find((o) => !o.on);
  if (!c) return;
  c.top = xpick([TILEW, CBLUE, CRED, CYELL, FPINK, CGREEN, STEEL]); c.low = xpick([VOID, BNEAR, CNAVY, STONE]);
  c.skin = xpick([SKIN1, SKIN2, SKIN3, SKIN3, SKIN4]); c.hair = xpick([HAIR1, HAIR1, HAIR2, HAIR3]);
  c.sp = 9 + xr() * 5; c.ph = xr() * 4; c.tx = ZEBRA0 + 5 + xr() * (ZEBRA1 - ZEBRA0 - 10); c.on = true;
  if (xr() < 0.55) { c.dir = xr() < 0.5 ? 1 : -1; c.x = c.dir > 0 ? -8 : WW + 8; c.y = KERB; c.vy = 1; c.phase = 'approach'; }
  else { c.x = c.tx; c.y = FAR_KERB; c.vy = -1; c.dir = xr() < 0.5 ? 1 : -1; c.phase = 'wait'; c.wait = 0.6 + xr(); }
}
/** Someone on the stripes: vehicles hold at the line until they are across, whatever the light
    (people waiting at the kerb do not stop traffic here; the light does). */
const zebraBusy = () => CROSSERS.some((c) => c.on && c.phase === 'cross');

function updateCrossers(dt: number) {
  crossT -= dt * (0.08 + 0.5 * S.busy);
  if (crossT <= 0) { crossT = 4 + xr() * 6; spawnCrosser(); }
  for (const c of CROSSERS) {
    if (!c.on) continue;
    if (c.phase === 'approach' || c.phase === 'leave') {
      const d = c.tx - c.x;
      c.x += c.dir * c.sp * dt; c.ph += dt * c.sp * 0.42;
      if (c.phase === 'approach' && d * c.dir <= 0) { c.x = c.tx; c.phase = 'wait'; c.wait = 0.6 + xr(); }
      if (c.phase === 'leave' && (c.x < -12 || c.x > WW + 12)) c.on = false;
    } else if (c.phase === 'wait') {
      c.wait -= dt;
      // step out only in the pedestrian phase (vehicles have red), and only once the road by the stripes is clear
      if (c.wait <= 0 && pedestrianMayStart(sig(), CROSS_TIME) && !vehicleNearCrossing()) c.phase = 'cross';
    } else {
      c.y += c.vy * c.sp * 0.8 * dt; c.ph += dt * c.sp * 0.42;
      if (c.vy > 0 && c.y > FAR_KERB) { c.on = false; crossings++; }
      if (c.vy < 0 && c.y <= KERB) { c.y = KERB; c.phase = 'leave'; c.tx = c.dir > 0 ? WW + 20 : -20; crossings++; }
    }
  }
}
const onRoad = () => CROSSERS.filter((c) => c.on && c.phase === 'cross' && c.y > STREET && c.y < FAR_KERB).length;

function drawCrosser(c: Crosser) {
  const X = Math.round(c.x), y = Math.round(c.y), walking = c.phase !== 'wait';
  const st = walking ? [1, 0, 1, 0][(c.ph | 0) & 3] : 0, across = c.phase === 'cross' || c.phase === 'wait';
  for (let r = 0; r < 5; r++) {
    const c2 = r === 4 ? VOID : c.low;
    if (across) { put(X - 1, y - 4 + r - (r >= 2 && st ? 1 : 0), c2); put(X + 1, y - 4 + r - (r >= 2 && !st && walking ? 1 : 0), c2); }
    else { const off = r >= 2 ? st : 0; put(X - 1 - off, y - 4 + r, c2); put(X + 1 + off, y - 4 + r, c2); }
  }
  rect(X - 1, y - 10, 3, 6, c.top); rect(X - 1, y - 14, 3, 3, c.skin); rect(X - 1, y - 15, 3, 1, c.hair);
  if (across && c.vy < 0) rect(X - 1, y - 14, 3, 2, c.hair); else if (!across) put(X - c.dir, y - 14, c.hair);
}

function update(dt: number) {
  updateAnimals(dt);
  sigT += dt;
  const before = CROSSERS.map((c) => c.on && c.phase === 'cross');
  tickSpawns(dt, S.festa || S.saoJoao ? 1.8 : 1.1); updatePeople(dt); updateCrossers(dt); updateCars(dt, 1);
  if (CROSSERS.some((c, i) => c.on && c.phase === 'cross' && !before[i]) && sig().phase !== 'red') badStarts++;
  if (onRoad() && vehicleBetween(ZEBRA0, ZEBRA1)) conflicts++;
}

const FOG = [{ y: 104, h: 9, sp: 0.5 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  drawOpenings(shops, shopsOpen()); drawOpenings(glass, false); shopFloor(); billboard();
  drawFarPrecip();
  blitLayer(front);
  for (const l of LAMPS) { lampLight(l); lampPool(l); }
  nightSpill(shops, shopsOpen()); drawSignals();
  if (S.natal) christmasStar(LAMPS[0].x + 14, LAMPS[0].top - 10, 1);
  if (S.festa || S.saoJoao) bandeirolas(166, 76, 378, 62, 10, 3);
  drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); for (const l of LAMPS) lampRoadPool(l, 158); parked(); for (const c of CROSSERS) if (c.on) drawCrosser(c); drawCars();
  blitLayer(near); drawNearSignals();
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const centroTeatro: Scene = {
  id: 'centro-teatro',
  name: 'Centro · Casa de Amigos',
  build() {
    if (!built) { buildFar(); buildLeft(); buildBlock(); buildRight(); buildFront(); buildGround(); built = true; }
    // in real rain, people without an umbrella wait under the shop canopy (well clear of the zebra)
    setLanes([{ y: 142 }, { y: 144 }, { y: 146 }], { bikes: false, shelters: [{ x0: 186, x1: 298, cap: 4 }] });
    setupAnimals({ ground: [143, 145], dogs: 2, sleepSpots: [40, 330], lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })),
      wires: [wireCurve(166, 68, 480, 40, 10), wireCurve(0, 46, 166, 68, 6)],
      walls: [{ x0: 297, x1: 364, y: 93 }, { x0: 57, x1: 124, y: 62 }] });
    setCarLanes(160, 174, 'br');
    setBrCrossing({ x0: ZEBRA0, x1: ZEBRA1, occupied: zebraBusy }); // after setCarLanes, which clears it
    setBrOneWay(1); // one-way here: left to right
    sigT = (S.ms / 1000) % cycleLength();
    setBrSignal(() => sig().phase);
    for (const c of CROSSERS) c.on = false;
    configure({ roofs: [{ x0: B0, x1: B1, y: 33 }, { x0: 297, x1: 365, y: 93 }], tips: [{ x: 181, y: 114, end: GROUND }, { x: 302, y: 114, end: GROUND }],
      lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })), ground0: GROUND, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() {
    const s = sig(), st = brSignalStats();
    return `active  people x${peopleCount()}  sinal ${s.phase} ${s.left.toFixed(0)}s pedestre ${pedestrianLight(s, CROSS_TIME) === 'walk' ? 'siga' : 'pare'}`
      + `  parados x${brQueued()} furou-vermelho ${st.redRuns} contramao ${st.wrongWay}`
      + `  faixa x${onRoad()} travessias ${crossings} conflitos ${conflicts} fora-de-fase ${badStarts}  lojas ${shopsOpen() ? 'abertas' : 'fechadas'}`;
  },
};
