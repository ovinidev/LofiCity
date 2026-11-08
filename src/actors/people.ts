/* Pedestrians assembled from parts: height, skin, hair, clothes, accessories and companions.
   Who appears depends on the hour (commuters, students, kids with randoseru, elderly,
   night owls), the weekday, the weather (umbrellas) and the season (coats and scarves,
   tees, yukata on festival nights). Drawn procedurally in world space, side view. */
import { G, put, rect } from '../engine/gfx';
import { bay, mulberry32, type Rng } from '../engine/math';
import {
  BARK, CBEIGE, CBLUE, CGREEN, CNAVY, CORNG, CRED, CYAN, CYELL, HAIR1, HAIR2, HAIR3, HALO, MAGD,
  SKIN1, SKIN2, SKIN3, SKIN4, STEEL, UMB, VOID, WCOOL, WHITE, WOOD, AMB, AMBD,
} from '../engine/palette';
import { S } from '../sky/state';

const enum Kind { Walk, Bike, Chair }
const enum Top { Jacket, Suit, Coat, Tee, Sailor, Gakuran, Yukata, Shirt }
const enum Hair { Short, Long, Bun, Bob, Bald, Spiky }
const enum Bag { None, Shoulder, Backpack, Randoseru, Briefcase }

export interface Person {
  on: boolean; x: number; dir: number; sp: number; ph: number; lane: number; kind: Kind;
  H: number; skin: number; hair: number; hairStyle: Hair; hat: number; hatC: number;
  top: Top; topC: number; bottomC: number; skirt: boolean; accent: number; scarf: number;
  bag: Bag; bagC: number; umb: number; stoop: boolean; cane: boolean; dog: number; phone: boolean; box: number; light: boolean;
  /** Esperança extras: jogging, a sun umbrella, a pushcart. */
  run: boolean; sun: boolean; push: number;
}

export interface Lane { y: number }

const r: Rng = mulberry32(0x9e0b1e);
const pick = <T>(a: readonly T[]): T => a[(r() * a.length) | 0];
function weighted<T>(items: [T, number][]): T {
  let t = 0; for (const [, w] of items) t += w;
  let x = r() * t;
  for (const [v, w] of items) { x -= w; if (x <= 0) return v; }
  return items[0][0];
}

const POOL = 18;
const P: Person[] = Array.from({ length: POOL }, () => ({
  on: false, x: 0, dir: 1, sp: 0, ph: 0, lane: 0, kind: Kind.Walk, H: 16, skin: SKIN1, hair: HAIR1, hairStyle: Hair.Short,
  hat: 0, hatC: 0, top: Top.Jacket, topC: 0, bottomC: 0, skirt: false, accent: 255, scarf: 255, bag: Bag.None, bagC: 0,
  umb: 255, stoop: false, cane: false, dog: 255, phone: false, box: 255, light: false, run: false, sun: false, push: 255,
}));
let lanes: Lane[] = [{ y: 145 }];

export function setLanes(l: Lane[]) { lanes = l; for (const p of P) p.on = false; }

const SKINS: [number, number][] = [[SKIN1, 0.34], [SKIN2, 0.34], [SKIN3, 0.2], [SKIN4, 0.12]];
const SKINS_BR: [number, number][] = [[SKIN1, 0.18], [SKIN2, 0.34], [SKIN3, 0.3], [SKIN4, 0.18]];
const UMBS = [UMB, UMB, UMB, CNAVY, CRED, VOID, CBLUE, CGREEN, CYELL, MAGD];

type Archetype = 'salary' | 'office' | 'student' | 'kid' | 'elder' | 'casual' | 'dog' | 'bike' | 'delivery' | 'chair' | 'yukata' | 'owl' | 'runner' | 'sombrinha' | 'vendor';

