/* Animals of the Agreste town: street dogs (the caramelo vira-lata among them) trotting,
   sniffing, sitting, or curled asleep by a door at night; cats on walls and platibandas whose
   eyes catch the light after dark; rolinhas on the wires that burst off when a bus or the
   carro de som goes by; vultures (urubus) circling on the afternoon thermals; flocks crossing
   at dusk; bats around the street lights; calangos darting over warm rock. Each scene says
   where the ground, the wires, the walls and the lamps are. */
import { G, put, rect } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import { BARK, BNEAR, CBEIGE, CYELL, FWG, LEAFG, STEEL, STONE, TERRA, TILEW, VOID, WOOD } from '../engine/palette';
import { S } from '../sky/state';
import { bigVehicleNear } from './br-traffic';

export interface Wire { x0: number; x1: number; y: (x: number) => number }
export interface Perch { x0: number; x1: number; y: number }
export interface AnimalSetup { ground: number[]; wires?: Wire[]; walls?: Perch[]; lamps?: { x: number; y: number }[]; rock?: number[]; dogs?: number; sleepSpots?: number[] }

const r = mulberry32(0xd06);
const pick = <T>(a: readonly T[]): T => a[(r() * a.length) | 0];
let cfg: AnimalSetup = { ground: [145] };

// ---------- dogs ----------
type DogState = 'walk' | 'sniff' | 'sit' | 'scratch' | 'sleep';
interface Dog { on: boolean; x: number; y: number; dir: number; sp: number; c: number; spot: number; st: DogState; t: number; ph: number; ear: boolean; boost: number }
const DOG_COLORS = [TERRA, TERRA, TERRA, VOID, CBEIGE, TILEW, WOOD]; // caramelo first
const dogs: Dog[] = Array.from({ length: 4 }, () => ({ on: false, x: 0, y: 0, dir: 1, sp: 0, c: TERRA, spot: 255, st: 'walk' as DogState, t: 0, ph: 0, ear: false, boost: 0 }));
let dogT = 4;

function spawnDog() {
  const d = dogs.find((o) => !o.on);
  if (!d || !cfg.ground.length) return;
  d.on = true; d.dir = r() < 0.5 ? 1 : -1; d.y = pick(cfg.ground); d.c = pick(DOG_COLORS); d.spot = r() < 0.35 ? (d.c === TILEW ? VOID : TILEW) : 255;
  d.x = d.dir > 0 ? G.camX - 12 : G.camX + G.W + 12; d.sp = 9 + r() * 6; d.st = 'walk'; d.t = 2 + r() * 5; d.ear = r() < 0.5;
}

function updateDogs(dt: number) {
  const night = S.cal.hour >= 22 || S.cal.hour < 5;
  // at night a couple of dogs sleep curled at their usual spots
  if (night && cfg.sleepSpots) cfg.sleepSpots.forEach((x, i) => { const d = dogs[i]; if (d && !d.on) { d.on = true; d.x = x; d.y = cfg.ground[0]; d.c = DOG_COLORS[i % DOG_COLORS.length]; d.spot = 255; d.st = 'sleep'; d.dir = i % 2 ? 1 : -1; d.t = 1e9; } });
  dogT -= dt * (S.rain > 0.4 ? 0.2 : 1);
  // fewer dogs about when the town is empty; late at night only the odd one trots by
  if (dogT <= 0) {
    dogT = (12 + r() * 25) / Math.max(0.25, Math.min(1, S.busy * 2));
    const awake = dogs.filter((d) => d.on && d.st !== 'sleep').length;
    if (awake < (night ? 1 : cfg.dogs ?? 2)) spawnDog();
  }
  for (const d of dogs) {
    if (!d.on) continue;
    d.ph += dt; d.t -= dt;
    if (d.st === 'sleep') { if (!night) { d.st = 'walk'; d.t = 3; } continue; }
    if (d.t <= 0) {
      const q = r();
      d.st = d.st !== 'walk' ? 'walk' : q < 0.4 ? 'sniff' : q < 0.65 ? 'sit' : q < 0.75 ? 'scratch' : 'walk';
      d.t = d.st === 'walk' ? 3 + r() * 6 : 1.5 + r() * 3;
      if (d.st === 'walk' && r() < 0.25) d.dir = -d.dir;
    }
    d.boost = Math.max(0, d.boost - dt);
    if (d.st === 'walk') d.x += d.dir * (d.boost > 0 ? 48 : d.sp) * dt;
    if (d.x < G.camX - 30 || d.x > G.camX + G.W + 30) d.on = false;
  }
}

