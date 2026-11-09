/* PARTAGE SHOPPING, FOOD COURT AND CINEMA (Campina Grande, PB): the mall's food court and, at its end,
   the cinema's front, seen side-on. After the reference photos in issue #40: a tall white hall with
   skylight boxes and a band of clerestory glass (the city's real sky shows through; rain runs down the
   panes only with a real reading), white tree-like columns branching in a Y up to the roof, a row of
   fast-food counters with lit boards under a grey band of round speakers, black tables with yellow
   chairs on a black-and-white floor, low planters of grass; then the cinema: big red letters on a beige
   wall over the box office (BILHETERIA), its dark red counter wall with posters, a screen showing
   trailers and a queue between stanchions.

   Names are made up, never the real brands: the cinema is CINESERTÃO (after the photo's chain) and the
   counters show only what they sell (SUCOS, TAPIOCA, LANCHÃO, BURGER, PASTEL).

   Reached through the passage on the upper floor of the shops' gallery (partage-interior.ts); the
   LOJAS passage here goes back. The cinema's doors lead into its room (cinema-partage.ts) while both
   the mall and the cinema are open (cinemaDoorTap in partage-rules.ts). The counters keep the mall's
   hours (art direction, like the shops): shutters come down one by one before closing. Diners at the
   tables and the queue grow with the mall's crowd (insideCrowd). Indoors: lit by the mall
   (mallGrade() in partage-kit.ts); the people walking use the shared pedestrians with `indoor: true`. */
import { L, Lp, WW, WY0, blitLayer, newLayer, put, rect } from '../engine/gfx';
import { hashf, mulberry32 } from '../engine/math';
import {
  CBEIGE, CBLUE, CGREEN, CHURCHL, CNAVY, CORNG, CRED, CYELL, FBLUE, FLILAC, FORNG, FPINK, HAIR1, HAIR2, LEAFG, LEAFGD, LEDW, LIGHT,
  SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, STONEL, TILEW, VOID, WOOD, WWARM,
} from '../engine/palette';
import { setupAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S } from '../sky/state';
import { drawSky } from './common';
import { text, textW } from './br-kit';
import { mallGrade, skylightRain } from './partage-kit';
import { cinemaDoorTap, insideCrowd, mallOpen, shutterAt } from './partage-rules';
import type { Scene } from './types';

// ---------- geometry (world space) ----------
/** Skylight boxes in the roof, the clerestory glass, the soffit, the speaker band, the counters, the floor. */
const SKY_TOP = -150, SKY_BOT = -40, CLER_TOP = -10, CLER_BOT = 14, SPK = 40, CTR_TOP = 50, CTR_BOT = 106;
const BOXES: [number, number][] = [[16, 144], [184, 296], [336, 464]];
/** The cinema's front: from here to the right edge. */
const CIN = 304;
/** The box office opening in the cinema's wall. */
const BOX = { x0: 312, x1: 452, top: 52 };
/** The passage back to the shops. */
const PASS = { x0: 84, x1: 124 };
/** The stanchions of the box office queue, and where the queue stands. */
const QY = 134, Q0 = 330, Q1 = 440;
/** Table rows (table-top y) and the tables' x, clear of the columns' bases. */
const ROWS = [142, 156];
const TABLES = [12, 44, 76, 108, 140, 206, 238, 270];
/** The Y columns: base x and the roof points their three arms reach. */
const COLS = [{ x: 176, arms: [126, 176, 232] }, { x: 300, arms: [250, 300, 352] }];

interface Counter { x: number; w: number; name: string; bg: number; fg: number; tilde?: number }
const COUNTERS: Counter[] = [
  { x: 0, w: 42, name: 'SUCOS', bg: CGREEN, fg: TILEW },
  { x: 42, w: 42, name: 'TAPIOCA', bg: FORNG, fg: TILEW },
  { x: 124, w: 60, name: 'LANCHAO', bg: CYELL, fg: CRED, tilde: 5 },
  { x: 184, w: 56, name: 'BURGER', bg: CRED, fg: CYELL },
  { x: 240, w: 64, name: 'PASTEL', bg: CNAVY, fg: CYELL },
];
const SHIRTS = [CRED, CBLUE, CYELL, CGREEN, FPINK, FORNG, FLILAC, CNAVY, TILEW, VOID];
const SKINS = [SKIN1, SKIN2, SKIN3, SKIN4];

const hall = newLayer();
const rr = mulberry32(0x5a1a7);

