/* Rare, calm ambient life events drawn on top of a scene's regular crowd: the schedule and every rule
   (which scenes, which hours, real-weather gating, one at a time) live in ambient-rules.ts; this file
   only stages them. Everything except the stray dog is a pure function of the clock (event start/end
   and S.ms), so a pinned #at= moment always shows the same frame and nothing pops in mid-street: each
   actor walks in from a world edge and leaves by the other. If the real weather turns while a
   fair-weather event is on (rain arrives), its actors simply hurry off the nearest way. */
import { G, WW, put, rect } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  BARK, CBEIGE, CBLUE, CGREEN, CNAVY, CORNG, CRED, CYELL, FWG, HAIR1, HAIR2, HAIR3, LIGHT, SKIN1, SKIN2, SKIN3,
  SKIN4, STEEL, STONEL, VOID, WHITE, WOOD,
} from '../engine/palette';
import { S } from '../sky/state';
import { audio } from '../audio/audio';
import { radio } from '../audio/radio';
import { type AmbientEvent, ambientAt, cueAllowed, nextPlanned } from './ambient-rules';
import { walkerToFollow } from './people';

/** Where things happen in a scene (world coordinates; y values are feet / wheel bottoms). */
export interface AmbientSpot {
  /** Sidewalk row for the vendor, the kid and a dog walking alone. */
  walk: number;
  /** Where the vendor stops. */
  stop: number;
  /** Where the kid plays with the ball. */
  kid?: number;
  /** Where someone stands feeding pigeons (on a pavement or plaza row). */
  feed?: { x: number; y: number };
  /** A wall or parapet top the cat walks along. */
  wall?: { x0: number; x1: number; y: number };
  /** Road row along the curb (outside the car lanes) where the delivery moto rides and parks, and
      the shop door it delivers to. */
  curb?: number;
  shop?: number;
}

let sceneId = '';
let spot: AmbientSpot | null = null;
let cur: AmbientEvent | null = null;
/** Set when the real weather cancelled the running event: its actors leave from where they were. */
let abort: { at: number; x: number; dir: number; landed: boolean } | null = null;
let cuedSeed = -1, doneSeed = -1;
/** True until the first update after setupAmbient(): the scene was just shown. */
let fresh = false;

interface Dog { x: number; y: number; dir: number; ph: number; c: number; sniff: number; next: number; leave: boolean; track: Track | null; lastX: number; rnd: () => number }
type Track = () => { x: number; y: number; dir: number } | null;
let dog: Dog | null = null;

/** Called from a scene's build(): the events for this scene and where they take place. */
export function setupAmbient(id: string, s: AmbientSpot) { sceneId = id; spot = s; cur = null; abort = null; dog = null; doneSeed = -1; fresh = true; }

const wx = () => ({ kind: S.wxKind, rain: S.rain, snow: S.snow });
const OUT = 14; // how far beyond the world edge actors start and end
const seedU = (seed: number, k: number) => mulberry32(seed + k * 7919)();

// ---------- walk in, stay, walk out (time-based) ----------
interface Pose { x: number; dir: number; moving: boolean; k: number; ph: number }

function walkPose(ev: AmbientEvent, now: number, stopX: number, speed: number, enterDir?: number): Pose {
  const dir = enterDir ?? (seedU(ev.seed, 1) < 0.5 ? 1 : -1), dur = (ev.end - ev.start) / 1000;
  const x0 = dir > 0 ? -OUT : WW + OUT, x1 = dir > 0 ? WW + OUT : -OUT;
  const sp = Math.max(speed, (WW + 2 * OUT) / (dur * 0.65));
  const tIn = Math.abs(stopX - x0) / sp, tOut = Math.abs(x1 - stopX) / sp, stay = dur - tIn - tOut;
  if (abort && now >= abort.at) {
    const t = (now - abort.at) / 1000;
    return { x: abort.x + abort.dir * sp * 2 * t, dir: abort.dir, moving: true, k: -1, ph: t * sp * 0.84 };
  }
  const t = (now - ev.start) / 1000;
  if (t < tIn) return { x: x0 + dir * sp * t, dir, moving: true, k: -1, ph: t * sp * 0.42 };
  if (t < tIn + stay) return { x: stopX, dir, moving: false, k: (t - tIn) / stay, ph: 0 };
  return { x: stopX + dir * sp * (t - tIn - stay), dir, moving: true, k: -1, ph: (t - tIn - stay) * sp * 0.42 };
}