/** Weights per archetype for the current hour, weekday and season. */
function archetypes(): [Archetype, number][] {
  const h = S.cal.hour, wd = S.cal.weekday >= 1 && S.cal.weekday <= 5 ? 1 : 0.25;
  const peak = (a: number, b: number) => (h >= a && h < b ? 1 : 0);
  const commute = peak(6.5, 9.5) + peak(17, 21) * 0.9;
  const br = S.city.br, biz = br ? 0.3 : 1;
  const festival = !br && (S.fireworks || (S.cal.month >= 6 && S.cal.month <= 7 && h >= 17.5 && h < 22.5)) ? 1 : 0;
  const festa = br && (S.festa || S.saoJoao) && h >= 18 && h < 23 ? 1 : 0;
  return [
    ['salary', (0.4 + 3 * commute * wd + peak(21, 24) * 0.8) * biz],
    ['office', (0.3 + 2.2 * commute * wd) * biz],
    ['student', (peak(7, 8.7) * 3 + peak(15, 18.5) * 2) * wd + 0.1],
    ['kid', (peak(7, 8.3) * 2.5 + peak(14, 16.5) * 2) * wd + peak(9, 17) * 0.3 * (1 - wd)],
    ['elder', peak(7, 17.5) * 1.4 + 0.05],
    ['casual', 0.6 + peak(10, 24) * 1.4 + (1 - wd) * 1.5 + festa * 4 + (br ? 1 : 0)],
    ['dog', peak(5.5, 8.5) * 1.2 + peak(16.5, 20) * 1],
    ['bike', 0.5 + commute * 0.8],
    ['delivery', peak(11, 14) * 0.6 + peak(18, 23.5) * 0.9 + peak(0, 2) * 0.3],
    ['chair', peak(8, 19) * 0.25 + (br ? peak(17.5, 22) * 1.2 : 0)],
    ['yukata', festival * 4],
    ['owl', peak(0, 5) * 2 + peak(23, 24)],
    // Esperança: joggers at dawn and dusk, sun umbrellas on hot clear days, street vendors
    ['runner', br ? peak(5, 7.5) * 2 + peak(17, 19.5) * 1.5 : 0],
    ['sombrinha', br && S.temp !== null && S.temp > 26 && S.dayK > 0.6 && S.cloud < 0.5 ? 1.4 : 0],
    ['vendor', br ? peak(8, 17) * 0.7 : 0],
  ];
}

