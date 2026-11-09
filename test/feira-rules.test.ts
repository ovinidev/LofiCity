// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AISLE, BARROWS, COUNTER, type FeiraCtx, FEIRA_DAYS, MAX_SHOPPERS, ROAD_X, STALLS, VEHICLES, WALL_X, activeShoppers, feiraState, feiraWet,
  inside, laneX, makeShoppers, obstacles, shopperCap, slotPos, slotUsers, sortZ, spawnShopper, stallsFor, stepShoppers, unloaderAt, vendorPose,
  walkerBoost,
} from '../src/actors/feira-rules.ts';

function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const dry = { kind: 'live' as const, rain: 0, snow: 0 };
const ctxAt = (weekday: number, hour: number, wx = dry): FeiraCtx => {
  const state = feiraState(weekday, hour);
  return { state, wet: feiraWet(wx), wx, stalls: stallsFor(state.kind) };
};

test('the full feira runs on Saturday mornings only: setup, open, packing, then nothing', () => {
  assert.equal(feiraState(6, 4).phase, 'none'); assert.equal(feiraState(6, 4.9).phase, 'none');
  assert.equal(feiraState(6, 5).phase, 'setup');
  for (const h of [5.5, 6.5, 8.5, 11.5, 12.4]) assert.equal(feiraState(6, h).phase, 'open', `${h}h`);
  assert.equal(feiraState(6, 13).phase, 'packing');
  for (const h of [13.5, 14, 17, 21]) assert.equal(feiraState(6, h).phase, 'none', `${h}h`);
  assert.equal(feiraState(6, 8).kind, 'feira');
  assert.equal(feiraState(3, 8).kind, 'feirinha');
  for (const d of [0, 1, 2, 4, 5]) for (let h = 0; h < 24; h += 0.25) assert.equal(feiraState(d, h).phase, 'none', `day ${d} ${h}h`);
});

test('nothing at night, on any day', () => {
  for (let d = 0; d < 7; d++) for (const h of [0, 1, 2, 3, 4, 18, 19, 20, 22, 23.9]) {
    const s = feiraState(d, h);
    assert.equal(s.phase, 'none'); assert.equal(s.frames, false); assert.equal(shopperCap(s.flow, false), 0);
  }
});

test('the Saturday crowd peaks 07-10h and thins at both ends; the feirinha stays smaller', () => {
  const f = (h: number) => feiraState(6, h).flow;
  assert.equal(f(8), 1); assert.equal(f(9.5), 1);
  assert.ok(f(5.6) < 0.6 && f(12.3) < 0.6 && f(13.2) < f(12.3));
  assert.equal(feiraState(6, 5).flow, 0, 'no shoppers while the stalls go up');
  for (let h = 6; h < 11; h += 0.5) assert.ok(feiraState(3, h).flow <= 0.4 + 1e-9);
  assert.equal(shopperCap(f(8), false), MAX_SHOPPERS);
  assert.ok(shopperCap(feiraState(3, 8).flow, false) < MAX_SHOPPERS / 2);
  assert.ok(stallsFor('feirinha').length < stallsFor('feira').length && stallsFor('feirinha').length >= 3);
  assert.equal(stallsFor(null).length, 0);
});

test('stock goes up at dawn and sells down near the end; tarps follow the phase', () => {
  assert.ok(feiraState(6, 5.1).stock < feiraState(6, 5.4).stock);
  assert.equal(feiraState(6, 8).stock, 1);
  assert.ok(feiraState(6, 12.4).stock < 0.75);
  assert.ok(feiraState(6, 13.4).stock < feiraState(6, 12.6).stock);
  assert.equal(feiraState(6, 5.05).tarps, false); assert.equal(feiraState(6, 8).tarps, true); assert.equal(feiraState(6, 13.4).tarps, false);
});