const offWorld = (x: number) => x < -OUT - 2 || x > WW + OUT + 2;

// ---------- update ----------
export function updateAmbient(dt: number) {
  if (!spot || !sceneId) return;
  const now = S.ms, ev = ambientAt(sceneId, now, wx());
  if (cur?.kind === 'dog-follow') updateDog(dt, now);
  if (cur && finished(cur, now)) { doneSeed = cur.seed; cur = null; abort = null; dog = null; }
  // An event joins only at its start, or when the scene is first shown mid-event (like the prewarmed
  // crowd). One cancelled by the weather, or found already under way later (the reading turned dry
  // again mid-slot), is skipped rather than popping its actors into the middle of the street.
  if (!cur && ev && ev.seed !== doneSeed) {
    if (fresh || now - ev.start < 3000) begin(ev); else doneSeed = ev.seed;
  }
  else if (cur && !ev && !abort && now < cur.end && cur.kind !== 'dog-follow') abort = abortFrom(cur, now);
  // a quiet vendor's bell once, when the cart stops on screen (ambience on, audio unlocked, no radio)
  if (cur?.kind === 'vendor' && cur.seed !== cuedSeed && !abort) {
    const p = walkPose(cur, now, spot.stop, 8);
    if (!p.moving && p.x > G.camX && p.x < G.camX + G.W) {
      cuedSeed = cur.seed;
      if (cueAllowed({ soundOn: audio.isOn(), unlocked: audio.ready(), radioOn: radio.isOn() })) audio.vendorCue(cur.vendor ?? 'picole');
    }
  }
  fresh = false;
}

function begin(ev: AmbientEvent) {
  cur = ev; abort = null; dog = null;
  if (ev.kind === 'dog-follow') startDog(ev);
}

function finished(ev: AmbientEvent, now: number): boolean {
  if (ev.kind === 'dog-follow') return dog === null;
  if (abort) return offWorld(mainX(ev, now)) || (ev.kind === 'cat-wall' && !onWall(mainX(ev, now)));
  return now >= ev.end;
}

/** Where the event's main actor stands now (for leaving early). */
function mainX(ev: AmbientEvent, now: number): number {
  const s = spot!;
  if (ev.kind === 'cat-wall') return catPose(ev, now).x;
  if (ev.kind === 'vendor') return walkPose(ev, now, s.stop, 8).x;
  if (ev.kind === 'kid-ball') return walkPose(ev, now, s.kid ?? s.stop, 14).x;
  if (ev.kind === 'pigeons') return walkPose(ev, now, s.feed?.x ?? s.stop, 7).x;
  return motoPose(ev, now).x;
}

function abortFrom(ev: AmbientEvent, now: number) {
  const x = mainX(ev, now);
  if (ev.kind === 'cat-wall') { const w = spot!.wall!; return { at: now, x, dir: x - w.x0 < w.x1 - x ? -1 : 1, landed: false }; }
  // pigeons only fly off if they had come down (the feeder had stopped)
  const landed = ev.kind === 'pigeons' && walkPose(ev, now, spot!.feed?.x ?? spot!.stop, 7).k > 0.08;
  return { at: now, x, dir: x < WW / 2 ? -1 : 1, landed };
}

