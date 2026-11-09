/* Pure rules for the feira livre (fruit and vegetable street market) on Rua José Bezerra da Costa
   (no DOM, unit-tested in test/feira-rules.test.ts): when it runs, how many shoppers it draws,
   where the stalls stand, and how shoppers walk the aisle, stop, queue and buy.

   Schedule (ART DIRECTION, an assumption, not the town's real timetable): the full feira on
   Saturdays, stalls going up from 05:00 (first light, never in the dark), open 05:30-12:30 with its peak 07-10h, packed away by
   13:30; a small feirinha of a few stalls on Wednesdays, 06:00-11:00. Nothing at night, nothing on
   other days: outside these windows the street goes back to its normal rhythm. This is a different
   market from the first-Saturday craft fair at Praça da Cultura.

   Layout: the scene's traffic runs both ways on the right-hand carriageway, so the feira takes the
   left one, between the wall's sidewalk and the median: a row of barracas backed onto the wall's
   kerb (vendors behind them, on the wall side), an aisle, and a second row toward the median
   (vendors on the median side). Metres, as in persp-kit.ts: X across (negative = left of the
   camera), z away from it. Shoppers keep to the aisle and the counters; they never enter a table,
   a parked vehicle or the traffic carriageway (X > -6.2), and they never cross the road.

   Weather: only the real state counts (rain-rules.ts). Genuine rain thins the crowd and opens
   umbrellas; unknown weather ('unavailable') changes nothing.

   Keep this file free of TS-only runtime syntax: `node --test` runs it by stripping the types. */
import { type WxState, opensUmbrella, raining } from './rain-rules.ts';

// ---------- schedule ----------
export type FeiraKind = 'feira' | 'feirinha';
export type FeiraPhase = 'none' | 'setup' | 'open' | 'packing';
/** Local hours: stalls go up from `setup`, trade `open`..`close`, are gone by `packed`. */
export interface FeiraDay { kind: FeiraKind; setup: number; open: number; close: number; packed: number }

/** Weekday (0 = Sunday) -> that day's market. Assumed art direction (see the header). */
export const FEIRA_DAYS: Readonly<Record<number, FeiraDay>> = {
  6: { kind: 'feira', setup: 5, open: 5.5, close: 12.5, packed: 13.5 },
  3: { kind: 'feirinha', setup: 5.5, open: 6, close: 11, packed: 11.75 },
};
/** The feirinha draws this share of the Saturday crowd. */
export const FEIRINHA_K = 0.4;

export interface FeiraState {
  phase: FeiraPhase;
  kind: FeiraKind | null;
  /** Shopper level 0..1 (the cap is MAX_SHOPPERS * flow). */
  flow: number;
  /** How full the stalls are 0..1 (crates going up at dawn, the xepa near the end). */
  stock: number;
  /** Stall frames stand / the tarps are up. */
  frames: boolean;
  tarps: boolean;
}

const NONE: FeiraState = { phase: 'none', kind: null, flow: 0, stock: 0, frames: false, tarps: false };
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/** Saturday shopper curve over the open hours: a quick dawn rise, the 07-10h peak, a long tail. */
function openFlow(d: FeiraDay, h: number): number {
  const peak0 = d.open + 1.5, peak1 = d.open + 4.5;
  if (h < peak0) return lerp(0.45, 1, (h - d.open) / (peak0 - d.open));
  if (h < peak1) return 1;
  return lerp(1, 0.5, (h - peak1) / (d.close - peak1));
}

