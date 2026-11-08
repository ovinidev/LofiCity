/* Traffic of a town in the Paraíba Agreste. Motorcycles dominate (mototáxis in vests with a
   passenger, delivery boxes, the gas man with a botijão, scooters); then hatchbacks, sedans,
   SUVs and small pickups carrying botijões, melons or a wardrobe from the furniture shops; the
   odd Veraneio or Kombi; the carro de som crawling by with speakers on the roof; carros-pipa
   bringing water in the dry season; donkey carts; and Viação São José buses and micro-buses.
   Two lanes: the far lane drives left, the near lane right. Slower vehicles hold up the cars
   behind them; motorcycles weave past. */
import { G, put, rect } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  BARK, BNEAR, CBEIGE, CBLUE, CGREEN, CNAVY, CORNG, CRED, CYELL, HALO, LEDW, LIGHT, MAG, MAGD, SKIN2, SKIN3,
  STEEL, STONE, STONEL, TILEW, VOID, WCOOL, WDIM, WOOD, AMB,
} from '../engine/palette';
import { S, hourIn } from '../sky/state';
import { overlaps, yieldLimit } from './street-rules';

type Kind = 'moto' | 'hatch' | 'sedan' | 'suv' | 'pickup' | 'veraneio' | 'kombi' | 'som' | 'pipa' | 'carroca' | 'bus' | 'micro' | 'escolar';
type MotoKind = 'plain' | 'mototaxi' | 'delivery' | 'gas' | 'scooter';
type Load = 'none' | 'gas' | 'melon' | 'furniture' | 'sacks';
interface V {
  on: boolean; kind: Kind; x: number; dir: number; sp: number; cruise: number; lane: number; len: number;
  body: number; body2: number; rider: number; helmet: number; pillion: boolean; moto: MotoKind; load: Load; ph: number;
}

const r = mulberry32(0xb4a1);
const pick = <T>(a: readonly T[]): T => a[(r() * a.length) | 0];
const POOL = 8;
const VS: V[] = Array.from({ length: POOL }, () => ({
  on: false, kind: 'hatch' as Kind, x: 0, dir: 1, sp: 0, cruise: 0, lane: 0, len: 26, body: TILEW, body2: TILEW, rider: CRED,
  helmet: VOID, pillion: false, moto: 'plain' as MotoKind, load: 'none' as Load, ph: 0,
}));
let laneY = [158, 172], spawnT = 0.3;

/** A zebra crossing across both lanes between world x0 and x1; `occupied` says whether a pedestrian
    is on it or about to step on. Off unless a scene sets one (setBrLanes clears it). */
export interface BrCrossing { x0: number; x1: number; occupied: () => boolean }
let crossing: BrCrossing | null = null;
/** Gap between a stop line and the stripes. */
const STOP_GAP = 3;

export function setBrLanes(far: number, near: number) { laneY = [far, near]; crossing = null; for (const v of VS) v.on = false; }
export function setBrCrossing(c: BrCrossing | null) { crossing = c; }
/** Whether any vehicle's body is on the crossing or between its stop lines (a pedestrian waits for this to clear). */
export const vehicleNearCrossing = () => !!crossing && VS.some((v) => v.on && overlaps(v.x, v.len, crossing!.x0 - STOP_GAP, crossing!.x1 + STOP_GAP));
/** Whether any vehicle's body overlaps world x0..x1 (debug check). */
export const vehicleBetween = (x0: number, x1: number) => VS.some((v) => v.on && overlaps(v.x, v.len, x0, x1));

const LEN: Record<Kind, number> = { moto: 12, hatch: 26, sedan: 31, suv: 31, pickup: 31, veraneio: 34, kombi: 28, som: 27, pipa: 42, carroca: 34, bus: 66, micro: 44, escolar: 50 };
const CAR_COLORS = [TILEW, TILEW, TILEW, STONEL, STONEL, VOID, CRED, CBLUE, CNAVY, STONE, CBEIGE];

