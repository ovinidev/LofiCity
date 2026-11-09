/* CINE · FACHADA (Remígio, PB): the street front of the cinema whose room is cinema-remigio.ts, on
   the Rod. Padre Ibiapina. Drawn from a Street View capture supplied by the owner (Feb 2025), used as
   reference only; it is not in the repo. A 1950s art-deco front: dark red rendered walls, a stepped
   parapet with white blocks and three bays; the white speckled centre block with a few vertical
   grooves, the raised letters "CINE" over a second line of which only "R" and "T" are legible, and a
   grey roll-up shutter at street level; either side a white tower-like bay with grooves, a small
   shade hood, two small windows and a framed film poster (tiny and illegible in the photo, so the
   posters here are generic colour blocks with no titles); a crazy-paving tile base along the lower
   wall. To the left a green and white shop with glass front whose sign reads "PLAFA..." (the rest is
   not legible and stays blank), the concrete pole with its tangle of wires and the street-light arm,
   a side street with a zebra across the road at its corner and a white building with red bands and a
   roll-up garage door; to the right low orange and cream old houses with wooden doors behind a low
   wall of cobogó blocks, and a white sedan parked at the kerb. Cobblestone sidewalk, asphalt with a
   white edge line and no centre line.

   Art direction, not facts: the road's direction is not known from the photo, so it keeps the
   default two-way side-on traffic (br-traffic.ts); the shop's hours are unknown, so its front is
   never shown open or lit; the showtimes board on the easel by the door is not in the photo. The
   cinema itself follows the same pure schedule as the room inside (cinema-rules.ts): the shutter is
   up and the foyer lit while the room is open (14:00-23:00), the board highlights the running or
   next session with the same state the screen inside shows, a small queue forms before a session
   and goes in during the pre-show, and the audience comes out when a film ends; nothing happens at
   the door while it is closed. Tapping the door goes inside (cinema-remigio) at the same moment;
   when closed it only says so. */