function dress(p: Person, a: Archetype) {
  // unknown temperature (no reading): none of these, so the neutral default outfit
  const t = S.temp, cold = t !== null && t < 8, cool = t !== null && t < 17, hot = t !== null && t > 23;
  const female = r() < 0.5;
  p.H = 15 + ((r() * 3) | 0); p.skin = weighted(S.city.br ? SKINS_BR : SKINS); p.hair = weighted([[HAIR1, 0.62], [HAIR2, 0.3], [CORNG, 0.04], [CBEIGE, 0.04]]);
  p.hairStyle = female ? pick([Hair.Long, Hair.Bob, Hair.Bun, Hair.Long]) : pick([Hair.Short, Hair.Short, Hair.Spiky]);
  p.hat = 0; p.skirt = false; p.accent = 255; p.scarf = 255; p.bag = Bag.None; p.stoop = false; p.cane = false;
  p.dog = 255; p.phone = false; p.box = 255; p.kind = Kind.Walk; p.run = false; p.sun = false; p.push = 255;
  const br = S.city.br;
  p.top = cold ? Top.Coat : cool ? Top.Jacket : hot ? Top.Tee : pick([Top.Jacket, Top.Tee, Top.Shirt]);
  p.topC = pick([CNAVY, VOID, CBEIGE, CGREEN, CRED, CBLUE, STEEL, CYELL]);
  p.bottomC = pick([CNAVY, VOID, CBEIGE, CBLUE, STEEL]);
  p.sp = 11 + r() * 7;
  switch (a) {
    case 'salary':
      p.hairStyle = Hair.Short; p.top = hot ? Top.Shirt : cold ? Top.Coat : Top.Suit;
      p.topC = p.top === Top.Shirt ? WHITE : p.top === Top.Coat ? pick([CBEIGE, VOID, CNAVY]) : pick([VOID, CNAVY, STEEL]);
      p.bottomC = pick([VOID, CNAVY, STEEL]); p.accent = pick([CRED, CBLUE, CYELL, CNAVY]); p.bag = Bag.Briefcase; p.bagC = VOID; p.sp = 15 + r() * 6;
      break;
    case 'office':
      p.top = cold ? Top.Coat : Top.Suit; p.topC = pick([CBEIGE, CNAVY, VOID, WHITE]); p.skirt = female && r() < 0.6;
      p.bottomC = p.skirt ? pick([CNAVY, VOID, CBEIGE]) : pick([VOID, CNAVY]); p.bag = Bag.Shoulder; p.bagC = pick([CBEIGE, VOID, CRED, WOOD]);
      if (!female) { p.hairStyle = Hair.Short; p.skirt = false; }
      break;
    case 'student':
      p.H = 15 + ((r() * 2) | 0);
      if (br) { // public-school uniform: white tee, blue trousers, backpack
        p.top = Top.Tee; p.topC = WHITE; p.bottomC = CBLUE; p.bag = Bag.Backpack; p.bagC = pick([VOID, CNAVY, CRED, CBLUE]); p.phone = r() < 0.5; p.sp = 13 + r() * 5;
        break;
      }
      if (female) { p.top = Top.Sailor; p.topC = CNAVY; p.skirt = true; p.bottomC = CNAVY; p.accent = CRED; }
      else { p.top = Top.Gakuran; p.topC = VOID; p.bottomC = VOID; p.accent = CYELL; p.hairStyle = Hair.Short; }
      if (cold) p.scarf = pick([CRED, CNAVY, CBEIGE]);
      p.bag = r() < 0.5 ? Bag.Backpack : Bag.Shoulder; p.bagC = pick([VOID, CNAVY, CBEIGE]); p.phone = r() < 0.4; p.sp = 13 + r() * 5;
      break;
    case 'kid':
      p.H = 10 + ((r() * 2) | 0); p.top = cold ? Top.Coat : hot ? Top.Tee : Top.Jacket; p.topC = pick([CYELL, CRED, CBLUE, CGREEN, WHITE]);
      p.bag = Bag.Randoseru; p.bagC = pick([CRED, VOID, WOOD, CNAVY, MAGD]); p.hat = r() < 0.6 ? 2 : 0; p.hatC = CYELL; p.sp = 13 + r() * 6;
      p.hairStyle = female ? Hair.Bob : Hair.Short;
      if (br) { p.bag = Bag.Backpack; p.hat = 0; p.top = Top.Tee; p.topC = WHITE; p.bottomC = CBLUE; }
      break;
    case 'elder':
      p.H = 14 + ((r() * 2) | 0); p.hair = HAIR3; p.hairStyle = female ? Hair.Bun : r() < 0.5 ? Hair.Bald : Hair.Short;
      p.stoop = r() < 0.6; p.cane = r() < 0.5; p.topC = pick([CBEIGE, WOOD, CGREEN, STEEL, CNAVY]); p.sp = 6 + r() * 3;
      p.hat = !female && r() < 0.4 ? 2 : 0; p.hatC = pick([CBEIGE, STEEL]);
      if (female && r() < 0.5) { p.bag = Bag.Shoulder; p.bagC = WOOD; }
      if (br && !female && r() < 0.45) { p.hat = 3; p.hatC = WOOD; } // chapéu de couro
      break;
    case 'casual':
      p.phone = r() < 0.5; p.hat = r() < 0.3 ? (cold ? 1 : 2) : 0; p.hatC = pick([VOID, CRED, CNAVY, CBEIGE]);
      p.bag = r() < 0.4 ? Bag.Backpack : r() < 0.5 ? Bag.Shoulder : Bag.None; p.bagC = pick([VOID, CBEIGE, CGREEN, CNAVY]);
      p.skirt = female && r() < 0.35;
      break;
    case 'dog':
      p.dog = pick([WOOD, AMBD, WHITE, VOID, CBEIGE]); p.sp = 9 + r() * 4;
      break;
    case 'bike':
      p.kind = Kind.Bike; p.sp = 34 + r() * 12; p.light = true;
      if (r() < 0.3) { p.top = Top.Suit; p.topC = VOID; p.bottomC = VOID; }
      break;
    case 'delivery':
      p.kind = Kind.Bike; p.sp = 40 + r() * 10; p.box = pick([CORNG, CRED, CYELL, CGREEN]); p.top = Top.Jacket; p.topC = p.box; p.hat = 2; p.hatC = p.box; p.light = true;
      break;
    case 'chair':
      p.kind = Kind.Chair; p.sp = 8 + r() * 3;
      break;
    case 'yukata':
      p.top = Top.Yukata; p.topC = pick([CNAVY, CRED, WHITE, CBLUE, MAGD, CGREEN]); p.accent = pick([CYELL, CRED, WHITE, AMB]);
      p.hairStyle = female ? Hair.Bun : Hair.Short; p.sp = 8 + r() * 4; p.bag = Bag.None;
      break;
    case 'runner':
      p.run = true; p.top = Top.Tee; p.topC = pick([CYELL, CRED, CBLUE, WHITE, CGREEN, MAGD]); p.bottomC = pick([VOID, CNAVY, STEEL]);
      p.bag = Bag.None; p.phone = false; p.hat = r() < 0.4 ? 2 : 0; p.hatC = pick([WHITE, VOID, CRED]); p.sp = 30 + r() * 8;
      break;
    case 'sombrinha':
      p.sun = true; p.umb = pick([CRED, CYELL, CBLUE, MAGD, CGREEN]); p.hairStyle = pick([Hair.Long, Hair.Bun]); p.skirt = r() < 0.5;
      p.top = Top.Tee; p.bag = Bag.Shoulder; p.bagC = pick([WOOD, CBEIGE, VOID]); p.sp = 9 + r() * 3;
      break;
    case 'vendor':
      p.push = pick([CRED, CBLUE, WHITE, CYELL]); p.hat = 2; p.hatC = pick([WHITE, CYELL, CRED]); p.top = Top.Tee; p.sp = 7 + r() * 3;
      break;
    case 'owl':
      p.phone = r() < 0.7; p.sp = 9 + r() * 6;
      if (r() < 0.5) { p.top = cold ? Top.Coat : Top.Suit; p.topC = VOID; p.accent = 255; p.bag = Bag.Briefcase; p.bagC = VOID; }
      break;
  }
  if (cold && p.top !== Top.Yukata && p.scarf === 255 && r() < 0.45) p.scarf = pick([CRED, CYELL, WHITE, CBEIGE, CGREEN]);
  if (cold && p.hat === 0 && r() < 0.25) { p.hat = 1; p.hatC = pick([CRED, CNAVY, CBEIGE, VOID, CYELL]); }
  const wet = S.rain + S.snow > 0.08;
  p.umb = wet && r() < 0.9 ? pick(UMBS) : p.sun ? p.umb : 255;
  if (wet && p.umb === 255) p.sp *= 1.3; // hurrying without one
}