// ---------- static hall ----------
function buildRoof() {
  // the roof underside, white, with beams; the skylight boxes are left transparent (the real sky shows)
  L(hall, 0, WY0, WW, SKY_BOT - WY0, TILEW);
  for (let x = 8; x < WW; x += 32) L(hall, x, WY0, 2, SKY_TOP - WY0, STONEL);
  for (const [a, b] of BOXES) {
    // the box's deep white sides, then the glass with its grid of ribs
    L(hall, a - 4, SKY_TOP - 4, b - a + 8, 4, STONEL); L(hall, a - 4, SKY_BOT, b - a + 8, 2, STONEL);
    L(hall, a - 4, SKY_TOP, 4, SKY_BOT - SKY_TOP, STONEL); L(hall, b, SKY_TOP, 4, SKY_BOT - SKY_TOP, STONEL);
    for (let y = SKY_TOP; y < SKY_BOT; y++) for (let x = a; x < b; x++) {
      if ((x - a) % 16 === 0 || (y - SKY_TOP) % 22 === 0) Lp(hall, x, y, TILEW);
      else Lp(hall, x, y, 255); // glass: transparent
    }
  }
  // the high wall with its band of clerestory glass, then the soffit with downlights
  L(hall, 0, SKY_BOT + 2, WW, CLER_TOP - SKY_BOT - 2, TILEW);
  L(hall, 0, CLER_TOP - 2, WW, 2, STONEL); L(hall, 0, CLER_BOT, WW, 2, STONEL);
  for (let x = 0; x < WW; x += 20) L(hall, x, CLER_TOP, 2, CLER_BOT - CLER_TOP, TILEW);
  L(hall, 0, CLER_BOT + 2, WW, SPK - CLER_BOT - 2, TILEW);
  for (let x = 10; x < CIN; x += 20) L(hall, x, SPK - 2, 3, 1, LIGHT);
  // the grey band with round speakers over the counters
  L(hall, 0, SPK, CIN, CTR_TOP - SPK, STONEL); L(hall, 0, CTR_TOP - 1, CIN, 1, STONE);
  for (let x = 14; x < CIN - 6; x += 24) { L(hall, x, SPK + 3, 4, 4, TILEW); L(hall, x + 1, SPK + 4, 2, 2, STEEL); }
}

/** One counter: the lit board, the kitchen behind with menu boards, the counter top. */
function counter(c: Counter) {
  const { x, w } = c;
  L(hall, x, CTR_TOP, w, CTR_BOT - CTR_TOP, VOID);
  L(hall, x + 2, CTR_TOP + 1, w - 4, 11, c.bg);
  const tx = x + 2 + ((w - 4 - textW(c.name)) >> 1);
  text(hall, c.name, tx, CTR_TOP + 4, c.fg);
  if (c.tilde !== undefined) { const ax = tx + c.tilde * 4; Lp(hall, ax, CTR_TOP + 3, c.fg); Lp(hall, ax + 1, CTR_TOP + 2, c.fg); Lp(hall, ax + 2, CTR_TOP + 3, c.fg); }
  // the kitchen: a lit back wall, menu boards with pictures of the food, a steel hood
  L(hall, x + 3, CTR_TOP + 13, w - 6, 32, CHURCHL);
  L(hall, x + 3, CTR_TOP + 13, w - 6, 3, STEEL);
  for (let mx = x + 5; mx + 10 < x + w - 3; mx += 12) {
    L(hall, mx, CTR_TOP + 18, 10, 8, VOID); L(hall, mx + 1, CTR_TOP + 19, 8, 3, [CORNG, CYELL, FORNG, CRED][(rr() * 4) | 0]); L(hall, mx + 1, CTR_TOP + 23, 6, 1, TILEW);
  }
  // the counter: steel top, a coloured front
  L(hall, x + 2, CTR_BOT - 12, w - 4, 2, STEEL); L(hall, x + 2, CTR_BOT - 10, w - 4, 10, c.bg); L(hall, x + 2, CTR_BOT - 10, w - 4, 1, VOID);
  L(hall, x, CTR_TOP, 1, CTR_BOT - CTR_TOP, STONE); L(hall, x + w - 1, CTR_TOP, 1, CTR_BOT - CTR_TOP, STONE);
}