function choose(v: V) {
  const h = S.cal.hour, day = hourIn(h, 6, 18.5), late = h >= 23 || h < 5;
  const w: [Kind, number][] = [
    ['moto', 44], ['hatch', 18], ['sedan', 6], ['suv', 5], ['pickup', 8], ['veraneio', 1.5], ['kombi', 2],
    ['som', day ? 2.5 : 0], ['pipa', day ? (S.cal.month >= 8 || S.cal.month <= 1 ? 4 : 1.5) : 0], ['carroca', day ? 4 : 0],
    ['bus', late ? 0 : 3], ['micro', late ? 0 : 2],
    // prefeitura school buses at the start and end of each school shift on weekdays
    ['escolar', S.cal.weekday >= 1 && S.cal.weekday <= 5 && (hourIn(h, 6, 7.8) || hourIn(h, 11, 13.5) || hourIn(h, 17, 18.5)) ? 6 : 0],
  ];
  // #car=bus (or any kind) makes most spawns that kind, for previews
  const want = /car=(\w+)/.exec(location.hash)?.[1] as Kind | undefined;
  if (want && want in LEN) w.push([want, 400]);
  let t = 0; for (const [, x] of w) t += x;
  let q = r() * t; v.kind = 'hatch';
  for (const [k, x] of w) { q -= x; if (q <= 0) { v.kind = k; break; } }
  v.len = LEN[v.kind]; v.body = pick(CAR_COLORS); v.body2 = TILEW; v.pillion = false; v.load = 'none'; v.ph = r() * 6;
  switch (v.kind) {
    case 'moto': {
      v.moto = pick(['plain', 'plain', 'mototaxi', 'mototaxi', 'delivery', 'gas', 'scooter'] as const);
      v.body = pick([CRED, CRED, VOID, CBLUE, STONEL, TILEW, CNAVY]);
      v.rider = pick([CRED, CBLUE, VOID, CYELL, TILEW, CGREEN, STONE]); v.helmet = pick([VOID, VOID, TILEW, CRED, CBLUE, CYELL]);
      v.pillion = v.moto === 'mototaxi' || (v.moto === 'plain' && r() < 0.3);
      if (v.moto === 'mototaxi') v.rider = pick([CYELL, CORNG]);
      v.cruise = v.moto === 'scooter' ? 42 : 52 + r() * 22; break;
    }
    case 'pickup': v.load = pick(['none', 'gas', 'melon', 'furniture', 'sacks'] as const); v.cruise = 42 + r() * 12; break;
    case 'veraneio': v.body = pick([CBEIGE, CGREEN, WOOD, CRED, CNAVY]); v.cruise = 36 + r() * 8; break;
    case 'kombi': v.body = pick([CBLUE, CRED, CBEIGE, CGREEN]); v.cruise = 34 + r() * 8; break;
    case 'som': v.body = pick([TILEW, CRED, CBLUE]); v.cruise = 14 + r() * 4; break;
    case 'pipa': v.body = pick([TILEW, CRED, CBLUE]); v.cruise = 30 + r() * 6; break;
    case 'carroca': v.body = pick([STONE, BARK, STONEL]); v.cruise = 11 + r() * 4; v.load = pick(['sacks', 'melon', 'none'] as const); break;
    case 'bus': v.cruise = 34 + r() * 6; break;
    case 'micro': v.cruise = 38 + r() * 6; break;
    case 'escolar': v.cruise = 32 + r() * 6; break;
    default: v.cruise = 42 + r() * 14;
  }
  v.sp = v.cruise;
}

function spawn() {
  const lane = r() < 0.5 ? 0 : 1, dir = lane === 0 ? -1 : 1;
  const entry = dir > 0 ? G.camX - 70 : G.camX + G.W + 4;
  if (VS.some((o) => o.on && o.lane === lane && Math.abs(o.x - entry) < 80)) return;
  const v = VS.find((o) => !o.on);
  if (!v) return;
  choose(v);
  v.on = true; v.lane = lane; v.dir = dir; v.x = dir > 0 ? G.camX - v.len - 4 : G.camX + G.W + 4;
}

