// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UMBRELLA_SHARE, WET_KEEP, WET_MIN, opensUmbrella, raining, shelterAt, shelterWait, type WxState } from '../src/actors/rain-rules.ts';

const ROLLS = Array.from({ length: 50 }, (_, i) => i / 50);

test('unknown weather never opens an umbrella, whatever the numbers say', () => {
  for (const [rain, snow] of [[0, 0], [0.6, 0], [1, 0], [0, 0.8], [0.5, 0.5]]) {
    assert.equal(raining('unavailable', rain, snow), false);
    for (const roll of ROLLS) assert.equal(opensUmbrella('unavailable', rain, snow, roll), false);
  }
});

test('a real reading (live or stale) or the #wx= test with precipitation opens umbrellas', () => {
  for (const kind of ['live', 'stale', 'override'] as WxState[]) {
    assert.equal(raining(kind, 0.6, 0), true);
    assert.equal(raining(kind, 0, 0.6), true); // snow counts too
    assert.equal(opensUmbrella(kind, 0.6, 0, 0), true);
    assert.equal(opensUmbrella(kind, 0.6, 0, 0.95), false); // some people have none
    const share = ROLLS.filter((roll) => opensUmbrella(kind, 0.35, 0, roll)).length / ROLLS.length;
    assert.ok(Math.abs(share - UMBRELLA_SHARE) < 0.05);
  }
});

test('dry or barely drizzling readings: no umbrellas', () => {
  for (const kind of ['live', 'stale', 'override'] as WxState[]) {
    assert.equal(raining(kind, 0, 0), false);
    assert.equal(raining(kind, WET_MIN, 0), false);
    for (const roll of ROLLS) assert.equal(opensUmbrella(kind, 0.03, 0.02, roll), false);
  }
  // an open umbrella stays open just below the opening threshold, and not below the keep one
  assert.equal(raining('live', 0.07, 0, WET_KEEP), true);
  assert.equal(raining('live', 0.05, 0, WET_KEEP), false);
  assert.equal(raining('live', Number.NaN, 0), false);
});

test('only people on foot without an umbrella wait under a shelter, while it really rains and there is room', () => {
  const base = { wet: true, umbrella: false, onFoot: true, waited: false, waiting: 0, cap: 3 };
  const w = shelterWait(base, 0.5);
  assert.ok(w >= 8 && w <= 30);
  assert.equal(shelterWait({ ...base, wet: false }, 0.5), 0); // dry or unknown weather
  assert.equal(shelterWait({ ...base, umbrella: true }, 0.5), 0);
  assert.equal(shelterWait({ ...base, onFoot: false }, 0.5), 0);
  assert.equal(shelterWait({ ...base, waited: true }, 0.5), 0); // they don't stop twice
  assert.equal(shelterWait({ ...base, waiting: 3 }, 0.5), 0); // full
  // unknown weather never reaches a shelter decision as wet
  assert.equal(shelterWait({ ...base, wet: raining('unavailable', 1, 0) }, 0.5), 0);
});

test('shelterAt finds the covered stretch', () => {
  const S = [{ x0: 10, x1: 20, cap: 2 }, { x0: 40, x1: 50, cap: 3 }];
  assert.equal(shelterAt(S, 15)?.x0, 10);
  assert.equal(shelterAt(S, 50)?.x0, 40);
  assert.equal(shelterAt(S, 30), null);
  assert.equal(shelterAt([], 15), null);
});
