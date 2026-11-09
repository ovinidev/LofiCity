/* CINEMA (Remígio, PB): the inside of a movie theatre seen from the back row. A wide, slightly
   curved screen fills the front wall; rows of black reclining seats step down on both sides of a
   central aisle lit by blue LED step lights; small blue wall lights glow on the side walls; a few
   people sit scattered in the rows, one walks down the aisle and two stand near the front left.

   The screen runs a code-drawn, generic superhero action "movie": short seeded shots (armoured
   flyer, shield thrower, hammer and lightning, a caped green villain, a helicopter over a city at
   night, close-up brawls) with flashes, explosions, camera shake and black trailer-style cuts.
   No logos, no title, no real frames: only generic silhouettes and colour schemes.

   Indoors, so the sky and the weather play no part. The room lights itself: the scene owns the
   palette (grade()) and the seats, heads and walls are tinted by the average colour of whatever is
   on screen, so a bright explosion brightens the room. Sessions follow the city's real clock
   (art direction, see cinema-rules.ts): 14:00-23:00, otherwise the screen is dark, the house work
   lights are dimly on and the room is empty. Drawn from a reference photo of a modern multiplex. */
import { G, L, Lget, Lp, WW, WY0, blitLayer, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, hashf, mulberry32, vnoise } from '../engine/math';
import {
  AMB, AMBD, ASPH, BARK, BFAR, BMID, BNEAR, BOLT, CBLUE, CGREEN, CHURCH, CHURCHD, CHURCHL, CLOUD, CLOUDD, CNAVY, CORNG, CYAN, CYAND,
  FARB, FBLUE, FGREEN, FLILAC, FOG, FORNG, FPINK, FWG, GLOWI, GLOWO, GOLD, HAIR1, HAIR2, HAIR3, HALO, HAZE, LEAF1, LEAF2, LEAFG,
  LEDW, LIGHT, MANTO, MOMIJI, NIGHT_RGB, NPAL, PAL32, RAIN, RAINB, SAKURA, SAKURAD, SIGR, SKIN2, SKIN4, SKY1, SKY2, SKY3, SKY4,
  STEEL, STONE, SUN, TERRA, TILEW, UMB, VOID, WCOOL, WET, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { setupAnimals } from '../actors/animals';
import { S } from '../sky/state';
import { type Session, type Shot, screenNotice, sessionAt, shotAt } from './cinema-rules';
import type { Scene } from './types';

// ---------- the scene's own palette ----------
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Fixed colours for every index while this scene is on (night colours unless overridden below). */
const RGB = NIGHT_RGB.map((c) => [...c]);

// room: a base colour, how much screen light it catches and how much the house lights add
const R = {
  BLACK: VOID, CEIL: RAIN, WALL: BFAR, WALL2: BMID, SEAT: BNEAR, SEATM: ASPH, RIMF: STEEL, RIMN: STONE, FLOOR: WET,
  CARPET: CNAVY, STEP: FBLUE, SCR: FOG, SCR2: CLOUDD, HAIR: HAIR1, HAIRL: HAIR2, HAIRR: HAIR3, SKIN: SKIN4, SHIRT: CBLUE,
  LED: CYAN, LEDG: CYAND, EXIT: WCOOL,
};
const ROOM: { i: number; base: number[]; gain: number; house: number }[] = [
  { i: R.BLACK, base: hex('#040408'), gain: 0.03, house: 0.05 },
  { i: R.CEIL, base: hex('#06070c'), gain: 0.05, house: 0.12 },
  { i: R.WALL, base: hex('#0b0f17'), gain: 0.1, house: 0.32 },
  { i: R.WALL2, base: hex('#0e131c'), gain: 0.15, house: 0.38 },
  { i: R.SEAT, base: hex('#08080c'), gain: 0.07, house: 0.12 },
  { i: R.SEATM, base: hex('#121319'), gain: 0.16, house: 0.24 },
  { i: R.RIMF, base: hex('#1c1f28'), gain: 0.62, house: 0.5 },
  { i: R.RIMN, base: hex('#181a22'), gain: 0.38, house: 0.42 },
  { i: R.FLOOR, base: hex('#08090e'), gain: 0.08, house: 0.14 },
  { i: R.CARPET, base: hex('#0c1630'), gain: 0.06, house: 0.16 },
  { i: R.STEP, base: hex('#22468e'), gain: 0.05, house: 0.12 },
  { i: R.SCR, base: hex('#161c26'), gain: 0.55, house: 0.1 },
  { i: R.SCR2, base: hex('#10141c'), gain: 0.32, house: 0.08 },
  { i: R.HAIR, base: hex('#141217'), gain: 0.12, house: 0.18 },
  { i: R.HAIRL, base: hex('#2a252b'), gain: 0.7, house: 0.45 },
  { i: R.HAIRR, base: hex('#3a1a14'), gain: 0.5, house: 0.45 },
  { i: R.SKIN, base: hex('#2a1e20'), gain: 0.55, house: 0.55 },
  { i: R.SHIRT, base: hex('#0e121c'), gain: 0.22, house: 0.3 },
];
// emissive room lights: constant
for (const [i, h] of [[R.LED, '#3a72ff'], [R.LEDG, '#14286a'], [R.EXIT, '#9fd8ff']] as const) RGB[i] = hex(h);

// film colours (fixed: the picture is a light source)
const F = {
  BLACK: FARB, SKY: SKY1, SKY2: SKY2, SKY3: SKY3, CITY: SKY4, CITY2: HAZE, WIN: WWARM, WINB: GLOWO, WINC: GLOWI,
  FIRE0: SUN, FIRE1: LIGHT, FIRE2: AMB, FIRE3: AMBD, SMOKE: CLOUD, BRIDGE: WOOD, RAIL: TERRA, ROAD: FPINK,
  RED: MOMIJI, GOLD: GOLD, BLUE: MANTO, SHR: SIGR, SHW: TILEW, DOOMG: CGREEN, DOOMM: CHURCHD, DOOMD: CHURCH, GREEN: FWG,
  BOLT: BOLT, BOLT2: RAINB, CAPE: FORNG, ARMOR: CHURCHL, SKIN: SKIN2, HAIRF: LEAF1, SIL: BARK, HELI: UMB, NAV: CORNG,
  BEAM: HALO, FLARE: LEDW, WHITE: WHITE, PURP: FLILAC, PURP2: FGREEN, GROUND: LEAF2, RUBBLE: LEAFG, TEXT: SAKURA, SLIDE: SAKURAD,
};
for (const [i, h] of [
  [F.BLACK, '#030305'], [F.SKY, '#050916'], [F.SKY2, '#0c1430'], [F.SKY3, '#1c1638'], [F.CITY, '#080b14'], [F.CITY2, '#111626'],
  [F.WIN, '#d0a050'], [F.WINB, '#4f86ff'], [F.WINC, '#a8c4ff'], [F.FIRE0, '#fffbe8'], [F.FIRE1, '#ffd77e'], [F.FIRE2, '#ff9a30'],
  [F.FIRE3, '#b4481a'], [F.SMOKE, '#2a2128'], [F.BRIDGE, '#2c1e1c'], [F.RAIL, '#d88c50'], [F.ROAD, '#141318'],
  [F.RED, '#b8281e'], [F.GOLD, '#e2b440'], [F.BLUE, '#2a4cb4'], [F.SHR, '#d8382a'], [F.SHW, '#e8e8ea'], [F.DOOMG, '#1d5a2a'],
  [F.DOOMM, '#8e94a0'], [F.DOOMD, '#2a2d34'], [F.GREEN, '#7dff8a'], [F.BOLT, '#f0f2ff'], [F.BOLT2, '#94aaff'], [F.CAPE, '#9e1c1c'],
  [F.ARMOR, '#5a5f6c'], [F.SKIN, '#c48c6a'], [F.HAIRF, '#c8a048'], [F.SIL, '#0b0b0f'], [F.HELI, '#26282f'], [F.NAV, '#ff5a2a'],
  [F.BEAM, '#fff0c0'], [F.FLARE, '#c8e2ff'], [F.WHITE, '#ffffff'], [F.PURP, '#3a2462'], [F.PURP2, '#6a46b8'], [F.GROUND, '#17131a'],
  [F.RUBBLE, '#2a2228'], [F.TEXT, '#8ea4bc'], [F.SLIDE, '#1a2430'],
] as const) RGB[i] = hex(h);

// ---------- geometry (world space) ----------
/** The movie picture: the film is always drawn in these picture coordinates (244 x 84). */
const PX0 = 128, PY0 = -70, PW = 244, PH = 84;
const STAGE = 34, ROWS = 10, AX = 276;
/** Where the screen sits on the front wall: the curved surface (SX0..SX1, STOP..SBOT) and the picture
    rectangle shown on it (px, py, pw, ph). */
interface Geo { SCX: number; SX0: number; SX1: number; STOP: number; SBOT: number; px: number; py: number; pw: number; ph: number }
/** Landscape: the wide screen as in the photo; the picture is drawn 1:1. */
const WIDE: Geo = { SCX: 250, SX0: 96, SX1: 404, STOP: -86, SBOT: 24, px: PX0, py: PY0, pw: PW, ph: PH };
/** Narrow (portrait) frames show only ~230 world px, less than the 308 px screen: the same screen is
    drawn at about 2/3 scale, centred in the frame and still standing on the stage, and the film is
    scaled down into it, so the whole picture stays visible. */
const NARROW: Geo = { SCX: 240, SX0: 140, SX1: 340, STOP: -48, SBOT: 24, px: 161, py: -38, pw: 158, ph: 55 };
/** The wide layout needs the whole curved screen (plus its frame) inside the frame. */
const geoFor = (frameW: number): Geo => (frameW >= WIDE.SX1 - WIDE.SX0 + 12 ? WIDE : NARROW);
const screenTop = (g: Geo, x: number) => Math.round(g.STOP - 4 * ((x - g.SCX) / (g.SX1 - g.SCX)) ** 2);
const screenBot = (g: Geo, x: number) => Math.round(g.SBOT + 3 * ((x - g.SCX) / (g.SX1 - g.SCX)) ** 2);

interface Row { y: number; h: number; w: number; gap: number; hw: number; l: number; r: number; u: number }
const ROW: Row[] = Array.from({ length: ROWS }, (_, k) => {
  const u = k / (ROWS - 1);
  return {
    u, y: Math.round(42 + 136 * u ** 1.35), h: Math.round(5 + 24 * u), w: Math.round(11 + 30 * u), gap: Math.max(1, Math.round(1 + 2 * u)),
    hw: Math.round(6 + 20 * u), l: Math.round(108 - 150 * u), r: Math.round(398 + 140 * u),
  };
});
/** Left edge of seat n (0 = next to the aisle) on a side (-1 left, +1 right) of row k. */
function seatX(k: number, side: number, n: number) {
  const r = ROW[k], step = r.w + r.gap;
  return side < 0 ? AX - r.hw - r.gap - r.w - n * step : AX + r.hw + r.gap + n * step;
}

// ---------- static room ----------
/** One static room layer per screen layout, built on first use. */
const rooms = new Map<Geo, Uint8Array>();
let room = newLayer();

function roomFor(g: Geo) {
  let ly = rooms.get(g);
  if (!ly) { ly = room = newLayer(); buildRoom(g); rooms.set(g, ly); }
  return ly;
}

function buildRoom(g: Geo) {
  const { SX0, SX1 } = g, rr = mulberry32(0xc1e);
  L(room, 0, WY0, WW, 180 - WY0, R.BLACK);
  // ceiling and front wall around the screen
  for (let y = WY0; y < 180; y++) for (let x = 0; x < WW; x++) {
    const lw = y < STAGE + (SX0 - x) * 0.45 && x < SX0, rw = y < STAGE - 8 + (x - SX1) * 0.4 && x >= SX1;
    const lTop = -86 - (SX0 - x) * 1.25, rTop = -86 - (x - SX1) * 1.25;
    if (x < SX0) Lp(room, x, y, y < lTop ? R.CEIL : lw ? (bay(x, y) < 0.25 + 0.5 * (x / SX0) ** 2 ? R.WALL2 : R.WALL) : R.BLACK);
    else if (x >= SX1) Lp(room, x, y, y < rTop ? R.CEIL : rw ? (bay(x, y) < 0.25 + 0.5 * ((WW - x) / (WW - SX1)) ** 2 ? R.WALL2 : R.WALL) : R.BLACK);
    else Lp(room, x, y, y < -100 ? R.CEIL : y < STAGE ? R.WALL : R.BLACK);
  }
  // ceiling slats receding towards the screen (seen on tall portrait screens)
  for (let i = 1; i < 14; i++) {
    const y = Math.round(-104 - 3 * i ** 1.6);
    for (let x = 0; x < WW; x++) if (Lget(room, x, y) === R.CEIL) Lp(room, x, y, R.WALL);
  }
  // faint acoustic panel seams on the side walls
  // (whole rows only: a fractional y made Lp write 120-360 px to the side, stray lines in the ceiling)
  for (let x = 12; x < SX0; x += 21) for (let y = Math.ceil(-86 - (SX0 - x) * 1.25 + 2); y < STAGE + (SX0 - x) * 0.45 - 2; y++) Lp(room, x, y, R.WALL);
  for (let x = SX1 + 18; x < WW; x += 21) for (let y = Math.ceil(-86 - (x - SX1) * 1.25 + 2); y < STAGE - 8 + (x - SX1) * 0.4 - 2; y++) Lp(room, x, y, R.WALL);
  // the screen: a wide gently curved surface with a dark masking frame
  for (let x = SX0 - 3; x < SX1 + 3; x++) { const t = screenTop(g, x) - 3, b = screenBot(g, x) + 3; L(room, x, t, 1, b - t, R.BLACK); }
  for (let x = SX0; x < SX1; x++) {
    const t = screenTop(g, x), b = screenBot(g, x), edge = Math.abs(x - g.SCX) / (SX1 - g.SCX);
    for (let y = t; y < b; y++) Lp(room, x, y, bay(x, y) < edge * edge * 0.9 || y === t || y === b - 1 ? R.SCR2 : R.SCR);
  }
  // stage step and the floor in front of the first row
  L(room, SX0 - 30, g.SBOT + 6, SX1 - SX0 + 60, STAGE - g.SBOT - 6, R.FLOOR);
  L(room, SX0 - 30, STAGE - 1, SX1 - SX0 + 60, 1, R.RIMN);
  L(room, SX0 - 40, STAGE, SX1 - SX0 + 80, 8, R.FLOOR);
  // aisle: stepped carpet with blue LED nosings
  for (let k = 0; k < ROWS; k++) {
    const a = ROW[k], b = ROW[k + 1] ?? { y: 182, hw: 30 };
    for (let y = a.y - 2; y < b.y; y++) {
      const f = (y - a.y) / Math.max(1, b.y - a.y), hw = Math.round(a.hw + (b.hw - a.hw) * f);
      for (let x = AX - hw; x <= AX + hw; x++) {
        const pat = k > 3 && ((x + y) % 5 === 0 || (x - y + 500) % 5 === 0);
        Lp(room, x, y, pat ? R.FLOOR : R.CARPET);
      }
    }
    const ny = a.y + Math.round(a.h * 0.75);
    L(room, AX - a.hw, ny, a.hw * 2 + 1, 1, R.STEP);
    for (const side of [-1, 1]) {
      const lx = AX + side * (a.hw - 1);
      Lp(room, lx, ny - 1, R.LEDG); Lp(room, lx - side, ny, R.LEDG);
      Lp(room, lx, ny, R.LED); if (a.u > 0.5) Lp(room, lx + side * -1, ny, R.LED);
    }
    // a few LED dots along the tread
    if (a.u > 0.3) for (let x = AX - a.hw + 4; x < AX + a.hw - 3; x += 6) Lp(room, x, ny, R.LED);
  }
  // seats, far row first so nearer rows overlap
  for (let k = 0; k < ROWS; k++) {
    const r = ROW[k];
    for (const side of [-1, 1]) for (let n = 0; n < 30; n++) {
      const x = seatX(k, side, n);
      if (side < 0 ? x + r.w < r.l : x > r.r) break;
      seat(x, r.y, r.w, r.h, r.gap, k < 5 ? R.RIMF : R.RIMN);
    }
  }
  // blue wall lights (left low, right higher, as in the photo)
  for (const [x, y] of [[36, 34], [458, 22]]) {
    for (let dy = -3; dy <= 4; dy++) for (let dx = -2; dx <= 3; dx++) if (rr() < 0.55) Lp(room, x + dx, y + dy, R.LEDG);
    L(room, x, y, 2, 3, R.EXIT);
  }
  // small blue marker lights along the front of the stage
  for (let x = SX0 + 6; x < SX1; x += 34) Lp(room, x, STAGE + 1, R.LED);
}

/** One reclining seat seen from behind. */
function seat(x: number, y: number, w: number, h: number, gap: number, rim: number) {
  const rnd = h > 10 ? 2 : 1;
  L(room, x + rnd, y, w - rnd * 2, 1, rim);
  L(room, x, y + 1, w, h - 1, R.SEAT);
  if (rnd > 1) { Lp(room, x, y + 1, R.BLACK); Lp(room, x + w - 1, y + 1, R.BLACK); Lp(room, x + 1, y + 1, rim); Lp(room, x + w - 2, y + 1, rim); }
  else { Lp(room, x, y + 1, R.SEATM); Lp(room, x + w - 1, y + 1, R.SEATM); }
  if (h > 10) {
    L(room, x + 2, y + 1, w - 4, 1, R.SEATM);
    L(room, x + 2, y + Math.round(h * 0.38), w - 4, 1, R.SEATM); // headrest seam
    L(room, x, y + 2, 1, h - 2, R.SEATM);
    if (w > 22) L(room, x + (w >> 1) - 1, y + Math.round(h * 0.18), 2, 1, R.SEATM); // stitched logo
  }
  // armrest and cup holder between seats
  const ay = y + Math.round(h * 0.55);
  L(room, x + w, ay, Math.max(1, gap), h - (ay - y), R.SEAT);
  L(room, x + w, ay, Math.max(1, gap), 1, rim);
}

// ---------- tiny 3x5 font for the screen notices ----------
const GL: Record<string, string> = {
  A: '.X.X.XXXXX.XX.X', D: 'XX.X.XX.XX.XXX.', E: 'XXXX..XX.X..XXX', H: 'X.XX.XXXXX.XX.X', I: 'XXX.X..X..X.XXX', L: 'X..X..X..X..XXX',
  M: 'X.XXXXXXXX.XX.X', O: 'XXXX.XX.XX.XXXX', P: 'XX.X.XXX.X..X..', R: 'XX.X.XXX.X.XX.X', S: '.XXX...X...XXX.',
  V: 'X.XX.XX.XX.X.X.', X: 'X.XX.X.X.X.XX.X', Z: 'XXX..X.X.X..XXX', '0': 'XXXX.XX.XX.XXXX', '1': '.X.XX..X..X.XXX',
  '2': 'XX...X.X.X..XXX', '3': 'XX...X.X...XXX.', '4': 'X.XX.XXXX..X..X', '5': 'XXXX..XX...XXX.', '6': '.XXX..XXXX.XXXX',
  '7': 'XXX..X.X..X..X.', '8': 'XXXX.XXXXX.XXXX', '9': 'XXXX.XXXX..XXX.',
};
function text(s: string, cx: number, y: number, c: number) {
  let x = Math.round(cx - (s.length * 4 - 1) / 2);
  for (const ch of s) {
    const base = ch === 'Ã' ? 'A' : ch === 'Ó' ? 'O' : ch === 'Í' ? 'I' : ch;
    const g = GL[base];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === 'X') put(x + (i % 3), y + ((i / 3) | 0), c);
    if (ch === 'Ã') { put(x, y - 2, c); put(x + 1, y - 3, c); put(x + 2, y - 2, c); put(x + 3, y - 3, c); }
    if (ch === 'Ó' || ch === 'Í') { put(x + 1, y - 2, c); put(x + 2, y - 3, c); }
    x += 4;
  }
}

