/* Rare geek-culture easter eggs in Esperança's scenes: the schedule, the conditions and the spots live
   in egg-rules.ts; this file only draws them and answers taps. Hooked once from main.ts (update, draw
   after the scene, tap, hover), so no scene file carries egg code and other cities never see them.
   Everything is a pure function of the clock (egg start/end and S.ms), so a pinned #at= always shows
   the same frame. Sky eggs paint only over sky and cloud pixels, so buildings stay in front of them.
   Nothing here reads or writes the weather beyond passing the real state to egg-rules.ts. */
import { G, M, put, spr, getW } from '../engine/gfx';
import { bay } from '../engine/math';
import {
  AMB, CBEIGE, CBLUE, CLOUD, CLOUDD, CNAVY, CORNG, CRED, CYAN, CYELL, FPINK, GOLD, LEAFG, LEAFGD, LEDW, LIGHT,
  SIGR, SKYIDX, STEEL, STONEL, VOID, WCOOL, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { S } from '../sky/state';
import {
  EGG_DUR, EGG_SPOTS, type Egg, type EggCond, type EggId, type EggSpot, KONAMI_ID, eggAt, eggLine, konamiEgg,
  nextEgg, parseEggParam,
} from './egg-rules';

let sceneId = '';
let cur: Egg | null = null;
/** #egg= test override (labelled in the HUD), read once from the hash by main.ts. */
let forceParam: EggId | 'konami' | null = null;
/** Anchor of the #egg= loop in this scene (reset on every scene change). */
let forceAnchor = -1;
/** What the #egg=konami override resolved to in this scene. */
let forceKonami: EggId | null = null;
/** The Konami code's unlock: one play of a fitting egg, then back to the schedule. */
let konami: { scene: string; id: EggId; anchor: number; until: number } | null = null;
/** Where the egg was drawn last frame (world px), for taps; null when hidden or faded. */
interface Box { x0: number; y0: number; x1: number; y1: number; hx: number; hy: number }
let box: Box | null = null;
/** Read through a call so TypeScript does not narrow `box` across the draw functions that set it. */
const lastBox = (): Box | null => box;
let taps = 0;

export const cond = (): EggCond => ({ dayK: S.dayK, wx: { kind: S.wxKind, rain: S.rain, snow: S.snow, cloud: S.cloud } });

/** Reads #egg= (main.ts passes the URL hash parameter). Unknown ids are ignored. */
export function setEggOverride(v: string | null) { forceParam = parseEggParam(v); }
/** The labelled override in force, for the HUD ('' when none). */
export const eggOverride = () => forceParam ?? '';

/** Per frame, after scene.update(): which egg is showing. `on` is false outside Esperança. */
export function updateEggs(id: string, on: boolean) {
  const now = S.ms;
  if (id !== sceneId) { sceneId = id; forceAnchor = now; forceKonami = null; box = null; if (konami && konami.scene !== id) konami = null; }
  if (!on) { cur = null; box = null; return; }
  if (konami && now >= konami.until) konami = null;
  let force: { id: EggId; anchor: number } | null = null;
  if (forceParam === KONAMI_ID) {
    forceKonami ??= konamiEgg(id, cond());
    if (forceKonami) force = { id: forceKonami, anchor: forceAnchor };
  } else if (forceParam) force = { id: forceParam, anchor: forceAnchor };
  else if (konami) force = { id: konami.id, anchor: konami.anchor };
  cur = eggAt(id, now, cond(), force);
  if (!cur) box = null;
}

/** The Konami code was typed: play the rarest egg that fits this scene now. Returns it (or null). */
export function unlockKonami(id: string, on: boolean): EggId | null {
  if (!on) return null;
  const pick = konamiEgg(id, cond());
  if (!pick) return null;
  const [d0, d1] = EGG_DUR[pick];
  konami = { scene: id, id: pick, anchor: S.ms, until: S.ms + Math.round((d0 + d1) * 500) };
  return pick;
}

// ---------- helpers ----------
const isSky = (c: number) => SKYIDX[c] === 1 || c === CLOUD || c === CLOUDD;
/** put() only where the scene shows sky or cloud (so roofs and towers stay in front). */
function putSky(x: number, y: number, c: number) { if (isSky(getW(x, y))) put(x, y, c); }
/** A string sprite with dithered visibility `a` (0..1) and an optional sky-only mask. */
function sprA(rows: readonly string[], x: number, y: number, map: Uint8Array, a = 1, sky = false, flipX = false, flipY = false) {
  x = Math.round(x); y = Math.round(y);
  const h = rows.length;
  for (let j = 0; j < h; j++) {
    const r = rows[flipY ? h - 1 - j : j], w = r.length;
    for (let i = 0; i < w; i++) {
      const c = map[r.charCodeAt(flipX ? w - 1 - i : i)];
      if (c === 255 || (a < 1 && bay(x + i, y + j) >= a)) continue;
      if (sky) putSky(x + i, y + j, c); else put(x + i, y + j, c);
    }
  }
}
/** Fade in over `fin` seconds and out over the last `fout`. */
const fade = (t: number, dur: number, fin: number, fout = fin) => Math.max(0, Math.min(1, t / fin, (dur - t) / fout));
const setBox = (x0: number, y0: number, w: number, h: number) => { box = { x0, y0, x1: x0 + w, y1: y0 + h, hx: x0 + w / 2, hy: y0 }; };

// ---------- the web-slinger ----------
const SPIDEY = [
  '..rrr..',
  '.rwrwr.',
  '..rrr..',
  '.brrrb.',
  'b.rrr.b',
  'b.bbb.b',
  '..bbb..',
  '..b.b..',
  '..b.b..',
  '..r.r..',
  '.rr.rr.',
];
const SPIDEY_CLIMB = [
  ['b.rrr.b', 'brrrrrb', '.rkrkr.', '..rrr..', '..bbb..', '.b...b.', 'b......'],
  ['b.rrr.b', 'brrrrrb', '.rkrkr.', '..rrr..', '..bbb..', '.b...b.', '......b'],
];
const SPIDEY_MAP = M({ r: CRED, b: CBLUE, w: WHITE, k: VOID });

function drawSpidey(sp: EggSpot, t: number, dur: number) {
  if (sp.y1 === undefined) { // hanging upside down on a web thread
    const drop = Math.min(1, t / 2, (dur - t) / 2), len = Math.round(2 + 8 * Math.max(0, drop));
    if (drop <= 0) return;
    const sway = Math.round(Math.sin(t * 1.3) * 1), x = sp.x + sway;
    for (let y = sp.y; y < sp.y + len; y++) put(sp.x + Math.round(sway * (y - sp.y) / len), y, STONEL);
    sprA(SPIDEY, x - 3, sp.y + len, SPIDEY_MAP, 1, false, false, true);
    // a wave now and then
    if (Math.sin(t * 0.9) > 0.85) { put(x - 4, sp.y + len + 5, CRED); put(x - 5, sp.y + len + 6, CRED); }
    setBox(x - 4, sp.y, 9, len + 12);
    box!.hy = sp.y + len;
    return;
  }
  // crawling up a wall (or mast) in short bursts, then back down before leaving
  const half = dur / 2, k = t < half ? t / half : (dur - t) / half;
  const steps = 6, q = k * steps, frac = q - Math.floor(q), moving = frac < 0.6;
  const prog = (Math.floor(q) + Math.min(1, frac / 0.6)) / steps, y = Math.round(sp.y + (sp.y1 - sp.y) * prog);
  const a = fade(t, dur, 1.2);
  const fr = SPIDEY_CLIMB[moving ? Math.floor(t * 4) & 1 : 0];
  sprA(fr, sp.x - 3, y - 7, SPIDEY_MAP, a);
  if (a > 0.5) setBox(sp.x - 4, y - 8, 9, 10);
}

// ---------- the caped vigilante ----------
const BAT = [
  '..k...k..',
  '..kkkkk..',
  '..kwkwk..',
  '...kkk...',
  '.kkkkkkk.',
  'kkkkykkkk',
  'kkkkkkkkk',
  'kkkkkkkkk',
  '.kkk.kkk.',
  '.kk...kk.',
  '.kk...kk.',
];
const BAT_MAP = M({ k: VOID, w: LEDW, y: GOLD });
function drawBatman(sp: EggSpot, t: number, dur: number) {
  const a = fade(t, dur, 1.5, 1);
  const x = sp.x - 4, y = sp.y - BAT.length + 1;
  sprA(BAT, x, y, BAT_MAP, a);
  // the cape catches the wind now and then
  if (a > 0.5) {
    const fl = Math.sin(t * 2.2) > 0.3 ? 1 : 0;
    for (let j = 5; j < 9; j++) put(x + 9 + fl * (j > 6 ? 1 : 0), y + j, VOID);
    if (fl) put(x + 10, y + 9, VOID);
    setBox(x - 1, y - 1, 12, BAT.length + 2);
  }
}

// ---------- the signal on the clouds ----------
const LOGO = [
  'kk.....k.k.....kk',
  '.kkkk..kkk..kkkk.',
  'kkkkkkkkkkkkkkkkk',
  '.kkkkkkkkkkkkkkk.',
  '..kkk..kkk..kkk..',
  '...k....k....k...',
];
function drawBatsignal(sp: EggSpot, t: number, dur: number) {
  // switched on with a flicker, held, switched off
  let a = fade(t, dur, 2, 1.5);
  if (t < 1.2 && Math.sin(t * 40) > 0) a *= 0.3;
  if (a <= 0) return;
  const cx = sp.x, cy = sp.y, rx = 15, ry = 8;
  // the beam from the searchlight off to the lower right
  const bx = cx + 70, by = cy + 110;
  for (let j = cy + ry; j < by; j += 1) {
    const k = (j - cy) / (by - cy), mx = cx + (bx - cx) * k, hw = 3 + (1 - k) * 8;
    for (let x = Math.round(mx - hw); x <= Math.round(mx + hw); x++) if (bay(x, j) < 0.22 * a) putSky(x, j, AMB);
  }
  // the disc and the bat in one pass (so the bat is not masked by the disc just painted)
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    const d = (i / rx) ** 2 + (j / ry) ** 2;
    if (d > 1) continue;
    const bat = a > 0.6 && LOGO[j + 3]?.[i + 8] === 'k';
    if (bat) putSky(cx + i, cy + j, VOID);
    else if (bay(cx + i, cy + j) < (d > 0.8 ? 0.6 * a : a)) putSky(cx + i, cy + j, d > 0.8 ? AMB : LIGHT);
  }
  if (a > 0.5) setBox(cx - rx, cy - ry, rx * 2 + 1, ry * 2 + 1);
}