/** Where the market is at a local weekday and fractional hour. */
export function feiraState(weekday: number, hour: number): FeiraState {
  const d = FEIRA_DAYS[weekday];
  if (!d || !Number.isFinite(hour) || hour < d.setup || hour >= d.packed) return NONE;
  const k = d.kind === 'feirinha' ? FEIRINHA_K : 1;
  if (hour < d.open) {
    const t = (hour - d.setup) / (d.open - d.setup);
    return { phase: 'setup', kind: d.kind, flow: 0, stock: t, frames: true, tarps: t > 0.3 };
  }
  if (hour < d.close) {
    const xepa = Math.max(0, (hour - (d.close - 2)) / 2); // the last two hours sell the stalls down
    return { phase: 'open', kind: d.kind, flow: openFlow(d, hour) * k, stock: 1 - 0.35 * Math.min(1, xepa), frames: true, tarps: true };
  }
  const t = (hour - d.close) / (d.packed - d.close);
  return { phase: 'packing', kind: d.kind, flow: lerp(0.5, 0, t / 0.7) * k, stock: 0.65 * (1 - t), frames: true, tarps: t < 0.6 };
}

// ---------- crowd ----------
/** Most shoppers (and porters) in the feira at once, at the Saturday peak in dry weather. */
export const MAX_SHOPPERS = 30;
/** Real rain thins the crowd to this share. */
export const RAIN_K = 0.5;

export interface FeiraWx { kind: WxState; rain: number; snow: number }
/** Genuine (or #wx= test) rain; unknown weather is never wet. */
export const feiraWet = (wx: FeiraWx) => raining(wx.kind, wx.rain, wx.snow);

/** Shopper cap for a flow level and the real rain state. */
export function shopperCap(flow: number, wet: boolean): number {
  if (!(flow > 0)) return 0;
  return Math.max(0, Math.min(MAX_SHOPPERS, Math.round(MAX_SHOPPERS * Math.min(1, flow) * (wet ? RAIN_K : 1))));
}

/** Extra density for the ordinary sidewalk walkers while the market draws people into the street. */
export const walkerBoost = (flow: number) => 1 + 0.6 * Math.min(1, Math.max(0, flow));

// ---------- layout ----------
export type Goods = 'laranja' | 'banana' | 'tomate' | 'verdura' | 'melao' | 'melancia' | 'batata' | 'cebola' | 'abacaxi' | 'pimentao';
export interface Row {
  /** Table across, metres. */
  X0: number; X1: number;
  /** Where the vendor stands, and the shoppers at the counter. */
  vendorX: number; spotX: number;
  /** +1 if the aisle is toward larger X from the table (the wall row), -1 otherwise. */
  side: 1 | -1;
}
export const ROW_W: Row = { X0: -20, X1: -18.4, vendorX: -20.45, spotX: -17.8, side: 1 };
export const ROW_E: Row = { X0: -11.6, X1: -10, vendorX: -9.5, spotX: -12.2, side: -1 };
/** Walking lanes in the aisle (a shopper keeps one lane while walking). */
export const AISLE = { X0: -16.7, X1: -15.3 } as const;
/** Shoppers enter or leave at these depths (the near one is just off screen to the left, behind the pickup). */
export const NEAR_Z = 15, FAR_Z = 66;
/** Past this depth, walking away, most turn back toward the viewer. */
export const TURN_Z = 60.5;
/** The traffic carriageway starts at the median's left kerb: nobody of the feira goes past it. */
export const ROAD_X = -6.2;
/** The wall's face: nobody goes left of it. */
export const WALL_X = -22;

export interface Box { X0: number; X1: number; z0: number; z1: number }
export interface Stall extends Box { id: number; row: 'W' | 'E'; goods: Goods[]; seed: number; /** Also set up for the Wednesday feirinha. */ small: boolean; /** A second hand helps here. */ helper: boolean }

/** Parked vehicles and props on the feira's carriageway: the white pickup and the dark car of the
    scene, the market's unloading truck, a parked moto with a crate and two wheelbarrows. */
export const VEHICLES: Readonly<Record<'pickup' | 'car' | 'truck' | 'moto', Box>> = {
  pickup: { X0: -15.9, X1: -14.1, z0: 13.4, z1: 18.8 },
  car: { X0: -14.35, X1: -12.55, z0: 30.8, z1: 35.4 },
  truck: { X0: -14.45, X1: -12.75, z0: 62, z1: 67 },
  moto: { X0: -12.6, X1: -12, z0: 35.6, z1: 37.4 },
};
export const BARROWS: readonly Box[] = [
  { X0: -20, X1: -19.2, z0: 18.8, z1: 20.3 },
  { X0: -11.4, X1: -10.6, z0: 28.4, z1: 29.9 },
];
/** The pickup's half of the aisle: near it, lanes squeeze toward the wall. */
const SQUEEZE = { X: -16.35, z0: 20.2, z1: 21.8 };