import { L, Lp, WW, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { hashf, mulberry32 } from '../engine/math';
import {
  ASPH, BFAR, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CHURCHL, CNAVY, CORNG, CRED, CYELL, FGREEN, FORNG, HAIR1, HAIR2, HAIR3, LIGHT,
  SIGR, SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, STONEL, TERRA, TILEW, UMB, VOID, WDIM, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { setBrCrossing, vehicleBetween, vehicleNearCrossing } from '../actors/br-traffic';
import { opensUmbrella } from '../actors/rain-rules';
import { S } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { type Lamp, bandeirolas, christmasStar, isNight, lampArm, lampLight, lampPool, lampRoadPool, pole, text, warmPool, wire, wireCurve } from './br-kit';
import { PRESHOW_MIN, QUEUE_MAX, boardAt, doorTap, exitsAt, queueAt, sessionAt } from './cinema-rules';
import type { Scene } from './types';

const HORIZON = 110, GROUND = 140, STREET = 147, SH = 180 - STREET;
const wr = mulberry32(0xc17e);
const far = newLayer(), mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
/** The street light on the concrete pole between the shop and the cinema. */
const LAMP: Lamp = { x: 162, top: 32, ground: GROUND, arms: 1 };
/** The cinema front and its bays (world x). */
const C0 = 172, C1 = 328, BL = 190, BR = 286, BAY_W = 24, CX0 = 226, CX1 = 274;
/** The roll-up door in the centre block. */
const D0 = 236, D1 = 264, DTOP = 96, DX = (D0 + D1) >> 1;
/** The side street on the left and the zebra across the road at its corner. */
const SIDE0 = 96, SIDE1 = 124, ZEBRA0 = 99, ZEBRA1 = 121;
/** The showtimes board on its easel, right of the door. */
const BX = 276, BY = 106, BW = 48, BH = 28;
/** Low wall of cobogó blocks in front of the orange house. */
const WALL0 = 330, WALL1 = 400, WALLTOP = 123;

// ---------- static layers ----------
function buildFar() {
  for (let x = -4; x < WW;) { const w = 14 + ((wr() * 24) | 0), top = 80 + ((wr() * 18) | 0); L(far, x, top, w, GROUND - top, BFAR); x += w + ((wr() * 3) | 0); }
  L(far, 334, 86, 64, 16, STONEL); L(far, 334, 86, 64, 1, STONE); // the pale building behind the orange house
}

function buildLeft() {
  // white building with red bands and a roll-up garage door (far left, across the side street)
  L(mid, 0, 66, SIDE0, GROUND - 66, TILEW); L(mid, 0, 66, SIDE0, 4, CRED); L(mid, 0, 70, SIDE0, 1, HAIR3);
  L(mid, 0, 100, SIDE0, 3, CRED); L(mid, 40, 120, SIDE0 - 40, 3, CRED);
  for (const x of [12, 34, 56, 76]) { L(mid, x - 1, 77, 12, 13, STONE); L(mid, x, 78, 10, 11, WDIM); L(mid, x, 83, 10, 1, STONEL); }
  L(mid, 4, 106, 32, GROUND - 106, BMID); for (let y = 107; y < GROUND; y += 2) L(mid, 4, y, 32, 1, STONE);
  L(mid, 3, 105, 34, 1, STONEL);
  L(mid, SIDE0 - 2, 66, 2, GROUND - 66, STONEL);
  // the side street running away between the buildings
  for (let y = 112; y < GROUND; y++) {
    const t = (y - 112) / (GROUND - 112), half = Math.round(8 + 6 * t), cx = Math.round(110 - 2 * (1 - t));
    L(mid, SIDE0, y, SIDE1 - SIDE0, 1, y < 118 ? BFAR : STONE);
    L(mid, cx - half, y, half * 2, 1, ASPH);
    if (y > 118) { Lp(mid, cx - half - 1, y, STONEL); Lp(mid, cx + half, y, STONEL); } // kerbs of the side street
  }
  // the green and white shop: pale green front, darker green column, white sign, glass front, green base
  L(mid, SIDE1, 60, 160 - SIDE1, GROUND - 60, FGREEN); L(mid, 148, 60, 12, 44, CGREEN); L(mid, SIDE1, 60, 160 - SIDE1, 1, TILEW);
  L(mid, 160, 64, C0 - 160, GROUND - 64, TILEW);
  L(mid, 126, 88, 32, 14, TILEW); L(mid, 126, 102, 32, 1, STONE);
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 10) Lp(mid, 131 + i, 95 + j, CGREEN); // round logo
  L(mid, 130, 93, 1, 5, TILEW); L(mid, 131, 93, 2, 1, TILEW); L(mid, 132, 94, 1, 1, TILEW); L(mid, 131, 95, 2, 1, TILEW);
  text(mid, 'PLAFA', 136, 91, CGREEN); // the rest of the name is not legible in the photo
  L(mid, 136, 98, 18, 1, STONEL); // the small line under it, not legible either
  L(mid, 127, 105, 30, 27, TILEW);
  L(mid, 129, 107, 12, 24, BNEAR); L(mid, 143, 107, 12, 24, BNEAR); // glass door and window
  for (const x of [130, 144]) { L(mid, x + 1, 108, 1, 6, WDIM); L(mid, x + 3, 108, 1, 3, WDIM); }
  L(mid, 129, 118, 12, 1, STEEL);
  L(mid, SIDE1, 132, C0 - SIDE1, GROUND - 132, CGREEN); for (let x = SIDE1 + 1; x < C0; x += 3) Lp(mid, x, 134 + (x % 2), TILEW);
}

/** Crazy-paving tiles: white joints between irregular red stones (nearest of jittered points). */
function mosaic(x0: number, x1: number, y0: number, y1: number) {
  const cell = 5, pts: { x: number; y: number }[] = [];
  for (let gy = y0 - cell; gy < y1 + cell; gy += cell) for (let gx = x0 - cell; gx < x1 + cell; gx += cell) pts.push({ x: gx + wr() * cell, y: gy + wr() * cell });
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let a = 1e9, b = 1e9;
    for (const p of pts) { if (Math.abs(p.x - x) > 12 || Math.abs(p.y - y) > 12) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < a) { b = a; a = d; } else if (d < b) b = d; }
    Lp(mid, x, y, b - a < 0.7 ? TILEW : CRED);
  }
}

