// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerRain, nextVisitIn, vendorCount, visitIsExit, visitorCap } from '../src/actors/shop-rules.ts';
import { HURRY, UMBRELLA_SHARE, opensUmbrella } from '../src/actors/rain-rules.ts';
import { density, peopleCap } from '../src/sky/rhythm.ts';

const brt = (iso: string) => Date.parse(`${iso}-03:00`);

test('no vendors when the shop is closed; at least one when it is open', () => {
  assert.equal(vendorCount(false, 1, 3), 0);
  assert.equal(vendorCount(true, 0, 3), 1);
  assert.equal(vendorCount(true, 0.05, 3), 1);
  assert.equal(vendorCount(true, 1, 3), 3);
  assert.equal(vendorCount(true, 1, 0), 0);
  assert.ok(vendorCount(true, 0.4, 3) >= vendorCount(true, 0.2, 3), 'more vendors as the street fills');
});

test('customers come more often when the street is busy and the shop is popular', () => {
  assert.equal(nextVisitIn(0, 3, 0.5), Infinity, 'empty street: nobody');
  assert.equal(nextVisitIn(0.5, 0, 0.5), Infinity);
  assert.ok(nextVisitIn(0.8, 1, 0.5) < nextVisitIn(0.2, 1, 0.5));
  assert.ok(nextVisitIn(0.6, 3, 0.5) < nextVisitIn(0.6, 1, 0.5), 'Armazém Paraíba (weight 3) is busier than an ordinary shop');
  for (const roll of [0, 0.5, 0.999]) assert.ok(Number.isFinite(nextVisitIn(0.6, 1, roll)));
});

test('visitor cap follows the street and never exceeds the pool', () => {
  assert.equal(visitorCap(0, 1, 14), 1);
  assert.ok(visitorCap(1, 3, 14) >= 5);
  assert.equal(visitorCap(1, 100, 6), 6);
});

test('half the visits are people coming out, half going in', () => {
  assert.equal(visitIsExit(0.1), true);
  assert.equal(visitIsExit(0.9), false);
});

test('the day is livelier than before (old peaks 0.62 / 0.75), still empty at night', () => {
  assert.ok(density('esperanca', 'rua-comercio', brt('2026-11-09T11:00')).people >= 0.75);
  assert.ok(density('esperanca', 'praca-matriz', brt('2026-11-09T14:00')).people >= 0.85);
  assert.ok(density('esperanca', 'rua-comercio', brt('2026-11-09T23:00')).people <= 0.05);
  assert.ok(peopleCap(0.78) >= 17, 'room for a visibly fuller street at midday');
});

test('town car traffic builds up through the day, peaks at 17-18h and is quiet at night', () => {
  const t = (h: string, scene = 'rua-comercio') => density('esperanca', scene, brt(`2026-11-09T${h}`)).traffic;
  const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '17:00'];
  for (let i = 1; i < hours.length; i++) assert.ok(t(hours[i]) > t(hours[i - 1]), `${hours[i]} above ${hours[i - 1]}`);
  assert.ok(t('17:30') >= t('15:00') && t('17:30') >= 0.95);
  assert.ok(t('22:00') < t('17:00') / 5 && t('03:00') <= 0.05);
  assert.equal(t('12:00', 'praca-matriz'), t('12:00', 'rua-comercio'), 'same traffic curve in every Esperança scene');
});

// ---------- shop-front customers in the rain (through rain-rules.ts, like every walker) ----------
const ROLLS = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200);

test('customers in real rain or snow open an umbrella like the pedestrians, the rest hurry', () => {
  for (const kind of ['live', 'stale', 'override'] as const) for (const [rain, snow] of [[0.5, 0], [0, 0.4], [0.2, 0.1]]) {
    let umb = 0;
    for (const roll of ROLLS) {
      const c = customerRain(kind, rain, snow, roll);
      assert.equal(c.umbrella, opensUmbrella(kind, rain, snow, roll));
      assert.equal(c.speedK, c.umbrella ? 1 : HURRY);
      if (c.umbrella) umb++;
    }
    assert.ok(Math.abs(umb / ROLLS.length - UMBRELLA_SHARE) < 0.02);
  }
});

test('dry or unknown weather changes nothing for customers: no umbrella, normal pace', () => {
  for (const roll of ROLLS) {
    assert.deepEqual(customerRain('live', 0, 0, roll), { umbrella: false, speedK: 1 });
    assert.deepEqual(customerRain('live', 0.05, 0, roll), { umbrella: false, speedK: 1 }); // a trace under the threshold
    assert.deepEqual(customerRain('unavailable', 1, 1, roll), { umbrella: false, speedK: 1 });
    assert.deepEqual(customerRain('live', Number.NaN, 0, roll), { umbrella: false, speedK: 1 });
  }
});
