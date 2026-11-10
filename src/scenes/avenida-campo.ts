/* AVENIDA E CAMPO (Esperança, PB), drawn from a visual brief written from an owner's late-afternoon
   snapshot (used as reference only; it is not in the repo). From a raised viewpoint you look over a
   wide open field of patchy grass and bare earth crossed by an informal dirt path, where a few horses
   graze; behind it an avenue runs left to right with its street lights; beyond it the low edge of
   town, a few two- and three-storey buildings and a white building in the middle distance with a thin
   plume of smoke beside it. Many power lines cross the sky diagonally on their concrete poles: with
   the sky, they are the view's signature.

   The place's real name, the avenue's name and its traffic direction are not known: the scene keeps
   the neutral name "Avenida e Campo" and a two-way road, one lane each way, as on the other side-on
   Esperança streets (see ./avenida-campo-rules.ts). No zebra or traffic light was seen, so none is
   wired. No signs were readable, so none is drawn. */
import { G, L, Lp, WW, blitLayer, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  ASPH, BARK, BFAR, BMID, BNEAR, CBEIGE, CLOUD, CLOUDD, FBLUE, FPINK, LEAFG, LEAFGD, STEEL, STONE, STONEL, TERRA, TILEW, VOID,
  WDIM, WET, WOOD, WWARM, CHURCHL,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { raining } from '../actors/rain-rules';
import { S } from '../sky/state';
import { windDir, windStrength } from '../sky/wind-rules';
import { drawFog, drawSky } from './common';
import { type Lamp, isNight, lampLight, lampPost, lampRoadPool, pole, wireCurve, warmPool } from './br-kit';
import {
  AVENUE, FAR_LANE, FIELD_POLE, HORSE_H, type Horse, NEAR_LANE, VERGE_Y, horseAt, horseLine, makeHorses, stepHorse,
} from './avenida-campo-rules';
import type { Scene } from './types';

const HORIZON = 100;
/** Far sidewalk (in front of the buildings) from WALK0 down to the asphalt. */
const WALK0 = 101;
const wr = mulberry32(0xa7e1);
const far = newLayer(), mid = newLayer(), field = newLayer(), front = newLayer();
const farWins: { x: number; y: number; rank: number }[] = [];
/** Street lights on the far sidewalk, their arms over the avenue. */
const LAMPS: Lamp[] = [60, 180, 300, 420].map((x) => ({ x, top: 72, ground: AVENUE.y0, arms: 1 }));
/** Concrete poles along the avenue (far sidewalk) and the tall one in the field. */
const AV_POLES = [130, 250, 370], AV_POLE_TOP = AVENUE.y0 - 62;
const FP_TOP = FIELD_POLE.y - 150;

// ---------- wires ----------
interface Cable { x0: number; y0: number; x1: number; y1: number; sag: number; ph: number }
/** The diagonal bundles across the sky: from the field pole's crossarm up to the top-left, and on down to
    the right; a second bundle from an avenue pole climbing to the top-right, crossing the first. */
const SKY: Cable[] = [
  ...[0, 1, 2, 3, 4].map((i) => ({ x0: -10, y0: -96 + i * 9, x1: 326 + i * 2.5, y1: FP_TOP + 3, sag: 10 + i * 2, ph: i * 1.3 })),
  ...[0, 1, 2, 3].map((i) => ({ x0: 327 + i * 3, y0: FP_TOP + 3, x1: 490, y1: 46 + i * 7, sag: 5 + i, ph: 2 + i })),
  ...[0, 1, 2].map((i) => ({ x0: 127 + i * 3, y0: AV_POLE_TOP + 3, x1: 490, y1: -118 + i * 10, sag: 14 + i * 3, ph: 4 + i })),
  // steeper runs climbing out of the top of the frame, so the tall portrait sky still shows the wires
  ...[0, 1, 2].map((i) => ({ x0: 70 + i * 8, y0: -330, x1: 328 + i * 3, y1: FP_TOP + 3, sag: 8 + i * 2, ph: 6 + i })),
  ...[0, 1].map((i) => ({ x0: 248 + i * 4, y0: AV_POLE_TOP + 3, x1: 470 + i * 12, y1: -330, sag: 10 + i * 4, ph: 8 + i })),
];
/** The low wires along the avenue between its poles (the rolinhas perch on these). */
const AV_WIRES = [
  { x0: -4, y0: AV_POLE_TOP + 6, x1: 131, y1: AV_POLE_TOP + 3, sag: 4 }, { x0: 131, y0: AV_POLE_TOP + 3, x1: 251, y1: AV_POLE_TOP + 3, sag: 6 },
  { x0: 251, y0: AV_POLE_TOP + 3, x1: 371, y1: AV_POLE_TOP + 3, sag: 6 }, { x0: 371, y0: AV_POLE_TOP + 3, x1: 484, y1: AV_POLE_TOP + 7, sag: 4 },
];

/** A sagging cable drawn straight into the frame; in wind it swings (strong at >= 30 km/h, wind-rules.ts). */
function cable(c: Cable, swing: number, col: number) {
  const n = Math.ceil(Math.abs(c.x1 - c.x0) * 1.2) || 1;
  const sag = c.sag + swing * Math.sin(S.ms / 1000 * 1.7 + c.ph);
  let px = NaN, py = NaN;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(c.x0 + (c.x1 - c.x0) * t), y = Math.round(c.y0 + (c.y1 - c.y0) * t + sag * 4 * t * (1 - t));
    if (x === px && y === py) continue;
    put(x, y, col); px = x; py = y;
  }
}

