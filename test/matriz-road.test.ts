// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CROSS1, STOP_ROW, Y_ENTRY, Y_EXIT, type RoadCar, gapAt, spawnAway, stepRoad } from '../src/actors/matriz-road.ts';

const pool = (n = 7): RoadCar[] => Array.from({ length: n }, () => ({ on: false, y: 0, sp: 1 }));
const car = (y: number, sp = 1): RoadCar => ({ on: true, y, sp });
/** Deterministic random for long runs (no Math.random). */
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test('the Matriz spawner only produces vehicles going away, entering below the frame', () => {
  const cars = pool(), r = lcg(7);
  let spawned = 0;
  for (let i = 0; i < 30 * 600; i++) {
    if (r() < 0.05) {
      const c = spawnAway(cars);
      if (c) { spawned++; assert.equal(c.y, Y_ENTRY); assert.ok(Y_ENTRY > 180, 'entry is below the 180-row frame'); c.sp = 0.85 + r() * 0.5; }
    }
    const before = cars.map((c) => c.y), occupied = Math.floor(i / 90) % 3 === 0;
    stepRoad(cars, 1 / 30, occupied);
    cars.forEach((c, j) => { if (c.on) assert.ok(c.y <= before[j], `vehicle ${j} moved toward the viewer: ${before[j]} -> ${c.y}`); });
  }
  assert.ok(spawned > 50, `spawned ${spawned}`);
});

test('a full pool or a blocked entry spawns nothing', () => {
  const full = [car(150), car(160)];
  assert.equal(spawnAway(full), null);
  const blocked = [car(Y_ENTRY - 1), { on: false, y: 0, sp: 1 }];
  assert.equal(spawnAway(blocked), null);
  assert.equal(blocked[1].on, false);
});

test('vehicles stop at the line before an occupied zebra and queue without overlapping', () => {
  const cars = pool(4);
  for (let i = 0; i < 30 * 40; i++) { if (i % 30 === 0) { const c = spawnAway(cars); if (c) c.sp = 1 + (i % 90) / 180; } stepRoad(cars, 1 / 30, true); }
  const on = cars.filter((c) => c.on);
  assert.ok(on.length >= 2, `${on.length} held`); // the queue then blocks the entry, so no more join
  const ys = on.map((c) => c.y).sort((a, b) => a - b);
  assert.ok(Math.abs(ys[0] - STOP_ROW) < 0.01, `leader at ${ys[0]}`);
  assert.ok(ys[0] > CROSS1, 'held short of the stripes');
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= gapAt(ys[i]) - 1e-9, `queue gap ${ys[i] - ys[i - 1]}`);
});

test('a clear zebra holds no one; vehicles leave past the church', () => {
  const cars = [car(Y_ENTRY), car(160)];
  for (let i = 0; i < 30 * 60; i++) stepRoad(cars, 1 / 30, false);
  assert.ok(cars.every((c) => !c.on));
});

test('a negative or zero tick (first animation frame) never rolls a vehicle back', () => {
  const c = car(160);
  for (const dt of [-0.004, 0, Number.NaN]) { stepRoad([c], dt, false); assert.equal(c.y, 160); }
});

test('a vehicle already past its stop line carries on across', () => {
  const c = car(STOP_ROW - 2);
  stepRoad([c], 0.5, true);
  assert.ok(c.y < STOP_ROW - 2);
  // and it eventually leaves at the exit row
  for (let i = 0; i < 30 * 60 && c.on; i++) stepRoad([c], 1 / 30, true);
  assert.equal(c.on, false);
  assert.ok(Y_EXIT < STOP_ROW);
});

test('praca-matriz draws one-way traffic: no direction field, no headlights, no centre line', () => {
  const src = readFileSync(new URL('../src/scenes/praca-matriz.ts', import.meta.url), 'utf8');
  const iface = /interface RCar \{([^}]*)\}/.exec(src);
  assert.ok(iface, 'RCar declared');
  assert.ok(!/\bdir\b/.test(iface![1]), 'RCar has no direction (every vehicle goes away)');
  assert.ok(src.includes('spawnAway(RC)'), 'spawns through the one-way rule');
  assert.ok(!/headlight|Y_NEAR|laneU|dashed centre line/i.test(src), 'no oncoming leftovers');
  // Decorama's one-way runs left to right and is not touched by this rule
  assert.ok(!readFileSync(new URL('../src/scenes/centro-teatro.ts', import.meta.url), 'utf8').includes('matriz-road'));
});