export function updateBr(dt: number, density = 1) {
  // roughly one vehicle every 2-6 s at a busy hour, a trickle late at night
  spawnT -= dt * (0.02 + 0.36 * S.traffic) * density;
  if (spawnT <= 0) { spawnT = 0.6 + r() * 1.2; spawn(); }
  // with a zebra crossing, vehicles are moved front-first so each sees where the one ahead stopped
  const zc = crossing, occupied = !!zc && zc.occupied(), held = new Set<V>();
  const order = zc ? VS.filter((v) => v.on).sort((a, b) => b.x * b.dir - a.x * a.dir) : VS;
  for (const v of order) {
    if (!v.on) continue;
    // follow a slower vehicle ahead in the same lane (motorcycles squeeze past)
    let sp = v.cruise;
    if (v.kind !== 'moto') for (const o of VS) {
      if (o === v || !o.on || o.lane !== v.lane || o.kind === 'moto') continue;
      const gap = v.dir > 0 ? o.x - (v.x + v.len) : v.x - (o.x + o.len);
      if (gap > 0 && gap < 14) sp = Math.min(sp, o.sp * (gap < 6 ? 0.6 : 1));
    }
    let lim = Infinity;
    if (zc) {
      // stop before the stripes while someone is on (or stepping onto) them; queue behind anyone held there
      lim = yieldLimit(v.dir > 0 ? v.x + v.len : v.x, v.dir, zc.x0 - STOP_GAP, zc.x1 + STOP_GAP, occupied);
      for (const o of held) {
        if (o.lane !== v.lane) continue;
        const gap = v.dir > 0 ? o.x - (v.x + v.len) : v.x - (o.x + o.len);
        if (gap >= 0) lim = Math.min(lim, Math.max(0, gap - 3));
      }
      if (lim < Infinity) { held.add(v); sp = Math.min(sp, lim * 1.5); } // ease down toward the line
    }
    v.sp += (sp - v.sp) * Math.min(1, dt * 2);
    const move = Math.min(v.sp * dt, lim);
    if (move < v.sp * dt) v.sp = move / dt;
    v.x += v.dir * move; v.ph += v.sp * dt * 0.25;
    if (v.x < G.camX - v.len - 80 || v.x > G.camX + G.W + 80) v.on = false;
  }
}

/** Big vehicles passing at x scare birds off the wires. */
export function bigVehicleNear(): number | null {
  for (const v of VS) if (v.on && (v.kind === 'bus' || v.kind === 'pipa' || v.kind === 'som' || v.kind === 'escolar')) return v.x + v.len / 2;
  return null;
}

// ---------- drawing ----------
const night = () => S.dayK < 0.55;

function wheel(x: number, y: number, rad = 2) {
  rect(x - rad, y - rad * 2 + 1, rad * 2 + 1, rad * 2, VOID); put(x, y - rad, STEEL);
}
function lights(front: number, back: number, y: number, f: number, cone = 26) {
  const n = night();
  put(front, y, n ? LEDW : STONEL); put(back, y, n ? MAG : MAGD);
  if (!n) return;
  for (let i = 1; i < cone; i++) for (let j = -2; j <= 2; j++) {
    const x = front + i * f, yy = y + j + Math.round(i * 0.12);
    if (bay(x - G.camX, yy + G.oy) < 0.3 * (1 - i / cone) * (1 - Math.abs(j) / 3)) put(x, yy, HALO);
  }
  for (let i = 1; i < 5; i++) if (bay(back - i * f, y) < 0.4 * (1 - i / 5)) put(back - i * f, y, MAGD);
}