// ---------- people (a small, plain figure in the same style as people.ts) ----------
const STRIDE = [2, 1, 0, 1];
function figure(x: number, yF: number, H: number, dir: number, ph: number, moving: boolean, shirt: number, pants: number, skin: number, hair: number, hat = 255) {
  const X = Math.round(x), s = moving ? STRIDE[(ph | 0) & 3] : 0, kid = H <= 11, legL = kid ? 4 : Math.round(H * 0.37);
  const yLeg = yF - legL + 1, yHead = yF - H + 1, yT = yHead + 4;
  for (let r = 0; r < legL; r++) {
    const off = Math.round(s * (legL > 1 ? r / (legL - 1) : 0)), c = r === legL - 1 ? VOID : pants;
    if (s === 0) { put(X - 1, yLeg + r, c); put(X, yLeg + r, c); } else { put(X - off, yLeg + r, c); put(X + off, yLeg + r, c); }
  }
  rect(X - 1, yT, kid ? 2 : 3, yLeg - yT, shirt);
  rect(X - 1, yHead + 1, 3, 3, skin); rect(X - 1, yHead, 3, 1, hair); put(X - dir, yHead + 1, hair);
  if (hat !== 255) { rect(X - 1, yHead - 1, 3, 1, hat); put(X + dir * 2, yHead, hat); rect(X - 1, yHead, 3, 1, hat); }
  return { hx: X + dir * 2, hy: yT + 2 }; // hand
}
const SKINS = [SKIN1, SKIN2, SKIN3, SKIN4], HAIRS = [HAIR1, HAIR2, HAIR3], SHIRTS = [CRED, CBLUE, CGREEN, CYELL, WHITE, CORNG];
const pickOf = <T>(a: readonly T[], seed: number, k: number) => a[Math.floor(seedU(seed, k) * a.length)];

// ---------- the vendor ----------
function drawVendor(ev: AmbientEvent, now: number) {
  const s = spot!, p = walkPose(ev, now, s.stop, 8), y = s.walk, f = p.dir, kind = ev.vendor ?? 'picole';
  // the cart spans cx-4 .. cx+7, centred 10 px ahead of the vendor
  const cx = Math.round(p.x + f * 10 - 2), near = f > 0 ? cx - 4 : cx + 7, night = S.dayK < 0.45, t = now / 1000;
  // cart, pushed ahead
  rect(cx - 2, y - 2, 2, 2, VOID); rect(cx + 4, y - 2, 2, 2, VOID); // wheels
  if (kind === 'picole') { // styrofoam box with the brand band and a little parasol
    rect(cx - 4, y - 8, 12, 6, WHITE); rect(cx - 4, y - 6, 12, 1, CBLUE); rect(cx - 4, y - 8, 12, 1, CBLUE);
    rect(cx + 1, y - 17, 1, 9, STEEL);
    for (let i = -5; i <= 5; i++) put(cx + 1 + i, y - 18 + Math.round((i * i) / 12), (i + 5) % 4 < 2 ? CYELL : CRED);
  } else if (kind === 'pipoca') { // red cart with a glass box of popcorn and a lamp at dusk
    rect(cx - 4, y - 8, 12, 6, CRED); rect(cx - 3, y - 14, 10, 6, WHITE); rect(cx - 2, y - 12, 8, 3, CYELL);
    rect(cx - 4, y - 15, 12, 1, CRED); rect(cx + 1, y - 17, 2, 2, CRED);
    if (night) { put(cx + 2, y - 13, LIGHT); put(cx + 3, y - 13, LIGHT); }
    if (!p.moving) for (let k = 0; k < 3; k++) { const a = (t * 0.5 + k / 3) % 1; if (bay(k, (a * 8) | 0) < 1 - a) put(cx + k * 2, y - 18 - a * 6, STONEL); }
  } else { // água de coco: green coconuts on a wooden cart
    rect(cx - 4, y - 5, 12, 3, WOOD);
    for (let i = 0; i < 5; i++) { put(cx - 3 + i * 2, y - 6, CGREEN); put(cx - 2 + i * 2, y - 7, i < 4 ? CGREEN : 255); }
    put(cx, y - 8, CGREEN); put(cx + 3, y - 8, CGREEN);
    rect(cx - 5, y - 4, 1, 4, WOOD);
  }
  const h = figure(p.x, y, 15, f, p.ph, p.moving, pickOf([WHITE, CYELL, CBLUE], ev.seed, 2), CNAVY, pickOf(SKINS, ev.seed, 3), HAIR1, kind === 'coco' ? CBEIGE : 255);
  rect(Math.min(h.hx, near), h.hy, Math.abs(near - h.hx) + 1, 1, STEEL); // handle
  // ringing the little bell while stopped
  if (!p.moving && kind !== 'pipoca' && Math.sin(t * 9) > 0.2 && p.k < 0.4) { put(p.x - f, y - 15, STEEL); put(p.x - f, y - 16, CYELL); }
}