const GOODS: readonly Goods[][] = [
  ['laranja', 'banana', 'tomate'], ['verdura', 'cebola', 'pimentao'], ['melancia', 'melao'], ['banana', 'abacaxi', 'laranja'],
  ['tomate', 'batata', 'cebola'], ['verdura', 'tomate'], ['melao', 'laranja', 'banana'], ['abacaxi', 'melancia'],
  ['batata', 'cebola', 'verdura'], ['laranja', 'tomate', 'pimentao'],
];

function hash(n: number): number {
  let x = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d); x ^= x >>> 15; x = Math.imul(x, 0x165667b1); x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

const STALL_LEN = 2.6;
function makeStalls(): Stall[] {
  const out: Stall[] = [];
  const add = (row: 'W' | 'E', z0: number, small: boolean) => {
    const r = row === 'W' ? ROW_W : ROW_E, id = out.length, seed = hash(id + 11);
    out.push({ id, row, X0: r.X0, X1: r.X1, z0, z1: z0 + STALL_LEN, goods: GOODS[Math.floor(hash(id + 3) * GOODS.length)], seed, small, helper: id % 4 === 1 });
  };
  for (let i = 0; i < 11; i++) add('W', 21 + i * 3.5, i === 0 || i === 2 || i === 4);
  // the median row leaves room for the dark car and the moto parked beside it
  for (const z of [21, 24.5]) add('E', z, z === 21);
  for (let i = 0; i < 6; i++) add('E', 38 + i * 3.5, i === 1);
  return out;
}
/** Every stall of the Saturday feira (ids are indices). */
export const STALLS: readonly Stall[] = makeStalls();
/** The stalls standing for a kind of market. */
export const stallsFor = (kind: FeiraKind | null): readonly Stall[] => (kind === 'feira' ? STALLS : kind === 'feirinha' ? STALLS.filter((s) => s.small) : []);

export const rowOf = (s: Stall) => (s.row === 'W' ? ROW_W : ROW_E);

/** Counter places at a stall: two at the counter, one waiting a step further out. */
export const COUNTER = 2, SLOTS = 3;
export function slotPos(s: Stall, slot: number): { X: number; z: number } {
  const r = rowOf(s), zc = (s.z0 + s.z1) / 2;
  if (slot < COUNTER) return { X: r.spotX, z: zc + (slot === 0 ? -0.65 : 0.65) };
  return { X: r.spotX + r.side * 0.75, z: zc };
}

/** The lane's X at depth z: by the pickup the aisle narrows toward the wall. */
export function laneX(lane: number, z: number): number {
  const sq = Math.min(lane, SQUEEZE.X);
  if (z <= SQUEEZE.z0) return sq;
  if (z >= SQUEEZE.z1) return lane;
  return sq + (lane - sq) * ((z - SQUEEZE.z0) / (SQUEEZE.z1 - SQUEEZE.z0));
}

/** Every box a person must stay out of (stall tables, vehicles, wheelbarrows). */
export const obstacles = (stalls: readonly Stall[]): Box[] => [...stalls, ...Object.values(VEHICLES), ...BARROWS];
/** Whether a point is inside a box grown by `pad` metres (a person's half-width). */
export const inside = (b: Box, X: number, z: number, pad = 0.2) => X > b.X0 - pad && X < b.X1 + pad && z > b.z0 - pad && z < b.z1 + pad;

/**
 * Draw order for a person in this one-point view. Everything here is left of the camera, so a box
 * (stall or parked vehicle, drawn with key z1) hides whatever stands on its far, wall side within
 * its depth: such a person is drawn first (key past z1). Anyone else keeps their own depth.
 */
