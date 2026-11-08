// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type DepthCar, type DepthRoad, canEnter, carsOnCrossing, frontZ, stepDepthCars } from '../src/actors/persp-rules.ts';

// Rua Faustino Porto's zebra: stripes from 10.3 m to 15.5 m, stop lines 1.2 m out.
const road = (occupied: boolean, crossing = true): DepthRoad => ({
  zNear: 3, zFar: 140, gap: 1.6, stopGap: 1.2, crossing: crossing ? { z0: 10.3, z1: 15.5, occupied } : null,
});
const car = (z: number, dir: 1 | -1, len = 4.2, cruise = 8): DepthCar => ({ on: true, z, dir, sp: cruise, cruise, len });

/** Deterministic spawner for long runs (no Math.random). */
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test('vehicles stop at the line before an occupied zebra, in both directions', () => {
  const r = road(true), away = car(4, 1), oncoming = car(40, -1);
  for (let i = 0; i < 600; i++) stepDepthCars([away, oncoming], 1 / 30, r);
  assert.ok(frontZ(away) <= 10.3 - 1.2 + 1e-9, `away front at ${frontZ(away)}`);
  assert.ok(frontZ(away) > 10.3 - 1.2 - 0.5, 'away car rolled up to its line');
  assert.ok(frontZ(oncoming) >= 15.5 + 1.2 - 1e-9, `oncoming front at ${frontZ(oncoming)}`);
  assert.ok(away.on && oncoming.on);
  assert.ok(!carsOnCrossing([away, oncoming], { ...r, stopGap: 0 }));
});

test('a clear zebra holds no one, and vehicles leave at the far ends', () => {
  const r = road(false), away = car(4, 1), oncoming = car(40, -1);
  for (let i = 0; i < 30 * 60; i++) stepDepthCars([away, oncoming], 1 / 30, r);
  assert.equal(away.on, false);
  assert.equal(oncoming.on, false);
});

test('a vehicle already past its stop line carries on across', () => {
  const r = road(true), v = car(10, 1); // front at 12.1, beyond the 9.1 line
  stepDepthCars([v], 0.5, r);
  assert.ok(v.z > 10);
});

test('vehicles in a lane never overlap or overtake, queueing behind a stopped one', () => {
  const r: DepthRoad = { ...road(true), crossing: { z0: 30, z1: 35, occupied: true } };
  const lead = car(15, 1, 4.2, 6), next = car(8, 1, 2, 10); // a moto catching up with a car that will stop
  for (let i = 0; i < 300; i++) {
    stepDepthCars([lead, next], 1 / 30, r);
    assert.ok(next.z < lead.z, 'order kept');
    assert.ok(lead.z - next.z - (lead.len + next.len) / 2 >= 1.6 - 1e-6, 'gap kept');
  }
});

test('long run with spawns: nobody drives onto an occupied zebra, entries never stack', () => {
  const rnd = lcg(7), cars: DepthCar[] = Array.from({ length: 7 }, () => ({ ...car(0, 1), on: false }));
  let occupied = false, violations = 0;
  for (let i = 0; i < 30 * 600; i++) {
    if (i % 90 === 0) {
      const wasOccupied = occupied;
      occupied = rnd() < 0.5;
      // a pedestrian only steps out once nothing is on the stripes or between the lines
      if (occupied && !wasOccupied && carsOnCrossing(cars, road(true))) occupied = false;
    }
    const r = road(occupied);
    if (rnd() < 0.05) {
      const slot = cars.find((c) => !c.on), dir: 1 | -1 = rnd() < 0.5 ? 1 : -1, len = rnd() < 0.5 ? 2 : 4.2;
      if (slot && canEnter(cars, dir, len, r)) Object.assign(slot, car(dir > 0 ? r.zNear : r.zFar, dir, len, 6 + rnd() * 4));
    }
    const before = cars.map((c) => c.on && carsOnCrossing([c], { ...r, stopGap: 0 }));
    stepDepthCars(cars, 1 / 30, r);
    // while occupied, a vehicle that was off the stripes must still be off them
    if (occupied) cars.forEach((c, k) => { if (c.on && !before[k] && carsOnCrossing([c], { ...r, stopGap: 0 })) violations++; });
    for (const a of cars) for (const b of cars) if (a !== b && a.on && b.on && a.dir === b.dir) assert.ok(Math.abs(a.z - b.z) >= (a.len + b.len) / 2 + 1.6 - 1e-6, 'overlap in lane');
    for (const c of cars) if (c.on) assert.ok(c.z >= r.zNear - 1e-6 && c.z <= r.zFar + 1e-6);
  }
  assert.equal(violations, 0);
});

test('without a crossing nothing is ever held and no car is ever "on" it', () => {
  const r = road(true, false), v = car(4, 1);
  assert.equal(carsOnCrossing([v], r), false);
  for (let i = 0; i < 120; i++) stepDepthCars([v], 1 / 30, r);
  assert.ok(v.z > 4 + 7, 'kept cruising');
});

test('a new vehicle cannot enter on top of another one', () => {
  const r = road(false);
  assert.equal(canEnter([car(r.zNear + 1, 1)], 1, 4.2, r), false);
  assert.equal(canEnter([car(r.zNear + 1, 1)], -1, 4.2, r), true);
  assert.equal(canEnter([car(r.zNear + 12, 1)], 1, 4.2, r), true);
});