// ---------- the dot eater ----------
const GHOST = ['..ggg..', '.ggggg.', 'gwegweg', 'ggggggg', 'ggggggg', 'ggggggg'];
const SKIRT = ['g.g.g.g', '.g.g.g.'];
function drawPac(x: number, y: number, dir: number, t: number) {
  const open = Math.abs(Math.sin(t * 9)) * 0.8;
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
    if (i * i + j * j > 10) continue;
    const ang = Math.atan2(j, i * dir);
    if (Math.abs(ang) < open && i * dir > 0) continue;
    put(x + i, y + j, CYELL);
  }
  put(x, y - 2, VOID);
}
function drawGhost(x: number, y: number, body: number, scared: boolean, t: number, dir: number) {
  const map = M({ g: body, w: WHITE, e: scared ? body : CNAVY });
  spr(GHOST, x - 3, y - 3, map, dir < 0);
  spr([SKIRT[Math.floor(t * 6) & 1]], x - 3, y + 3, map);
  if (scared) { put(x - 2, y + 1, WHITE); put(x, y + 1, WHITE); put(x + 2, y + 1, WHITE); }
}
function drawPacman(sp: EggSpot, t: number, dur: number) {
  const x0 = sp.x, x1 = sp.x1 ?? sp.x + 100, y = sp.y, half = dur / 2, span = x1 - x0 + 50;
  const going = t < half, k = (going ? t : t - half) / half;
  const pac = going ? x0 - 8 + span * k : x1 + 8 - span * k, dir = going ? 1 : -1;
  const clip = (x: number) => x >= x0 - 2 && x <= x1 + 2;
  // pellets ahead of the dot eater
  for (let x = x0; x <= x1; x += 5) if ((going ? x > pac + 4 : x < pac - 4) && clip(x)) put(x, y, WHITE);
  if (!going && x0 + 5 < pac - 4) put(x0 + 5, y, CYELL); // a power pellet waiting at the end
  const flash = going && k > 0.75 && Math.floor(t * 5) % 2 === 0;
  const COLS = [CRED, FPINK, CYAN, CORNG];
  for (let g = 0; g < 3; g++) {
    const gx = going ? pac + 12 + g * 9 : pac - 12 - g * 9;
    if (!clip(gx - 3) || !clip(gx + 3)) continue;
    drawGhost(Math.round(gx), y, going ? (flash ? WHITE : CBLUE) : COLS[g], going, t, dir);
  }
  if (clip(pac - 3) && clip(pac + 3)) drawPac(Math.round(pac), y, dir, t);
  const lo = Math.max(x0, Math.min(pac, pac + dir * 40)), hi = Math.min(x1, Math.max(pac, pac + dir * 40));
  if (hi > lo) setBox(lo - 4, y - 5, hi - lo + 8, 11);
}