function buildCinema() {
  // stepped parapet: outer walls, side bays, pilasters, centre block (white caps on every step)
  const cols: [number, number, number, number][] = [
    [C0, BL, 52, CRED], [BL, BL + BAY_W, 46, TILEW], [BL + BAY_W, CX0, 43, CRED], [CX0, CX1, 38, TILEW],
    [CX1, BR, 43, CRED], [BR, BR + BAY_W, 46, TILEW], [BR + BAY_W, C1, 49, CRED],
  ];
  for (const [x0, x1, top, c] of cols) {
    L(mid, x0, top, x1 - x0, GROUND - top, c);
    L(mid, x0, top, x1 - x0, 2, TILEW); L(mid, x0, top + 2, x1 - x0, 1, c === CRED ? HAIR3 : STONEL);
  }
  L(mid, 234, 34, 32, 4, TILEW); L(mid, 234, 34, 32, 1, STONEL); // the raised block on top of the centre
  // speckled stucco on the white parts
  for (let y = 34; y < GROUND; y++) for (let x = C0; x < C1; x++) if (hashf(x * 977 + y * 131) < 0.07) {
    const inWhite = (x >= BL && x < BL + BAY_W && y > 48) || (x >= BR && x < BR + BAY_W && y > 48) || (x >= CX0 && x < CX1 && y > 40);
    if (inWhite) Lp(mid, x, y, STONEL);
  }
  // side bays: three grooves, a shade hood, two small windows, the framed poster
  for (const bx of [BL, BR]) {
    for (const y of [56, 59, 62]) L(mid, bx + 5, y, BAY_W - 10, 1, STONE);
    L(mid, bx - 2, 69, BAY_W + 4, 2, TILEW); L(mid, bx - 2, 71, BAY_W + 4, 1, STONE); L(mid, bx, 72, BAY_W, 1, STONEL);
    for (const wx of [bx + 3, bx + 15]) { L(mid, wx - 1, 75, 8, 7, STONE); L(mid, wx, 76, 6, 5, BNEAR); L(mid, wx, 78, 6, 1, STEEL); }
    L(mid, bx + 11, 84, 2, 1, STEEL); // the little poster lamp bracket
    poster(bx + 6, 86, bx === BL);
  }
  // centre: vertical grooves, ledge, raised letters, the shutter frame
  for (const x of [246, 250, 254]) L(mid, x, 42, 1, 18, STONE);
  L(mid, CX0 + 2, 62, CX1 - CX0 - 4, 2, TILEW); L(mid, CX0 + 2, 64, CX1 - CX0 - 4, 1, STONE); L(mid, CX0 + 4, 65, CX1 - CX0 - 8, 1, STONEL);
  letters(mid);
  L(mid, D0 - 2, DTOP - 2, D1 - D0 + 4, GROUND - DTOP + 2, STONEL); L(mid, D0 - 2, DTOP - 2, D1 - D0 + 4, 1, STONE);
  // the crazy-paving base and the plain red plinth under it
  mosaic(C0, D0 - 2, 116, 134); mosaic(D1 + 2, C1, 116, 134);
  L(mid, C0, 134, D0 - 2 - C0, GROUND - 134, CRED); L(mid, D1 + 2, 134, C1 - D1 - 2, GROUND - 134, CRED);
  L(mid, C0, 134, D0 - 2 - C0, 1, HAIR3); L(mid, D1 + 2, 134, C1 - D1 - 2, 1, HAIR3);
  L(mid, C1 - 1, 49, 1, GROUND - 49, HAIR3); L(mid, C0, 52, 1, GROUND - 52, HAIR3);
  L(mid, C1 - 4, 60, 1, GROUND - 60, STONE); // the drainpipe down the right corner
}

/** "CINE" in raised grey letters; the second line shows only "R" and "T" (the rest is not legible). */
function letters(ly: Uint8Array | null, c = STEEL) {
  const word = (dx: number, dy: number, col: number) => {
    text(ly, 'CI', 235 + dx, 70 + dy, col, 2); letterN(ly, 251 + dx, 70 + dy, col); text(ly, 'E', 259 + dx, 70 + dy, col, 2);
    text(ly, 'R', 243 + dx, 84 + dy, col, 2); text(ly, 'T', 251 + dx, 84 + dy, col, 2);
  };
  if (ly) word(1, 1, STONE);
  word(0, 0, c);
}
/** A clearer N than the 3x5 font's at this size: two stems and a diagonal, 6x10. */
function letterN(ly: Uint8Array | null, x: number, y: number, c: number) {
  const px = (i: number, j: number, w: number, h: number) => (ly ? L(ly, x + i, y + j, w, h, c) : rect(x + i, y + j, w, h, c));
  px(0, 0, 2, 10); px(4, 0, 2, 10);
  for (let k = 0; k < 6; k++) px(k < 3 ? 2 : 3, 2 + k, 1, 1);
}