// ---------- the movie (picture coordinates, clipped to the picture) ----------
let shx = 0, shy = 0;
function mp(x: number, y: number, c: number) {
  x = Math.round(x + shx); y = Math.round(y + shy);
  if (x >= 0 && y >= 0 && x < PW && y < PH) put(PX0 + x, PY0 + y, c);
}
function mr(x: number, y: number, w: number, h: number, c: number) {
  let x0 = Math.round(x + shx), y0 = Math.round(y + shy), x1 = Math.round(x + w + shx), y1 = Math.round(y + h + shy);
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(PW, x1); y1 = Math.min(PH, y1);
  if (x1 > x0 && y1 > y0) rect(PX0 + x0, PY0 + y0, x1 - x0, y1 - y0, c);
}
function mline(x0: number, y0: number, x1: number, y1: number, c: number, w = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; if (w > 1) mr(x - (w >> 1), y - (w >> 1), w, w, c); else mp(x, y, c); }
}
function mdisc(cx: number, cy: number, r: number, c: number) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.6) mp(cx + dx, cy + dy, c);
}
/** Dither the whole picture towards a colour (flashes) or black (fades). */
function cover(k: number, c: number) {
  if (k <= 0) return;
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (bay(x, y) < k) put(PX0 + x, PY0 + y, c);
}
const ease = (a: number, b: number, t: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const pulse = (a: number, len: number, t: number) => (t >= a && t < a + len ? 1 - (t - a) / len : 0);

// backdrops
function city(seed: number, t: number, horizon: number) {
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x += 1) mp(x - shx, y - shy, bay(x, y) < y / PH ? F.SKY2 : F.SKY);
  const r = mulberry32(seed);
  for (let layer = 0; layer < 2; layer++) {
    for (let x = -4 - layer * 9; x < PW + 8;) {
      const w = 8 + ((r() * 14) | 0), h = 14 + ((r() * (layer ? 30 : 46)) | 0), top = horizon - h + layer * 6, blue = r() < 0.18;
      mr(x, top, w, horizon + 10 - top, layer ? F.CITY2 : F.CITY);
      for (let wy = top + 2; wy < horizon; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2)
        if (r() < (blue ? 0.6 : 0.22)) mp(wx, wy, blue ? (r() < 0.3 ? F.WINC : F.WINB) : F.WIN);
      x += w + ((r() * 4) | 0);
    }
  }
  // a blinking red light on the tallest tower
  if (Math.sin(t * 5) > 0) mp(40 + (seed % 120), horizon - 52, F.NAV);
}
function bridge(y: number, glowX: number) {
  mr(-4, y, PW + 8, 9, F.BRIDGE); mr(-4, y + 9, PW + 8, PH - y, F.ROAD);
  mr(-4, y - 1, PW + 8, 1, F.RAIL); mr(-4, y - 7, PW + 8, 1, F.RAIL);
  for (let x = -4; x < PW + 8; x += 6) mr(x, y - 7, 1, 7, Math.abs(x - glowX) < 60 ? F.RAIL : F.FIRE3);
  for (let x = 20; x < PW; x += 70) { mr(x, y - 26, 1, 19, F.DOOMM); mr(x, y - 26, 6, 1, F.DOOMM); mp(x + 6, y - 25, F.FIRE1); }
}
function ruins(seed: number, t: number, ground: number) {
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) mp(x - shx, y - shy, bay(x, y) < y / PH * 1.2 ? F.PURP : F.SKY3);
  const r = mulberry32(seed ^ 0x55);
  for (let x = -6; x < PW + 6;) {
    const w = 10 + ((r() * 18) | 0), h = 10 + ((r() * 34) | 0);
    mr(x, ground - h, w, h, F.CITY);
    for (let k = 0; k < 3; k++) mr(x + ((r() * w) | 0), ground - h - 2, 2 + ((r() * 3) | 0), 3, F.SKY3); // broken tops
    x += w + 2 + ((r() * 8) | 0);
  }
  mr(-4, ground, PW + 8, PH - ground + 4, F.GROUND);
  for (let i = 0; i < 18; i++) mr((r() * PW) | 0, ground + ((r() * 8) | 0), 2 + ((r() * 5) | 0), 2, F.RUBBLE);
  // distant fires and sky lightning
  for (let i = 0; i < 3; i++) { const fx = (r() * PW) | 0; if (Math.sin(t * 9 + i) > -0.6) { mp(fx, ground - 1, F.FIRE2); mp(fx + 1, ground - 2, F.FIRE1); } }
  if (vnoise(seed, t * 1.7) > 0.86) bolt(30 + (seed % 180), 0, 40 + (seed % 140), ground - 30, seed + ((t * 14) | 0), false);
}
function fiery(t: number) {
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const k = y / PH + (vnoise(x * 13 + 7, t * 0.8 + y * 0.03) - 0.5) * 0.45;
    mp(x - shx, y - shy, k > 1.04 ? F.FIRE1 : k > 0.94 ? F.FIRE2 : bay(x, y) < (k - 0.66) * 2.5 ? F.FIRE3 : bay(x, y) < k * 0.7 ? F.SMOKE : F.BLACK);
  }
  for (let i = 0; i < 16; i++) { const ex = (hashf(i * 31) * PW + t * 9 * (1 + (i % 3))) % PW, ey = PH - ((t * 14 + i * 13) % PH); mp(ex, ey, i % 2 ? F.FIRE1 : F.FIRE2); }
}

