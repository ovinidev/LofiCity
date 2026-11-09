// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HURRY, PARASOL_SHARE, UMBRELLA_SHARE, WET_KEEP, WET_MIN, opensUmbrella, parasolWeather, pickUmbrella, raining, shelterAt, shelterWait,
  umbrellaOpen, type WxState,
} from '../src/actors/rain-rules.ts';

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

// ---------- depth streets (persp-kit.ts): the same decisions through pickUmbrella / umbrellaOpen ----------
const KINDS: WxState[] = ['live', 'stale', 'unavailable', 'override'];
const WEATHERS: [number, number][] = [[0, 0], [0.03, 0.02], [0.35, 0], [0.6, 0], [0, 0.6], [1, 0], [Number.NaN, 0]];

test('depth walkers open a rain umbrella exactly when side-on pedestrians would', () => {
  for (const kind of KINDS) for (const [rain, snow] of WEATHERS) for (const roll of ROLLS) {
    const u = pickUmbrella(kind, rain, snow, 20, 1, 0.9, roll, 0.5);
    assert.equal(u.umbrella, opensUmbrella(kind, rain, snow, roll), `${kind} ${rain}/${snow} roll ${roll}`);
  }
});

test('depth walkers without an umbrella hurry only in real rain or snow', () => {
  for (const kind of KINDS) for (const [rain, snow] of WEATHERS) {
    const u = pickUmbrella(kind, rain, snow, null, 1, 0.9, 0.99, 0.99); // roll 0.99: no umbrella
    assert.equal(u.umbrella, false);
    assert.equal(u.speedK, raining(kind, rain, snow) ? HURRY : 1);
  }
});

test('unknown weather changes nothing: no umbrella, no sun umbrella, normal pace', () => {
  // with no reading the temperature is null (sky/state.ts), so a sun umbrella is impossible too
  for (const [rain, snow] of WEATHERS) for (const roll of ROLLS)
    assert.deepEqual(pickUmbrella('unavailable', rain, snow, null, 1, 0, roll, roll), { umbrella: false, sun: false, speedK: 1 });
});

test('sun umbrellas follow the side-on hot clear day condition and stay open whatever the precipitation', () => {
  assert.equal(parasolWeather(null, 1, 0), false);
  assert.equal(parasolWeather(27, 1, 0.2), true);
  assert.equal(parasolWeather(26, 1, 0.2), false);
  assert.equal(parasolWeather(30, 0.5, 0.2), false); // not full day
  assert.equal(parasolWeather(30, 1, 0.6), false); // cloudy
  assert.equal(parasolWeather(Number.NaN, 1, 0), false);
  const share = ROLLS.filter((r) => pickUmbrella('live', 0, 0, 30, 1, 0.1, 0.5, r).sun).length / ROLLS.length;
  assert.ok(Math.abs(share - PARASOL_SHARE) < 0.05);
  for (const kind of KINDS) assert.equal(umbrellaOpen(true, kind, 0, 0), true);
  // a rain umbrella shows while it still rains (keep threshold) and is folded when dry or unknown
  assert.equal(umbrellaOpen(false, 'live', 0.07, 0), true);
  assert.equal(umbrellaOpen(false, 'live', 0.04, 0), false);
  assert.equal(umbrellaOpen(false, 'unavailable', 1, 0), false);
});

test('pickUmbrella is pure: the same inputs always give the same answer (no hidden randomness)', () => {
  for (const kind of KINDS) for (const [rain, snow] of WEATHERS) for (const roll of ROLLS.slice(0, 10))
    assert.deepEqual(pickUmbrella(kind, rain, snow, 30, 1, 0.1, roll, roll), pickUmbrella(kind, rain, snow, 30, 1, 0.1, roll, roll));
});

test('shelterAt works on depths too and keeps the shelter type', () => {
  const sh = [{ walk: 1, x0: 12.5, x1: 24.9, X: 6.4, cap: 3 }];
  assert.equal(shelterAt(sh, 20)?.X, 6.4);
  assert.equal(shelterAt(sh, 30), null);
});