// ---------- the blue box ----------
const BOX = [
  '....l....',
  '...nnn...',
  '.nnnnnnn.',
  'nnnnnnnnn',
  'nkwkwkwkn',
  'nbbbbbbbn',
  'nbggbggbn',
  'nbggbggbn',
  'nbbbbbbbn',
  'nbnnbnnbn',
  'nbnnbnnbn',
  'nbbbbbbbn',
  'nbnnbnnbn',
  'nbnnbnnbn',
  'nbbbbbbbn',
  'nbnnbnnbn',
  'nbnnbnnbn',
  'nbbbbbbbn',
  'nnnnnnnnn',
];
function drawTardis(sp: EggSpot, t: number, dur: number) {
  // materialises with a pulsing fade, stays, dematerialises the same way
  const fin = 5, fout = 5;
  let a = 1;
  if (t < fin) a = (t / fin) * (0.55 + 0.45 * Math.sin(t * 5)) + (t / fin) * 0.2;
  else if (t > dur - fout) { const r = (dur - t) / fout; a = r * (0.55 + 0.45 * Math.sin((dur - t) * 5)) + r * 0.2; }
  a = Math.max(0, Math.min(1, a));
  if (a <= 0.02) return;
  const night = S.dayK < 0.45, lamp = Math.sin(t * 4) > 0 ? LIGHT : WHITE;
  const map = M({ n: CNAVY, b: CBLUE, k: VOID, w: WHITE, g: night ? WWARM : WHITE, l: t < fin || t > dur - fout ? lamp : night ? LIGHT : WHITE });
  const x = sp.x - 4, y = sp.y - BOX.length + 1;
  sprA(BOX, x, y, map, a);
  if (a > 0.4) setBox(x - 1, y - 1, 11, BOX.length + 2);
}