/** A jagged lightning bolt; a fresh shape every few frames. */
function bolt(x0: number, y0: number, x1: number, y1: number, seed: number, thick: boolean) {
  const r = mulberry32(seed), n = 7;
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const nx = i === n ? x1 : x0 + ((x1 - x0) * i) / n + (r() - 0.5) * 16, ny = y0 + ((y1 - y0) * i) / n;
    if (thick) mline(px + 1, py, nx + 1, ny, F.BOLT2);
    mline(px, py, nx, ny, F.BOLT);
    if (r() < 0.3) mline(nx, ny, nx + (r() - 0.5) * 14, ny + 6, F.BOLT2);
    px = nx; py = ny;
  }
}

function fireball(cx: number, cy: number, r: number, age: number, seed: number) {
  for (let dy = -r; dy <= r * 0.35; dy++) for (let dx = -r * 1.5; dx <= r * 1.5; dx++) {
    const n = vnoise(seed + dx * 7, dy * 0.4 + age * 3) - 0.5;
    const d = Math.sqrt((dx / 1.5) ** 2 + dy * dy) / r + n * 0.45 + age * 0.35;
    if (d >= 1.05) continue;
    mp(cx + dx, cy + dy, d < 0.35 ? F.FIRE0 : d < 0.6 ? F.FIRE1 : d < 0.85 ? F.FIRE2 : age > 0.5 ? F.SMOKE : F.FIRE3);
  }
}
function spark(cx: number, cy: number, k: number) {
  if (k <= 0) return;
  const len = Math.round(3 + 7 * k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) mline(cx, cy, cx + dx * len, cy + dy * len, F.FIRE1);
  mdisc(cx, cy, Math.round(1 + 2 * k), F.WHITE);
}
function shieldDisc(cx: number, cy: number, r: number) {
  mdisc(cx, cy, r, F.SHR); if (r > 2) mdisc(cx, cy, r - 1, F.SHW); if (r > 3) mdisc(cx, cy, r - 2, F.SHR); mdisc(cx, cy, Math.max(0, r - 3), F.BLUE);
  mp(cx, cy, F.SHW);
}