/** A generic film poster in a frame: colour blocks, a figure, no title. */
function poster(x: number, y: number, blue: boolean) {
  L(mid, x - 1, y - 1, 14, 20, STEEL);
  L(mid, x, y, 12, 18, blue ? CNAVY : CRED);
  for (let j = 0; j < 8; j++) L(mid, x, y + 10 + j, 12, 1, j % 3 ? (blue ? CBLUE : CORNG) : blue ? CNAVY : CRED);
  L(mid, x + 4, y + 4, 4, 3, blue ? STONEL : CYELL); L(mid, x + 3, y + 7, 6, 7, blue ? CBLUE : BNEAR); L(mid, x + 4, y + 14, 1, 3, BNEAR); L(mid, x + 7, y + 14, 1, 3, BNEAR);
  L(mid, x + 2, y + 1, 8, 1, TILEW);
}

function buildRight() {
  // the low orange house: tile edge, two wooden doors, the cobogó wall in front
  L(mid, C1, 98, 402 - C1, GROUND - 98, FORNG); L(mid, C1, 96, 402 - C1, 2, TERRA); L(mid, C1, 98, 402 - C1, 1, CORNG);
  for (const x of [344, 380]) { L(mid, x - 1, 105, 11, GROUND - 105, CBEIGE); L(mid, x, 106, 9, GROUND - 106, WOOD); L(mid, x + 1, 108, 3, 4, BNEAR); L(mid, x + 5, 108, 3, 4, BNEAR); }
  L(mid, WALL0, WALLTOP, WALL1 - WALL0, GROUND - WALLTOP, CBEIGE); L(mid, WALL0, WALLTOP, WALL1 - WALL0, 1, TILEW);
  for (const x of [336, 356, 376]) { L(mid, x, 126, 14, 7, STONEL); for (let i = 0; i < 3; i++) { L(mid, x + 1 + i * 5, 127, 3, 2, CRED); L(mid, x + 1 + i * 5, 130, 3, 2, CRED); } }
  for (const x of [352, 372, 392]) L(mid, x, WALLTOP - 2, 3, 2, CBEIGE); // posts on top of the wall
  // the weathered cream house with a barred window
  L(mid, 402, 84, WW - 402, GROUND - 84, CHURCHL); L(mid, 402, 82, WW - 402, 2, STONEL); L(mid, 402, 88, WW - 402, 1, STONE);
  for (let y = 84; y < GROUND; y++) for (let x = 402; x < WW; x++) if (hashf(x * 313 + y * 71) < 0.05) Lp(mid, x, y, STONEL);
  L(mid, 428, 98, 16, 20, STONE); L(mid, 429, 99, 14, 18, BNEAR); for (let x = 431; x < 443; x += 3) L(mid, x, 99, 1, 18, STEEL);
  L(mid, 458, 104, 12, GROUND - 104, WOOD); L(mid, 458, 104, 12, 1, STONE);
  L(mid, 402, 84, 1, GROUND - 84, STONE);
}

function buildFront() {
  // cobblestone sidewalk with a kerb, broken by the side street on the left
  for (let y = GROUND; y < 146; y++) for (let x = 0; x < WW; x++) {
    if (x >= SIDE0 && x < SIDE1) { Lp(front, x, y, ASPH); continue; }
    const row = y - GROUND, off = row % 2 ? 2 : 0;
    Lp(front, x, y, (x + off) % 4 === 0 || (row === 2 && x % 3 === 0) ? STONE : STONEL);
  }
  L(front, 0, 146, SIDE0, 1, TILEW); L(front, SIDE1, 146, WW - SIDE1, 1, TILEW);
  // the pole with its coil of cables, the street-light arm and the tangle of wires
  pole(front, LAMP.x, GROUND, 108); lampArm(front, LAMP);
  for (const [cy, r] of [[50, 3], [55, 4], [61, 3]] as const) for (let a = 0; a < 6.28; a += 0.3) Lp(front, Math.round(LAMP.x + 1 + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.7), VOID);
  L(front, LAMP.x - 3, 70, 3, 6, BMID); // a small box on the pole
  for (const [x0, y0, x1, y1, s] of WIRES) wire(front, x0, y0, x1, y1, s);
}
const WIRES: [number, number, number, number, number][] = [
  [0, 18, LAMP.x, 36, 6], [0, 28, LAMP.x, 40, 4], [40, 70, LAMP.x, 44, 3],
  [LAMP.x, 36, WW, 28, 8], [LAMP.x, 39, WW, 40, 12], [LAMP.x, 42, WW, 54, 7], [LAMP.x, 44, 330, 96, 4], [LAMP.x + 30, 0, WW, 46, 6],
];

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.08 ? STONE : ASPH;
  for (let x = 0; x < WW; x++) if (x < ZEBRA0 - 3 || x > ZEBRA1 + 3) street.base[2 * WW + x] = TILEW; // the white edge line (no centre line in the photo)
  for (let d = 1; d < SH; d++) for (let x = ZEBRA0; x < ZEBRA1; x++) street.base[d * WW + x] = (d + 1) % 5 < 3 ? TILEW : ASPH;
  for (let p = 0; p < 5; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 5), rx = 8 + wr() * 16, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