/** A car in profile. `cab` is [start, end] of the cabin along the body (front = 1), `hood` how far the nose slopes. */
function car(x0: number, y: number, L: number, f: number, body: number, opt: { h?: number; roof?: number; cab?: [number, number]; roofC?: number; boxy?: boolean; wins?: number } = {}) {
  const h = opt.h ?? 5, roof = opt.roof ?? 4, [a, b] = opt.cab ?? [0.22, 0.7], n = night();
  const top = y - 3 - h;
  rect(x0, top, L, h, body);
  if (!opt.boxy) put(f > 0 ? x0 + L - 1 : x0, top, BNEAR); // rounded nose
  // cabin with sloped pillars
  const c0 = Math.round(x0 + L * (f > 0 ? a : 1 - b)), c1 = Math.round(x0 + L * (f > 0 ? b : 1 - a));
  const rt = top - roof;
  for (let j = 0; j < roof; j++) {
    const inset = opt.boxy ? 0 : roof - j - 1;
    rect(c0 + (f > 0 ? 0 : inset), rt + j, c1 - c0 - inset, 1, opt.roofC ?? body);
  }
  // windows
  const wins = opt.wins ?? 2, ww = (c1 - c0 - 2) / wins;
  for (let i = 0; i < wins; i++) rect(Math.round(c0 + 1 + i * ww + (i ? 1 : 0)), rt + 1, Math.max(1, Math.round(ww) - 1), roof - 1, n ? WDIM : WCOOL);
  // bumpers, wheels, lights
  rect(x0, y - 4, L, 1, STONE);
  wheel(x0 + 5, y); wheel(x0 + L - 6, y);
  lights(f > 0 ? x0 + L - 1 : x0, f > 0 ? x0 : x0 + L - 1, y - 5, f);
}

function drawMoto(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), n = night();
  const front = f > 0 ? x0 + 11 : x0, back = f > 0 ? x0 : x0 + 11;
  wheel(x0 + 2, y, 1); wheel(x0 + 9, y, 1);
  if (v.moto === 'scooter') { rect(x0 + 2, y - 4, 8, 2, v.body); rect(front - 2 * f, y - 7, 2, 4, v.body); }
  else { rect(x0 + 3, y - 5, 6, 2, v.body); rect(x0 + 4, y - 6, 3, 1, v.body); put(front - f, y - 6, STEEL); put(front - f, y - 7, STEEL); rect(x0 + 3, y - 3, 5, 1, STEEL); }
  const rx = x0 + 5 + (f > 0 ? 0 : 1);
  rect(rx, y - 11, 2, 6, v.rider); rect(rx + f, y - 9, 2, 1, v.rider); put(rx + 2 * f, y - 8, SKIN2);
  rect(rx + (f > 0 ? 1 : -1), y - 6, 2, 1, CNAVY);
  rect(rx, y - 14, 3, 3, v.helmet); put(rx + (f > 0 ? 2 : 0), y - 13, n ? STONEL : WCOOL);
  if (v.moto === 'mototaxi') { put(rx, y - 10, VOID); put(rx + 1, y - 9, VOID); } // vest number
  if (v.pillion) { const px = rx - 3 * f; rect(px, y - 10, 2, 5, pick2(v.ph, [CBEIGE, CRED, TILEW, CBLUE])); rect(px, y - 13, 2, 3, VOID); }
  if (v.moto === 'delivery') { rect(back + (f > 0 ? -1 : -3), y - 12, 5, 5, CRED); rect(back + (f > 0 ? 0 : -2), y - 11, 3, 1, TILEW); }
  if (v.moto === 'gas') { rect(back + (f > 0 ? -1 : -2), y - 10, 4, 5, CBLUE); rect(back + (f > 0 ? 0 : -1), y - 11, 2, 1, STEEL); }
  put(front, y - 6, n ? LEDW : STONEL); put(back, y - 5, n ? MAG : MAGD);
  if (n) for (let i = 1; i < 18; i++) for (let j = -1; j <= 1; j++) { const x = front + i * f, yy = y - 5 + j + Math.round(i * 0.15); if (bay(x - G.camX, yy + G.oy) < 0.28 * (1 - i / 18)) put(x, yy, HALO); }
}
const pick2 = (ph: number, a: number[]) => a[Math.floor(ph * 10) % a.length];