// ---------- characters: generic silhouettes and colour schemes ----------
type Who = 'armor' | 'shield' | 'hammer' | 'doom' | 'brute';
type Pose = 'stand' | 'punch' | 'raise' | 'hit' | 'throw' | 'crouch' | 'fly' | 'cast';
const LOOK: Record<Who, { leg: number; body: number; head: number; arm: number; hand: number; eye: number; cape?: number; belt: number }> = {
  armor: { leg: F.RED, body: F.RED, head: F.GOLD, arm: F.RED, hand: F.GOLD, eye: F.FLARE, belt: F.GOLD },
  shield: { leg: F.BLUE, body: F.BLUE, head: F.BLUE, arm: F.BLUE, hand: F.SHR, eye: F.SKIN, belt: F.SHW },
  hammer: { leg: F.ARMOR, body: F.ARMOR, head: F.SKIN, arm: F.SKIN, hand: F.ARMOR, eye: F.BLUE, cape: F.CAPE, belt: F.DOOMM },
  doom: { leg: F.DOOMD, body: F.DOOMG, head: F.DOOMM, arm: F.DOOMM, hand: F.DOOMM, eye: F.GREEN, cape: F.DOOMG, belt: F.GOLD },
  brute: { leg: F.SIL, body: F.SIL, head: F.SIL, arm: F.SIL, hand: F.SIL, eye: F.SHR, belt: F.SIL },
};

