/* PARTAGE SHOPPING, THE SHOPS (Campina Grande, PB): a two-storey gallery of the mall, seen side-on
   across the corridor. Under a long glass skylight (the city's real sky shows through it, rain on the
   panes only with a real reading), two rows of shop fronts with lit windows, the upper walkway behind
   a glass balustrade, an escalator climbing from the ground floor to the upper one, and on the ground
   floor the glass doors back out to the forecourt under a green SAÍDA sign, a little coffee kiosk,
   planters and a bench on the polished floor.

   Three fronts follow the reference photos of the mall's shops (issue #40), under made-up look-alike
   names, never the real brands: a department store with a dark band and backlit white letters
   (RIACHINHO: racks, mannequins, a display table), a bookshop with a wood fascia (LEITORA: shelves and
   low tables of books) and a sports store with red letters on white and a red SALDOS board
   (CENTAURA). The other shops show only a category (MODA, PERFUMARIA, ...).

   Reached from the main doors of the street front (partage-shopping.ts) while the mall is open;
   tapping SAÍDA goes back out, and the passage on the upper floor (signposted ALIMENTAÇÃO · CINEMA)
   leads to the food court and the cinema's front (partage-alimentacao.ts). Hours, shutters and the
   crowd come from partage-rules.ts, shared with the street front, so the doors and the inside agree.

   Indoors: the gallery lights itself (mallGrade() in partage-kit.ts), the same by day and by night (a
   touch warmer at night), dimmed to the security lights while closed; only the skylight follows the
   sky. The people walking the corridors use the shared pedestrians with `indoor: true` (no umbrellas,
   no hurrying, no heat). */