const hour = () => S.cal.hour;
const isOpen = () => sessionAt(hour()).phase !== 'closed';

/** The door: shutter down when closed; rolled up over a lit foyer (ticket window, poster) when open. */
function door() {
  const n = isNight();
  if (!isOpen()) {
    rect(D0, DTOP, D1 - D0, GROUND - DTOP, STONEL);
    for (let y = DTOP + 1; y < GROUND; y += 2) rect(D0, y, D1 - D0, 1, STONE);
    rect(D0, GROUND - 2, D1 - D0, 2, STEEL);
    return;
  }
  rect(D0, DTOP, D1 - D0, GROUND - DTOP, n ? WWARM : CBEIGE);
  rect(D0, GROUND - 8, D1 - D0, 8, n ? CORNG : STONE); // floor
  rect(D0 + 3, DTOP + 10, 10, 12, VOID); rect(D0 + 4, DTOP + 11, 8, 6, n ? LIGHT : WDIM); rect(D0 + 3, DTOP + 22, 10, 10, WOOD); // ticket window
  rect(D0 + 17, DTOP + 9, 8, 12, CRED); rect(D0 + 18, DTOP + 10, 6, 5, CYELL); rect(D0 + 19, DTOP + 15, 4, 5, BNEAR); // a poster inside
  rect(D0 - 1, DTOP - 1, D1 - D0 + 2, 4, STEEL); rect(D0 - 1, DTOP + 2, D1 - D0 + 2, 1, STONE); // the rolled-up shutter
  if (n) warmPool(DX, GROUND + 3, 22, 5, 0.6);
}

/** At night, while open: the letters and the two poster lamps light up. */
function signLights() {
  if (!isNight() || !isOpen()) return;
  letters(null, LIGHT);
  for (const bx of [BL, BR]) { put(bx + 11, 85, LIGHT); put(bx + 12, 85, LIGHT); warmPool(bx + 12, 94, 9, 10, 0.4); }
  warmPool(250, 80, 22, 13, 0.25);
}

/** Text in the board's 3x5 font, with the tilde of Ã drawn by hand. */
function boardText(str: string, x: number, y: number, c: number) {
  for (const ch of str) {
    if (ch === 'Ã') { text(null, 'A', x, y, c); put(x, y - 1, c); put(x + 1, y - 2, c); put(x + 2, y - 1, c); }
    else text(null, ch, x, y, c);
    x += 4;
  }
}

/** The showtimes board: the four session times and a status line, from the same schedule as the room. */
function board() {
  const b = boardAt(hour()), n = isNight(), t = S.ms / 1000;
  rect(BX + 3, BY + BH, 1, GROUND + 1 - BY - BH, WOOD); rect(BX + BW - 4, BY + BH, 1, GROUND + 1 - BY - BH, WOOD); // easel legs
  rect(BX - 1, BY - 1, BW + 2, BH + 2, WOOD); rect(BX, BY, BW, BH, VOID);
  b.rows.forEach((r, i) => {
    const x = BX + 4 + (i % 2) * 22, y = BY + 3 + Math.floor(i / 2) * 7;
    const lit = r.state === 'now' && (b.phase === 'film' || Math.sin(t * 4) > -0.3);
    const c = r.state === 'now' ? (n ? LIGHT : CYELL) : r.state === 'next' ? WHITE : r.state === 'done' ? BMID : STONE;
    if (r.state === 'now') rect(x - 2, y + 1, 1, 3, lit ? c : STONE);
    if (r.state !== 'now' || lit) boardText(r.label, x, y, c);
    else boardText(r.label, x, y, STONE);
  });
  rect(BX + 2, BY + 16, BW - 4, 1, BMID);
  const sc = b.phase === 'film' ? (n ? SIGR : CRED) : b.phase === 'preshow' ? (n ? LIGHT : CYELL) : STONE;
  boardText(b.status, BX + ((BW - (b.status.length * 4 - 1)) >> 1), BY + 20, sc);
  if (n && b.phase !== 'closed') { rect(BX + (BW >> 1) - 2, BY - 3, 5, 2, STEEL); put(BX + (BW >> 1), BY - 1, LIGHT); warmPool(BX + (BW >> 1), BY + 8, 26, 10, 0.18); }
}