/** A figure with its feet at (x, fy), facing f (+1 right, -1 left), scale s. */
function fig(x: number, fy: number, who: Who, pose: Pose, f: number, t: number, s = 1) {
  const c = LOOK[who];
  const P = (dx: number, dy: number, w: number, h: number, col: number) => mr(x + (f > 0 ? dx : -dx - w) * s, fy + dy * s, w * s, h * s, col);
  if (pose === 'fly') {
    P(-14, -13, 8, 2, c.leg); P(-14, -11, 8, 2, c.leg); P(-6, -14, 9, 5, c.body); P(3, -15, 4, 4, c.head); P(6, -14, 1, 1, c.eye);
    P(7, -13, 6, 2, c.arm); P(13, -13, 2, 2, c.hand); P(-3, -13, 1, 1, F.FLARE);
    if (Math.sin(t * 40) > -0.3) { P(-17, -13, 3, 2, F.FIRE1); P(-17, -11, 3, 2, F.FIRE2); P(-19, -12, 2, 2, F.FIRE0); }
    return;
  }
  const lo = pose === 'crouch' ? 4 : 0, lean = pose === 'hit' ? -2 : pose === 'punch' ? 1 : 0;
  if (c.cape) {
    const flap = Math.round(Math.sin(t * 6 + x) * 1.5);
    P(-5 + lean, -19 + lo, 3, 17 - lo, c.cape); P(-6 + lean + flap, -8, 2, 6, c.cape);
  }
  if (pose === 'punch' || pose === 'throw' || pose === 'cast') { P(2, -9, 2, 9, c.leg); P(-4, -9, 2, 9, c.leg); }
  else if (pose === 'crouch') { P(-5, -5, 3, 5, c.leg); P(2, -5, 3, 5, c.leg); }
  else if (pose === 'hit') { P(-4, -9, 2, 9, c.leg); P(0, -8, 2, 8, c.leg); }
  else { P(-3, -9, 2, 9, c.leg); P(1, -9, 2, 9, c.leg); }
  const ux = lean, uy = lo;
  P(-3 + ux, -18 + uy, 6, 9, c.body); P(-3 + ux, -10 + uy, 6, 1, c.belt);
  P(-2 + ux, -23 + uy, 4, 5, c.head); P(1 + ux, -22 + uy, 1, 1, c.eye);
  if (who === 'armor') { P(-1 + ux, -16 + uy, 2, 1, F.FLARE); P(-2 + ux, -21 + uy, 4, 1, F.RED); }
  if (who === 'shield') { P(-3 + ux, -15 + uy, 6, 1, F.SHW); P(-3 + ux, -13 + uy, 6, 1, F.SHR); P(-1 + ux, -20 + uy, 3, 2, F.SKIN); }
  if (who === 'hammer') { P(-3 + ux, -24 + uy, 5, 2, F.HAIRF); P(-3 + ux, -22 + uy, 1, 5, F.HAIRF); P(-2 + ux, -16 + uy, 1, 1, F.DOOMM); P(1 + ux, -16 + uy, 1, 1, F.DOOMM); }
  if (who === 'doom') { P(-3 + ux, -24 + uy, 6, 2, F.DOOMG); P(-3 + ux, -22 + uy, 1, 5, F.DOOMG); P(2 + ux, -22 + uy, 1, 3, F.DOOMG); P(-2 + ux, -16 + uy, 4, 1, F.GOLD); }
  P(-4 + ux, -17 + uy, 1, 7, c.arm);
  switch (pose) {
    case 'punch': P(3 + ux, -16 + uy, 7, 2, c.arm); P(10 + ux, -16 + uy, 2, 2, c.hand); break;
    case 'raise': P(2 + ux, -28 + uy, 2, 10, c.arm); P(2 + ux, -29 + uy, 2, 1, c.hand); break;
    case 'throw': P(3 + ux, -17 + uy, 3, 2, c.arm); P(6 + ux, -19 + uy, 3, 2, c.arm); P(9 + ux, -20 + uy, 2, 2, c.hand); break;
    case 'cast': P(3 + ux, -17 + uy, 6, 2, c.arm); P(9 + ux, -18 + uy, 2, 3, c.hand); P(-6 + ux, -20 + uy, 2, 4, c.arm); break;
    case 'hit': P(-6 + ux, -21 + uy, 3, 1, c.arm); P(3 + ux, -20 + uy, 3, 1, c.arm); break;
    default: P(3 + ux, -17 + uy, 1, 7, c.arm); P(3 + ux, -10 + uy, 1, 1, c.hand);
  }
  if (who === 'hammer') {
    if (pose === 'raise') { P(1 + ux, -33 + uy, 5, 4, F.DOOMM); P(1 + ux, -33 + uy, 5, 1, F.SHW); }
    else if (pose === 'crouch') { P(4, -4, 5, 4, F.DOOMM); P(5, -8, 1, 4, F.HAIRF); }
    else { P(3 + ux, -10 + uy, 1, 3, F.HAIRF); P(2 + ux, -7 + uy, 4, 3, F.DOOMM); }
  }
  if (who === 'shield' && pose !== 'throw' && pose !== 'hit') shieldDisc(x + f * (6 + ux) * s, fy + (-14 + uy) * s, 4 * s);
}

// ---------- shots ----------
const BRAWL_PAIRS: [Who, Who][] = [['armor', 'doom'], ['shield', 'brute'], ['hammer', 'doom'], ['shield', 'doom']];