test('real rain thins the crowd; unknown weather changes nothing', () => {
  assert.ok(shopperCap(1, true) < shopperCap(1, false));
  assert.equal(feiraWet({ kind: 'unavailable', rain: 1, snow: 0 }), false);
  assert.equal(feiraWet({ kind: 'live', rain: 0.6, snow: 0 }), true);
  assert.equal(feiraWet({ kind: 'override', rain: 0.6, snow: 0 }), true);
  assert.equal(shopperCap(0.8, feiraWet({ kind: 'unavailable', rain: 1, snow: 0 })), shopperCap(0.8, false));
  assert.equal(walkerBoost(0), 1); assert.ok(walkerBoost(1) > 1);
});

test('the layout: stalls do not overlap each other, the vehicles or the aisle, and stay off the road', () => {
  const all = [...STALLS, ...Object.values(VEHICLES), ...BARROWS];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    assert.ok(a.X1 <= b.X0 || b.X1 <= a.X0 || a.z1 <= b.z0 || b.z1 <= a.z0, `boxes ${i} and ${j} overlap`);
  }
  for (const s of STALLS) {
    assert.ok(s.X0 > WALL_X + 1.2 && s.X1 < ROAD_X, `stall ${s.id} across`);
    assert.ok(s.X1 + 0.2 < AISLE.X0 - 0.2 || s.X0 - 0.2 > AISLE.X1 + 0.2, `stall ${s.id} in the aisle`);
    for (let k = 0; k < 3; k++) {
      const p = slotPos(s, k);
      for (const b of obstacles(STALLS)) assert.ok(!inside(b, p.X, p.z), `stall ${s.id} slot ${k} blocked`);
    }
  }
  for (let z = 7; z < 67; z += 0.25) for (const lane of [AISLE.X0, (AISLE.X0 + AISLE.X1) / 2, AISLE.X1]) {
    const X = laneX(lane, z);
    for (const b of obstacles(STALLS)) assert.ok(!inside(b, X, z), `lane ${lane} at z ${z} hits a box`);
  }
});

test('draw order: whoever stands on the wall side of a box within its depth is drawn before it', () => {
  const s = STALLS[0];
  assert.ok(sortZ(-20.45, (s.z0 + s.z1) / 2, [s]) > s.z1, 'the wall-row vendor is behind the table');
  assert.equal(sortZ(-17.8, 22, [s]), 22, 'a shopper at the counter is in front of it');
  assert.equal(sortZ(-17.8, 40, [s]), 40);
});

test('vendors serve when someone is at the counter, and only work the crates while setting up or packing', () => {
  for (let t = 0; t < 60; t += 0.7) {
    assert.ok(['weigh', 'bag'].includes(vendorPose(0.3, t, 'open', true)));
    assert.ok(['call', 'arrange', 'idle'].includes(vendorPose(0.3, t, 'open', false)));
    assert.ok(['carry', 'arrange'].includes(vendorPose(0.7, t, 'setup', false)));
    assert.equal(vendorPose(0.7, t, 'none', false), 'idle');
  }
  const poses = new Set(Array.from({ length: 200 }, (_, i) => vendorPose(0.42, i * 1.3, 'open', false)));
  assert.equal(poses.size, 3, 'they call, arrange and wait over time');
  for (let t = 0; t < 20; t += 0.1) { const u = unloaderAt(t).u; assert.ok(u >= 0 && u <= 1); }
});