function drawDog(d: Dog) {
  const x = Math.round(d.x), y = d.y, f = d.dir, c = d.c;
  if (d.st === 'sleep') { // curled up, breathing
    const b = Math.sin(d.ph * 1.6) > 0 ? 1 : 0;
    rect(x - 3, y - 3 - b, 7, 3 + b, c); put(x + 3 * f, y - 4 - b, c); put(x - 3 * f, y - 1, c); return;
  }
  const sit = d.st === 'sit', sniff = d.st === 'sniff', walk = d.st === 'walk', step = walk ? Math.sin(d.ph * 12) : 0;
  const bodyY = sit ? y - 5 : y - 5;
  rect(x - 3, bodyY, 7, 3, c); if (d.spot !== 255) put(x, bodyY, d.spot);
  if (sit) { rect(x - 3 * f, bodyY + 1, 2, 3, c); rect(x + 2 * f, bodyY + 3, 1, 2, c); } // haunches + front legs
  else for (const [lx, ph] of [[-3, 1], [-2, -1], [2, 1], [3, -1]]) { put(x + lx * f + Math.round(step * ph * 0.6), y - 2, c); put(x + lx * f, y - 1, c); }
  const hy = sniff ? bodyY + 2 : bodyY - 2, hx = x + 4 * f;
  rect(hx - (f > 0 ? 0 : 1), hy, 2, 2, c); put(hx + 2 * f, hy + 1, c === VOID ? STONE : VOID); // head, nose
  if (d.ear) put(hx, hy - 1, c); else put(hx - f, hy - 1, c);
  const wag = Math.sin(d.ph * (walk ? 14 : 8)) > 0 ? 1 : 0;
  if (d.st === 'scratch') { put(x - 2 * f, bodyY - 1, c); put(x - 2 * f + (wag ? f : 0), bodyY - 2, c); }
  put(x - 4 * f, bodyY - 1 + wag, c); put(x - 5 * f, bodyY - 2 + wag, c); // tail
}

// ---------- cats ----------
interface Cat { x: number; y: number; perch: Perch; dir: number; c: number; st: 'sit' | 'walk' | 'loaf'; t: number; ph: number; boost: number }
let cats: Cat[] = [];
function initCats() {
  cats = [];
  const walls = cfg.walls ?? [];
  const n = Math.min(walls.length, 1 + ((r() * 2) | 0));
  for (let i = 0; i < n; i++) {
    const p = walls[(r() * walls.length) | 0];
    cats.push({ x: p.x0 + 3 + r() * (p.x1 - p.x0 - 6), y: p.y, perch: p, dir: r() < 0.5 ? 1 : -1, c: pick([VOID, TILEW, TERRA, STEEL, CBEIGE]), st: 'sit', t: 3 + r() * 8, ph: r() * 6, boost: 0 });
  }
}
function updateCats(dt: number) {
  for (const c of cats) {
    c.ph += dt; c.t -= dt;
    if (c.t <= 0) { c.st = pick(['sit', 'sit', 'walk', 'loaf'] as const); c.t = c.st === 'walk' ? 2 + r() * 3 : 4 + r() * 10; if (r() < 0.4) c.dir = -c.dir; }
    c.boost = Math.max(0, c.boost - dt);
    if (c.st === 'walk') {
      c.x += c.dir * (c.boost > 0 ? 34 : 6) * dt;
      if (c.x < c.perch.x0 + 2 || c.x > c.perch.x1 - 3) { c.dir = -c.dir; c.x = Math.max(c.perch.x0 + 2, Math.min(c.perch.x1 - 3, c.x)); }
    }
  }
}
function drawCat(c: Cat) {
  const x = Math.round(c.x), y = c.y - 1, f = c.dir, col = c.c, n = S.dayK < 0.4;
  if (c.st === 'loaf') { rect(x - 2, y - 2, 5, 2, col); put(x + 2 * f, y - 3, col); put(x + 3 * f, y - 3, col); put(x - 3 * f, y - 1, col); }
  else if (c.st === 'sit') {
    rect(x - 1, y - 3, 3, 3, col); rect(x - 1, y - 5, 3, 2, col); put(x - 1, y - 6, col); put(x + 1, y - 6, col); // body, head, ears
    const sw = Math.sin(c.ph * 1.5); put(x - 2 * f, y - 1, col); put(x - 3 * f, y - 1 - (sw > 0 ? 1 : 0), col);
    if (n) { put(x - 1 + (f > 0 ? 1 : 0), y - 5, FWG); put(x + (f > 0 ? 1 : 0), y - 5, FWG); }
  } else {
    const st = Math.sin(c.ph * 10) > 0 ? 1 : 0;
    rect(x - 2, y - 3, 5, 2, col); rect(x + 2 * f, y - 5, 2, 2, col); put(x + 2 * f, y - 6, col);
    put(x - 2 + st, y - 1, col); put(x + 2 - st, y - 1, col); put(x - 3 * f, y - 4, col); put(x - 4 * f, y - 5, col);
    if (n) put(x + 3 * f, y - 5, FWG);
  }
}