function drawShot(sh: Shot, now: number): number {
  const t = sh.t, sd = sh.seed, side = sd & 1 ? 1 : -1;
  let shake = 0, flash = 0;
  switch (sh.kind) {
    case 'heli': {
      const bx = 70 + (sd % 100), hy = 16 + (sd % 6);
      const boom = t - 2.0;
      shake = boom > 0 ? Math.max(0, 1 - boom / 1.2) * 2.2 : 0;
      city(sd, now, 58); bridge(60, bx);
      // helicopter: body, tail, skids, spinning rotor, searchlight onto the bridge
      const hx = 200 - t * 6 - (sd % 30);
      for (let y = hy + 6; y < 60; y++) { const w = (y - hy) * 0.35; for (let x = -w; x <= w; x++) if (bay(Math.round(hx + x), y) < 0.18) mp(hx + x - 4, y, F.BEAM); }
      mr(hx - 8, hy, 10, 5, F.HELI); mr(hx + 2, hy + 1, 16, 2, F.HELI); mr(hx + 17, hy - 2, 2, 4, F.HELI); mr(hx - 7, hy + 6, 12, 1, F.HELI);
      mr(hx - 7, hy + 1, 3, 2, F.WINB);
      const rw = Math.round(14 * Math.abs(Math.sin(now * 30))); mr(hx - 3 - rw, hy - 2, rw * 2 + 1, 1, F.DOOMM); mr(hx - 3, hy - 1, 1, 1, F.DOOMM);
      if (Math.sin(now * 7) > 0.4) mp(hx + 18, hy - 2, F.NAV);
      if (boom > 0) { fireball(bx, 59, Math.round(6 + 20 * Math.min(1, boom * 2.5)), Math.min(1, boom / 3.5), sd); flash = pulse(0, 0.2, boom) * 0.9; }
      break;
    }
    case 'armor': case 'shield': case 'hammer': {
      const ground = 66, bg = (sd >> 1) & 1;
      if (bg) city(sd, now, ground - 4); else ruins(sd, now, ground);
      if (bg) { mr(-4, ground - 4, PW + 8, PH, F.ROAD); mr(-4, ground - 4, PW + 8, 1, F.RAIL); }
      const hx = side > 0 ? 70 : PW - 70, vx = PW - hx, f = side;
      if (sh.kind === 'armor') {
        const land = ease(0.4, 1.6, t), fx = side > 0 ? -30 + (hx + 30) * land : PW + 30 - (PW + 30 - hx) * land;
        const fire = t > 2.2 && t < 3.3, hit = t > 3.2;
        fig(fx, land < 1 ? ground - 14 + 14 * land : ground, 'armor', land < 1 ? 'fly' : fire ? 'punch' : 'stand', f, now);
        const push = hit ? Math.min(16, (t - 3.2) * 30) : 0;
        fig(vx + f * push, ground, 'doom', hit ? 'hit' : t > 1.8 ? 'cast' : 'stand', -f, now);
        if (fire) {
          mline(fx + f * 12, ground - 15, vx - f * 8, ground - 15, F.FLARE, 3); mline(fx + f * 12, ground - 15, vx - f * 8, ground - 15, F.WHITE);
          for (let a = -1.2; a <= 1.2; a += 0.12) mp(vx - f * 8 + Math.cos(a) * -f * 6, ground - 15 + Math.sin(a) * 9, F.GREEN);
          shake = 0.8;
        }
        if (hit) { fireball(vx + f * push, ground - 12, Math.round(4 + 8 * Math.min(1, (t - 3.2) * 3)), Math.min(1, (t - 3.2) / 2), sd); shake = Math.max(0, 1.8 - (t - 3.2)); flash = pulse(3.2, 0.18, t) * 0.8; }
      } else if (sh.kind === 'shield') {
        const b1 = vx - f * 12, b2 = vx + f * 14, thrown = t > 1.2;
        const T1 = 1.3, T2 = 2.1, T3 = 2.8, T4 = 3.6;
        const down1 = t > T2, down2 = t > T3;
        fig(hx, ground, 'shield', thrown && t < T4 ? (t < 1.6 ? 'throw' : 'stand') : 'stand', f, now);
        fig(b1 + (down1 ? f * Math.min(10, (t - T2) * 30) : 0), ground, 'brute', down1 ? 'hit' : 'punch', -f, now);
        fig(b2 + (down2 ? f * Math.min(10, (t - T3) * 30) : 0), ground, 'brute', down2 ? 'hit' : 'stand', -f, now);
        let sx2 = 0, sy2 = 0, on = false;
        const lerpArc = (ax: number, ay: number, bx: number, by: number, k: number, arc: number) => { sx2 = ax + (bx - ax) * k; sy2 = ay + (by - ay) * k - Math.sin(k * Math.PI) * arc; on = true; };
        if (t > T1 && t < T2) lerpArc(hx + f * 9, ground - 20, b1, ground - 16, (t - T1) / (T2 - T1), 10);
        else if (t >= T2 && t < T3) lerpArc(b1, ground - 16, b2, ground - 14, (t - T2) / (T3 - T2), 6);
        else if (t >= T3 && t < T4) lerpArc(b2, ground - 14, hx + f * 6, ground - 14, (t - T3) / (T4 - T3), 14);
        if (on) { shieldDisc(sx2, sy2, 4); mline(sx2 - f * 3, sy2, sx2 - f * 9, sy2, F.SHW); }
        spark(b1, ground - 16, pulse(T2, 0.3, t)); spark(b2, ground - 14, pulse(T3, 0.3, t));
        shake = Math.max(pulse(T2, 0.4, t), pulse(T3, 0.4, t)) * 1.6;
      } else {
        const up = t > 0.8 && t < 2.6, slam = t >= 2.6;
        fig(PW / 2, ground, 'hammer', up ? 'raise' : slam ? 'crouch' : 'stand', f, now);
        fig(PW / 2 - 50 - (slam ? Math.min(30, (t - 2.6) * 60) : 0), ground, 'brute', slam ? 'hit' : 'stand', 1, now);
        fig(PW / 2 + 50 + (slam ? Math.min(30, (t - 2.6) * 60) : 0), ground, 'brute', slam ? 'hit' : 'stand', -1, now);
        if (up && t > 1.4) { const k = ((now * 18) | 0); bolt(PW / 2 + 10 * Math.sin(k), 0, PW / 2 + f * 3, ground - 32, sd + k, true); bolt(PW / 2 - 40, 0, PW / 2 + f * 3, ground - 32, sd + k * 3, false); flash = (k & 1) * 0.25; shake = 0.6; }
        if (slam) {
          const w = (t - 2.6) * 90;
          for (let a = 0; a < 6.28; a += 0.05) { const px = PW / 2 + Math.cos(a) * w, py = ground + Math.sin(a) * w * 0.12; mp(px, py, F.BOLT2); }
          for (let i = 0; i < 10; i++) { const k2 = t - 2.6; mr(PW / 2 + (hashf(sd + i) - 0.5) * 80 * k2 * 2, ground - 30 * k2 * (0.5 + hashf(i)) + 40 * k2 * k2, 2, 2, F.RUBBLE); }
          flash = pulse(2.6, 0.25, t) * 0.95; shake = Math.max(0, 2.5 - (t - 2.6) * 1.5);
        }
      }
      break;
    }
    case 'brawl': {
      fiery(now);
      const [a, b] = BRAWL_PAIRS[sd % BRAWL_PAIRS.length], beat = Math.floor((t - 0.4) / 0.7), ph = (t - 0.4) / 0.7 - beat;
      const att = beat >= 0 ? (beat + (sd >> 3)) & 1 : -1, contact = ph > 0.35 && ph < 0.6;
      const lx = 96, rx = 148;
      fig(lx - (att === 1 && contact ? 4 : 0), PH + 6, a, att === 0 && ph > 0.25 ? 'punch' : att === 1 && contact ? 'hit' : 'stand', 1, now, 2);
      fig(rx + (att === 0 && contact ? 4 : 0), PH + 6, b, att === 1 && ph > 0.25 ? 'punch' : att === 0 && contact ? 'hit' : 'stand', -1, now, 2);
      if (beat >= 0 && t < 6) {
        const k = pulse(0.35, 0.25, ph);
        spark(att === 0 ? rx - 8 : lx + 8, PH + 6 - 32, k);
        if (k > 0) for (let i = 0; i < 6; i++) mline(0, 10 + i * 13, 30 * k, 10 + i * 13, F.FIRE1);
        shake = k * 2; flash = k * 0.25;
      }
      break;
    }
    case 'doom': {
      mr(0, 0, PW, PH, F.BLACK);
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (bay(x, y) < 0.95 - (y / PH) * 1.1) mp(x - shx, y - shy, F.SKY3);
      if (vnoise(sd, now * 2) > 0.82) bolt(20 + (sd % 60), 0, 30 + (sd % 50), 50, sd + ((now * 16) | 0), false);
      const rise = ease(0.3, 3, t), cast = t > 3.4;
      fig(PW / 2, PH + 14 - rise * 8, 'doom', cast ? 'raise' : 'stand', side, now, 2);
      if (cast) {
        const k = ((now * 20) | 0);
        for (let i = 0; i < 4; i++) { const r = mulberry32(sd + k + i); let px = PW / 2 + side * 6, py = PH - 50 - rise * 8; for (let j = 0; j < 6; j++) { const nx = px + (r() - 0.5) * 18, ny = py - r() * 8; mline(px, py, nx, ny, F.GREEN); px = nx; py = ny; } }
        shake = 0.6; flash = pulse(5.2, 0.5, t) * 0.7;
      }
      if (flash > 0.01) { cover(flash, F.GREEN); flash = 0; }
      break;
    }
    case 'card': {
      mr(0, 0, PW, PH, F.BLACK);
      const k = Math.sin(Math.min(1, ease(1, 2.6, t)) * Math.PI);
      if (k > 0) { const w = Math.round(PW * 0.5 * k); mr(PW / 2 - w, PH / 2, w * 2, 1, F.FLARE); mr(PW / 2 - w / 3, PH / 2, (w * 2) / 3, 1, F.WHITE); mdisc(PW / 2, PH / 2, Math.round(3 * k), F.WHITE); }
      flash = pulse(3.8, 0.35, t) * 0.4;
      shake = pulse(3.8, 0.5, t) * 1.5;
      break;
    }
  }
  if (flash > 0.01) cover(flash, F.WHITE);
  return shake;
}