// ---------- static layers ----------
function buildFar() {
  // distant hills and tree clumps beyond the town edge
  for (let x = 0; x < WW; x++) { const top = Math.round(90 + Math.sin(x * 0.021) * 3 + Math.sin(x * 0.07 + 1) * 1.5); L(far, x, top, 1, WALK0 - top, BFAR); }
  for (let i = 0; i < 18; i++) { const cx = wr() * WW, r = 3 + wr() * 4; for (let dy = -r; dy <= 0; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); L(far, cx - w, 94 + dy, w * 2, 1, LEAFGD); } }
  // low outskirts houses, one storey, flat or gabled
  for (let x = -2; x < WW;) {
    const w = 10 + ((wr() * 16) | 0), top = 89 + ((wr() * 5) | 0), wall = [CBEIGE, STONEL, FPINK, FBLUE, CHURCHL, TILEW][(wr() * 6) | 0];
    L(far, x, top, w, WALK0 - top, wall); L(far, x, top, w, 1, wr() < 0.5 ? TERRA : STONE);
    for (let wx = x + 2; wx < x + w - 3; wx += 5) { L(far, wx, top + 3, 2, 3, BMID); farWins.push({ x: wx, y: top + 4, rank: wr() }); }
    x += w + ((wr() * 2) | 0);
  }
  // a few two- and three-storey buildings
  for (const [x, w, top, wall] of [[34, 26, 80, STONEL], [96, 20, 83, CBEIGE], [170, 30, 77, FPINK], [300, 24, 81, STONEL], [352, 32, 76, CBEIGE], [430, 22, 82, FBLUE]] as const) {
    L(far, x, top, w, WALK0 - top, wall); L(far, x, top, w, 1, STONE); L(far, x + w - 2, top, 2, WALK0 - top, STONE);
    for (let y = top + 3; y < WALK0 - 4; y += 7) for (let wx = x + 3; wx < x + w - 4; wx += 6) { L(far, wx, y, 3, 3, BMID); farWins.push({ x: wx + 1, y: y + 1, rank: wr() }); }
    L(far, x + 4, top - 4, 6, 4, BMID); L(far, x + 4, top - 4, 6, 1, STEEL); // water tank on the roof
  }
  // the white building in the middle distance: three storeys, window bands, a parapet
  const WX = 222, WWD = 40, WT = 68;
  L(far, WX, WT, WWD, WALK0 - WT, TILEW); L(far, WX - 1, WT - 2, WWD + 2, 2, TILEW); L(far, WX + WWD - 3, WT, 3, WALK0 - WT, STONEL);
  for (let y = WT + 5; y < WALK0 - 6; y += 9) {
    L(far, WX + 2, y + 5, WWD - 5, 1, STONEL);
    for (let wx = WX + 4; wx < WX + WWD - 6; wx += 7) { L(far, wx, y, 4, 4, BMID); farWins.push({ x: wx + 1, y: y + 1, rank: wr() }); farWins.push({ x: wx + 2, y: y + 2, rank: wr() }); }
  }
  L(far, WX + 16, WALK0 - 7, 7, 7, BNEAR);
}

function buildMid() {
  // far sidewalk: dusty paving, a kerb
  for (let y = WALK0; y < AVENUE.y0; y++) for (let x = 0; x < WW; x++) Lp(mid, x, y, (x * 7 + y * 3) % 11 ? STONE : CBEIGE);
  L(mid, 0, AVENUE.y0 - 1, WW, 1, STONEL);
  // the avenue: asphalt with patched spots, a dashed centre line between the two lanes
  for (let y = AVENUE.y0; y < AVENUE.y1; y++) for (let x = 0; x < WW; x++) Lp(mid, x, y, wr() < 0.06 ? STONE : ASPH);
  for (let x = 6; x < WW; x += 24) L(mid, x, 122, 11, 1, TILEW);
  L(mid, 0, AVENUE.y1 - 1, WW, 1, STONEL); L(mid, 0, AVENUE.y1, WW, 1, STONE);
  // concrete poles and street lights along the far sidewalk
  for (const x of AV_POLES) pole(mid, x, AVENUE.y0, AVENUE.y0 - AV_POLE_TOP);
  for (const l of LAMPS) lampPost(mid, l);
}

