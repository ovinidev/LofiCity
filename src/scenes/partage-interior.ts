/* PARTAGE SHOPPING, INSIDE (Campina Grande, PB): a two-storey gallery of the mall, seen side-on
   across the corridor. Under a long glass skylight (the city's real sky shows through it, rain on the
   panes only with a real reading), two rows of shop fronts with lit windows, the upper walkway behind
   a glass balustrade, an escalator climbing from the ground floor to the upper one, and on the ground
   floor the glass doors back out to the forecourt under a green SAÍDA sign, a little coffee kiosk,
   planters and a bench on the polished floor.

   Reached from the main doors of the street front (partage-shopping.ts) while the mall is open;
   tapping SAÍDA goes back out, and the cinema's doors on the upper floor lead into its room
   (cinema-partage.ts) while a session is on. No reference photo of the inside was used: the layout is a generic
   Brazilian mall gallery, the shops are generic (a category on each sign, no brands) and the kiosk is
   art direction. Hours, shutters and the crowd come from partage-rules.ts, shared with the street
   front, so the doors and the inside always agree.

   Indoors: the gallery lights itself (grade()), the same by day and by night (a touch warmer at night),
   dimmed to the security lights while closed; only the skylight follows the sky. The people walking
   the corridors use the shared pedestrians with `indoor: true` (no umbrellas, no hurrying, no heat). */