/** The passage back to the shops: a corridor opening with a lit "LOJAS <-" sign. */
function buildPassage() {
  const { x0, x1 } = PASS;
  L(hall, x0, CTR_TOP, x1 - x0, CTR_BOT - CTR_TOP, TILEW);
  for (let y = CTR_TOP + 14; y < CTR_BOT; y++) {
    const t = Math.min(1, (y - CTR_TOP - 14) / 14), a = Math.round(x0 + 4 + 8 * t), b = Math.round(x1 - 4 - 8 * t);
    L(hall, x0 + 4, y, a - x0 - 4, 1, STONEL); L(hall, b, y, x1 - 4 - b, 1, STONEL);
    L(hall, a, y, b - a, 1, y > CTR_BOT - 10 ? CBEIGE : CHURCHL);
  }
  L(hall, x0 + 3, CTR_TOP + 2, x1 - x0 - 6, 10, CNAVY);
  const tx = x0 + 3 + ((x1 - x0 - 6 - textW('LOJAS') - 6) >> 1) + 6;
  text(hall, 'LOJAS', tx, CTR_TOP + 4, TILEW);
  L(hall, tx - 6, CTR_TOP + 6, 4, 1, CYELL); Lp(hall, tx - 5, CTR_TOP + 5, CYELL); Lp(hall, tx - 5, CTR_TOP + 7, CYELL); Lp(hall, tx - 6, CTR_TOP + 6, CYELL);
}

/** The cinema's front: the beige wall, CINESERTÃO in big red letters, the box office and its posters. */
function buildCinema() {
  L(hall, CIN, CLER_BOT + 2, WW - CIN, CTR_BOT - CLER_BOT - 2, CBEIGE);
  L(hall, CIN, CLER_BOT + 2, 2, CTR_BOT - CLER_BOT - 2, STONEL);
  const name = 'CINESERTAO', nx = BOX.x0 + ((BOX.x1 - BOX.x0 - textW(name, 3)) >> 1), ny = 22;
  text(hall, name, nx + 1, ny + 1, VOID, 3); text(hall, name, nx, ny, CRED, 3);
  const ax = nx + 8 * 12; L(hall, ax, ny - 3, 3, 2, CRED); L(hall, ax + 3, ny - 5, 3, 2, CRED); L(hall, ax + 6, ny - 3, 3, 2, CRED); // the tilde of CINESERTÃO
  text(hall, 'CINEMAS', BOX.x0 + ((BOX.x1 - BOX.x0 - textW('CINEMAS')) >> 1), ny + 18, CRED);
  // the opening: a grey band over the box office, the dark red counter wall, the counter
  L(hall, BOX.x0, BOX.top, BOX.x1 - BOX.x0, CTR_BOT - BOX.top, STONEL);
  L(hall, BOX.x0, BOX.top, BOX.x1 - BOX.x0, 1, STONE);
  text(hall, 'BILHETERIA', BOX.x0 + 52, BOX.top + 3, TILEW);
  L(hall, BOX.x0 + 30, BOX.top + 10, BOX.x1 - BOX.x0 - 30, CTR_BOT - BOX.top - 10, CRED);
  for (let y = BOX.top + 12; y < CTR_BOT - 14; y += 4) L(hall, BOX.x0 + 30, y, BOX.x1 - BOX.x0 - 30, 1, CORNG);
  // the entrance to the rooms on the left of the opening, under a little "ENTRADA" board
  L(hall, BOX.x0 + 2, BOX.top + 10, 26, CTR_BOT - BOX.top - 10, VOID);
  L(hall, BOX.x0 + 2, BOX.top + 11, 26, 7, CNAVY); text(hall, 'SALAS', BOX.x0 + 6, BOX.top + 12, CYELL);
  // the box office windows: a long counter, three ticket screens and a tiled panel
  L(hall, BOX.x0 + 32, CTR_BOT - 16, 70, 3, STEEL); L(hall, BOX.x0 + 32, CTR_BOT - 13, 70, 13, STONE);
  for (let i = 0; i < 3; i++) { const wx = BOX.x0 + 38 + i * 22; L(hall, wx, BOX.top + 16, 14, 8, VOID); L(hall, wx + 1, BOX.top + 17, 12, 6, FBLUE); }
  for (let y = BOX.top + 28; y < CTR_BOT - 18; y += 3) for (let x = BOX.x0 + 34; x < BOX.x0 + 100; x += 3) Lp(hall, x + ((y >> 1) & 1), y, TILEW);
  // the posters on the red wall, each in a lit frame (generic colour blocks, no titles)
  for (const [i, a, b] of [[0, CNAVY, CYELL], [1, VOID, CRED], [2, CBLUE, FORNG]] as const) {
    const px = BOX.x0 + 104 + i * 12;
    L(hall, px - 1, BOX.top + 14, 10, 16, LEDW); L(hall, px, BOX.top + 15, 8, 14, a); L(hall, px + 1, BOX.top + 17, 6, 5, b); L(hall, px + 1, BOX.top + 25, 6, 1, TILEW);
  }
  L(hall, BOX.x1 - 1, BOX.top, 1, CTR_BOT - BOX.top, STONE);
}