/** Patchy dry-agreste ground: grass, dry straw and bare earth, an informal dirt path to the avenue. */
function buildField() {
  const g0 = AVENUE.y1 + 1;
  for (let y = g0; y < 180; y++) for (let x = 0; x < WW; x++) {
    const n = Math.sin(x * 0.045 + y * 0.11) + Math.sin(x * 0.013 - y * 0.07 + 2) * 1.3 + Math.sin(x * 0.11 + y * 0.31) * 0.4 + (wr() - 0.5) * 0.7;
    const c = n > 1.1 ? TERRA : n > 0.5 ? CBEIGE : n > -0.6 ? LEAFG : LEAFGD;
    Lp(field, x, y, y < VERGE_Y && c === TERRA ? LEAFGD : c);
  }
  // the dirt path: from the bottom-left of the field up to the avenue's kerb, narrowing with distance
  for (let y = g0; y < 180; y++) {
    const t = (y - g0) / (180 - g0), cx = 236 - t * 92 + Math.sin(t * 3.2) * 10, half = 1.5 + t * 6;
    for (let x = Math.floor(cx - half - 1); x <= cx + half + 1; x++) {
      const edge = Math.abs(x - cx) > half;
      if (edge && wr() < 0.5) continue;
      Lp(field, x, y, edge ? STONE : wr() < 0.12 ? STONE : wr() < 0.1 ? TERRA : CBEIGE);
    }
  }
  // the tall concrete pole in the field
  pole(front, FIELD_POLE.x - 1, FIELD_POLE.y, FIELD_POLE.y - FP_TOP);
  L(front, FIELD_POLE.x - 3, FIELD_POLE.y - 1, 7, 2, BNEAR);
}

/** Grass tufts and weeds that sway (dynamic), seeded once. */
const TUFTS = Array.from({ length: 90 }, () => {
  const y = VERGE_Y + 2 + wr() * (180 - VERGE_Y - 2);
  return { x: wr() * WW, y, h: 2 + Math.round(wr() * (1 + (y - VERGE_Y) / 16)), c: wr() < 0.5 ? LEAFGD : wr() < 0.6 ? CBEIGE : LEAFG };
});

// ---------- dynamic ----------
const hr = mulberry32(0x40e5);
const COATS = [WOOD, TILEW, BARK, TERRA];
let horses: Horse[] = [];
let taps = 0;

function tufts() {
  const s = windStrength(S.wind), d = windDir(S.wind), t = S.ms / 1000;
  for (const u of TUFTS) {
    const lean = d * s * 1.6 + Math.sin(t * (1.2 + s * 3) + u.x * 0.3) * (0.3 + s);
    for (let i = 0; i < u.h; i++) put(u.x + Math.round(lean * (i / u.h)), u.y - i, u.c);
    put(u.x - 1, u.y, u.c); put(u.x + 1, u.y, u.c);
  }
}

/** A horse side-on, hooves at (h.x, h.y): grazing (head down), standing or walking. */
function drawHorse(h: Horse) {
  const f = h.dir, x = Math.round(h.x), y = Math.round(h.y), c = h.coat, mane = c === BARK ? VOID : c === TILEW ? STONEL : BARK;
  const p = (dx: number, dy: number, w: number, hh: number, col: number) => rect(f > 0 ? x + dx : x - dx - w + 1, y + dy, w, hh, col);
  const walk = h.st === 'walk', step = walk ? Math.round(Math.sin(h.ph * 6)) : 0;
  p(-7, 0, 15, 1, LEAFGD); // shadow on the grass
  // legs (hind pair, front pair), hooves dark
  for (const [lx, o] of [[-6, step], [-4, -step], [4, -step], [6, step]] as const) { p(lx, -5, 1, 4, lx === -4 || lx === 6 ? mane : c); p(lx + o, -1, 1, 1, VOID); }
  // body, belly shade, rump
  p(-7, -10, 14, 5, c); p(-6, -6, 12, 1, mane === STONEL ? STONEL : BNEAR); p(-8, -9, 1, 3, c);
  // tail, swishing
  const sw = Math.round(Math.sin(h.ph * 1.7) * 1.2);
  p(-9, -9, 1, 2, mane); p(-9 + Math.min(0, sw), -7, 1, 4, mane); p(-10 + sw, -4, 1, 1, mane);
  if (h.st === 'graze') {
    // neck down to the grass, muzzle in it, the head bobbing a little as it crops
    const bob = Math.sin(h.ph * 2.3) > 0.6 ? 1 : 0;
    p(6, -10, 2, 3, c); p(7, -8, 2, 3, c); p(8, -6 + bob, 2, 3, c); p(9, -4 + bob, 2, 3, c); p(8, -11, 1, 3, mane);
    p(10, -2 + bob, 1, 1, VOID);
  } else {
    // neck up, head forward, ear, mane
    p(5, -14, 3, 5, c); p(6, -16, 4, 3, c); p(9, -15, 2, 2, c); p(10, -14, 1, 1, VOID); p(6, -17, 1, 1, c);
    p(4, -15, 1, 5, mane); p(7, -15, 1, 1, VOID);
  }
}