// ---------- the forest spirit at the shelter ----------
const SPIRIT = [
  '.s.........s.',
  '.ss.......ss.',
  '.sssssssssss.',
  'sssssssssssss',
  'swwkssssswwks',
  'sssssskssssss',
  'sssssssssssss',
  'sssbbbbbbbsss',
  'ssbbsbsbsbbss',
  'sbbbbbbbbbbbs',
  'sbbsbsbsbsbbs',
  'sbbbbbbbbbbbs',
  'ssbbbbbbbbbss',
  '.sssssssssss.',
  '.ss.......ss.',
];
const SPIRIT_BLINK = 'sssssssssssss';
function drawTotoro(sp: EggSpot, t: number, dur: number) {
  const a = fade(t, dur, 3, 3);
  if (a <= 0) return;
  const rows = [...SPIRIT];
  if (Math.sin(t * 0.8) > 0.95) rows[4] = SPIRIT_BLINK; // a slow blink
  const x = sp.x - 6, y = sp.y - rows.length + 1;
  sprA(rows, x, y, M({ s: CNAVY, b: CBEIGE, w: WHITE, k: VOID }), a);
  // a leaf held over the head, just in case
  if (a > 0.5) {
    for (let i = -4; i <= 4; i++) put(x + 6 + i, y - 3 + Math.round((i * i) / 8), i === 0 ? LEAFGD : LEAFG);
    put(x + 6, y - 2, WOOD); put(x + 6, y - 1, WOOD);
    setBox(x - 1, y - 4, 15, rows.length + 5);
  }
}

// ---------- the little critter in the grass ----------
const CRITTER = [
  'k.....k',
  'y.....y',
  'yy...yy',
  '.yyyyy.',
  '.ykyky.',
  '.ryyyr.',
  '..yyy..',
  '.y...y.',
];
function drawPoke(e: Egg, sp: EggSpot, t: number, dur: number) {
  const a = fade(t, dur, 1.5, 1.5);
  if (a <= 0) return;
  const x1 = sp.x1 ?? sp.x + 60, dir = e.seed & 1 ? 1 : -1;
  // hop, hop, stop and look around; across the turf and back
  const hops = 8, k = t / dur, q = k * hops, frac = q - Math.floor(q), hopping = frac < 0.35;
  const along = (Math.floor(q) + Math.min(1, frac / 0.35)) / hops;
  const pos = dir > 0 ? along : 1 - along, x = Math.round(sp.x + (x1 - sp.x) * pos);
  const lift = hopping ? Math.round(Math.sin((frac / 0.35) * Math.PI) * 2) : 0, y = sp.y - CRITTER.length + 1 - lift;
  const face = hopping ? dir : (Math.floor(t) % 3 === 0 ? -dir : dir);
  sprA(CRITTER, x - 3, y, M({ k: VOID, y: CYELL, r: CRED }), a, false, face < 0);
  // zigzag tail
  const tx = x - 4 * face;
  put(tx, y + 4, WOOD); put(tx - face, y + 3, CYELL); put(tx, y + 2, CYELL); put(tx - face, y + 1, CYELL);
  if (!hopping && Math.sin(t * 7) > 0.8) { put(x - 4, y + 4, LIGHT); put(x + 4, y + 4, LIGHT); put(x, y - 1, LIGHT); }
  if (a > 0.5) setBox(x - 6, y - 2, 13, CRITTER.length + 4);
}

