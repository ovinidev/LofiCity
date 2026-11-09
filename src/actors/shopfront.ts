/* Life at a shop front: vendors standing out by the door while the shop is open, and customers who
   walk in from the street or come out and walk away with a bag. Separate from the street pedestrians
   (people.ts), so a scene opts in per shop and the rest of its crowd is untouched. How many and how
   often follow the real hour (S.busy, from rhythm.ts) and the shop's own opening hours; rules are in
   shop-rules.ts. In real rain or snow customers open an umbrella or hurry (rain-rules.ts, as every
   other walker), never in unknown weather. Drawn in world space, side view, like the pedestrians. */
import { G, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import { CBLUE, CBEIGE, CGREEN, CNAVY, CORNG, CRED, CYELL, HAIR1, HAIR2, HAIR3, MANTO, SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, TILEW, UMB, VOID, WHITE, WOOD } from '../engine/palette';
import { S } from '../sky/state';
import { customerRain, nextVisitIn, vendorCount, visitIsExit, visitorCap } from './shop-rules';
import { umbrellaOpen } from './rain-rules';

export interface ShopFront {
  /** World x of each place a customer can go in (a door, or a stretch of open front). */
  doors: number[];
  /** Ground row the figures stand on. */
  y: number;
  /** World x of each vendor out front, in the order they appear as the street fills. */
  vendors: number[];
  /** How busy this shop is next to an ordinary one (1). */
  weight: number;
  open: () => boolean;
  /** Vest or apron colour of the staff. */
  vest: number;
  /** Optional bright band across the vest (default: just a small name tag), so staff read against a busy front. */
  trim?: number;
}

interface Fig { x: number; dir: number; skin: number; hair: number; top: number; low: number; skirt: boolean; bag: number; vest: number }
interface Visitor extends Fig { on: boolean; shop: number; tx: number; out: boolean; sp: number; ph: number; wait: number; umb: number }

const r = mulberry32(0x5b0f7);
const pick = <T>(a: readonly T[]): T => a[(r() * a.length) | 0];
const POOL = 14;
const V: Visitor[] = Array.from({ length: POOL }, () => ({ on: false, shop: 0, tx: 0, out: false, sp: 10, ph: 0, wait: 0, umb: 255, x: 0, dir: 1, skin: SKIN2, hair: HAIR1, top: WHITE, low: VOID, skirt: false, bag: 255, vest: 255 }));
let fronts: ShopFront[] = [];
let staff: Fig[][] = [];
let timers: number[] = [];

const SKINS = [SKIN1, SKIN2, SKIN2, SKIN3, SKIN3, SKIN4];
const HAIRS = [HAIR1, HAIR1, HAIR2, HAIR3];
const TOPS = [WHITE, WHITE, CBLUE, MANTO, CRED, CYELL, CGREEN, CBEIGE];
const LOWS = [VOID, CBLUE, STONE, CBEIGE];
const UMBS = [UMB, UMB, CNAVY, CRED, CBLUE];

function dress(f: Fig, vest: number | null) {
  f.skin = pick(SKINS); f.hair = pick(HAIRS); f.skirt = r() < 0.4;
  f.top = vest ?? pick(TOPS); f.low = f.skirt && vest === null ? f.top : pick(LOWS); f.vest = vest ?? 255; f.bag = 255;
}

/** Sets this scene's shop fronts (clearing every visitor). A scene that never calls it has none. */
export function setShopFronts(list: ShopFront[]) {
  fronts = list;
  staff = list.map((s) => s.vendors.map((x) => { const f: Fig = { x, dir: r() < 0.5 ? 1 : -1, skin: 0, hair: 0, top: 0, low: 0, skirt: false, bag: 255, vest: 255 }; dress(f, s.vest); f.skirt = false; return f; }));
  timers = list.map(() => 1 + r() * 4);
  for (const v of V) v.on = false;
}

const countFor = (shop: number) => V.reduce((n, v) => n + (v.on && v.shop === shop ? 1 : 0), 0);

function spawnVisitor(shop: number) {
  const v = V.find((o) => !o.on), s = fronts[shop];
  if (!v) return;
  dress(v, null);
  v.shop = shop; v.on = true; v.ph = r() * 4; v.sp = 9 + r() * 4; v.wait = 0;
  const wx = customerRain(S.wxKind, S.rain, S.snow, r()); // real rain only (rain-rules.ts)
  v.umb = wx.umbrella ? pick(UMBS) : 255; v.sp *= wx.speedK;
  const door = pick(s.doors);
  v.out = visitIsExit(r());
  if (v.out) { // comes out of the door and walks off, usually with a bag
    v.x = door + (r() - 0.5) * 4; v.dir = r() < 0.5 ? 1 : -1; v.tx = door; v.bag = r() < 0.7 ? pick([CRED, CYELL, WHITE, CORNG, WOOD]) : 255;
  } else { // walks up from the street, stops a moment at the door, goes in
    v.dir = r() < 0.5 ? 1 : -1; v.x = door - v.dir * (36 + r() * 50); v.tx = door; v.bag = 255; v.wait = 0.3 + r() * 0.5;
  }
}

export function updateShopFronts(dt: number) {
  fronts.forEach((s, i) => {
    if (!s.open()) { for (const v of V) if (v.on && v.shop === i && !v.out) v.on = false; timers[i] = 2; return; }
    timers[i] -= dt;
    if (timers[i] > 0) return;
    timers[i] = nextVisitIn(S.busy, s.weight, r());
    if (countFor(i) < visitorCap(S.busy, s.weight, 6)) spawnVisitor(i);
  });
  for (const v of V) {
    if (!v.on) continue;
    if (v.out) {
      v.x += v.dir * v.sp * dt; v.ph += dt * v.sp * 0.42;
      if (v.x < G.camX - 14 || v.x > G.camX + G.W + 14) v.on = false;
      continue;
    }
    const d = v.tx - v.x;
    if (Math.abs(d) > 1) { v.dir = Math.sign(d); v.x += v.dir * v.sp * dt; v.ph += dt * v.sp * 0.42; }
    else { v.wait -= dt; if (v.wait <= 0) v.on = false; } // through the door
  }
}

function drawFig(f: Fig, y: number, stride: number, arm: boolean, trim = 255) {
  const X = Math.round(f.x);
  for (let rr = 0; rr < 5; rr++) {
    const off = rr >= 2 ? stride : 0, c = rr === 4 ? VOID : f.skirt && rr >= 2 ? f.skin : f.low;
    put(X - 1 - off, y - 4 + rr, c); put(X + 1 + off, y - 4 + rr, c);
  }
  rect(X - 1, y - 10, 3, f.skirt ? 8 : 6, f.top);
  if (f.vest !== 255) { put(X - 1, y - 8, TILEW); put(X + 1, y - 8, TILEW); } // name tag / stripe on the vest
  if (trim !== 255) { rect(X - 1, y - 8, 3, 1, trim); put(X - 1, y - 10, trim); put(X + 1, y - 10, trim); } // bright band and shoulder straps
  rect(X - 1, y - 14, 3, 3, f.skin); rect(X - 1, y - 15, 3, 1, f.hair); put(X - f.dir, y - 14, f.hair);
  if (f.skirt) put(X - f.dir, y - 13, f.hair);
  if (arm) { put(X + f.dir * 2, y - 11, f.skin); put(X + f.dir * 2, y - 12, f.skin); } // a wave at the passers-by
  if (f.bag !== 255) { rect(X + f.dir * 2, y - 6, 3, 3, f.bag); put(X + f.dir * 2 + 1, y - 7, f.skin); }
}

/** An open umbrella over a customer (as the street pedestrians carry it): canopy at yTop, shaft to the hand. */
function umbrellaOver(ux: number, yTop: number, c: number) {
  rect(ux - 3, yTop, 7, 1, c); rect(ux - 4, yTop + 1, 9, 1, c);
  for (let i = -5; i <= 5; i++) if (i % 3 !== 0) put(ux + i, yTop + 2, c);
  put(ux, yTop - 1, STEEL);
  for (let y = yTop + 2; y < yTop + 9; y++) put(ux, y, STEEL);
}

export function drawShopFronts() {
  const t = S.ms / 1000;
  fronts.forEach((s, i) => {
    const n = vendorCount(s.open(), S.busy, s.vendors.length);
    for (let k = 0; k < n; k++) drawFig(staff[i][k], s.y, 0, ((t + k * 3.7 + i) % 9) < 0.9, s.trim ?? 255);
  });
  for (const v of V) {
    if (!v.on) continue;
    const walking = v.out || Math.abs(v.tx - v.x) > 1;
    drawFig(v, fronts[v.shop].y, walking ? [1, 0, 1, 0][(v.ph | 0) & 3] : 0, false);
    if (v.umb !== 255 && umbrellaOpen(false, S.wxKind, S.rain, S.snow)) umbrellaOver(Math.round(v.x) + v.dir, fronts[v.shop].y - 20, v.umb);
  }
}

/** Debug panel text: vendors standing out and customers in motion. */
export const shopFrontDebug = () =>
  `vend x${fronts.reduce((n, s) => n + vendorCount(s.open(), S.busy, s.vendors.length), 0)} clientes x${V.filter((v) => v.on).length}`;