function buildFloor() {
  // the black-and-white floor: wide stripes across the hall, polished, the counters mirrored near the base
  for (let y = CTR_BOT; y < 180; y++) {
    const d = y - CTR_BOT, band = Math.floor(d / 6) & 1;
    for (let x = 0; x < WW; x++) {
      const k = Math.floor((x + d * 0.7) / 18) & 1;
      Lp(hall, x, y, band && k ? STEEL : (x + Math.round(d * 0.7)) % 18 === 0 ? STONEL : CHURCHL);
    }
  }
  L(hall, 0, CTR_BOT, WW, 1, STONE);
  for (const c of COUNTERS) for (let y = CTR_BOT + 1; y < CTR_BOT + 7; y++) for (let x = c.x + 4; x < c.x + c.w - 4; x += 2) Lp(hall, x + (y & 1), y, c.bg);
}

function buildPlanters() {
  // low dark planters of tall grass at the front of the food court
  for (const [x0, x1] of [[0, 52], [212, 262]]) {
    L(hall, x0, 170, x1 - x0, 10, VOID); L(hall, x0, 170, x1 - x0, 1, STEEL);
    for (let x = x0 + 1; x < x1 - 1; x++) { const h = 4 + ((rr() * 7) | 0); L(hall, x, 170 - h, 1, h, rr() < 0.5 ? LEAFG : LEAFGD); }
  }
}

// ---------- dynamic ----------
const wd = () => S.cal.weekday, hr = () => S.cal.hour;
const isOpen = () => mallOpen(wd(), hr());
const cinemaOn = () => cinemaDoorTap(wd(), hr()).enter;
/** A fresh crowd every few minutes, from the clock (so #at= shows the same tables). */
const slot = () => Math.floor(S.ms / 240_000);

/** Roll-down grilles on the counters: up while open, coming down one by one before closing. */
function shutters() {
  COUNTERS.forEach((c, i) => {
    const k = shutterAt(wd(), hr(), i, COUNTERS.length);
    if (k <= 0) return;
    const top = CTR_TOP + 12, h = Math.round((CTR_BOT - top) * k);
    rect(c.x + 2, top, c.w - 4, h, STONEL);
    for (let y = top + 1; y < top + h; y += 3) rect(c.x + 2, y, c.w - 4, 1, STONE);
    rect(c.x + 2, top + h - 1, c.w - 4, 1, STEEL);
  });
}

/** A standing figure, side-on (for the counter staff, the box office and the queue). */
function figure(x: number, feet: number, shirt: number, skin: number, hair: number, legs = CNAVY) {
  rect(x - 1, feet - 6, 1, 6, legs); rect(x + 1, feet - 6, 1, 6, legs);
  rect(x - 2, feet - 12, 5, 6, shirt); rect(x - 1, feet - 16, 3, 4, skin); rect(x - 1, feet - 17, 3, 1, hair);
}

/** Staff behind the counters while they are open: an apron colour per counter, someone at the till. */
function staff() {
  COUNTERS.forEach((c, i) => {
    if (shutterAt(wd(), hr(), i, COUNTERS.length) > 0) return;
    const n = c.w > 50 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const x = c.x + 10 + k * (c.w - 22) + (((S.ms / 1000 / (5 + i + k)) | 0) % 3) * 2;
      figure(x, CTR_BOT - 10, c.bg === CYELL ? CRED : c.bg, SKINS[(i + k) % 4], k ? HAIR2 : HAIR1);
      rect(x - 1, CTR_BOT - 18, 3, 1, TILEW); // a cap
    }
  });
  // the box office: attendants at the windows while the cinema sells tickets
  if (cinemaOn()) for (let i = 0; i < 3; i++) if (i !== 1 || insideCrowd(wd(), hr()) > 1.2) {
    const x = BOX.x0 + 45 + i * 22;
    rect(x - 2, CTR_BOT - 22, 5, 6, CRED); rect(x - 1, CTR_BOT - 26, 3, 4, SKINS[(i + 1) % 4]); rect(x - 1, CTR_BOT - 27, 3, 1, HAIR1);
  }
}