function drawPickup(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), L = v.len;
  car(x0, y, L, f, v.body, { cab: [0.5, 0.78], wins: 1 });
  const bx0 = f > 0 ? x0 + 1 : x0 + Math.round(L * 0.5), bw = Math.round(L * 0.48) - 2, top = y - 8;
  rect(bx0, top - 1, bw, 1, v.body); // bed rail
  if (v.load === 'gas') for (let i = 0; i < 3; i++) { rect(bx0 + 1 + i * 4, top - 5, 3, 4, CBLUE); put(bx0 + 2 + i * 4, top - 6, STEEL); }
  if (v.load === 'melon') for (let i = 0; i < 4; i++) { rect(bx0 + 1 + i * 3, top - 3 - (i % 2), 3, 2, CGREEN); }
  if (v.load === 'furniture') { rect(bx0 + 1, top - 12, 9, 11, WOOD); rect(bx0 + 5, top - 11, 1, 9, BARK); put(bx0 + 4, top - 7, AMB); put(bx0 + 6, top - 7, AMB); rect(bx0 + 1, top - 6, 9, 1, CYELL); }
  if (v.load === 'sacks') for (let i = 0; i < 3; i++) rect(bx0 + 1 + i * 4, top - 4, 4, 3, CBEIGE);
}

function drawVeraneio(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), L = v.len;
  car(x0, y, L, f, v.body, { h: 6, roof: 5, cab: [0.08, 0.78], roofC: TILEW, boxy: true, wins: 3 });
  rect(x0, y - 6, L, 1, STONEL); // chrome strip
  put(f > 0 ? x0 + L - 1 : x0, y - 7, night() ? LEDW : TILEW); // round headlamp
}

function drawKombi(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), L = v.len, n = night();
  const top = y - 15;
  rect(x0, top + 6, L, 7, v.body); rect(x0, top, L, 7, TILEW);
  for (let i = 0; i < 4; i++) rect(x0 + 3 + i * 6, top + 1, 4, 4, n ? WDIM : WCOOL);
  const nose = f > 0 ? x0 + L - 3 : x0; rect(nose, top + 6, 3, 2, TILEW); // V on the front
  put(f > 0 ? x0 + L - 1 : x0, top, BNEAR);
  wheel(x0 + 5, y); wheel(x0 + L - 6, y);
  lights(f > 0 ? x0 + L - 1 : x0, f > 0 ? x0 : x0 + L - 1, y - 6, f);
}

function drawSom(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), L = v.len, t = S.ms / 1000;
  car(x0, y, L, f, v.body, { cab: [0.22, 0.68] });
  // speaker boxes on a roof rack, and the sound rolling out
  rect(x0 + 6, y - 18, L - 12, 1, STEEL);
  for (let i = 0; i < 3; i++) { rect(x0 + 6 + i * 5, y - 23, 4, 5, VOID); put(x0 + 7 + i * 5, y - 21, STEEL); }
  for (let k = 0; k < 3; k++) {
    const rad = 4 + (((t * 14) + k * 6) % 18);
    for (let a = -0.7; a <= 0.7; a += 0.18) put(x0 + L / 2 + Math.sin(a) * rad * f * 1.4, y - 22 - Math.cos(a) * rad * 0.5, rad < 14 ? STONEL : STONE);
  }
}

function drawPipa(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), L = v.len, n = night();
  const cab = f > 0 ? x0 + L - 11 : x0;
  rect(cab, y - 14, 11, 10, v.body); rect(cab + (f > 0 ? 5 : 1), y - 13, 5, 4, n ? WDIM : WCOOL);
  const t0 = f > 0 ? x0 : x0 + 12, tw = L - 13;
  rect(t0, y - 15, tw, 9, CBLUE); rect(t0 + 1, y - 16, tw - 2, 1, CBLUE); rect(t0, y - 7, tw, 1, STEEL);
  drawText4('AGUA', t0 + (tw >> 1) - 7, y - 14, TILEW);
  rect(x0, y - 5, L, 1, STONE);
  wheel(x0 + 5, y); wheel(x0 + 12, y); wheel(x0 + L - 6, y);
  lights(f > 0 ? x0 + L - 1 : x0, f > 0 ? x0 : x0 + L - 1, y - 6, f);
}