// ---------- the crowd at the door (counts from cinema-rules.ts) ----------
const SKINS = [SKIN1, SKIN2, SKIN2, SKIN3, SKIN4], HAIRS = [HAIR1, HAIR1, HAIR2, HAIR3];
const TOPS = [TILEW, CBLUE, CRED, CYELL, CGREEN, STEEL, CORNG, CNAVY], LOWS = [VOID, BNEAR, CNAVY, STONE];
const pickH = <T>(a: readonly T[], seed: number) => a[Math.floor(hashf(seed) * a.length)];

/** A small side-view person (same scale as the pedestrians), with an umbrella only in real rain. */
function figure(x: number, y: number, dir: number, seed: number, walking: boolean, ph: number) {
  const X = Math.round(x), st = walking ? [1, 0, 1, 0][(ph | 0) & 3] : 0, low = pickH(LOWS, seed + 3);
  for (let r = 0; r < 5; r++) { const c = r === 4 ? VOID : low, off = r >= 2 ? st : 0; put(X - 1 - off, y - 4 + r, c); put(X + 1 + off, y - 4 + r, c); }
  rect(X - 1, y - 10, 3, 6, pickH(TOPS, seed + 1)); rect(X - 1, y - 14, 3, 3, pickH(SKINS, seed + 2));
  rect(X - 1, y - 15, 3, 1, pickH(HAIRS, seed + 4)); put(X - dir, y - 14, pickH(HAIRS, seed + 4));
  if (opensUmbrella(S.wxKind, S.rain, S.snow, hashf(seed + 9))) { rect(X - 3, y - 19, 7, 2, UMB); put(X, y - 20, UMB); rect(X + dir, y - 17, 1, 6, STEEL); }
}

interface Spot { x: number; y: number; seed: number; role: 'visitor' | 'attendee' }
let spots: Spot[] = [];

/** The queue left of the door and the audience coming out after a film. Fixed seeds per session, so a
    moment always shows the same people. */
function crowd() {
  spots = [];
  const h = hour(), s = sessionAt(h), day = Math.floor(S.ms / 86_400_000), seedBase = day * 64 + Math.max(0, s.block) * 8;
  const n = queueAt(h);
  if (n > 0) {
    // during the pre-show the front person walks in as the queue shrinks
    let frac = 0;
    if (s.phase === 'preshow') { const q = QUEUE_MAX * (1 - s.sec / (PRESHOW_MIN * 60)); frac = Math.max(0, n - q); }
    for (let k = n - 1; k >= 0; k--) {
      const x = 232 - k * 7 + (k === 0 ? frac * 16 : 0), seed = seedBase + k + (s.phase === 'preshow' ? QUEUE_MAX - n : 0);
      if (x >= D0 + 8) continue; // inside
      figure(x, 141, 1, seed, k === 0 && frac > 0.05, S.ms / 120);
      spots.push({ x, y: 141, seed, role: 'visitor' });
    }
  }
  exitsAt(h).forEach((sec, k) => {
    const dir = k % 2 ? 1 : -1, x = DX + dir * Math.min(sec, 300) * 11, seed = seedBase + 40 + k;
    if (x < -10 || x > WW + 10) return;
    figure(x, 143, dir, seed, true, sec * 4.6);
    spots.push({ x, y: 143, seed, role: 'attendee' });
  });
}