// ---------- birds on wires ----------
/** `land`: flying in from off screen to its spot `x` on the wire (fx, fy is where it is now). */
interface Bird { wire: Wire; x: number; on: boolean; fly: boolean; land: boolean; vx: number; vy: number; fx: number; fy: number; t: number; ph: number }
let birds: Bird[] = [];
function initBirds() {
  birds = [];
  for (const w of cfg.wires ?? []) {
    let x = w.x0 + 10 + r() * 30;
    while (x < w.x1 - 10) {
      if (r() < 0.45) { const n = 1 + ((r() * 3) | 0); for (let k = 0; k < n; k++) birds.push({ wire: w, x: x + k * 3, on: true, fly: false, land: false, vx: 0, vy: 0, fx: 0, fy: 0, t: 0, ph: r() * 6 }); }
      x += 25 + r() * 40;
    }
  }
}
let scareCd = 0;
function updateBirds(dt: number) {
  scareCd -= dt;
  // S.birds (time of day only) peaks around 17h: birds hop off and fly back in to the wires far more often
  const bx = bigVehicleNear(), night = S.dayK < 0.2, act = S.birds;
  for (const b of birds) {
    b.ph += dt;
    if (b.on && !b.fly && ((bx !== null && Math.abs(bx - b.x) < 30 && scareCd <= 0) || r() < dt * (0.004 + 0.012 * act))) {
      b.fly = true; b.fx = b.x; b.fy = b.wire.y(b.x); b.vx = (r() < 0.5 ? -1 : 1) * (25 + r() * 25); b.vy = -18 - r() * 18;
    }
    if (b.fly && b.land) {
      const dx = b.x - b.fx, dy = b.wire.y(b.x) - b.fy, d = Math.hypot(dx, dy), step = 34 * dt;
      if (d <= step) { b.fly = false; b.land = false; b.on = true; } else { b.fx += (dx / d) * step; b.fy += (dy / d) * step; }
    } else if (b.fly) {
      b.fx += b.vx * dt; b.fy += b.vy * dt; b.vy += 4 * dt;
      if (b.fx < G.camX - 20 || b.fx > G.camX + G.W + 20 || b.fy < -G.oy - 20) { b.fly = false; b.on = false; b.t = (8 + r() * 25) * (1 - 0.8 * act); }
    } else if (!b.on) {
      b.t -= dt;
      if (b.t <= 0 && !night) { // glide in from off screen, above, to a free spot on its wire
        b.x = b.wire.x0 + 8 + r() * (b.wire.x1 - b.wire.x0 - 16);
        b.fly = true; b.land = true; b.fx = b.x + (r() < 0.5 ? -1 : 1) * (90 + r() * 80); b.fy = b.wire.y(b.x) - 40 - r() * 40;
      }
    }
  }
  if (bx !== null && birds.some((b) => b.fly)) scareCd = 4;
}
function drawBirds() {
  for (const b of birds) {
    if (b.fly) { const up = Math.sin(b.ph * 22) > 0; put(b.fx, b.fy, BNEAR); put(b.fx - 1, b.fy - (up ? 1 : 0), BNEAR); put(b.fx + 1, b.fy - (up ? 1 : 0), BNEAR); continue; }
    if (!b.on) continue;
    const y = Math.round(b.wire.y(b.x)), bob = Math.sin(b.ph * 0.7) > 0.95 ? 1 : 0;
    put(b.x, y - 1 - bob, STEEL); put(b.x + 1, y - 1, STEEL); put(b.x, y - 2 - bob, STONE); put(b.x - 1, y - 1, BNEAR);
  }
}