/** The screen by the box office, playing trailers (colour shots, cut every few seconds) while the cinema is on. */
function screen() {
  const x = 456, y = 60, t = S.ms / 1000;
  rect(x - 1, y - 1, 20, 14, VOID);
  if (!cinemaOn()) { rect(x, y, 18, 12, STEEL); return; }
  const shot = Math.floor(t / 4), a = SHIRTS[shot % 8], b = SHIRTS[(shot * 3 + 1) % 8];
  rect(x, y, 18, 12, CNAVY); rect(x, y + 7, 18, 5, a); rect(x + 3 + (shot % 9), y + 3, 5, 5, b);
  if (Math.floor(t * 2) % 7 === 0) rect(x, y, 18, 1, LEDW);
}

/** The stanchions and their belt, and the people waiting in line while tickets are on sale. */
function queue() {
  const on = cinemaOn(), n = on ? Math.min(6, Math.round(1 + insideCrowd(wd(), hr()) * 1.6)) : 0;
  for (let i = 0; i < n; i++) {
    const h = hashf(i * 7.7 + slot() * 1.3);
    figure(Q1 - 8 - i * 12 + Math.round(h * 4), QY + 2, SHIRTS[(h * 10) | 0], SKINS[(h * 41) & 3], h > 0.5 ? HAIR1 : HAIR2, h > 0.7 ? WOOD : CNAVY);
  }
  for (let x = Q0; x <= Q1; x += 14) { rect(x, QY - 9, 1, 11, STEEL); rect(x - 1, QY + 1, 3, 1, STEEL); }
  rect(Q0, QY - 8, Q1 - Q0, 1, VOID);
}

/** The white Y columns: a trunk rising from the floor, branching into three arms up to the roof. */
function columns() {
  for (const c of COLS) {
    const base = 152, fork = 66;
    rect(c.x - 2, fork, 4, base - fork, TILEW); rect(c.x + 1, fork, 1, base - fork, STONEL);
    rect(c.x - 4, base - 2, 8, 3, STONEL);
    for (const ex of c.arms) {
      const ey = SKY_BOT + 2, n = fork - ey;
      for (let i = 0; i <= n; i++) {
        const x = Math.round(c.x + ((ex - c.x) * i) / n), y = fork - i;
        rect(x - 1, y, 3, 1, TILEW); put(x + 1, y, STONEL);
      }
    }
  }
}

/** How full the tables are: nobody while closed, more with the mall's crowd. */
const occupancy = () => (isOpen() ? Math.min(0.75, 0.12 + 0.2 * insideCrowd(wd(), hr())) : 0);
/** Every chair: its x, the row's table-top y, which side of the table, and whether someone sits there now. */
function seats() {
  const occ = occupancy(), out: { cx: number; ty: number; side: number; seat: number; taken: boolean }[] = [];
  ROWS.forEach((ty, r) => TABLES.forEach((tx, j) => {
    const x = tx + (r ? 10 : 0);
    for (const side of [-1, 1]) {
      const seat = (r * 16 + j) * 2 + (side > 0 ? 1 : 0);
      out.push({ cx: x + (side < 0 ? -6 : 13), ty, side, seat, taken: occ > 0 && hashf(seat * 3.1 + slot() * 0.77) < occ });
    }
  }));
  return out;
}

/** The tables and their yellow chairs, with diners seated as the mall's crowd allows. */
function tables() {
  const occ = occupancy();
  for (const { cx, ty, side, seat, taken } of seats()) {
    if (taken) { // a diner, facing the table
      const h = hashf(seat * 5.3 + slot());
      rect(cx, ty - 9, 3, 7, SHIRTS[(h * 10) | 0]); rect(cx, ty - 13, 3, 4, SKINS[(h * 37) & 3]); rect(cx, ty - 14, 3, 1, h > 0.5 ? HAIR1 : HAIR2);
      put(side < 0 ? cx + 3 : cx - 1, ty - 1, SKINS[(h * 37) & 3]); // a hand on the table
    }
    // the chair: seat, legs and a back on the far side
    rect(cx - 1, ty + 1, 5, 1, CYELL); rect(cx - 1, ty + 2, 1, 5, CYELL); rect(cx + 3, ty + 2, 1, 5, CYELL);
    const bx = side < 0 ? cx - 1 : cx + 3; rect(bx, ty - 6, 1, 7, CYELL);
  }
  ROWS.forEach((ty, r) => TABLES.forEach((tx, j) => {
    const x = tx + (r ? 10 : 0);
    rect(x - 1, ty, 12, 2, VOID); rect(x + 4, ty + 2, 2, 5, VOID); rect(x + 2, ty + 7, 6, 1, VOID);
    if (occ > 0 && hashf(j * 9.1 + r * 3 + slot()) < occ) { rect(x + 1, ty - 2, 3, 2, [CRED, CYELL, TILEW][j % 3]); put(x + 7, ty - 2, WWARM); }
  }));
}