// ---------- people crossing on the zebra (no signal: they wait for a gap, traffic yields) ----------
type XPhase = 'approach' | 'wait' | 'cross' | 'leave';
interface Crosser { on: boolean; phase: XPhase; x: number; y: number; tx: number; dir: number; vy: number; sp: number; ph: number; wait: number; seed: number }
const xr = mulberry32(0xc1e2);
const CROSSERS: Crosser[] = Array.from({ length: 2 }, () => ({ on: false, phase: 'approach' as XPhase, x: 0, y: 0, tx: 0, dir: 1, vy: 1, sp: 10, ph: 0, wait: 0, seed: 0 }));
const KERB = 146, FAR_KERB = 188;
let crossT = 3, crossings = 0, conflicts = 0;

function spawnCrosser() {
  const c = CROSSERS.find((o) => !o.on);
  if (!c) return;
  c.seed = (xr() * 1e6) | 0; c.sp = 9 + xr() * 5; c.ph = xr() * 4; c.tx = ZEBRA0 + 4 + xr() * (ZEBRA1 - ZEBRA0 - 8); c.on = true;
  if (xr() < 0.55) { c.dir = xr() < 0.5 ? 1 : -1; c.x = c.dir > 0 ? -8 : WW + 8; c.y = KERB; c.vy = 1; c.phase = 'approach'; }
  else { c.x = c.tx; c.y = FAR_KERB; c.vy = -1; c.dir = xr() < 0.5 ? 1 : -1; c.phase = 'wait'; c.wait = 0.6 + xr(); }
}
/** Someone on the crossing, or at the kerb about to step onto it: traffic holds at the line. */
const zebraBusy = () => CROSSERS.some((c) => c.on && (c.phase === 'wait' || c.phase === 'cross'));

function updateCrossers(dt: number) {
  crossT -= dt * (0.05 + 0.4 * S.busy);
  if (crossT <= 0) { crossT = 5 + xr() * 7; spawnCrosser(); }
  for (const c of CROSSERS) {
    if (!c.on) continue;
    if (c.phase === 'approach' || c.phase === 'leave') {
      const d = c.tx - c.x;
      c.x += c.dir * c.sp * dt; c.ph += dt * c.sp * 0.42;
      if (c.phase === 'approach' && d * c.dir <= 0) { c.x = c.tx; c.phase = 'wait'; c.wait = 0.6 + xr(); }
      if (c.phase === 'leave' && (c.x < -12 || c.x > WW + 12)) c.on = false;
    } else if (c.phase === 'wait') {
      c.wait -= dt;
      if (c.wait <= 0 && !vehicleNearCrossing()) c.phase = 'cross';
    } else {
      c.y += c.vy * c.sp * 0.8 * dt; c.ph += dt * c.sp * 0.42;
      if (c.vy > 0 && c.y > FAR_KERB) { c.on = false; crossings++; }
      if (c.vy < 0 && c.y <= KERB) { c.y = KERB; c.phase = 'leave'; c.tx = c.dir > 0 ? WW + 20 : -20; crossings++; }
    }
  }
}
const onRoad = () => CROSSERS.filter((c) => c.on && c.phase === 'cross' && c.y > STREET && c.y < FAR_KERB).length;

function drawCrosser(c: Crosser) {
  const X = Math.round(c.x), y = Math.round(c.y), walking = c.phase !== 'wait', across = c.phase === 'cross' || c.phase === 'wait';
  if (!across) { figure(X, y, c.dir, c.seed, walking, c.ph); return; }
  const st = walking ? [1, 0, 1, 0][(c.ph | 0) & 3] : 0, low = pickH(LOWS, c.seed + 3), hair = pickH(HAIRS, c.seed + 4);
  for (let r = 0; r < 5; r++) { const c2 = r === 4 ? VOID : low; put(X - 1, y - 4 + r - (r >= 2 && st ? 1 : 0), c2); put(X + 1, y - 4 + r - (r >= 2 && !st && walking ? 1 : 0), c2); }
  rect(X - 1, y - 10, 3, 6, pickH(TOPS, c.seed + 1)); rect(X - 1, y - 14, 3, 3, pickH(SKINS, c.seed + 2)); rect(X - 1, y - 15, 3, 1, hair);
  if (c.vy < 0) rect(X - 1, y - 14, 3, 2, hair);
  if (opensUmbrella(S.wxKind, S.rain, S.snow, hashf(c.seed + 9))) { rect(X - 3, y - 19, 7, 2, UMB); rect(X + 1, y - 17, 1, 6, STEEL); }
}