export function sortZ(X: number, z: number, boxes: readonly Box[]): number {
  let k = z;
  for (const b of boxes) if (X < b.X0 && z > b.z0 - 0.3 && z < b.z1 + 0.3) k = Math.max(k, b.z1 + 0.02);
  return k;
}

// ---------- vendors ----------
export type VendorPose = 'call' | 'weigh' | 'bag' | 'arrange' | 'idle' | 'carry';
/** What a stall's vendor is doing at time t (seconds): serving whoever is at the counter, calling
    out prices, arranging crates or just waiting; arranging and carrying while setting up or packing. */
export function vendorPose(seed: number, t: number, phase: FeiraPhase, serving: boolean): VendorPose {
  if (phase === 'setup' || phase === 'packing') return hash(Math.floor(t / 3 + seed * 977)) < 0.55 ? 'carry' : 'arrange';
  if (phase !== 'open') return 'idle';
  if (serving) return Math.floor(t / 1.6 + seed * 10) % 2 ? 'bag' : 'weigh';
  const r = hash(Math.floor(t / 4 + seed * 7919));
  return r < 0.35 ? 'call' : r < 0.6 ? 'arrange' : 'idle';
}

/** The unloader between the truck's tail and the last wall stall: 0 at the truck, 1 at the stall. */
export function unloaderAt(t: number): { u: number; loaded: boolean } {
  const T = 9, p = ((t % T) + T) % T / T; // walk there with a crate, walk back empty
  return p < 0.5 ? { u: p * 2, loaded: true } : { u: 2 - p * 2, loaded: false };
}

// ---------- shoppers ----------
export type ShopState = 'walk' | 'go' | 'wait' | 'buy' | 'back' | 'follow';
export type Carry = 'bag' | 'basket' | 'trolley' | 'barrow' | 'none';
export type Age = 'adult' | 'elder' | 'child';
export interface Shopper {
  on: boolean; X: number; z: number; dz: 1 | -1; lane: number; sp: number; ph: number;
  state: ShopState; t: number; stall: number; slot: number;
  /** Stalls already considered (bit per stall id), stops made and planned. */
  seen: number; visits: number; want: number; turned: boolean;
  /** Index of the shopper this one walks with (a partner, a child), or -1. */
  lead: number;
  age: Age; carry: Carry; load: number; umbrella: boolean;
  /** Stable look seed (colours are picked by the scene). */
  look: number;
}

export function makeShoppers(n: number): Shopper[] {
  return Array.from({ length: n }, () => ({
    on: false, X: 0, z: 0, dz: 1 as 1 | -1, lane: -16, sp: 1, ph: 0, state: 'walk' as ShopState, t: 0, stall: -1, slot: -1,
    seen: 0, visits: 0, want: 0, turned: false, lead: -1, age: 'adult' as Age, carry: 'bag' as Carry, load: 0, umbrella: false, look: 0,
  }));
}

export interface FeiraCtx { state: FeiraState; wet: boolean; wx: FeiraWx; stalls: readonly Stall[] }

/** Chance of stopping at a stall the first time a shopper walks past it. */
export const P_STOP = 0.55;
/** Seconds at the counter (choosing, weighing, paying), and the most anyone waits for a place. */
export const BUY_S: readonly [number, number] = [4, 10];
export const PATIENCE_S = 14;

/** Who is at a stall's slots right now (index -1 = free). */
export function slotUsers(list: readonly Shopper[], stall: number): number[] {
  const used = [-1, -1, -1];
  list.forEach((p, i) => { if (p.on && p.stall === stall && p.slot >= 0 && p.lead < 0) used[p.slot] = i; });
  return used;
}
/** Whether someone stands at the counter of a stall (its vendor is serving). */
export const serving = (list: readonly Shopper[], stall: number) =>
  list.some((p) => p.on && p.lead < 0 && p.stall === stall && p.slot >= 0 && p.slot < COUNTER && p.state === 'buy');

