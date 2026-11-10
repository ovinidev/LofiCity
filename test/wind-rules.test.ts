// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STRONG_DELTA, STRONG_KMH, WIND_CALM, debrisCount, debrisOn, parseWindOverride, strongWind, windDir, windKmh, windStrength, windValue,
} from '../src/sky/wind-rules.ts';

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('windValue matches the live.ts formula and windKmh inverts it, both directions', () => {
  near(windValue(0, 1), WIND_CALM);
  near(windValue(55, 1), 0.95);
  near(windValue(55, -1), -0.85);
  near(windValue(500, 1), 1.2 * 0.9 + 0.05); // clamped at 66 km/h
  for (const k of [0, 5, 12, 29.9, 30, 41, 60]) for (const sign of [1, -1]) near(windKmh(windValue(k, sign)), k, 1e-6);
  near(windKmh(NaN), 0);
});

test('strong wind starts at 30 km/h: S.wind ≥ 0.5409 one way, ≤ −0.4409 the other', () => {
  near(STRONG_DELTA, 0.4909, 1e-4);
  assert.equal(STRONG_KMH, 30);
  assert.equal(strongWind(WIND_CALM), false);
  assert.equal(strongWind(windValue(29.9, 1)), false);
  assert.equal(strongWind(windValue(30, 1)), true);
  assert.equal(strongWind(windValue(30, -1)), true);
  assert.equal(strongWind(0.541), true);
  assert.equal(strongWind(0.54), false);
  assert.equal(strongWind(-0.441), true);
  assert.equal(strongWind(0.5), false); // the #wx=storm preset (27.5 km/h)
});

test('strength is 0 when calm, grows with speed, 1 from 45 km/h; direction follows the sign', () => {
  assert.equal(windStrength(WIND_CALM), 0);
  assert.equal(windDir(WIND_CALM), 0);
  assert.ok(windStrength(windValue(10, 1)) < windStrength(windValue(30, 1)));
  assert.equal(windStrength(windValue(45, -1)), 1);
  assert.equal(windStrength(windValue(66, 1)), 1);
  assert.equal(windDir(windValue(20, 1)), 1);
  assert.equal(windDir(windValue(20, -1)), -1);
});

const dry = { city: 'esperanca', kind: 'live' as const, wind: windValue(40, 1), rain: 0, snow: 0, wet: 0 };
test('debris only in Esperança, with a real reading or a test, strong wind and dry streets', () => {
  assert.equal(debrisOn(dry), true);
  assert.equal(debrisOn({ ...dry, kind: 'stale' }), true);
  assert.equal(debrisOn({ ...dry, kind: 'override' }), true);
  assert.equal(debrisOn({ ...dry, kind: 'unavailable' }), false);
  assert.equal(debrisOn({ ...dry, city: 'campina' }), false);
  assert.equal(debrisOn({ ...dry, city: 'tokyo' }), false);
  assert.equal(debrisOn({ ...dry, wind: windValue(29, 1) }), false);
  assert.equal(debrisOn({ ...dry, wind: WIND_CALM }), false);
  assert.equal(debrisOn({ ...dry, rain: 0.3 }), false);
  assert.equal(debrisOn({ ...dry, snow: 0.3 }), false);
  assert.equal(debrisOn({ ...dry, wet: 0.5 }), false);
  assert.equal(debrisOn({ ...dry, wind: windValue(40, -1) }), true);
});

test('debris count: none below the threshold, bounded by the cap, more in a gale', () => {
  assert.equal(debrisCount(windValue(29, 1), 18), 0);
  const at = debrisCount(windValue(30, 1), 18), gale = debrisCount(windValue(60, 1), 18);
  assert.ok(at > 0 && at <= 18 && gale <= 18 && gale >= at);
  assert.ok(debrisCount(windValue(60, 1), 8) <= 8);
  assert.equal(debrisCount(windValue(60, 1), 0), 0);
});

test('#wind= override: km/h with a sign, strong / calm, invalid ignored, label for the HUD', () => {
  assert.equal(parseWindOverride('#city=esperanca&wx=clear'), null);
  const w = parseWindOverride('#city=esperanca&wx=clear&wind=40')!;
  near(w.wind, windValue(40, 1)); assert.equal(w.label, 'wind=40'); assert.equal(strongWind(w.wind), true);
  near(parseWindOverride('#wind=-40')!.wind, windValue(40, -1));
  near(parseWindOverride('#wind=strong')!.wind, windValue(40, 1));
  near(parseWindOverride('#wind=calm')!.wind, WIND_CALM);
  assert.equal(parseWindOverride('#wind=abc'), null);
  assert.equal(parseWindOverride('#wind=9999'), null);
  assert.equal(parseWindOverride('#xwind=40'), null);
});