/** A long Saturday run: every invariant holds at every tick. */
function run(hourFrom: number, hourTo: number, wx = dry, seed = 7) {
  const list = makeShoppers(MAX_SHOPPERS + 4), rnd = lcg(seed), dt = 1 / 15;
  let maxOn = 0, buys = 0, waits = 0, stops = 0;
  for (let t = 0; hourFrom + t / 3600 < hourTo; t += dt) {
    const h = hourFrom + t / 3600, ctx = ctxAt(6, h, wx), cap = shopperCap(ctx.state.flow, ctx.wet);
    if (Math.floor(t / 0.8) !== Math.floor((t - dt) / 0.8)) spawnShopper(list, ctx, rnd);
    stepShoppers(list, dt, ctx, rnd);
    const on = activeShoppers(list);
    maxOn = Math.max(maxOn, on);
    assert.ok(on <= Math.max(cap, 0) + 1 || ctx.state.flow < feiraState(6, h - 0.05).flow, `${on} shoppers over the cap ${cap} at ${h.toFixed(2)}h`);
    const boxes = obstacles(ctx.stalls);
    for (const p of list) {
      if (!p.on) continue;
      assert.ok(p.X > WALL_X + 1.2 && p.X < ROAD_X - 0.3, `shopper off the feira at X ${p.X.toFixed(2)}`);
      for (const b of boxes) assert.ok(!inside(b, p.X, p.z, 0.15), `shopper inside a box at ${p.X.toFixed(2)}, ${p.z.toFixed(2)} (${p.state})`);
      if (p.state === 'buy') buys++;
      if (p.state === 'wait') waits++;
    }
    for (const s of ctx.stalls) {
      const users = list.filter((p) => p.on && p.lead < 0 && p.stall === s.id && p.slot >= 0);
      const slots = users.map((p) => p.slot);
      assert.equal(new Set(slots).size, slots.length, `two shoppers on one slot at stall ${s.id}`);
      assert.ok(users.filter((p) => p.slot < COUNTER).length <= COUNTER);
      assert.ok(users.length <= 3);
      if (users.some((p) => p.slot === 2 && p.state === 'wait')) assert.ok(slotUsers(list, s.id)[0] >= 0 && slotUsers(list, s.id)[1] >= 0, 'waiting while the counter has room');
      stops += users.length;
    }
  }
  return { maxOn, buys, waits, stops, list };
}

test('a busy Saturday morning: shoppers fill the feira up to the cap, buy and queue, inside the aisle and counters only', () => {
  const r = run(7, 7.6);
  assert.ok(r.maxOn >= MAX_SHOPPERS - 4, `only ${r.maxOn} shoppers at the peak`);
  assert.ok(r.buys > 0 && r.stops > 0);
});

test('rain (real) keeps the crowd thinner and gives umbrellas; the end of the market empties the street', () => {
  const wet = run(8, 8.4, { kind: 'live', rain: 0.6, snow: 0 }, 3);
  assert.ok(wet.maxOn <= shopperCap(1, true) + 1);
  assert.ok(wet.list.some((p) => p.umbrella));
  const end = run(13.2, 13.75, dry, 5);
  assert.equal(activeShoppers(end.list), 0, 'everyone has left once the feira is packed away');
  const dryRun = run(8, 8.2, dry, 3);
  assert.ok(!dryRun.list.some((p) => p.umbrella));
});

test('no shoppers outside the market hours', () => {
  const list = makeShoppers(10), rnd = lcg(1);
  for (const [d, h] of [[6, 4.8], [6, 15], [0, 9], [5, 9], [3, 12], [6, 22]] as const) assert.equal(spawnShopper(list, ctxAt(d, h), rnd), false, `day ${d} ${h}h`);
  assert.ok(Object.keys(FEIRA_DAYS).length === 2);
});

test('a zero or negative time step (a clock jump) never moves anyone or breaks a position', () => {
  const list = makeShoppers(12), rnd = lcg(9), ctx = ctxAt(6, 8.5);
  for (let i = 0; i < 400; i++) { if (i % 10 === 0) spawnShopper(list, ctx, rnd); stepShoppers(list, 1 / 15, ctx, rnd); }
  const snap = JSON.stringify(list);
  stepShoppers(list, -0.3, ctx, rnd); stepShoppers(list, 0, ctx, rnd);
  assert.equal(JSON.stringify(list), snap);
  for (let i = 0; i < 400; i++) { stepShoppers(list, i % 3 ? 1 / 30 : -1 / 30, ctx, rnd); for (const p of list) if (p.on) assert.ok(Number.isFinite(p.X + p.z)); }
});