/** The white sedan parked at the kerb on the right, as in the photo. */
function parked() {
  const x = 410, y = 154;
  rect(x, y - 7, 44, 5, TILEW); rect(x + 9, y - 12, 24, 5, TILEW); rect(x + 11, y - 11, 9, 3, WDIM); rect(x + 22, y - 11, 9, 3, WDIM);
  rect(x, y - 5, 44, 1, STONEL); rect(x + 5, y - 3, 7, 3, VOID); rect(x + 32, y - 3, 7, 3, VOID); put(x + 8, y - 2, STEEL); put(x + 35, y - 2, STEEL);
  put(x, y - 6, isNight() ? SIGR : CRED); put(x + 43, y - 6, STONEL);
}

function update(dt: number) {
  updateAnimals(dt);
  tickSpawns(dt, S.saoJoao && S.cal.hour >= 18 ? 1.6 : 1); updatePeople(dt); updateCrossers(dt); updateCars(dt, 0.8);
  if (onRoad() && vehicleBetween(ZEBRA0, ZEBRA1)) conflicts++;
}

const FOG = [{ y: 104, h: 9, sp: 0.5 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid);
  door(); signLights(); drawFarPrecip();
  blitLayer(front);
  lampLight(LAMP); lampPool(LAMP);
  if (S.natal) christmasStar(LAMP.x + 14, LAMP.top - 10, 1);
  if (S.festa || S.saoJoao) bandeirolas(LAMP.x, 46, WW, 50, 10, 6);
  board();
  drawAnimalsPerched(); crowd(); drawPeople(); drawAnimalsGround();
  drawStreet(street); lampRoadPool(LAMP, 158); parked(); for (const c of CROSSERS) if (c.on) drawCrosser(c); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const cinemaFachada: Scene = {
  id: 'cinema-fachada-remigio',
  name: 'Cine · Fachada · Remígio',
  build() {
    if (!built) { buildFar(); buildLeft(); buildCinema(); buildRight(); buildFront(); buildGround(); built = true; }
    setLanes([{ y: 142 }, { y: 144 }, { y: 146 }], { bikes: false });
    setupAnimals({ ground: [143, 145], dogs: 1, sleepSpots: [360], lamps: [{ x: LAMP.x + 14, y: LAMP.top }],
      wires: [wireCurve(LAMP.x, 36, WW, 28, 8), wireCurve(LAMP.x, 39, WW, 40, 12)],
      walls: [{ x0: WALL0, x1: WALL1, y: WALLTOP - 1 }, { x0: 0, x1: SIDE0, y: 65 }] });
    setCarLanes(162, 175, 'br'); // two-way: the photo does not show the road's direction (no centre line visible)
    setBrCrossing({ x0: ZEBRA0, x1: ZEBRA1, occupied: zebraBusy }); // after setCarLanes, which clears it
    for (const c of CROSSERS) c.on = false;
    configure({
      roofs: [{ x0: C0, x1: C1, y: 37 }, { x0: SIDE1, x1: C0, y: 59 }, { x0: C1, x1: 402, y: 95 }, { x0: 402, x1: WW, y: 81 }, { x0: 0, x1: SIDE0, y: 65 }],
      tips: [{ x: BL - 2, y: 71, end: GROUND }, { x: BR + BAY_W + 1, y: 71, end: GROUND }], lamps: [{ x: LAMP.x + 14, y: LAMP.top }], ground0: GROUND, horizon: HORIZON,
    });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  hint() { return isOpen() ? { x: DX, y: DTOP, text: 'Toque na porta pra entrar no cinema' } : null; },
  debug() {
    const b = boardAt(hour());
    return `active  people x${peopleCount()}  cine ${b.phase} ${b.status}  fila x${queueAt(hour())} saindo x${exitsAt(hour()).length}  faixa x${onRoad()} travessias ${crossings} conflitos ${conflicts}`;
  },
  tap(x, y) {
    // the door: in while the room is open (cinema-remigio, same moment); otherwise a short note
    if (x >= D0 - 2 && x <= D1 + 2 && y >= DTOP - 4 && y <= GROUND + 2) {
      const d = doorTap(hour());
      return d.enter ? { x: DX, y: DTOP, goto: 'cinema-remigio' } : { x: DX, y: DTOP, say: d.say };
    }
    for (const s of spots) if (Math.abs(x - s.x) <= 3 && y >= s.y - 16 && y <= s.y + 1) return { x: s.x, y: s.y - 15, speaker: { role: s.role } };
    return null;
  },
};