// ---------- audience ----------
interface Head { k: number; side: number; n: number; hair: number; face?: boolean }
const HEADS: Head[] = [
  { k: 6, side: -1, n: 2, hair: R.HAIRR }, { k: 6, side: -1, n: 0, hair: R.HAIR, face: true }, { k: 5, side: -1, n: 3, hair: R.HAIR },
  { k: 5, side: 1, n: 0, hair: R.HAIR }, { k: 3, side: -1, n: 1, hair: R.HAIR }, { k: 2, side: 1, n: 3, hair: R.HAIR },
];
const PRESHOW_HEADS: Head[] = [{ k: 4, side: 1, n: 4, hair: R.HAIRR }, { k: 7, side: 1, n: 2, hair: R.HAIR }];
const headBox = (h: Head) => {
  const r = ROW[h.k], w = Math.max(4, Math.round(r.w * 0.5)), hh = Math.max(4, Math.round(r.h * 0.8 + 2));
  return { x: seatX(h.k, h.side, h.n) + ((r.w - w) >> 1), y: r.y - Math.round(hh * 0.7), w, h: hh, top: r.y };
};
/** The back of a head peeking over the seat back, rim-lit by the screen. */
function drawHead(h: Head, now: number, i: number) {
  const b = headBox(h), lean = vnoise(i * 97, now * 0.15) > 0.7 ? (i & 1 ? 1 : -1) : 0, x = b.x + lean;
  const rim = h.hair === R.HAIRR ? R.SKIN : R.HAIRL;
  const rad = Math.max(1, Math.floor(b.w / 2.4));
  for (let y = b.y; y < b.top; y++) {
    const j = y - b.y, inset = j < rad ? Math.round(rad - Math.sqrt(rad * rad - (rad - j - 0.5) ** 2)) : 0;
    const w = b.w - inset * 2;
    rect(x + inset, y, w, 1, h.hair);
    if (j === 0) rect(x + inset, y, w, 1, rim);
    else { put(x + inset, y, rim); put(x + inset + w - 1, y, rim); }
  }
  if (h.face) rect(x + b.w - 2, b.y + 2, 2, Math.max(1, b.top - b.y - 2), R.SKIN);
  // shoulders just showing either side of the headrest on big near seats
  if (b.w > 10) { rect(x - 3, b.top - 1, 3, 1, R.SHIRT); rect(x + b.w, b.top - 1, 3, 1, R.SHIRT); }
}
/** Someone walking down the aisle towards the screen, scaled by depth. */
function drawWalker(fy: number, now: number) {
  const u = (fy - STAGE) / (182 - STAGE), hgt = Math.round(18 + 44 * u), x = AX + Math.round(Math.sin(fy * 0.07) * 2);
  person(x, fy, hgt, Math.sin(now * 7) > 0 ? 1 : -1, false);
}
/** A standing person seen from behind: round head, shoulders, arms, two legs; rim-lit edges. */
function person(cx: number, fy: number, h: number, step: number, pack: boolean) {
  const hw = Math.max(2, Math.round(h * 0.17)), sw = Math.max(4, Math.round(h * 0.36)), hip = Math.max(3, Math.round(h * 0.28));
  const headY = fy - h, neck = headY + hw + 1, legs = Math.round(h * 0.45), torso = fy - legs - neck;
  const lw = Math.max(1, Math.round(hip / 2) - 1), st = h > 20 ? step : 0;
  rect(cx - (hip >> 1) - st, fy - legs, lw, legs, R.SEAT); rect(cx + (hip >> 1) - lw + st, fy - legs, lw, legs, R.SEAT);
  rect(cx - (sw >> 1), neck, sw, torso, R.SHIRT); rect(cx - (hip >> 1), neck + (torso >> 1), hip, torso - (torso >> 1) + 1, R.SHIRT);
  rect(cx - (sw >> 1) - 1, neck + 1, 1, Math.round(torso * 0.9) + st, R.SHIRT); rect(cx + (sw >> 1), neck + 1, 1, Math.round(torso * 0.9) - st, R.SHIRT);
  rect(cx - (sw >> 1), neck, sw, 1, R.RIMN); rect(cx + (sw >> 1), neck + 1, 1, Math.round(torso * 0.9) - st, R.RIMN);
  if (pack) { rect(cx - (sw >> 1) + 1, neck + 2, sw - 2, Math.round(torso * 0.6), R.SEATM); rect(cx - (sw >> 1) + 1, neck + 2, sw - 2, 1, R.RIMF); }
  const hx = cx - (hw >> 1) - 1;
  rect(hx + 1, headY, hw, hw + 1, R.HAIR); rect(hx, headY + 1, hw + 2, hw - 1, R.HAIR);
  rect(hx + 1, headY, hw, 1, R.HAIRL); put(hx + hw + 1, headY + 1, R.HAIRL);
}
function drawStanding(now: number) {
  // two people standing by the front left, near the side entrance
  for (const [x, pack] of [[110, 0], [119, 1]]) person(x + Math.round(vnoise(x, now * 0.2) * 2 - 1), 41, 19, 0, !!pack);
}

// ---------- state ----------
let session: Session = sessionAt(15), shot: Shot | null = null, lastT = 0;
/** Smoothed average colour of the picture (0..1), which lights the room. */
const light = [0, 0, 0];
let house = 0;
let geo: Geo = WIDE;