import { L, Lp, WW, WY0, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { bay, hashf, mulberry32 } from '../engine/math';
import {
  CBEIGE, CBLUE, CGREEN, CHURCHL, CNAVY, CORNG, CRED, CYELL, FBLUE, FLILAC, FORNG, FPINK, HAIR1, HAIR2, HAZE, LEAFG, LEAFGD, LEDW,
  LIGHT, SKIN2, SKIN3, STEEL, STONE, STONEL, TILEW, VOID, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { setupAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S } from '../sky/state';
import { drawSky } from './common';
import { saidaSign, text, textW } from './br-kit';
import { mallGrade, skylightRain } from './partage-kit';
import { insideCrowd, mallOpen, shutterAt } from './partage-rules';
import type { Scene } from './types';

// ---------- geometry (world space) ----------
/** Skylight band, the beam under it, the upper shops, the walkway slab, the ground shops, the floor. */
const SKY_TOP = -220, SKY_BOT = -60, BEAM = -50, UP_TOP = -50, UP_FLOOR = 38, SLAB = 58, DN_TOP = 58, FLOOR = 148;
/** The glass doors back out to the forecourt (ground floor). */
const EX0 = 128, EX1 = 178;
/** The escalator: bottom landing on the ground floor, top landing on the upper walkway. */
const ESC = { x0: 196, y0: FLOOR + 2, x1: 390, y1: UP_FLOOR };
const escY = (x: number) => ESC.y0 + ((x - ESC.x0) * (ESC.y1 - ESC.y0)) / (ESC.x1 - ESC.x0);
/** The coffee kiosk on the ground floor. */
const KIOSK = { x: 48, w: 40, base: 152 };

type Kind = 'rack' | 'shelf' | 'counter' | 'dept' | 'books' | 'sport';
/** `big`: a brand-style fascia with large letters (the photographed fronts, under look-alike names). */
interface Shop { x: number; w: number; name: string; bg: number; fg: number; kind: Kind; big?: boolean }
const UPPER: Shop[] = [
  { x: 0, w: 80, name: 'MODA', bg: VOID, fg: TILEW, kind: 'rack' },
  { x: 80, w: 80, name: 'CENTAURA', bg: TILEW, fg: CRED, kind: 'sport', big: true },
  { x: 160, w: 80, name: 'LEITORA', bg: WOOD, fg: TILEW, kind: 'books', big: true },
  { x: 320, w: 80, name: 'PERFUMARIA', bg: FPINK, fg: TILEW, kind: 'counter' },
  { x: 400, w: 80, name: 'BRINQUEDOS', bg: CYELL, fg: CRED, kind: 'shelf' },
];
/** The passage on the upper floor, between the bookshop and the perfumery, to the food court and the
    cinema (partage-alimentacao.ts). */
const PASS = { x: 240, w: 80 };
const GROUND: Shop[] = [
  { x: 0, w: 128, name: 'RIACHINHO', bg: VOID, fg: WHITE, kind: 'dept', big: true },
  { x: EX1, w: 84, name: 'CELULARES', bg: CNAVY, fg: TILEW, kind: 'counter' },
  { x: 262, w: 84, name: 'BOLSAS', bg: FORNG, fg: TILEW, kind: 'rack' },
  { x: 346, w: 70, name: 'PRESENTES', bg: CGREEN, fg: TILEW, kind: 'shelf' },
  { x: 416, w: 64, name: 'INFANTIL', bg: FLILAC, fg: VOID, kind: 'rack' },
];
const SHOPS = [...UPPER, ...GROUND];
const GOODS = [CRED, CBLUE, CYELL, CGREEN, FPINK, FORNG, FLILAC, CNAVY, TILEW, VOID, WOOD, CBEIGE];

const room = newLayer();
const rr = mulberry32(0x9a47a1d);

// ---------- static gallery ----------
function buildCeiling() {
  // roof underside above the skylight (seen on tall portrait screens): white slabs between steel beams
  L(room, 0, WY0, WW, SKY_TOP - WY0, TILEW);
  for (let y = WY0 + 14; y < SKY_TOP; y += 24) L(room, 0, y, WW, 2, STONEL);
  for (let x = 20; x < WW; x += 40) L(room, x, WY0, 3, SKY_TOP - WY0, STONEL);
  // the skylight: glass panes (left transparent, the real sky shows through) on white steel ribs
  L(room, 0, SKY_TOP - 3, WW, 3, STEEL);
  for (let x = 0; x < WW; x += 24) L(room, x, SKY_TOP, 2, SKY_BOT - SKY_TOP, TILEW);
  for (let y = SKY_BOT - 18; y > SKY_TOP; y -= 34) L(room, 0, y, WW, 1, TILEW); // horizontal glazing bars
  for (let x = 0; x < WW; x += 48) for (let i = 0; i < 24; i++) { // diagonal bracing in alternate bays, one per row of panes
    for (let y0 = SKY_BOT - 18; y0 - 34 >= SKY_TOP - 1; y0 -= 34) Lp(room, x + i, y0 - 34 + Math.round((i * 34) / 24), STONEL);
    Lp(room, x + i, SKY_BOT - 18 + Math.round((i * 18) / 24), STONEL);
  }
  // the beam under the skylight, with downlights
  L(room, 0, SKY_BOT, WW, BEAM - SKY_BOT, TILEW); L(room, 0, SKY_BOT, WW, 1, STONEL); L(room, 0, BEAM - 1, WW, 1, STONEL);
  for (let x = 10; x < WW; x += 20) L(room, x, BEAM - 2, 3, 1, LIGHT);
}

/** One shop front: the pillar on its left, the sign board, the lit window and what is on show. */
/** Where a shop's window starts below its sign (the big fascias are taller). */
const glassTop = (s: Shop, top: number) => top + (s.big ? 17 : 12);
function shopFront(s: Shop, top: number, bot: number) {
  const { x, w } = s, gy = glassTop(s, top);
  L(room, x, top, w, bot - top, TILEW);
  if (s.big) {
    // a full-width fascia with the name in large letters (lit after the grade: see the EMISSIVE letters)
    L(room, x + 4, top, w - 4, 15, s.bg); L(room, x + 4, top + 14, w - 4, 1, s.bg === TILEW ? STONEL : STEEL);
    text(room, s.name, x + 4 + ((w - 4 - textW(s.name, 2)) >> 1), top + 3, s.fg, 2);
    if (s.kind === 'books') { // the bookshop's little open-book mark before the name
      const bx = x + 4 + ((w - 4 - textW(s.name, 2)) >> 1) - 6;
      L(room, bx, top + 6, 2, 4, s.fg); L(room, bx + 2, top + 5, 2, 4, s.fg);
    }
  } else {
    // sign board with the shop's category
    L(room, x + 6, top + 1, w - 10, 9, s.bg);
    text(room, s.name, x + 6 + ((w - 10 - textW(s.name)) >> 1), top + 3, s.fg);
  }
  // the window: a bright back wall and the floor inside
  L(room, x + 4, gy, w - 6, bot - gy, CHURCHL);
  L(room, x + 4, bot - 3, w - 6, 3, CBEIGE);
  for (let lx = x + 10; lx < x + w - 4; lx += 14) L(room, lx, gy, 4, 1, LIGHT); // track lights inside
  const ix0 = x + 7, ix1 = x + w - 5;
  if (s.kind === 'dept') {
    // the department store: two rails of clothes at the back, a display table of folded clothes and
    // mannequins by the glass (one in a red dress, as in the photo)
    L(room, ix0, gy + 8, ix1 - ix0, 1, STEEL);
    for (let cx = ix0 + 1; cx < ix1 - 2; cx += 3) L(room, cx, gy + 9, 2, 9 + ((rr() * 5) | 0), GOODS[(rr() * GOODS.length) | 0]);
    const ty = bot - 14;
    L(room, x + 40, ty, 34, 2, WOOD); L(room, x + 41, ty + 2, 2, 11, WOOD); L(room, x + 71, ty + 2, 2, 11, WOOD);
    for (let cx = x + 41; cx < x + 72; cx += 5) L(room, cx, ty - 3, 4, 3, GOODS[(rr() * GOODS.length) | 0]);
    const mannequin = (mx: number, top: number, dress: number) => {
      const my = bot - 3;
      L(room, mx, my - 26, 4, 4, CBEIGE); L(room, mx - 1, my - 22, 6, 9, top);
      if (dress >= 0) { L(room, mx - 2, my - 13, 8, 8, dress); L(room, mx + 1, my - 5, 1, 2, CBEIGE); L(room, mx + 2, my - 5, 1, 2, CBEIGE); }
      else L(room, mx, my - 13, 4, 10, CNAVY);
      L(room, mx - 1, my - 3, 6, 1, STEEL);
    };
    mannequin(x + 18, CRED, CRED); mannequin(x + 30, TILEW, -1); mannequin(x + w - 26, GOODS[(rr() * 8) | 0], -1); mannequin(x + w - 14, FPINK, FPINK);
  } else if (s.kind === 'books') {
    // the bookshop: tall shelves of spines at the back, low tables of books stacked flat in front
    for (let sy = gy + 7; sy < bot - 16; sy += 6) {
      L(room, ix0, sy, ix1 - ix0, 1, WOOD);
      for (let cx = ix0 + 1; cx < ix1 - 1; cx += 2) L(room, cx, sy - 4, 1, 4, GOODS[(rr() * GOODS.length) | 0]);
    }
    for (const tx of [x + 10, x + 44]) {
      L(room, tx, bot - 9, 26, 2, VOID); L(room, tx + 1, bot - 7, 2, 4, VOID); L(room, tx + 23, bot - 7, 2, 4, VOID);
      for (let cx = tx; cx < tx + 26; cx += 4) L(room, cx, bot - 11 - ((rr() * 2) | 0), 3, 2 + ((rr() * 2) | 0), GOODS[(rr() * GOODS.length) | 0]);
    }
  } else if (s.kind === 'sport') {
    // the sports store: racks of bright kit, a running track painted on the floor and the red SALDOS board
    for (const ry of [gy + 17, gy + 38]) {
      L(room, ix0, ry, ix1 - ix0, 1, STEEL);
      for (let cx = ix0 + 1; cx < ix1 - 2; cx += 3) L(room, cx, ry + 1, 2, 7 + ((rr() * 5) | 0), [CRED, FPINK, CBLUE, TILEW, VOID, FORNG][(rr() * 6) | 0]);
    }
    L(room, x + 4, bot - 3, w - 6, 3, FORNG); L(room, x + 4, bot - 2, w - 6, 1, TILEW);
    L(room, x + 12, gy + 1, 1, 3, STEEL); L(room, x + w - 14, gy + 1, 1, 3, STEEL);
    L(room, x + 9, gy + 4, w - 20, 9, CRED); L(room, x + 9, gy + 12, w - 20, 1, VOID);
    text(room, 'SALDOS', x + 9 + ((w - 20 - textW('SALDOS')) >> 1), gy + 6, TILEW);
  } else if (s.kind === 'rack') {
    // a rail of hanging clothes and a mannequin by the glass
    for (const ry of [gy + 7, gy + Math.round((bot - gy) * 0.55)]) {
      if (ry + 14 > bot - 4) continue;
      L(room, ix0, ry, ix1 - ix0, 1, STEEL);
      for (let cx = ix0 + 1; cx < ix1 - 2; cx += 3) L(room, cx, ry + 1, 2, 8 + ((rr() * 6) | 0), GOODS[(rr() * GOODS.length) | 0]);
    }
    const mx = x + w - 16, my = bot - 3;
    L(room, mx, my - 24, 4, 4, CBEIGE); L(room, mx - 1, my - 20, 6, 9, GOODS[(rr() * 8) | 0]); L(room, mx, my - 11, 4, 8, CNAVY); L(room, mx + 1, my - 3, 2, 1, STEEL);
  } else {
    // shelves of goods (with a glass counter in front for the counter shops)
    const shelfBot = s.kind === 'counter' ? gy + Math.round((bot - gy) * 0.55) : bot - 5;
    for (let sy = gy + 9; sy < shelfBot; sy += 9) {
      L(room, ix0, sy, ix1 - ix0, 1, STEEL);
      for (let cx = ix0 + 1; cx < ix1 - 2;) {
        const iw = 2 + ((rr() * 3) | 0), ih = 3 + ((rr() * 4) | 0);
        L(room, cx, sy - ih, iw, ih, GOODS[(rr() * GOODS.length) | 0]);
        cx += iw + 1;
      }
    }
    if (s.kind === 'counter') {
      const cy = bot - 14;
      L(room, ix0 + 4, cy, ix1 - ix0 - 8, 11, STEEL); L(room, ix0 + 5, cy + 1, ix1 - ix0 - 10, 5, FBLUE);
      for (let cx = ix0 + 7; cx < ix1 - 7; cx += 5) L(room, cx, cy + 3, 2, 2, GOODS[(rr() * 8) | 0]);
    }
  }
  // glass: a frame, the door mullions and a couple of diagonal glints
  L(room, x + 4, gy, w - 6, 1, STEEL);
  for (const mx of [x + Math.round(w * 0.35), x + Math.round(w * 0.65)]) L(room, mx, gy, 1, bot - gy, STONEL);
  for (let i = 0; i < 9; i++) { Lp(room, x + 10 + i, bot - 6 - i * 2, WHITE); Lp(room, x + 14 + i, bot - 6 - i * 2, WHITE); }
  // the pillar between shops
  L(room, x, top, 4, bot - top, TILEW); L(room, x + 3, top, 1, bot - top, STONEL);
}

/** The passage to the food court and the cinema: an opening in the upper row of shops, a corridor
    running back to the warm light of the food court, and a hanging sign "ALIMENTAÇÃO / CINEMA ->". */
function buildPassage() {
  const { x, w } = PASS, top = UP_TOP, bot = UP_FLOOR;
  L(room, x, top, w, bot - top, TILEW);
  L(room, x, top, 4, bot - top, TILEW); L(room, x + 3, top, 1, bot - top, STONEL); L(room, x + w - 1, top, 1, bot - top, STONEL);
  // the corridor: side walls narrowing to the far end, the ceiling, the floor and the lit food court beyond
  const fx0 = x + 26, fx1 = x + w - 26, fy0 = top + 30, fy1 = bot - 12;
  for (let y = top + 4; y < bot; y++) {
    const t = Math.min(1, Math.max(0, y < fy0 ? (y - top - 4) / (fy0 - top - 4) : y > fy1 ? (bot - y) / (bot - fy1) : 1));
    const a = Math.round(x + 6 + (fx0 - x - 6) * t), b = Math.round(x + w - 4 - (x + w - 4 - fx1) * t);
    L(room, x + 6, y, a - x - 6, 1, y < fy0 ? TILEW : y > fy1 ? CBEIGE : STONEL);
    L(room, b, y, x + w - 4 - b, 1, y < fy0 ? TILEW : y > fy1 ? CBEIGE : STONEL);
    L(room, a, y, b - a, 1, y < fy0 ? TILEW : y > fy1 ? CHURCHL : WWARM);
  }
  // little yellow chairs far off in the food court, and the downlights down the corridor
  for (let cx = fx0 + 3; cx < fx1 - 2; cx += 6) { Lp(room, cx, fy1 - 3, CYELL); Lp(room, cx, fy1 - 2, CYELL); Lp(room, cx + 1, fy1 - 2, CYELL); }
  for (const lx of [x + 16, x + 30, x + w - 32, x + w - 18]) Lp(room, lx, top + 6 + (lx < x + 40 ? (lx - x) >> 2 : (x + w - lx) >> 2), LIGHT);
  // the hanging sign
  const sx = x + 8, sw = w - 14, sy = top + 6;
  L(room, sx + 10, top, 1, 6, STEEL); L(room, sx + sw - 11, top, 1, 6, STEEL);
  L(room, sx, sy, sw, 19, CNAVY); L(room, sx, sy + 18, sw, 1, VOID);
  const t1 = 'ALIMENTAÇAO', t1x = sx + ((sw - textW(t1)) >> 1);
  text(room, t1, t1x, sy + 3, TILEW);
  Lp(room, t1x + 36, sy + 2, TILEW); Lp(room, t1x + 37, sy + 1, TILEW); Lp(room, t1x + 38, sy + 2, TILEW); // the tilde of ALIMENTAÇÃO
  const t2 = 'CINEMA', t2x = sx + ((sw - textW(t2) - 6) >> 1);
  text(room, t2, t2x, sy + 11, CYELL);
  const ax = t2x + textW(t2) + 2; // an arrow on: through the passage
  L(room, ax, sy + 13, 4, 1, CYELL); Lp(room, ax + 2, sy + 12, CYELL); Lp(room, ax + 2, sy + 14, CYELL); Lp(room, ax + 3, sy + 13, CYELL);
}

function buildShops() {
  for (const s of UPPER) shopFront(s, UP_TOP, UP_FLOOR);
  buildPassage();
  for (const s of GROUND) shopFront(s, DN_TOP, FLOOR);
  // the walkway slab: white fascia with a LED strip, the underside with downlights
  L(room, 0, UP_FLOOR, WW, 8, TILEW); L(room, 0, UP_FLOOR, WW, 1, STONEL); L(room, 0, UP_FLOOR + 5, WW, 1, LEDW);
  L(room, 0, UP_FLOOR + 8, WW, SLAB - UP_FLOOR - 8, STONEL); L(room, 0, SLAB - 1, WW, 1, STONE);
  for (let x = 12; x < WW; x += 24) L(room, x, SLAB - 2, 3, 1, LIGHT);
}

function buildExit() {
  // glazed automatic doors to the forecourt: the glass shows the outside (HAZE follows the real sky)
  L(room, EX0, DN_TOP, EX1 - EX0, FLOOR - DN_TOP, TILEW);
  L(room, EX0 + 4, DN_TOP + 16, EX1 - EX0 - 8, FLOOR - DN_TOP - 16, HAZE);
  L(room, EX0 + 4, FLOOR - 10, EX1 - EX0 - 8, 10, STONEL); // the forecourt slabs outside
  for (const x of [EX0 + 4, (EX0 + EX1) >> 1, EX1 - 5]) L(room, x, DN_TOP + 16, 1, FLOOR - DN_TOP - 16, STEEL);
  L(room, EX0 + 4, DN_TOP + 16, EX1 - EX0 - 8, 2, STEEL);
  for (let i = 0; i < 10; i++) Lp(room, EX0 + 9 + i, FLOOR - 14 - i * 3, WHITE);
  L(room, EX0 + 8, FLOOR - 1, EX1 - EX0 - 16, 1, VOID); // the door mat
}

function buildFloor() {
  // polished cream tiles, a darker joint grid, and the shop windows mirrored in the shine
  for (let y = FLOOR; y < 180; y++) {
    const d = y - FLOOR;
    for (let x = 0; x < WW; x++) Lp(room, x, y, (x + Math.round(d * 0.6)) % 32 === 0 || d % 9 === 8 ? CBEIGE : CHURCHL);
  }
  L(room, 0, FLOOR, WW, 1, STONE);
  for (const s of GROUND) for (let y = FLOOR + 1; y < FLOOR + 16; y++) for (let x = s.x + 6; x < s.x + s.w - 4; x++) {
    if (bay(x, y) < 0.32 * (1 - (y - FLOOR) / 16)) Lp(room, x, y, TILEW);
  }
}

function buildProps() {
  // planters with small palms and a bench, along the shop fronts
  for (const px of [104, 444]) {
    L(room, px - 7, FLOOR - 1, 14, 9, STEEL); L(room, px - 6, FLOOR, 12, 2, WOOD);
    L(room, px, FLOOR - 18, 1, 18, WOOD);
    for (let a = -3; a <= 3; a++) for (let k = 0; k < 9; k++) Lp(room, px + a * Math.round(k * 0.4), FLOOR - 18 + Math.round((k * k) / 8) - 1, (a + k) & 1 ? LEAFG : LEAFGD);
  }
  L(room, 300, FLOOR + 2, 26, 2, WOOD); L(room, 302, FLOOR + 4, 1, 5, STEEL); L(room, 323, FLOOR + 4, 1, 5, STEEL);
}

// ---------- dynamic ----------
const wd = () => S.cal.weekday, hr = () => S.cal.hour;
const isOpen = () => mallOpen(wd(), hr());

/** Roll-down grilles: up while open, coming down shop by shop before closing, all down while closed. */
function shutters() {
  SHOPS.forEach((s, i) => {
    const k = shutterAt(wd(), hr(), i, SHOPS.length);
    if (k <= 0) return;
    const top = glassTop(s, UPPER.includes(s) ? UP_TOP : DN_TOP) - 1, bot = UPPER.includes(s) ? UP_FLOOR : FLOOR;
    const h = Math.round((bot - top) * k);
    rect(s.x + 4, top, s.w - 6, h, STONEL);
    for (let y = top + 1; y < top + h; y += 3) rect(s.x + 4, y, s.w - 6, 1, STONE);
    rect(s.x + 4, top + h - 1, s.w - 6, 1, STEEL);
  });
}

/** The escalator: a steel truss, glass sides, black handrails; steps moving up while the mall is open,
    with a few people riding them. */
function escalator() {
  const t = S.ms / 1000, on = isOpen();
  // landings
  rect(ESC.x0 - 22, ESC.y0 - 1, 22, 3, STEEL); rect(ESC.x1, ESC.y1 - 1, 18, 3, STEEL);
  for (let x = ESC.x0; x <= ESC.x1; x++) {
    const y = Math.round(escY(x));
    rect(x, y, 1, 10, STEEL); put(x, y + 10, STONE); put(x, y, STONEL); // truss side panel
    for (let j = 1; j < 12; j++) if (bay(x, y - j) < 0.16) put(x, y - j, FBLUE); // glass balustrade
  }
  // moving step edges
  const off = on ? (t * 9) % 7 : 0;
  for (let d = off; d < ESC.x1 - ESC.x0; d += 7) { const x = ESC.x0 + Math.round(d); put(x, Math.round(escY(x)) - 1, STONE); }
  // riders standing on the steps (computed from the clock, so #at= shows the same riders)
  if (on) for (let i = 0; i < 3; i++) {
    const u = (t / 26 + i / 3 + hashf(Math.floor(t / 26 + i / 3) * 7 + i) * 0.05) % 1, x = Math.round(ESC.x0 + 10 + u * (ESC.x1 - ESC.x0 - 20));
    if (hashf(Math.floor(t / 26 + i / 3) * 13 + i) < 0.3) continue; // some trips run empty
    const fy = Math.round(escY(x)) - 1, shirt = GOODS[(i * 5 + Math.floor(t / 26 + i / 3)) % 8];
    rect(x - 1, fy - 6, 1, 6, CNAVY); rect(x + 1, fy - 6, 1, 6, CNAVY);
    rect(x - 2, fy - 13, 5, 7, shirt); rect(x - 1, fy - 17, 3, 4, i & 1 ? SKIN3 : SKIN2); rect(x - 1, fy - 18, 3, 1, i & 1 ? HAIR1 : HAIR2);
  }
  // handrails, drawn last over the riders' hands
  for (let x = ESC.x0 - 22; x <= ESC.x1 + 18; x++) {
    const y = x < ESC.x0 ? ESC.y0 : x > ESC.x1 ? ESC.y1 : escY(x);
    put(x, Math.round(y) - 12, VOID);
  }
}

/** The upper walkway's glass balustrade, in front of the people up there. */
function balustrade() {
  for (let x = 0; x < WW; x++) {
    if (x > ESC.x1 - 6 && x < ESC.x1 + 20) continue; // the opening onto the escalator
    put(x, UP_FLOOR - 15, STEEL);
    for (let y = UP_FLOOR - 14; y < UP_FLOOR; y++) if (bay(x, y) < 0.07) put(x, y, FBLUE);
    if (x % 40 === 6) rect(x, UP_FLOOR - 14, 1, 14, STEEL);
  }
}

/** The coffee kiosk: a counter, a little menu board and a canopy; the attendant is there while open. */
function kiosk() {
  const { x, w, base } = KIOSK, o = isOpen();
  rect(x, base - 16, w, 16, WOOD); rect(x, base - 16, w, 2, TILEW); rect(x + 2, base - 12, w - 4, 6, CHURCHL);
  rect(x + 4, base - 11, 3, 4, TILEW); rect(x + 9, base - 11, 3, 4, CRED); rect(x + 14, base - 11, 3, 4, TILEW); // cups
  rect(x + 3, base - 40, 2, 24, STEEL); rect(x + w - 5, base - 40, 2, 24, STEEL);
  rect(x - 2, base - 44, w + 4, 6, CORNG); rect(x - 2, base - 38, w + 4, 1, FORNG);
  const name = 'CAFE';
  text(null, name, x + ((w - textW(name)) >> 1), base - 43, o ? WHITE : STONEL);
  put(x + ((w - textW(name)) >> 1) + 13, base - 44, o ? WHITE : STONEL); put(x + ((w - textW(name)) >> 1) + 14, base - 45, o ? WHITE : STONEL); // the accent of CAFÉ
  if (o) {
    const ax = x + w - 12, by = base - 16;
    rect(ax - 2, by - 9, 5, 9, TILEW); rect(ax - 1, by - 13, 3, 4, SKIN3); rect(ax - 1, by - 14, 3, 1, HAIR1); rect(ax - 2, by - 7, 5, 1, CRED); // apron stripe
    rect(x + 6, base - 24, 10, 8, VOID); rect(x + 7, base - 23, 8, 1, CYELL); rect(x + 7, base - 21, 6, 1, TILEW); rect(x + 7, base - 19, 7, 1, TILEW); // menu
  }
}

/** The SAÍDA sign over the glass doors (a light source, on even while closed). */
const EXIT_SIGN = { x: EX0 + 9, y: DN_TOP + 2, w: EX1 - EX0 - 18, h: 10 };
const exitSign = () => saidaSign(EXIT_SIGN.x, EXIT_SIGN.y, EXIT_SIGN.w, EXIT_SIGN.h);
const onExit = (x: number, y: number) => x >= EX0 - 4 && x <= EX1 + 4 && y >= DN_TOP - 4 && y <= FLOOR + 4;

/** Rain on the skylight and the mall's own light, shared with the food court (partage-kit.ts). */
const grade = () => mallGrade(isOpen());

function update(dt: number) {
  tickSpawns(dt, insideCrowd(wd(), hr())); updatePeople(dt);
}

function render() {
  drawSky(SKY_BOT);
  blitLayer(room);
  skylightRain(SKY_TOP, SKY_BOT);
  shutters();
  kiosk();
  escalator();
  drawPeople();
  balustrade();
  exitSign();
}

let built = false;
export const partageInterior: Scene = {
  id: 'partage-interior',
  name: 'Partage · Lojas',
  build() {
    if (!built) { buildCeiling(); buildShops(); buildExit(); buildFloor(); buildProps(); built = true; }
    // the upper walkway and the ground-floor corridor; no bikes, and the weather does not reach them
    setLanes([{ y: UP_FLOOR - 1 }, { y: 157 }, { y: 163 }, { y: 169 }], { bikes: false, indoor: true });
    setupAnimals({ ground: [], dogs: 0 });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  grade,
  daylit: true,
  debug() { return `mall ${isOpen() ? 'aberto' : 'fechado'}  people x${peopleCount()}  crowd ${insideCrowd(wd(), hr()).toFixed(2)}`; },
  hintSpots() { return [{ x: EXIT_SIGN.x + (EXIT_SIGN.w >> 1), y: EXIT_SIGN.y - 2, kind: 'door' as const }, { x: PASS.x + (PASS.w >> 1), y: UP_TOP, kind: 'door' as const }]; },
  hint() { return { x: EXIT_SIGN.x + (EXIT_SIGN.w >> 1), y: EXIT_SIGN.y, text: 'Toque na SAÍDA pra voltar à rua' }; },
  tap(x, y) {
    if (onExit(x, y)) return { x: EXIT_SIGN.x + (EXIT_SIGN.w >> 1), y: EXIT_SIGN.y, goto: 'partage-shopping' };
    // the passage on the upper floor: on to the food court and the cinema's front (same building, same moment)
    if (x >= PASS.x + 4 && x <= PASS.x + PASS.w && y >= UP_TOP && y <= UP_FLOOR + 2) return { x: PASS.x + (PASS.w >> 1), y: UP_TOP + 6, goto: 'partage-alimentacao' };
    if (isOpen() && x >= KIOSK.x + KIOSK.w - 16 && x <= KIOSK.x + KIOSK.w - 6 && y >= KIOSK.base - 32 && y <= KIOSK.base - 14) {
      return { x: KIOSK.x + KIOSK.w - 12, y: KIOSK.base - 31, speaker: { role: 'vendor' } };
    }
    return null;
  },
};
