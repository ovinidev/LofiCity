// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUY_SHARE, COCO_HOURS, DRINK_SHARE, HOT_C, type HeatCtx, SIP_GAP, SIP_SECS, WARM_C, buysCoco, cocoOpen, heatLevel, pickDrink,
  sipGap, sipRaise,
} from '../src/actors/heat-rules.ts';

const ROLLS = Array.from({ length: 50 }, (_, i) => i / 50);
const hot = (o: Partial<HeatCtx> = {}): HeatCtx => ({ kind: 'live', temp: 33, dayK: 1, cloud: 0.1, rain: 0, snow: 0, ...o });

test('unknown temperature or unknown weather never gives heat behaviour', () => {
  assert.equal(heatLevel(hot({ temp: null })), 0);
  assert.equal(heatLevel(hot({ temp: NaN })), 0);
  for (const temp of [20, 30, 40]) assert.equal(heatLevel(hot({ kind: 'unavailable', temp })), 0);
  for (const r of ROLLS) {
    assert.equal(pickDrink(0, r, r), 'none');
    assert.equal(sipGap(0, r), Infinity);
    assert.equal(buysCoco(0, cocoOpen(0, 12), false, r), false);
  }
  assert.equal(cocoOpen(0, 12), false);
});

test('thresholds: inert below WARM_C, warm from WARM_C, hot from HOT_C (live, stale and the test override)', () => {
  for (const kind of ['live', 'stale', 'override'] as const) {
    assert.equal(heatLevel(hot({ kind, temp: 18 })), 0);
    assert.equal(heatLevel(hot({ kind, temp: WARM_C - 0.1 })), 0);
    assert.equal(heatLevel(hot({ kind, temp: WARM_C })), 1);
    assert.equal(heatLevel(hot({ kind, temp: HOT_C - 0.1 })), 1);
    assert.equal(heatLevel(hot({ kind, temp: HOT_C })), 2);
    assert.equal(heatLevel(hot({ kind, temp: 38 })), 2);
  }
});

test('night, dusk, cloud and real rain switch it off', () => {
  assert.equal(heatLevel(hot({ dayK: 0 })), 0);
  assert.equal(heatLevel(hot({ dayK: 0.5 })), 0);
  assert.equal(heatLevel(hot({ cloud: 0.8 })), 0);
  assert.equal(heatLevel(hot({ rain: 0.3 })), 0);
  assert.equal(heatLevel(hot({ snow: 0.3 })), 0);
  assert.equal(heatLevel(hot({ rain: 0.02 })), 2); // a trace below the rain threshold is not rain
});

test('drinks: share grows with the heat, coconuts and bottles both appear', () => {
  const share = (lvl: 0 | 1 | 2) => ROLLS.filter((r) => pickDrink(lvl, r, 0.5) !== 'none').length / ROLLS.length;
  assert.equal(share(0), 0);
  assert.ok(share(1) > 0 && share(2) > share(1) && share(2) <= 0.5);
  assert.ok(Math.abs(share(2) - DRINK_SHARE[2]) < 0.05);
  assert.equal(pickDrink(2, 0, 0), 'coco');
  assert.equal(pickDrink(2, 0, 0.99), 'water');
});

test('sips: bounded gaps, shorter when hotter, a couple of seconds raised and back down', () => {
  for (const r of ROLLS) {
    const g1 = sipGap(1, r), g2 = sipGap(2, r);
    assert.ok(g1 >= SIP_GAP[1][0] && g1 <= SIP_GAP[1][1]);
    assert.ok(g2 >= SIP_GAP[2][0] && g2 <= SIP_GAP[2][1] && g2 < g1);
  }
  assert.ok(SIP_SECS >= 1.5 && SIP_SECS <= 3.5);
  assert.equal(sipRaise(-1), 0);
  assert.equal(sipRaise(0), 0);
  assert.equal(sipRaise(SIP_SECS / 2), 1);
  assert.equal(sipRaise(SIP_SECS), 0);
  assert.ok(sipRaise(0.1) > 0 && sipRaise(0.1) < 1);
});

test('coconut cart: daytime hours with real heat; one customer at a time', () => {
  assert.equal(cocoOpen(1, COCO_HOURS[0] - 0.1), false);
  assert.equal(cocoOpen(1, COCO_HOURS[0]), true);
  assert.equal(cocoOpen(2, 16.9), true);
  assert.equal(cocoOpen(2, COCO_HOURS[1]), false);
  assert.equal(cocoOpen(2, 21), false);
  for (const r of ROLLS) {
    assert.equal(buysCoco(2, true, true, r), false);
    assert.equal(buysCoco(2, false, false, r), false);
  }
  assert.ok(buysCoco(2, true, false, 0));
  assert.ok(!buysCoco(2, true, false, BUY_SHARE[2]));
});