// ---------- kid with a ball ----------
function drawKid(ev: AmbientEvent, now: number) {
  const s = spot!, p = walkPose(ev, now, s.kid ?? s.stop, 14), y = s.walk, t = now / 1000;
  let bx: number, by: number, f = p.dir, kx = p.x;
  if (p.moving) { // dribbling along
    bx = p.x + f * 4; by = y - 1 - Math.abs(Math.sin(t * 6)) * 1.5;
  } else { // kicking it against the wall and taking it back, shifting a step now and then
    const cyc = 1.8, q = (t % cyc) / cyc, side = Math.floor(t / cyc) % 2 ? 1 : -1, reach = 12 + (Math.floor(t / cyc) % 3) * 3;
    kx = p.x + side * 2; f = side;
    const out = q < 0.5 ? q * 2 : 2 - q * 2;
    bx = kx + f * (3 + reach * out); by = y - 1 - Math.sin(out * Math.PI) * 3;
  }
  figure(kx, y, 10, f, p.moving ? p.ph * 1.5 : t * 3, p.moving || Math.floor(t * 2) % 2 === 0, pickOf(SHIRTS, ev.seed, 2), CBLUE, pickOf(SKINS, ev.seed, 3), pickOf(HAIRS, ev.seed, 4));
  rect(Math.round(bx), Math.round(by) - 1, 2, 2, WHITE); put(Math.round(bx), Math.round(by) - 1, VOID);
}

// ---------- someone feeding pigeons ----------
function drawPigeons(ev: AmbientEvent, now: number) {
  const s = spot!, feed = s.feed ?? { x: s.stop, y: s.walk }, p = walkPose(ev, now, feed.x, 7), t = now / 1000;
  const f = p.moving ? p.dir : -p.dir; // turns to face the birds
  const h = figure(p.x, feed.y, 14, f, p.ph, p.moving, pickOf([CBEIGE, WHITE, CBLUE], ev.seed, 2), pickOf([CNAVY, BARK], ev.seed, 5), pickOf(SKINS, ev.seed, 3), HAIR3, CBEIGE);
  if (!p.moving && p.k > 0.05 && p.k < 0.9) { // tossing crumbs
    const a = (t * 0.7) % 1;
    if (a < 0.5) for (let k = 0; k < 3; k++) put(h.hx + f * (2 + a * 14 + k * 2), h.hy + a * a * 18 + k, STONEL);
  }
  // pigeons: drop in once the crumbs start, peck around, fly off before the feeder leaves (or at the first rain)
  if (abort ? !abort.landed : p.moving) return;
  const base = abort ? abort.x : p.x, side = abort ? -abort.dir : f; // birds take off from where the crumbs fell
  for (let i = 0; i < 6; i++) {
    const ox = side * (6 + seedU(ev.seed, 10 + i) * 18), gx = base + ox, gy = feed.y + (i % 3) - 1;
    let fly = 0; // 0 = on the ground, 1 = high up and away
    if (abort) fly = Math.min(1, (now - abort.at) / 2500 + i * 0.05);
    else {
      const stay = p.k, tIn = 0.08 + i * 0.03, tOut = 0.92 - i * 0.01;
      fly = stay < tIn ? 1 - stay / tIn : stay > tOut ? (stay - tOut) / (1 - tOut) : 0;
    }
    const x = Math.round(gx + fly * 50 * (i % 2 ? 1 : -1)), y = Math.round(gy - fly * 60), peck = !fly && Math.sin(t * 5 + i * 1.7) > 0.6 ? 1 : 0;
    if (fly > 0.98) continue;
    const pf = (i % 2 ? 1 : -1);
    rect(x - 1, y - 2, 3, 2, STEEL); put(x + 2 * pf, y - 3 + peck * 2, STEEL); put(x + 2 * pf, y - 2 + peck * 2, CNAVY);
    if (fly > 0) { const w = Math.sin(t * 30 + i) > 0 ? -1 : 1; put(x - 1, y - 2 + w, STEEL); put(x + 1, y - 2 + w, STEEL); }
    else { put(x, y, CORNG); }
  }
}