import { L, Lp, WW, WY0, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { bay, hashf, mulberry32 } from '../engine/math';
import {
  CBEIGE, CBLUE, CGREEN, CHURCHL, CLOUD, CLOUDD, CNAVY, CORNG, CRED, CYELL, DAY_RGB, EMISSIVE, FBLUE, FLILAC, FORNG, FPINK, FWG,
  GLOWI, GLOWO, HAIR1, HAIR2, HAZE, LEAFG, LEAFGD, LEDW, LIGHT, MOON, NIGHT_RGB, NPAL, PAL32, RAINB, SKIN2, SKIN3, SKY1, SKY2,
  SKY3, SKY4, STEEL, STONE, STONEL, SUN, TILEW, VOID, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { setupAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { raining } from '../actors/rain-rules';
import { S } from '../sky/state';
import { drawSky } from './common';
import { saidaSign, text, textW } from './br-kit';
import { cinemaDoorTap, insideCrowd, mallOpen, shutterAt } from './partage-rules';
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

type Kind = 'rack' | 'shelf' | 'counter';
interface Shop { x: number; w: number; name: string; bg: number; fg: number; kind: Kind }
const UPPER: Shop[] = [
  { x: 0, w: 80, name: 'MODA', bg: VOID, fg: TILEW, kind: 'rack' },
  { x: 80, w: 80, name: 'ESPORTES', bg: CBLUE, fg: TILEW, kind: 'shelf' },
  { x: 160, w: 80, name: 'LIVRARIA', bg: CNAVY, fg: CYELL, kind: 'shelf' },
  { x: 320, w: 80, name: 'PERFUMARIA', bg: FPINK, fg: TILEW, kind: 'counter' },
  { x: 400, w: 80, name: 'BRINQUEDOS', bg: CYELL, fg: CRED, kind: 'shelf' },
];
/** The cinema's front on the upper floor, between the bookshop and the perfumery (cinema-partage.ts inside). */
const CINE = { x: 240, w: 80 };
const GROUND: Shop[] = [
  { x: 0, w: 128, name: 'CALÇADOS', bg: CRED, fg: TILEW, kind: 'shelf' },
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
function shopFront(s: Shop, top: number, bot: number) {
  const { x, w } = s, gy = top + 12;
  L(room, x, top, w, bot - top, TILEW);
  // sign board with the shop's category
  L(room, x + 6, top + 1, w - 10, 9, s.bg);
  text(room, s.name, x + 6 + ((w - 10 - textW(s.name)) >> 1), top + 3, s.fg);
  // the window: a bright back wall and the floor inside
  L(room, x + 4, gy, w - 6, bot - gy, CHURCHL);
  L(room, x + 4, bot - 3, w - 6, 3, CBEIGE);
  for (let lx = x + 10; lx < x + w - 4; lx += 14) L(room, lx, gy, 4, 1, LIGHT); // track lights inside
  const ix0 = x + 7, ix1 = x + w - 5;
  if (s.kind === 'rack') {
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

/** The cinema front: a dark marquee with CINEMA, two framed posters (generic colour blocks, no titles)
    and the glass doors into a dim foyer. */
function buildCinema() {
  const { x, w } = CINE, top = UP_TOP, bot = UP_FLOOR;
  L(room, x, top, w, bot - top, VOID);
  L(room, x, top, 4, bot - top, TILEW); L(room, x + 3, top, 1, bot - top, STONEL); L(room, x + w - 1, top, 1, bot - top, STONEL);
  L(room, x + 6, top + 1, w - 10, 11, CNAVY);
  text(room, 'CINEMA', x + 6 + ((w - 10 - textW('CINEMA')) >> 1), top + 4, TILEW);
  for (const [px, a, b] of [[x + 8, CRED, CYELL], [x + w - 22, CBLUE, FORNG]] as const) { // posters
    L(room, px - 1, top + 17, 16, 24, STEEL); L(room, px, top + 18, 14, 22, a); L(room, px + 2, top + 21, 10, 8, b); L(room, px + 2, top + 32, 10, 1, TILEW); L(room, px + 2, top + 35, 7, 1, TILEW);
  }
  // the doors: glass leaves into the foyer
  const d0 = x + 28, d1 = x + w - 28;
  L(room, d0, top + 20, d1 - d0, bot - top - 20, CNAVY);
  L(room, d0, top + 20, d1 - d0, 1, STEEL); L(room, (d0 + d1) >> 1, top + 20, 1, bot - top - 20, STEEL);
  for (let i = 0; i < 8; i++) Lp(room, d0 + 3 + i, bot - 4 - i * 3, FBLUE);
}

function buildShops() {
  for (const s of UPPER) shopFront(s, UP_TOP, UP_FLOOR);
  buildCinema();
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
    const top = (UPPER.includes(s) ? UP_TOP : DN_TOP) + 11, bot = UPPER.includes(s) ? UP_FLOOR : FLOOR;
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

/** The cinema: marquee bulbs chasing round the sign and a lit foyer while a session is on or coming up. */
function cinemaFront() {
  const { x, w } = CINE, on = cinemaDoorTap(wd(), hr()).enter, t = S.ms / 1000, top = UP_TOP;
  const d0 = x + 28, d1 = x + w - 28;
  if (on) {
    rect(d0 + 1, top + 22, d1 - d0 - 2, UP_FLOOR - top - 22, WWARM); rect((d0 + d1) >> 1, top + 21, 1, UP_FLOOR - top - 21, STEEL);
    rect(d0 + 3, UP_FLOOR - 9, d1 - d0 - 6, 5, CRED); rect(d0 + 4, UP_FLOOR - 13, 3, 4, TILEW); rect(d0 + 9, UP_FLOOR - 12, 3, 3, CYELL); // the snack counter
  }
  for (let k = 0, bx = x + 6; bx < x + w - 4; bx += 4, k++) {
    const c = on ? ((k + Math.floor(t * 6)) % 3 ? LIGHT : WWARM) : STEEL;
    put(bx, top, c); put(bx, top + 12, c);
  }
}

/** The SAÍDA sign over the glass doors (a light source, on even while closed). */
const EXIT_SIGN = { x: EX0 + 9, y: DN_TOP + 2, w: EX1 - EX0 - 18, h: 10 };
const exitSign = () => saidaSign(EXIT_SIGN.x, EXIT_SIGN.y, EXIT_SIGN.w, EXIT_SIGN.h);
const onExit = (x: number, y: number) => x >= EX0 - 4 && x <= EX1 + 4 && y >= DN_TOP - 4 && y <= FLOOR + 4;

/** Real rain (or the labelled #wx= test) beads and runs on the skylight. */
function skylightRain() {
  if (!raining(S.wxKind, S.rain, S.snow)) return;
  const t = S.ms / 1000, n = Math.round(60 + 240 * Math.min(1, S.rain));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hashf(i * 17.3) * WW), y = SKY_TOP + Math.floor(((hashf(i * 5.1) * 36 + t * (4 + hashf(i) * 6)) % (SKY_BOT - SKY_TOP)));
    put(x, y, RAINB); if (i & 1) put(x, y - 1, RAINB);
  }
}

// ---------- the gallery's own light ----------
/** The sky through the skylight and the glass doors keeps the global grade; everything else is lit by the mall. */
const KEEP = new Set<number>([SKY1, SKY2, SKY3, SKY4, HAZE, GLOWO, GLOWI, CLOUD, CLOUDD, SUN, MOON]);
function grade() {
  const o = isOpen(), k = o ? 1 : 0.32, warm = o ? 1 - S.dayK : 0;
  for (let i = 0; i < NPAL; i++) {
    if (KEEP.has(i)) continue;
    const lit = EMISSIVE[i], c = lit ? NIGHT_RGB[i] : DAY_RGB[i], kk = lit ? (o ? 1 : 0.6) : k;
    const r = Math.min(255, c[0] * kk + 10 * warm) | 0, g = Math.min(255, c[1] * kk + 4 * warm) | 0, b = Math.max(0, Math.min(255, c[2] * kk - 6 * warm)) | 0;
    PAL32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  // the green exit sign and its letters stay lit, as in any building
  for (const [i, h] of [[CGREEN, [30, 120, 60]], [FWG, [190, 255, 200]]] as const) PAL32[i] = (255 << 24) | (h[2] << 16) | (h[1] << 8) | h[0];
}

function update(dt: number) {
  tickSpawns(dt, insideCrowd(wd(), hr())); updatePeople(dt);
}

function render() {
  drawSky(SKY_BOT);
  blitLayer(room);
  skylightRain();
  shutters();
  cinemaFront();
  kiosk();
  escalator();
  drawPeople();
  balustrade();
  exitSign();
}

let built = false;
export const partageInterior: Scene = {
  id: 'partage-interior',
  name: 'Partage · Por dentro',
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
  hint() { return { x: EXIT_SIGN.x + (EXIT_SIGN.w >> 1), y: EXIT_SIGN.y, text: 'Toque na SAÍDA pra voltar à rua' }; },
  tap(x, y) {
    if (onExit(x, y)) return { x: EXIT_SIGN.x + (EXIT_SIGN.w >> 1), y: EXIT_SIGN.y, goto: 'partage-shopping' };
    // the cinema's doors: into the room while a session is on (cinema-partage), otherwise when it opens
    if (x >= CINE.x + 4 && x <= CINE.x + CINE.w && y >= UP_TOP + 14 && y <= UP_FLOOR + 2) {
      const d = cinemaDoorTap(wd(), hr()), cx = CINE.x + (CINE.w >> 1);
      return d.enter ? { x: cx, y: UP_TOP + 14, goto: 'cinema-partage' } : { x: cx, y: UP_TOP + 14, say: d.say };
    }
    if (isOpen() && x >= KIOSK.x + KIOSK.w - 16 && x <= KIOSK.x + KIOSK.w - 6 && y >= KIOSK.base - 32 && y <= KIOSK.base - 14) {
      return { x: KIOSK.x + KIOSK.w - 12, y: KIOSK.base - 31, speaker: { role: 'vendor' } };
    }
    return null;
  },
};