/** Adds one pedestrian (or a couple) entering from a screen edge. Returns how many spawned. */
export function spawnPerson(couple = false): number {
  const archs = archetypes();
  const a = weighted(archs);
  const dir = r() < 0.5 ? 1 : -1, lane = (r() * lanes.length) | 0;
  const n = couple || (a === 'yukata' && r() < 0.5) || (a === 'casual' && S.cal.hour >= 18 && r() < 0.3) ? 2 : 1;
  let made = 0, sp = 0;
  for (const p of P) {
    if (p.on) continue;
    dress(p, a);
    if (made === 1) { p.sp = sp; } else sp = p.sp;
    p.on = true; p.dir = dir; p.lane = lane; p.ph = r() * 4;
    p.x = dir > 0 ? G.camX - 16 - made * 9 : G.camX + G.W + 16 + made * 9;
    if (++made >= n) break;
  }
  return made;
}

let spawnT = 0.5;
/** Spawns pedestrians at a rate that follows how busy the hour is. */
export function tickSpawns(dt: number, density = 1) {
  spawnT -= dt * (0.05 + 0.42 * S.busy) * density;
  if (spawnT <= 0) { spawnT = 0.5 + r() * 1.5; spawnPerson(); }
}

export function updatePeople(dt: number) {
  for (const p of P) {
    if (!p.on) continue;
    p.x += p.dir * p.sp * dt;
    p.ph += dt * (p.kind === Kind.Bike ? 6 : p.sp * 0.42);
    if (p.x < G.camX - 40 || p.x > G.camX + G.W + 40) p.on = false;
  }
}