/** Shoppers on the feira (walking with someone counts too). */
export const activeShoppers = (list: readonly Shopper[]) => list.filter((p) => p.on).length;

/** Starts a shopper (and maybe a partner or a child) if the cap and the pool allow. */
export function spawnShopper(list: Shopper[], ctx: FeiraCtx, rnd: () => number): boolean {
  const cap = shopperCap(ctx.state.flow, ctx.wet);
  if (ctx.state.phase !== 'open' && ctx.state.phase !== 'packing') return false;
  const free = list.map((p, i) => (p.on ? -1 : i)).filter((i) => i >= 0);
  const room = Math.min(free.length, cap - activeShoppers(list));
  if (room < 1) return false;
  const g = rnd(), group = room >= 2 ? (g < 0.22 ? 'couple' : g < 0.34 ? 'family' : 'single') : 'single';
  const porter = group === 'single' && rnd() < 0.08;
  const near = porter ? rnd() < 0.3 : rnd() < 0.65;
  const lead = list[free[0]];
  const elder = !porter && rnd() < 0.2;
  Object.assign(lead, {
    on: true, dz: near ? 1 : -1, lane: AISLE.X0 + rnd() * (AISLE.X1 - AISLE.X0), state: 'walk', t: 0, stall: -1, slot: -1,
    seen: 0, visits: 0, want: porter ? 0 : 1 + Math.floor(rnd() * 3), turned: false, lead: -1, age: elder ? 'elder' : 'adult',
    carry: porter ? 'barrow' : (['bag', 'bag', 'basket', 'trolley'] as const)[Math.floor(rnd() * 4)], load: porter ? 1 : 0,
    umbrella: !porter && opensUmbrella(ctx.wx.kind, ctx.wx.rain, ctx.wx.snow, rnd()), look: Math.floor(rnd() * 1e6), ph: rnd() * 4,
  } satisfies Partial<Shopper>);
  lead.sp = porter ? 1.15 : elder ? 0.7 + rnd() * 0.2 : 1 + rnd() * 0.3;
  lead.z = near ? NEAR_Z : FAR_Z - rnd() * 3;
  lead.X = laneX(lead.lane, lead.z);
  if (group !== 'single') {
    const f = list[free[1]];
    Object.assign(f, {
      on: true, dz: lead.dz, lane: lead.lane, sp: lead.sp, state: 'follow', t: 0, stall: -1, slot: -1, seen: 0, visits: 0, want: 0,
      turned: false, lead: free[0], age: group === 'family' ? 'child' : lead.age, carry: group === 'family' ? 'none' : rnd() < 0.5 ? 'bag' : 'none',
      load: 0, umbrella: group === 'couple' && lead.umbrella && rnd() < 0.5, look: Math.floor(rnd() * 1e6), ph: rnd() * 4,
    } satisfies Partial<Shopper>);
    const at = followSpot(lead); f.X = at.X; f.z = at.z;
  }
  return true;
}

/** Where a follower stands: half a step behind and toward the wall while walking, beside the leader
    (on the aisle side) at a stall. */
function followSpot(lead: Shopper): { X: number; z: number } {
  if (lead.state === 'walk') return { X: lead.X - 0.5, z: lead.z - lead.dz * 0.7 };
  const st = STALLS[lead.stall];
  const side = st ? rowOf(st).side : 1;
  return { X: lead.X + side * 0.55, z: lead.z - 0.3 };
}

/** Moves (X, z) toward a target by at most `step`; returns true once there. */
function toward(p: { X: number; z: number }, tx: number, tz: number, step: number): boolean {
  const dx = tx - p.X, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d <= Math.max(0, step)) { p.X = tx; p.z = tz; return true; }
  if (!(step > 0)) return false;
  p.X += (dx / d) * step; p.z += (dz / d) * step;
  return false;
}

/**
 * One tick for every shopper. Walking: along their lane; the first time they pass a stall they may
 * stop, taking a free counter place or the waiting place (a full stall is passed by). At the
 * counter they buy for a few seconds and step back into their lane; the one waiting moves up when
 * a counter place frees, or gives up after a while. Followers keep beside their leader. When the
 * market is packing up nobody new stops; when it is over they all just walk out.
 */