// ---------- cat on a wall ----------
const onWall = (x: number) => !!spot?.wall && x >= spot.wall.x0 - 1 && x <= spot.wall.x1 + 1;
function catPose(ev: AmbientEvent, now: number): Pose {
  const w = spot!.wall!, dir = seedU(ev.seed, 1) < 0.5 ? 1 : -1, dur = (ev.end - ev.start) / 1000, pause = Math.min(10, dur * 0.3);
  const len = w.x1 - w.x0, sp = len / (dur - pause), x0 = dir > 0 ? w.x0 : w.x1;
  if (abort && now >= abort.at) { const t = (now - abort.at) / 1000; return { x: abort.x + abort.dir * 18 * t, dir: abort.dir, moving: true, k: -1, ph: t * 3 }; }
  const t = (now - ev.start) / 1000, half = (dur - pause) / 2;
  if (t < half) return { x: x0 + dir * sp * t, dir, moving: true, k: -1, ph: t };
  if (t < half + pause) return { x: x0 + dir * sp * half, dir, moving: false, k: (t - half) / pause, ph: t };
  return { x: x0 + dir * sp * (t - pause), dir, moving: true, k: -1, ph: t };
}
function drawCat(ev: AmbientEvent, now: number) {
  if (!spot!.wall) return;
  const p = catPose(ev, now);
  if (!onWall(p.x)) return;
  const x = Math.round(p.x), y = spot!.wall!.y - 1, f = p.dir, c = pickOf([VOID, CORNG, CBEIGE, WHITE], ev.seed, 2), n = S.dayK < 0.4;
  if (!p.moving) { // sits and looks around for a moment
    const look = p.k > 0.4 && p.k < 0.7 ? -f : f;
    rect(x - 1, y - 3, 3, 3, c); rect(x - 1, y - 5, 3, 2, c); put(x - 1, y - 6, c); put(x + 1, y - 6, c);
    put(x - 2 * f, y - 1, c); put(x - 3 * f, y - 1 - (Math.sin(p.ph * 1.5) > 0 ? 1 : 0), c);
    if (n) put(x + (look > 0 ? 1 : -1), y - 5, FWG);
    return;
  }
  const st = Math.sin(p.ph * 10) > 0 ? 1 : 0;
  rect(x - 2, y - 3, 5, 2, c); rect(x + 2 * f, y - 5, 2, 2, c); put(x + 2 * f, y - 6, c);
  put(x - 2 + st, y - 1, c); put(x + 2 - st, y - 1, c); put(x - 3 * f, y - 4, c); put(x - 4 * f, y - 5, c);
  if (n) put(x + 3 * f, y - 5, FWG);
}

