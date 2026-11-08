// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIKE_ARCHETYPES, allowedArchetypes, overlaps, yieldLimit } from '../src/actors/street-rules.ts';

// A crossing between x 212 and 236 with stop lines 3 px out, as in Praça da Cultura.
const FWD = 209, BACK = 239;

test('a vehicle heading toward an occupied crossing stops at its stop line', () => {
  assert.equal(yieldLimit(180, 1, FWD, BACK, true), 29); // may roll up to the line
  assert.equal(yieldLimit(FWD, 1, FWD, BACK, true), 0); // at the line: stays put
  assert.equal(yieldLimit(270, -1, FWD, BACK, true), 31);
  assert.equal(yieldLimit(BACK, -1, FWD, BACK, true), 0);
  // moving the full limit never puts the front past the line
  for (let pos = 150; pos <= FWD; pos += 7) assert.ok(pos + Math.min(50, yieldLimit(pos, 1, FWD, BACK, true)) <= FWD);
});

test('a clear crossing does not hold anyone', () => {
  assert.equal(yieldLimit(180, 1, FWD, BACK, false), Infinity);
  assert.equal(yieldLimit(FWD, 1, FWD, BACK, false), Infinity);
  assert.equal(yieldLimit(270, -1, FWD, BACK, false), Infinity);
});

test('a vehicle already past its stop line carries on', () => {
  assert.equal(yieldLimit(FWD + 0.5, 1, FWD, BACK, true), Infinity);
  assert.equal(yieldLimit(250, 1, FWD, BACK, true), Infinity);
  assert.equal(yieldLimit(BACK - 0.5, -1, FWD, BACK, true), Infinity);
  assert.equal(yieldLimit(200, -1, FWD, BACK, true), Infinity);
});

test('Matriz rows: the same rule as its original stop logic (CROSS0 - 1, CROSS1 + 2)', () => {
  const CROSS0 = 141, CROSS1 = 147, old = (y: number, dir: number) =>
    dir > 0 && y <= CROSS0 - 1 ? Math.max(0, CROSS0 - 1 - y) : dir < 0 && y >= CROSS1 + 2 ? Math.max(0, y - CROSS1 - 2) : Infinity;
  for (let y = 134; y < 194; y += 0.37) for (const dir of [1, -1]) assert.equal(yieldLimit(y, dir, CROSS0 - 1, CROSS1 + 2, true), old(y, dir));
});

test('overlap of a vehicle body with the crossing zone', () => {
  assert.ok(overlaps(200, 12, 209, 239)); // front at 212
  assert.ok(!overlaps(190, 19, 209, 239)); // front exactly at the stop line
  assert.ok(overlaps(238, 30, 209, 239));
  assert.ok(!overlaps(239, 30, 209, 239));
});

test('Matriz walker kinds exclude bikes; other scenes keep them', () => {
  const all: [string, number][] = [['casual', 2], ['bike', 0.5], ['delivery', 0.9], ['elder', 1.4], ['chair', 0.2], ['runner', 1]];
  const foot = allowedArchetypes(all, false);
  assert.deepEqual(foot.map(([a]) => a), ['casual', 'elder', 'chair', 'runner']);
  assert.ok(foot.every(([a]) => !BIKE_ARCHETYPES.has(a)));
  assert.equal(allowedArchetypes(all, true), all);
});