function update(dt: number) {
  tickSpawns(dt, insideCrowd(wd(), hr())); updatePeople(dt);
}

const inPane = (x: number, y: number) => (y >= CLER_TOP ? x % 20 > 1 : BOXES.some(([a, b]) => x > a && x < b));

function render() {
  drawSky(CLER_BOT);
  blitLayer(hall);
  skylightRain(SKY_TOP, SKY_BOT, inPane);
  skylightRain(CLER_TOP, CLER_BOT, inPane);
  staff();
  shutters();
  screen();
  queue();
  drawPeople();
  columns();
  tables();
}

/** Where tapping the cinema's box office / doors lands, and the LOJAS passage. */
const onCinema = (x: number, y: number) => x >= BOX.x0 && x <= BOX.x1 && y >= BOX.top - 34 && y <= CTR_BOT + 2;
const onPass = (x: number, y: number) => x >= PASS.x0 && x <= PASS.x1 && y >= CTR_TOP && y <= CTR_BOT + 2;

let built = false;
export const partageAlimentacao: Scene = {
  id: 'partage-alimentacao',
  name: 'Partage · Praça de alimentação',
  build() {
    if (!built) { buildRoof(); COUNTERS.forEach(counter); buildPassage(); buildCinema(); buildFloor(); buildPlanters(); built = true; }
    // the aisle in front of the counters and the cinema, and the front of the hall; indoors, no bikes
    setLanes([{ y: 118 }, { y: 123 }, { y: 179 }], { bikes: false, indoor: true });
    setupAnimals({ ground: [], dogs: 0 });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  grade: () => mallGrade(isOpen()),
  daylit: true,
  debug() { return `mall ${isOpen() ? 'aberto' : 'fechado'}  cinema ${cinemaOn() ? 'on' : 'off'}  people x${peopleCount()}  crowd ${insideCrowd(wd(), hr()).toFixed(2)}`; },
  hintSpots() {
    const spots = [{ x: (PASS.x0 + PASS.x1) >> 1, y: CTR_TOP - 2, kind: 'door' as const }];
    if (cinemaDoorTap(wd(), hr()).enter) spots.push({ x: (BOX.x0 + BOX.x1) >> 1, y: BOX.top - 2, kind: 'door' as const });
    return spots;
  },
  hint() { return { x: (PASS.x0 + PASS.x1) >> 1, y: CTR_TOP, text: 'Toque em LOJAS pra voltar' }; },
  tap(x, y) {
    if (onPass(x, y)) return { x: (PASS.x0 + PASS.x1) >> 1, y: CTR_TOP, goto: 'partage-interior' };
    // the cinema: into the room while both the mall and the cinema are open, otherwise when it opens
    if (onCinema(x, y)) {
      const d = cinemaDoorTap(wd(), hr()), cx = (BOX.x0 + BOX.x1) >> 1;
      return d.enter ? { x: cx, y: BOX.top, goto: 'cinema-partage' } : { x: cx, y: BOX.top, say: d.say };
    }
    // someone at a counter
    if (y >= CTR_TOP + 12 && y <= CTR_BOT - 8) {
      const i = COUNTERS.findIndex((c) => x >= c.x && x < c.x + c.w);
      if (i >= 0 && shutterAt(wd(), hr(), i, COUNTERS.length) <= 0) return { x: COUNTERS[i].x + 11, y: CTR_BOT - 28, speaker: { role: 'vendor' } };
    }
    // a diner at the tables
    const d = seats().find((s) => s.taken && x >= s.cx - 2 && x <= s.cx + 4 && y >= s.ty - 15 && y <= s.ty + 2);
    if (d) return { x: d.cx + 1, y: d.ty - 15, speaker: { role: 'passerby' } };
    return null;
  },
};