// ---------- sky: urubus, dusk flocks, bats ----------
const urubus = Array.from({ length: 3 }, (_, i) => ({ cx: 80 + i * 150 + r() * 60, cy: -10 + r() * 50, rx: 30 + r() * 30, ry: 8 + r() * 6, a: r() * 6, sp: 0.15 + r() * 0.1 }));
let flock: { x: number; y: number; dir: number; n: number; white: boolean } | null = null, flockT = 20;
const bats = Array.from({ length: 4 }, () => ({ a: r() * 6, s: 0.8 + r(), k: r() }));

function drawSkyAnimals(dt: number) {
  const day = S.sunElev > 12 && S.cloud < 0.75 && S.rain < 0.1;
  if (day) for (const u of urubus) {
    u.a += dt * u.sp;
    const x = u.cx + Math.cos(u.a) * u.rx, y = u.cy + Math.sin(u.a) * u.ry, tilt = Math.cos(u.a) > 0 ? 1 : 0;
    for (let i = -4; i <= 4; i++) put(x + i, y + Math.abs(i) * -0.35 + (i * (tilt ? 0.15 : -0.15)), VOID);
    put(x, y + 1, VOID);
  }
  // dusk flock (garças home to roost, or dark birds)
  flockT -= dt;
  // flocks follow the clock (S.birds): a few at dawn, many around 17h as birds head back to the trees
  if (!flock && flockT <= 0 && S.birds > 0.3) { const dir = r() < 0.5 ? 1 : -1; flock = { x: dir > 0 ? G.camX - 40 : G.camX + G.W + 40, y: -20 + r() * 50, dir, n: 6 + ((r() * 7) | 0), white: r() < 0.5 }; flockT = (60 + r() * 120) * (1 - 0.7 * S.birds); }
  if (flock) {
    flock.x += flock.dir * 22 * dt; flock.y -= dt * 1.5;
    const t = S.ms / 1000;
    for (let k = 0; k < flock.n; k++) {
      const row = (k + 1) >> 1, side = k % 2 ? 1 : -1, bx = flock.x - flock.dir * row * 6, by = flock.y + row * 3 * side * 0.6 + row * 2;
      const up = Math.sin(t * 9 + k) > 0;
      const c = flock.white ? TILEW : VOID;
      put(bx, by, c); put(bx - 1, by - (up ? 1 : 0), c); put(bx + 1, by - (up ? 1 : 0), c);
    }
    if (flock.x < G.camX - 120 || flock.x > G.camX + G.W + 120) flock = null;
  }
}

function drawBats(dt: number) {
  if (S.dayK > 0.15 || !cfg.lamps?.length || S.rain > 0.2) return;
  bats.forEach((b, i) => {
    b.a += dt * b.s * 2.2;
    const L = cfg.lamps![i % cfg.lamps!.length];
    const x = L.x + Math.sin(b.a) * 14 + Math.sin(b.a * 2.7 + b.k * 9) * 5, y = L.y + 6 + Math.cos(b.a * 1.3) * 6;
    const up = Math.sin(b.a * 18) > 0;
    put(x, y, VOID); put(x - 1, y - (up ? 1 : 0), VOID); put(x + 1, y - (up ? 1 : 0), VOID);
  });
}