// ---------- the freighter across the night sky ----------
const SHIP = [
  '..sssssss..',
  '.sssssssss.',
  'ssssskssssss',
  'sssssssssss.',
  '.sssssssss..',
  '..ss...ss...',
];
function drawFalcon(sp: EggSpot, t: number, dur: number) {
  const x1 = sp.x1 ?? sp.x + 200, y1 = sp.y1 ?? sp.y, k = t / dur;
  const X = -24 + (480 + 48) * k, Y = sp.y + ((y1 - sp.y) * (X - sp.x)) / (x1 - sp.x);
  const night = S.dayK < 0.45, map = M({ s: STEEL, k: night ? LEDW : CNAVY });
  // a long fading engine trail (the glow is what you notice in a dark sky)
  const slope = (y1 - sp.y) / (x1 - sp.x);
  for (let i = 1; i < 40; i++) if (bay(Math.round(X) - 6 - i, Math.round(Y)) < 1 - i / 40) putSky(X - 6 - i, Y - i * slope + 0.5, i < 12 ? CYAN : WCOOL);
  for (let j = 0; j < SHIP.length; j++) for (let i = 0; i < SHIP[j].length; i++) {
    const c = map[SHIP[j].charCodeAt(i)];
    if (c !== 255) putSky(X - 6 + i, Y - 3 + j, c);
  }
  for (let j = -1; j <= 1; j++) { putSky(X - 6, Y + j, CYAN); putSky(X - 7, Y + j, CYAN); }
  if (night && Math.sin(t * 8) > 0) { putSky(X - 4, Y - 4, SIGR); putSky(X + 4, Y + 2, LEDW); } // running lights
  setBox(Math.round(X) - 10, Math.round(Y) - 7, 22, 14);
}

// ---------- hooks ----------
/** Call right after scene.render(): draws the current egg (if any) on top of the scene. */
export function drawEggs() {
  box = null;
  const e = cur;
  if (!e) return;
  const sp = EGG_SPOTS[e.scene]?.[e.id];
  if (!sp) return;
  const t = (S.ms - e.start) / 1000, dur = (e.end - e.start) / 1000;
  if (t < 0 || t > dur) return;
  switch (e.id) {
    case 'spiderman': drawSpidey(sp, t, dur); break;
    case 'batman': drawBatman(sp, t, dur); break;
    case 'batsignal': drawBatsignal(sp, t, dur); break;
    case 'pacman': drawPacman(sp, t, dur); break;
    case 'tardis': drawTardis(sp, t, dur); break;
    case 'totoro': drawTotoro(sp, t, dur); break;
    case 'poke': drawPoke(e, sp, t, dur); break;
    case 'falcon': drawFalcon(sp, t, dur); break;
    default: break;
  }
  // only what is actually on screen can be tapped
  const b = lastBox();
  if (b && (b.x1 < G.camX || b.x0 > G.camX + G.W)) box = null;
}

/** Whether (x, y) (world px) is on the egg drawn this frame; a tiny margin, nothing else steals it. */
export function eggHit(x: number, y: number): { x: number; y: number; id: EggId } | null {
  const b = box;
  if (!b || !cur || x < b.x0 - 2 || x > b.x1 + 2 || y < b.y0 - 2 || y > b.y1 + 2) return null;
  return { x: b.hx, y: b.hy, id: cur.id };
}
/** The line to say for a tapped egg (a different one on every tap). */
export function eggSay(id: EggId): string { return eggLine(id, (cur?.seed ?? 0) + taps++); }

/** Debug panel line: the running egg and the next one planned. */
export function eggDebug(id: string): string {
  if (!EGG_SPOTS[id]) return '-';
  const hm = (ms: number) => { const d = new Date(ms + S.city.utc * 3_600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  const run = cur ? `${cur.id}${cur.forced ? (forceParam ? ` (teste #egg=${forceParam})` : ' (konami)') : ` ${hm(cur.start)}-${hm(cur.end)}`}` : 'none';
  const nx = nextEgg(id, Math.max(S.ms, cur?.end ?? S.ms));
  return `${run}  next ${nx ? `${nx.id} ${hm(nx.start)}` : '-'}`;
}