// ---------- delivery moto pulling over at a shop ----------
function motoPose(ev: AmbientEvent, now: number) {
  const s = spot!, stop = s.shop ?? s.stop, dir = seedU(ev.seed, 1) < 0.5 ? 1 : -1, dur = (ev.end - ev.start) / 1000;
  const x0 = dir > 0 ? -OUT - 10 : WW + OUT + 10, x1 = dir > 0 ? WW + OUT + 10 : -OUT - 10;
  const tIn = Math.abs(stop - x0) / 32, tOut = Math.abs(x1 - stop) / 32, stay = dur - tIn - tOut;
  const t = (now - ev.start) / 1000;
  if (t < tIn) { const q = t / tIn; return { x: x0 + (stop - x0) * (1 - (1 - q) * (1 - q)), dir, k: -1, moving: true }; }
  if (t < tIn + stay) return { x: stop, dir, k: (t - tIn) / stay, moving: false };
  const q = (t - tIn - stay) / tOut;
  return { x: stop + (x1 - stop) * q * q, dir, k: -1, moving: true };
}
function drawMoto(ev: AmbientEvent, now: number) {
  const s = spot!;
  if (s.curb === undefined) return;
  const m = motoPose(ev, now), x = Math.round(m.x), y = s.curb, f = m.dir, t = now / 1000, body = pickOf([CRED, CBLUE, VOID], ev.seed, 2);
  // the delivery box rides on the back, and comes off for the drop-off
  const delivering = !m.moving && m.k > 0.15 && m.k < 0.85;
  rect(x - 4, y - 3, 3, 3, VOID); rect(x + 3, y - 3, 3, 3, VOID); // wheels
  rect(x - 3, y - 5, 8, 2, body); put(x + 4 * f + 1, y - 7, STEEL); put(x + 4 * f + 1, y - 6, STEEL);
  if (S.dayK < 0.45) put(x + 5 * f + 1, y - 5, LIGHT);
  if (!delivering) rect(x - 4 * f - (f > 0 ? 1 : 0), y - 10, 4, 4, CRED);
  if (m.moving || !delivering) { // rider on the seat, helmet on
    rect(x - 1, y - 9, 3, 4, CNAVY); rect(x - 1, y - 12, 3, 3, pickOf([WHITE, CYELL, VOID], ev.seed, 3));
    if (!m.moving && Math.sin(t * 3) > 0.7) put(x - 5 * f, y - 4, STONEL); // idle puff
    return;
  }
  // on foot: down to the shop door with the box and back again
  const k = (m.k - 0.15) / 0.7, door = s.walk, leg = k < 0.4 ? k / 0.4 : k > 0.6 ? (1 - k) / 0.4 : 1;
  const rx = x + (f > 0 ? -6 : 6) * (1 - leg) + f * 2 * leg, ry = Math.round(y + (door - y) * leg);
  const walking = k < 0.4 || k > 0.6;
  figure(rx, ry, 15, k < 0.5 ? f : -f, t * 5, walking, CRED, CNAVY, SKIN2, HAIR1, VOID);
  if (k < 0.5) rect(rx + (k < 0.5 ? f : -f) * 2 - 1, ry - 9, 4, 4, CRED);
}