/** A tapped pedestrian (and their dog, if any). */
export function tapPeople(x: number, y: number): { x: number; y: number; dog: boolean } | null {
  for (const p of P) {
    if (!p.on) continue;
    const gy = lanes[p.lane]?.y ?? 0;
    if (Math.abs(x - p.x) < 5 && y > gy - p.H - 2 && y < gy + 2) return { x: p.x, y: gy - p.H, dog: p.dog !== 255 };
  }
  return null;
}

export const peopleCount = () => P.reduce((n, p) => n + (p.on ? 1 : 0), 0);

// ---------- drawing ----------
const STRIDE = [2, 1, 0, 1];

function head(p: Person, hx: number, y: number, f: number) {
  const hc = p.hair, hs = p.hairStyle;
  rect(hx - 1, y + 1, 3, 3, p.skin);
  if (hs !== Hair.Bald) { rect(hx - 1, y, 3, 1, hc); put(hx - f, y + 1, hc); }
  else { put(hx - f, y + 2, hc); }
  if (hs === Hair.Long) { put(hx - f, y + 2, hc); put(hx - f, y + 3, hc); put(hx - f, y + 4, hc); put(hx - 2 * f, y + 2, hc); }
  if (hs === Hair.Bob) { put(hx - f, y + 2, hc); put(hx - 2 * f, y + 1, hc); put(hx - 2 * f, y + 2, hc); }
  if (hs === Hair.Bun) put(hx - f, y - 1, hc);
  if (hs === Hair.Spiky) { put(hx, y - 1, hc); put(hx - f, y - 1, hc); }
  if (p.hat === 1) { rect(hx - 1, y - 1, 3, 2, p.hatC); put(hx - f, y + 1, p.hatC); }
  else if (p.hat === 2) { rect(hx - 1, y, 3, 1, p.hatC); put(hx + 2 * f, y + 1, p.hatC); put(hx + f, y + 1, p.hatC); }
  else if (p.hat === 3) { rect(hx - 2, y, 5, 1, p.hatC); rect(hx - 1, y - 1, 3, 1, p.hatC); put(hx - 2, y - 1, p.hatC); put(hx + 2, y - 1, p.hatC); } // leather hat, upturned brim
  if (p.phone && S.dayK < 0.5) { put(hx + 2 * f, y + 3, CYAN); put(hx + f, y + 2, WCOOL); }
}

function umbrella(p: Person, ux: number, yTop: number) {
  if (p.umb === 255 || (S.rain + S.snow < 0.06 && !p.sun)) return;
  const c = p.umb;
  rect(ux - 3, yTop, 7, 1, c);
  rect(ux - 4, yTop + 1, 9, 1, c);
  for (let i = -5; i <= 5; i++) if (i % 3 !== 0) put(ux + i, yTop + 2, c);
  put(ux, yTop - 1, STEEL);
  for (let y = yTop + 2; y < yTop + 8; y++) put(ux, y, STEEL);
  if (S.snowCover > 0.2 && S.snow > 0.05) { rect(ux - 2, yTop - 1, 5, 1, WHITE); }
}

function drawDog(dx: number, yF: number, f: number, c: number, ph: number, hand: [number, number]) {
  const leg = ((ph * 2) | 0) & 1;
  rect(dx - 2, yF - 3, 5, 2, c);
  put(dx + 3 * f, yF - 4, c); put(dx + 2 * f, yF - 4, c); put(dx + 3 * f, yF - 3, c); // head
  put(dx - 3 * f, yF - 4, c); // tail
  put(dx - 2 + leg, yF - 1, c); put(dx + 2 - leg, yF - 1, c);
  // leash with a little sag
  const [hx, hy] = hand, ex = dx + 2 * f, ey = yF - 4, n = Math.abs(ex - hx);
  for (let i = 0; i <= n; i++) { const t = i / (n || 1); put(hx + (ex - hx) * t, hy + (ey - hy) * t + Math.sin(t * Math.PI) * 1.5, VOID); }
}