/** The film in picture coordinates, 1:1 at PX0, PY0. */
function film(sh: Shot, now: number) {
  const shake = drawShot(sh, now);
  if (shake > 0) {
    // camera shake: redraw the shot shifted (cheap enough for an 84-row picture)
    shx = Math.round(Math.sin(now * 61) * shake); shy = Math.round(Math.cos(now * 47) * shake * 0.7);
    if (shx || shy) { mr(-8, -8, PW + 16, PH + 16, F.BLACK); drawShot(sh, now); }
    shx = 0; shy = 0;
  }
  cover(1 - sh.vis, F.BLACK);
}
/** The film drawn into an offscreen picture-sized buffer, then scaled down (nearest) into the narrow screen. */
const offPic = new Uint8Array(PW * PH);
function filmScaled(sh: Shot, now: number, g: Geo) {
  const keep = { W: G.W, H: G.H, camX: G.camX, oy: G.oy, buf: G.buf };
  G.W = PW; G.H = PH; G.camX = PX0; G.oy = -PY0; G.buf = offPic; offPic.fill(F.BLACK);
  try { film(sh, now); } finally { Object.assign(G, keep); }
  for (let y = 0; y < g.ph; y++) {
    const row = (((y + 0.5) * PH) / g.ph | 0) * PW;
    for (let x = 0; x < g.pw; x++) put(g.px + x, g.py + y, offPic[row + (((x + 0.5) * PW) / g.pw | 0)]);
  }
}

function render() {
  const now = S.ms / 1000, dt = Math.min(0.1, Math.max(0, now - lastT)); lastT = now;
  session = sessionAt(S.cal.hour);
  shot = shotAt(S.ms, S.city.utc);
  const g = geo = geoFor(G.W), cx = g.px + g.pw / 2, cy = g.py + g.ph / 2;
  blitLayer(roomFor(g));
  // the picture
  shx = 0; shy = 0;
  if (session.phase === 'film' && shot) {
    if (g === WIDE) film(shot, now);
    else filmScaled(shot, now, g);
  } else if (session.phase === 'preshow') {
    rect(g.px, g.py, g.pw, g.ph, F.SLIDE);
    text(screenNotice(S.cal.hour)?.[0] ?? '', cx, cy - 6, F.TEXT);
    // a little popcorn bucket
    const bx = cx - 4, by = cy + 6;
    rect(bx, by + 3, 8, 7, F.SHW); for (let i = 0; i < 8; i += 2) rect(bx + i, by + 3, 1, 7, F.SHR);
    for (let i = 0; i < 9; i++) put(bx + (i % 5) * 2 - 1 + (i > 4 ? 1 : 0), by + (i > 4 ? 0 : 2), F.FIRE1);
  } else {
    // closed: dark screen with a lit notice (the same text the street board agrees with, see cinema-rules.ts)
    const [a, b] = screenNotice(S.cal.hour) ?? [];
    text(a ?? '', cx, cy - 8, F.TEXT);
    text(b ?? '', cx, cy + 4, F.TEXT);
  }
  measure(dt, session.phase !== 'closed');
  if (session.phase !== 'closed') {
    const heads = session.phase === 'preshow' ? [...HEADS, ...PRESHOW_HEADS] : HEADS;
    heads.forEach((h, i) => drawHead(h, now, i));
    drawStanding(now);
    // a latecomer walks down the aisle every so often (more often during the pre-show)
    const period = session.phase === 'preshow' ? 45 : 140, walk = 26, c = ((now % period) + period) % period;
    if (c < walk) drawWalker(Math.round(182 - (182 - STAGE) * (c / walk)), now);
  }
  exitSign();
  house += ((session.phase === 'closed' ? 0.35 : session.phase === 'preshow' ? 0.75 : 0) - house) * Math.min(1, dt * 2);
}

// ---------- the way out ----------
/** The lit SAÍDA sign over the aisle near the back rows (always on, as in any cinema):
    tapping it goes back out to the street front (cinema-facade-remigio). */
const EXIT = { x: AX - 13, y: 146, w: 27, h: 9 }; // above the control bar in landscape
function exitSign() {
  const { x, y, w, h } = EXIT;
  rect(x - 1, y - 1, w + 2, h + 2, R.BLACK);
  rect(x, y, w, h, F.DOOMG);
  text('SAÍDA', x + (w >> 1), y + 3, F.GREEN);
  put(x + 2, y + 4, F.GREEN); put(x + w - 3, y + 4, F.GREEN); // little arrows either side
}
const onExit = (x: number, y: number) => x >= EXIT.x - 8 && x <= EXIT.x + EXIT.w + 8 && y >= EXIT.y - 8 && y <= EXIT.y + EXIT.h + 6;

/** Average colour of the picture, which then lights the room through grade(). The projector is off when closed. */
function measure(dt: number, on: boolean) {
  const p = geo, x0 = Math.max(0, sx(p.px)), x1 = Math.min(G.W, sx(p.px + p.pw)), y0 = Math.max(0, sy(p.py)), y1 = Math.min(G.H, sy(p.py + p.ph));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0 + (y & 2 ? 1 : 0); x < x1; x += 2) {
    const c = RGB[G.buf[y * G.W + x]]; r += c[0]; g += c[1]; b += c[2]; n++;
  }
  if (!n) return;
  if (!on) { r = g = b = 0; }
  const k = Math.min(1, dt * 14);
  light[0] += (r / n / 255 - light[0]) * k; light[1] += (g / n / 255 - light[1]) * k; light[2] += (b / n / 255 - light[2]) * k;
}

const WARM = [255, 214, 160];
function grade() {
  for (let i = 0; i < NPAL; i++) { const c = RGB[i]; PAL32[i] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]; }
  for (const e of ROOM) {
    const c = [0, 1, 2].map((j) => Math.min(255, e.base[j] + light[j] * 255 * e.gain * 1.6 + WARM[j] * e.house * house * 0.25) | 0);
    PAL32[e.i] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
  }
}

export const cinemaRemigio: Scene = {
  id: 'cinema-remigio',
  name: 'Cinema · Remígio',
  build() {
    setupAnimals({ ground: [], dogs: 0 });
    lastT = S.ms / 1000;
  },
  update() { /* everything is a function of the clock; see render() */ },
  render,
  grade,
  debug() {
    const s = shot ? `${shot.kind} #${shot.index} t${shot.t.toFixed(1)}` : '-';
    return `cinema  ${session.phase}  shot ${s}  light ${light.map((v) => v.toFixed(2)).join('/')}`;
  },
  hint() { return { x: EXIT.x + (EXIT.w >> 1), y: EXIT.y, text: 'Toque na SAÍDA pra voltar à rua' }; },
  tap(x, y) {
    if (onExit(x, y)) return { x: EXIT.x + (EXIT.w >> 1), y: EXIT.y, goto: 'cinema-facade-remigio' };
    if (session.phase === 'closed') return null;
    const heads = session.phase === 'preshow' ? [...HEADS, ...PRESHOW_HEADS] : HEADS;
    for (const h of heads) {
      const b = headBox(h);
      if (x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.top + 4) return { x: b.x + (b.w >> 1), y: b.y, speaker: { role: 'attendee' } };
    }
    return null;
  },
};