export function stepShoppers(list: Shopper[], dt: number, ctx: FeiraCtx, rnd: () => number) {
  if (!(dt > 0)) return; // time never runs backwards here (a clock jump can give a negative step)
  const trading = ctx.state.phase === 'open' || ctx.state.phase === 'packing';
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p.on || p.lead >= 0) continue;
    const step = p.sp * dt;
    if (p.state === 'walk') {
      p.z += p.dz * step; p.X = laneX(p.lane, p.z); p.ph += step * 3;
      if (p.dz > 0 && !p.turned && p.z > TURN_Z) { p.turned = true; if (rnd() < 0.7) p.dz = -1; }
      if (p.z < NEAR_Z - 0.5 || p.z > FAR_Z + 0.5) { p.on = false; continue; }
      if (!trading || p.visits >= p.want) continue;
      for (const s of ctx.stalls) {
        const bit = 2 ** s.id;
        if (Math.floor(p.seen / bit) % 2 || p.z < s.z0 + 0.4 || p.z > s.z1 - 0.4) continue;
        p.seen += bit;
        if (rnd() >= P_STOP) continue;
        const used = slotUsers(list, s.id);
        const slot = used[0] < 0 ? 0 : used[1] < 0 ? 1 : used[2] < 0 ? 2 : -1;
        if (slot < 0) continue; // busy stall: walk on
        p.stall = s.id; p.slot = slot; p.state = 'go'; p.t = 0;
        break;
      }
    } else if (p.state === 'go') {
      const at = slotPos(STALLS[p.stall], p.slot);
      p.ph += step * 3;
      if (toward(p, at.X, at.z, step)) { p.state = p.slot < COUNTER ? 'buy' : 'wait'; p.t = p.slot < COUNTER ? BUY_S[0] + rnd() * (BUY_S[1] - BUY_S[0]) : 0; }
    } else if (p.state === 'wait') {
      p.t += dt;
      const used = slotUsers(list, p.stall), free = used[0] < 0 ? 0 : used[1] < 0 ? 1 : -1;
      if (free >= 0) { p.slot = free; p.state = 'go'; }
      else if (p.t > PATIENCE_S || !trading) { p.state = 'back'; p.slot = -1; }
    } else if (p.state === 'buy') {
      p.t -= dt;
      if (p.t <= 0) { p.visits++; p.load++; p.state = 'back'; p.slot = -1; }
    } else if (p.state === 'back') {
      p.ph += step * 3;
      if (toward(p, laneX(p.lane, p.z), p.z, step)) { p.state = 'walk'; p.stall = -1; }
    }
    if (!trading && p.state === 'walk') p.want = 0;
  }
  // whoever waits moves up as soon as a counter place frees (also one freed later in this tick)
  for (const p of list) {
    if (!p.on || p.lead >= 0 || p.state !== 'wait') continue;
    const used = slotUsers(list, p.stall), free = used[0] < 0 ? 0 : used[1] < 0 ? 1 : -1;
    if (free >= 0) { p.slot = free; p.state = 'go'; }
  }
  // followers keep beside (or just behind) their leader
  for (const f of list) {
    if (!f.on || f.lead < 0) continue;
    const l = list[f.lead];
    if (!l.on) { f.on = false; continue; }
    f.dz = l.dz; f.stall = l.state === 'walk' ? -1 : l.stall;
    const at = followSpot(l), moved = !toward(f, at.X, at.z, l.sp * 1.4 * dt);
    if (moved || l.state === 'walk') f.ph += l.sp * dt * 3;
  }
}

/** Whether a shopper is on the move (legs swing) or standing. */
export const moving = (p: Shopper, list: readonly Shopper[]) => {
  const l = p.lead >= 0 ? list[p.lead] : p;
  return l.state === 'walk' || l.state === 'go' || l.state === 'back';
};