// ---------- calangos on the rock ----------
const lizards = Array.from({ length: 2 }, () => ({ x: 0, y: 0, dir: 1, t: 0, run: 0, on: false }));
function drawLizards(dt: number) {
  if (!cfg.rock?.length) return;
  const warm = S.sunElev > 15 && S.rain < 0.05;
  for (const l of lizards) {
    if (!l.on) { if (warm && r() < dt * 0.05) { l.on = true; l.dir = r() < 0.5 ? 1 : -1; l.x = G.camX + r() * G.W; l.y = pick(cfg.rock); l.t = 2; l.run = 0; } continue; }
    l.t -= dt;
    if (l.t <= 0) { l.run = l.run > 0 ? 0 : 0.4 + r() * 0.6; l.t = l.run > 0 ? l.run : 1 + r() * 4; if (r() < 0.3) l.dir = -l.dir; }
    if (l.run > 0) l.x += l.dir * 70 * dt;
    if (!warm || l.x < G.camX - 10 || l.x > G.camX + G.W + 10) { l.on = false; continue; }
    const x = Math.round(l.x), y = l.y, f = l.dir;
    rect(x - 2, y - 1, 5, 1, LEAFG); put(x + 3 * f, y - 1, CYELL); put(x - 3 * f, y, BARK); put(x - 4 * f, y, BARK);
    put(x - 1, y, LEAFG); put(x + 1, y, LEAFG);
  }
}

// ---------- taps ----------
/** Something was tapped at world (x, y): birds fly off, cats bolt, dogs bark and run. Returns what reacted. */
export function tapAnimals(x: number, y: number): { kind: 'bird' | 'cat' | 'dog'; x: number; y: number } | null {
  for (const b of birds) {
    if (!b.on || b.fly) continue;
    const by = b.wire.y(b.x);
    if (Math.abs(x - b.x) < 6 && y > by - 7 && y < by + 3) {
      for (const o of birds) if (o.on && !o.fly && o.wire === b.wire && Math.abs(o.x - b.x) < 16) {
        o.fly = true; o.fx = o.x; o.fy = o.wire.y(o.x); o.vx = (o.x < x ? -1 : 1) * (30 + r() * 25); o.vy = -22 - r() * 16;
      }
      return { kind: 'bird', x: b.x, y: by - 2 };
    }
  }
  for (const c of cats) if (Math.abs(x - c.x) < 6 && y > c.y - 10 && y < c.y + 2) {
    c.st = 'walk'; c.t = 1.6; c.boost = 1.6; c.dir = x < c.x ? 1 : -1;
    return { kind: 'cat', x: c.x, y: c.y - 6 };
  }
  for (const d of dogs) if (d.on && Math.abs(x - d.x) < 8 && y > d.y - 10 && y < d.y + 2) {
    d.st = 'walk'; d.t = 3; d.boost = 2.5; d.dir = x < d.x ? 1 : -1;
    return { kind: 'dog', x: d.x, y: d.y - 7 };
  }
  return null;
}

// ---------- API ----------
export function setupAnimals(setup: AnimalSetup) {
  cfg = setup;
  for (const d of dogs) d.on = false;
  dogT = 1 + r() * 4;
  initCats(); initBirds();
  for (const l of lizards) l.on = false;
}
export function updateAnimals(dt: number) { updateDogs(dt); updateCats(dt); updateBirds(dt); }
let lastSky = 0;
/** Sky creatures: call right after the sky (behind buildings). */
export function drawAnimalsSky() { const now = S.ms / 1000, dt = Math.min(0.1, Math.max(0, now - lastSky)); lastSky = now; drawSkyAnimals(dt); }
/** Cats on walls, birds on wires and bats: call after the front layer. */
export function drawAnimalsPerched() { for (const c of cats) drawCat(c); drawBirds(); drawBats(1 / 60); }
/** Dogs and lizards on the ground: call with the pedestrians. */
export function drawAnimalsGround() { for (const d of dogs) if (d.on) drawDog(d); drawLizards(1 / 60); }
export const animalsDebug = () => `dogs ${dogs.filter((d) => d.on).map((d) => d.st).join(',') || '-'}  cats ${cats.length}  birds ${birds.filter((b) => b.on && !b.fly).length}/${birds.length} fly ${birds.filter((b) => b.fly).length}`;