// ---------- the stray dog that tags along ----------
function startDog(ev: AmbientEvent) {
  const s = spot!, rnd = mulberry32(ev.seed), track = walkerToFollow(G.camX + 20, G.camX + G.W - 20);
  const c = [WOOD, CBEIGE, BARK, VOID][Math.floor(rnd() * 4)];
  if (track) {
    const w = track()!;
    dog = { x: w.dir > 0 ? Math.max(-OUT, G.camX - 12) : Math.min(WW + OUT, G.camX + G.W + 12), y: w.y, dir: w.dir, ph: 0, c, sniff: 0, next: 4 + rnd() * 6, leave: false, track, lastX: w.x, rnd };
  } else { // nobody to follow (late at night): it just trots along the pavement
    const dir = rnd() < 0.5 ? 1 : -1;
    dog = { x: dir > 0 ? -OUT : WW + OUT, y: s.walk, dir, ph: 0, c, sniff: 0, next: 5 + rnd() * 6, leave: true, track: null, lastX: 0, rnd };
  }
}
function updateDog(dt: number, now: number) {
  const d = dog;
  if (!d) return;
  d.ph += dt;
  if (d.sniff > 0) { d.sniff -= dt; return; }
  if ((d.next -= dt) <= 0) { d.sniff = 1 + d.rnd() * 1.5; d.next = 6 + d.rnd() * 8; return; }
  const w = d.track && !d.leave ? d.track() : null;
  if (d.track && !d.leave && (!w || Math.abs(w.x - d.lastX) > 20 || now >= cur!.end)) { d.leave = true; } // lost them, or time to go
  if (w && !d.leave) {
    d.lastX = w.x;
    const want = w.x - w.dir * 9, gap = want - d.x;
    d.dir = Math.abs(gap) > 1.5 ? Math.sign(gap) : w.dir;
    d.x += Math.sign(gap) * Math.min(Math.abs(gap), (Math.abs(gap) > 12 ? 26 : 12) * dt);
  } else d.x += d.dir * 16 * dt;
  if (offWorld(d.x) || (d.leave && (d.x < G.camX - 30 || d.x > G.camX + G.W + 30) && d.x * d.dir > (G.camX + G.W / 2) * d.dir)) dog = null;
}
function drawDog() {
  const d = dog;
  if (!d) return;
  const x = Math.round(d.x), y = d.y, f = d.dir, c = d.c, sniff = d.sniff > 0, step = sniff ? 0 : Math.sin(d.ph * 12);
  const by = y - 5;
  rect(x - 3, by, 7, 3, c);
  for (const [lx, ph] of [[-3, 1], [-2, -1], [2, 1], [3, -1]]) { put(x + lx * f + Math.round(step * ph * 0.6), y - 2, c); put(x + lx * f, y - 1, c); }
  const hy = sniff ? by + 2 : by - 2, hx = x + 4 * f;
  rect(hx - (f > 0 ? 0 : 1), hy, 2, 2, c); put(hx + 2 * f, hy + 1, c === VOID ? STONEL : VOID); put(hx - f, hy - 1, c);
  const wag = Math.sin(d.ph * 14) > 0 ? 1 : 0;
  put(x - 4 * f, by - 1 + wag, c); put(x - 5 * f, by - 2 + wag, c);
}

// ---------- drawing hooks ----------
/** Sidewalk, plaza and wall-top events; call right after drawPeople(). */
export function drawAmbient() {
  if (!spot || !cur) return;
  const now = S.ms;
  switch (cur.kind) {
    case 'vendor': drawVendor(cur, now); break;
    case 'kid-ball': drawKid(cur, now); break;
    case 'pigeons': drawPigeons(cur, now); break;
    case 'cat-wall': drawCat(cur, now); break;
    case 'dog-follow': drawDog(); break;
    default: break;
  }
}
/** Road events (the delivery moto); call after drawStreet() and before drawCars(). */
export function drawAmbientRoad() {
  if (spot && cur?.kind === 'moto-delivery') drawMoto(cur, S.ms);
}

/** Debug panel line: the running event (and its progress) and the next one planned. */
export function ambientDebug(id: string): string {
  if (id !== sceneId || !spot) return '-';
  const now = S.ms, hm = (ms: number) => { const d = new Date(ms + S.city.utc * 3_600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  const name = (e: AmbientEvent) => (e.kind === 'vendor' ? `vendor/${e.vendor}` : e.kind);
  const run = cur ? `${name(cur)} ${hm(cur.start)}-${hm(cur.end)}${abort ? ' (saindo: clima)' : ''}` : 'none';
  const nx = nextPlanned(id, Math.max(now, cur?.end ?? now));
  return `${run}  next ${nx ? `${name(nx)} ${hm(nx.start)}` : '-'}`;
}