/** Tiny 3x5 text for vehicle signs (only the letters these signs need). */
const G4: Record<string, string> = {
  A: '010101111101101', G: '011100101101011', U: '101101101101111', S: '011100010001110', O: '010101101101010', J: '001001001101010',
  E: '111100110100111', L: '100100100100111', P: '110101110100100', R: '110101110101101', N: '110101101101101', C: '011100100100011', M: '101111111101101',
  I: '111010010010111', D: '110101101101110', ' ': '000000000000000',
};
function drawText4(s: string, x: number, y: number, c: number) {
  for (const ch of s) { const g = G4[ch] ?? G4[' ']; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') put(x + i, y + j, c); x += 4; }
}

/** Donkey (jumento) pulling a two-wheeled cart, driver in a leather hat. */
function drawCarroca(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), step = Math.sin(v.ph * 2.5);
  const dx = f > 0 ? x0 + 20 : x0, cx = f > 0 ? x0 : x0 + 14; // donkey ahead, cart behind
  // donkey
  rect(dx, y - 9, 9, 4, v.body); rect(dx + (f > 0 ? 8 : -2), y - 12, 3, 4, v.body); // body, neck+head
  put(dx + (f > 0 ? 9 : -1), y - 14, v.body); put(dx + (f > 0 ? 10 : -2), y - 14, v.body); // long ears
  put(dx + (f > 0 ? 10 : -2), y - 9, CBEIGE); // muzzle
  for (const [lx, ph] of [[1, 1], [3, -1], [6, 1], [8, -1]]) { const o = Math.round(step * ph); rect(dx + lx + o, y - 5, 1, 5, v.body); }
  put(dx + (f > 0 ? -1 : 9), y - 8, BARK); // tail
  // shafts + cart
  for (let i = 0; i < 8; i++) put(f > 0 ? dx - 8 + i : dx + 9 + i, y - 8, WOOD);
  rect(cx, y - 11, 14, 5, WOOD); rect(cx, y - 11, 14, 1, BARK);
  for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; put(cx + 7 + Math.cos(t) * 4, y - 4 + Math.sin(t) * 4, BARK); }
  put(cx + 7 + Math.cos(v.ph) * 3, y - 4 + Math.sin(v.ph) * 3, WOOD);
  if (v.load === 'sacks') for (let i = 0; i < 3; i++) rect(cx + 1 + i * 4, y - 14, 4, 3, CBEIGE);
  if (v.load === 'melon') for (let i = 0; i < 4; i++) rect(cx + 1 + i * 3, y - 13 - (i % 2), 3, 2, CGREEN);
  // driver with chapéu de couro
  const px = cx + (f > 0 ? 11 : 1);
  rect(px, y - 18, 3, 7, CBEIGE); rect(px, y - 21, 3, 3, SKIN3); rect(px - 1, y - 22, 5, 1, WOOD); rect(px, y - 23, 3, 1, WOOD);
}

/** Viação São José buses and micro-buses, in green and yellow. */
function drawBus(v: V, y: number, micro: boolean) {
  const f = v.dir, x0 = Math.round(v.x), L = v.len, n = night(), H = micro ? 15 : 18, top = y - H - 3;
  // yellow upper body with the windows and the name, green skirt with a wavy edge
  rect(x0, top, L, H, CYELL); rect(x0, top + H - 6, L, 6, CGREEN);
  for (let i = 0; i < L; i++) put(x0 + i, top + H - 6 + Math.round(Math.sin((i / L) * Math.PI * 2 * f) * 1), CGREEN);
  for (let wx = x0 + 3; wx < x0 + L - 9; wx += 7) rect(wx, top + 1, 5, 5, n ? LIGHT : WDIM);
  const wsx = f > 0 ? x0 + L - 7 : x0 + 1; rect(wsx, top + 2, 6, H - 8, n ? WCOOL : WDIM);
  rect(f > 0 ? x0 + L - 14 : x0 + 9, top + 3, 4, H - 4, BNEAR); // door
  drawText4('SAO JOSE', x0 + (L >> 1) - 15, top + 6, CGREEN);
  rect(x0 + 2, top - 3, micro ? 22 : 36, 3, VOID);
  drawText4(micro ? 'ESPERANCA' : 'CAMPINA', x0 + 3, top - 8, n ? AMB : CYELL);
  wheel(x0 + 8, y, 3); wheel(x0 + L - 10, y, 3);
  lights(f > 0 ? x0 + L - 1 : x0, f > 0 ? x0 : x0 + L - 1, y - 6, f, 30);
}