function lights() {
  const n = isNight();
  for (const w of farWins) put(w.x, w.y, n && w.rank < 0.4 ? WWARM : n ? WDIM : BMID);
}

/** A thin plume of smoke rising beside the white building (a scene detail, not weather; none in real rain). */
function smoke() {
  if (raining(S.wxKind, S.rain, S.snow)) return;
  const t = S.ms / 1000, d = windDir(S.wind), s = windStrength(S.wind), col = isNight() ? CLOUDD : S.dayK > 0.7 ? STONE : CLOUD;
  for (let i = 0; i < 16; i++) {
    const a = (t * 0.06 + i / 16) % 1, y = 94 - a * (70 - s * 30), r = 1 + a * 4.5;
    const x = 268 + a * (5 + d * s * 50) + Math.sin(a * 7 + i) * 2;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const X = Math.round(x + dx), Y = Math.round(y + dy);
      if (bay(sx(X), sy(Y)) < 0.8 * (1 - a) * (1 - Math.hypot(dx, dy) / (r + 0.5))) put(X, Y, col);
    }
  }
}

/** Damp asphalt after real rain (S.wet comes from the weather feed). */
function wetRoad() {
  if (S.wet < 0.15) return;
  for (let y = AVENUE.y0; y < AVENUE.y1 - 1; y++) for (let x = G.camX; x < G.camX + G.W; x++) if (bay(sx(x), sy(y)) < S.wet * 0.35) put(x, y, WET);
}

/** Lamp pools: on the avenue, and a faint spill onto the verge of the field. */
function nightLight() {
  if (!isNight()) return;
  for (const l of LAMPS) { lampRoadPool(l, 122); warmPool(l.x + 14, VERGE_Y + 3, 30, 5, 0.22); }
}

function update(dt: number) {
  updateAnimals(dt);
  tickSpawns(dt, 0.35); updatePeople(dt);
  updateCars(dt, 0.8);
  for (const h of horses) stepHorse(h, dt, hr, horses);
}

const FOG = [{ y: 96, h: 8, sp: 0.4 }, { y: 150, h: 10, sp: -0.25 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); lights(); smoke(); drawFireworks();
  blitLayer(mid); wetRoad(); drawFarPrecip();
  for (const l of LAMPS) lampLight(l);
  const s = windStrength(S.wind), swing = 0.3 + s * 2.5;
  for (const w of AV_WIRES) cable({ ...w, ph: w.x0 }, 0, VOID);
  drawAnimalsPerched();
  nightLight();
  drawPeople(); drawCars();
  blitLayer(field); tufts();
  for (const h of [...horses].sort((a, b) => a.y - b.y)) drawHorse(h);
  blitLayer(front);
  for (const c of SKY) cable(c, swing, VOID);
  drawAnimalsGround();
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const avenidaCampo: Scene = {
  id: 'avenida-campo',
  name: 'Avenida e Campo',
  build() {
    if (!built) { buildFar(); buildMid(); buildField(); built = true; }
    // a quiet outskirts view: the odd walker on the far sidewalk, no crowd
    setLanes([{ y: AVENUE.y0 - 1 }], { bikes: false });
    setupAnimals({ ground: [178], dogs: 1, lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })),
      wires: AV_WIRES.map((w) => wireCurve(w.x0, w.y0, w.x1, w.y1, w.sag)) });
    setCarLanes(FAR_LANE, NEAR_LANE, 'br');
    configure({ roofs: [], tips: [], lamps: [], ground0: AVENUE.y1, horizon: HORIZON });
    const h = mulberry32(0x40e5); horses = makeHorses(3, h, COATS); taps = 0;
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  // a tapped horse snorts or says a quiet line (nothing about the weather)
  tap(x, y) {
    const h = horseAt(horses, x, y);
    if (!h) return null;
    return { x: h.x, y: h.y - HORSE_H - 2, say: horseLine(taps++) };
  },
  debug() {
    return `active  people x${peopleCount()}  cavalos ${horses.map((h) => `${h.st}@${Math.round(h.x)},${Math.round(h.y)}`).join(' ')}`;
  },
};