const STRIDE_RUN = [3, 0, 3, 0];
function drawWalker(p: Person, yGround: number) {
  const f = p.dir, X = Math.round(p.x), H = p.H, fr = (p.ph | 0) & 3, s = p.run ? STRIDE_RUN[fr] : STRIDE[fr];
  const yF = yGround - (p.run && fr & 1 ? 1 : 0); // runners bounce
  const kid = H <= 11, legL = kid ? 4 : Math.round(H * 0.37), yHead = yF - H + 1 + (p.stoop ? 1 : 0);
  const hx = X + (p.stoop ? f : 0), yT = yHead + 4, yLeg = yF - legL + 1, tw = kid ? 1 : 2;
  const long = p.top === Top.Coat || p.top === Top.Yukata;
  // legs
  for (let rr = 0; rr < legL; rr++) {
    const t = legL > 1 ? rr / (legL - 1) : 0, off = Math.round(s * t);
    const bare = p.skirt && rr >= 2;
    const c = rr === legL - 1 ? VOID : bare ? p.skin : p.top === Top.Yukata ? p.topC : p.bottomC;
    if (s === 0) { put(X - 1, yLeg + rr, c); put(X, yLeg + rr, c); }
    else { put(X - off, yLeg + rr, c); put(X + off, yLeg + rr, c); }
  }
  if (p.skirt) rect(X - 2, yLeg, 5, 2, p.bottomC);
  // torso
  const tEnd = long ? yLeg + Math.min(legL - 2, p.top === Top.Yukata ? legL - 1 : 2) : yLeg;
  rect(X - tw, yT, tw * 2 + 1, tEnd - yT, p.topC);
  if (p.top === Top.Suit) { put(X + f, yT, WHITE); put(X + f, yT + 1, p.accent === 255 ? WHITE : p.accent); }
  if (p.top === Top.Shirt && p.accent !== 255) put(X + f, yT + 1, p.accent);
  if (p.top === Top.Sailor) { rect(X - tw, yT, tw * 2 + 1, 1, WHITE); put(X + f, yT + 1, p.accent); }
  if (p.top === Top.Gakuran) for (let y = yT + 1; y < tEnd; y += 2) put(X + f, y, p.accent);
  if (p.top === Top.Yukata) {
    for (let y = yT; y < tEnd; y++) for (let x = X - tw; x <= X + tw; x++) if (bay(x, y) < 0.18) put(x, y, p.topC === WHITE ? CNAVY : WHITE);
    rect(X - tw, yT + 3, tw * 2 + 1, 1, p.accent);
  }
  // arm swing (hand)
  const armX = X + [-1, 0, 1, 0][fr] * f * (p.cane ? 0 : 1) + (p.cane ? 2 * f : 0);
  const sleeve = p.top === Top.Tee ? p.skin : p.topC;
  put(armX, yT + 2, sleeve); put(armX, yT + 3, sleeve); put(armX, yT + 4, p.skin);
  if (p.scarf !== 255) { rect(X - tw, yT, tw * 2 + 1, 1, p.scarf); put(X - (tw + 1) * f, yT + 1, p.scarf); }
  // bags
  if (p.bag === Bag.Backpack) rect(X - (tw + 2) * f + (f < 0 ? -1 : 0) + (f > 0 ? 0 : 1), yT + 1, 2, 4, p.bagC);
  if (p.bag === Bag.Randoseru) rect(f > 0 ? X - tw - 3 : X + tw + 1, yT, 3, 4, p.bagC);
  if (p.bag === Bag.Shoulder) { rect(X - (tw + 1) * f - (f < 0 ? 1 : 0), yT + 3, 2, 3, p.bagC); put(X, yT, p.bagC); }
  if (p.bag === Bag.Briefcase) rect(armX - 1, yT + 5, 3, 2, p.bagC);
  if (p.cane) for (let y = yT + 4; y <= yF; y++) put(X + 3 * f, y, BARK);
  head(p, hx, yHead, f);
  umbrella(p, X + f, yHead - 5);
  if (p.dog !== 255) drawDog(X + 9 * f, yF, f, p.dog, p.ph, [armX, yT + 4]);
  if (p.push !== 255) { // pushcart: box on a wheel, handles to the hands
    const cx = f > 0 ? X + 3 : X - 9;
    rect(cx, yF - 7, 7, 4, p.push); rect(cx, yF - 7, 7, 1, STEEL); put(cx + (f > 0 ? 5 : 1), yF - 1, VOID); put(cx + (f > 0 ? 5 : 1), yF - 2, VOID);
    put(armX, yT + 4, STEEL); put(f > 0 ? cx - 1 : cx + 7, yF - 6, STEEL);
  }
}