/** Prefeitura school bus: yellow, black band with ESCOLAR, kids at the windows. */
function drawEscolar(v: V, y: number) {
  const f = v.dir, x0 = Math.round(v.x), L = v.len, n = night(), H = 16, top = y - H - 3;
  rect(x0, top, L, H, CYELL); rect(x0, top + H - 9, L, 7, VOID);
  drawText4('ESCOLAR', x0 + (L >> 1) - 14, top + H - 8, CYELL);
  for (let wx = x0 + 3; wx < x0 + L - 9; wx += 6) { rect(wx, top + 1, 4, 5, n ? LIGHT : WDIM); if (((wx + (S.ms / 900 | 0)) % 3) === 0) rect(wx + 1, top + 3, 2, 3, SKIN2); }
  const wsx = f > 0 ? x0 + L - 7 : x0 + 1; rect(wsx, top + 2, 6, H - 9, n ? WCOOL : WDIM);
  rect(x0, y - 5, L, 2, VOID);
  wheel(x0 + 8, y, 3); wheel(x0 + L - 10, y, 3);
  lights(f > 0 ? x0 + L - 1 : x0, f > 0 ? x0 : x0 + L - 1, y - 6, f, 28);
}

function drawV(v: V) {
  const y = laneY[v.lane], x0 = Math.round(v.x), f = v.dir;
  switch (v.kind) {
    case 'moto': drawMoto(v, y); break;
    case 'hatch': car(x0, y, v.len, f, v.body, { cab: [0.15, 0.72] }); break;
    case 'sedan': car(x0, y, v.len, f, v.body, { cab: [0.25, 0.66] }); break;
    case 'suv': car(x0, y, v.len, f, v.body, { h: 6, roof: 5, cab: [0.12, 0.72], boxy: true, wins: 3 }); rect(x0 + 6, y - 15, v.len - 12, 1, STEEL); break;
    case 'pickup': drawPickup(v, y); break;
    case 'veraneio': drawVeraneio(v, y); break;
    case 'kombi': drawKombi(v, y); break;
    case 'som': drawSom(v, y); break;
    case 'pipa': drawPipa(v, y); break;
    case 'carroca': drawCarroca(v, y); break;
    case 'bus': drawBus(v, y, false); break;
    case 'micro': drawBus(v, y, true); break;
    case 'escolar': drawEscolar(v, y); break;
  }
}

const HORN: Record<Kind, 'moto' | 'car' | 'kombi' | 'bus' | 'truck' | 'bray' | 'som'> = {
  moto: 'moto', hatch: 'car', sedan: 'car', suv: 'car', pickup: 'car', veraneio: 'kombi', kombi: 'kombi', som: 'som',
  pipa: 'truck', carroca: 'bray', bus: 'bus', micro: 'bus', escolar: 'bus',
};
const TALL: Record<Kind, number> = { moto: 15, hatch: 13, sedan: 13, suv: 15, pickup: 14, veraneio: 15, kombi: 16, som: 24, pipa: 17, carroca: 24, bus: 28, micro: 24, escolar: 24 };
/** A tapped vehicle: which horn to play and where to show the reaction. */
export function tapBr(x: number, y: number) {
  for (const v of VS) {
    if (!v.on) continue;
    const gy = laneY[v.lane];
    if (x >= v.x - 2 && x <= v.x + v.len + 2 && y >= gy - TALL[v.kind] && y <= gy + 2) return { sound: HORN[v.kind], x: v.x + v.len / 2, y: gy - TALL[v.kind] };
  }
  return null;
}

export function drawBr() {
  for (const v of VS) if (v.on && v.lane === 0) drawV(v);
  for (const v of VS) if (v.on && v.lane === 1) drawV(v);
}

export const brTrafficDebug = () => VS.filter((v) => v.on).map((v) => (v.kind === 'moto' ? v.moto : v.kind)).join(',');