function wheel(cx: number, cy: number, rad: number, ph: number) {
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; put(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad, VOID); }
  const t = ph * 2;
  put(cx + Math.cos(t) * (rad - 1), cy + Math.sin(t) * (rad - 1), STEEL);
}

function drawBike(p: Person, yF: number) {
  const f = p.dir, X = Math.round(p.x), cy = yF - 2;
  wheel(X - 4 * f, cy, 2.4, p.ph); wheel(X + 4 * f, cy, 2.4, p.ph);
  for (let i = 0; i <= 4; i++) { put(X - 4 * f + i * f, cy - (i * 3) / 4, STEEL); put(X + i * f, cy - 3 + (i * 3) / 4, STEEL); }
  put(X + 3 * f, cy - 4, STEEL); put(X + 3 * f, cy - 5, STEEL); put(X + 2 * f, cy - 5, STEEL);
  put(X - f, cy - 4, VOID);
  // rider
  const yHead = yF - 15;
  rect(X - 1, yHead + 4, 3, 5, p.topC);
  const k = Math.sin(p.ph * 2) > 0 ? 1 : 0;
  put(X + f, yHead + 9, p.bottomC); put(X + 2 * f, yHead + 9 + k, p.bottomC); put(X + 2 * f, yHead + 10 + k, VOID);
  put(X + 2 * f, yHead + 5, p.topC); put(X + 3 * f, yHead + 6, p.skin);
  head(p, X, yHead, f);
  if (p.box !== 255) { rect(f > 0 ? X - 6 : X + 3, yHead + 5, 4, 4, p.box); put(f > 0 ? X - 5 : X + 4, yHead + 6, WHITE); }
  umbrella(p, X, yHead - 5);
  if (p.light && S.dayK < 0.6) {
    put(X + 5 * f, cy - 3, WHITE);
    for (let i = 1; i < 12; i++) for (let j = -1; j <= 1; j++) if (bay(X + (5 + i) * f, cy - 3 + j) < 0.3 * (1 - i / 12)) put(X + (5 + i) * f, cy - 3 + j, HALO);
  }
}

function drawChair(p: Person, yF: number) {
  const f = p.dir, X = Math.round(p.x);
  wheel(X - f, yF - 3, 3.2, p.ph); put(X + 3 * f, yF - 1, VOID); put(X + 3 * f, yF, VOID);
  rect(X - 3 * f - (f < 0 ? 0 : 0), yF - 10, 1, 7, STEEL); rect(Math.min(X - 2 * f, X + 2 * f), yF - 5, 5, 1, STEEL);
  const yHead = yF - 14;
  rect(X - 2, yHead + 4, 3, 5, p.topC);
  rect(Math.min(X, X + 2 * f), yF - 5, 3, 1, p.bottomC); put(X + 2 * f, yF - 4, p.bottomC); put(X + 2 * f, yF - 2, VOID);
  put(X, yHead + 6, p.skin);
  head(p, X - 1, yHead, f);
  umbrella(p, X, yHead - 5);
}

/** Draws everyone on the given lanes, back lane first. */
export function drawPeople() {
  const order = lanes.map((l, i) => [l.y, i] as const).sort((a, b) => a[0] - b[0]);
  for (const [y, li] of order)
    for (const p of P) {
      if (!p.on || p.lane !== li) continue;
      if (p.kind === Kind.Bike) drawBike(p, y);
      else if (p.kind === Kind.Chair) drawChair(p, y);
      else drawWalker(p, y);
    }
}
