// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birdActivity, cityClock, density, massActive, massState, peopleCap } from '../src/sky/rhythm.ts';

/** Epoch ms for a wall-clock time at UTC-3 (Brasília / Fortaleza time, no daylight saving). */
const brt = (iso: string) => Date.parse(`${iso}-03:00`);
const people = (city: Parameters<typeof density>[0], scene: string, iso: string) => density(city, scene, brt(iso)).people;

// 2026-11-08 is a Sunday; 2026-11-09 Monday; 2026-11-13 Friday; 2026-11-14 Saturday.

test('city clock reads Brasília time and weekday, across the UTC date line', () => {
  assert.deepEqual(cityClock(brt('2026-11-08T14:30'), -3), { hour: 14.5, weekday: 0 });
  // 22:00 Sunday in Brasília is already 01:00 Monday UTC
  const late = brt('2026-11-08T22:00');
  assert.equal(new Date(late).getUTCDay(), 1);
  assert.deepEqual(cityClock(late, -3), { hour: 22, weekday: 0 });
});

test('levels are continuous across hour boundaries (interpolated, no jumps)', () => {
  for (const city of ['esperanca', 'campina', 'joaopessoa'] as const)
    for (let h = 0; h < 24; h++) {
      const at = Date.UTC(2026, 10, 9, h + 3); // h:00 Brasília
      const before = density(city, 'praca-cultura', at - 1000).people, after = density(city, 'praca-cultura', at + 1000).people;
      assert.ok(Math.abs(before - after) < 0.001, `${city} ${h}h jumps ${before} -> ${after}`);
      const b0 = birdActivity(city, at - 1000), b1 = birdActivity(city, at + 1000);
      assert.ok(Math.abs(b0 - b1) < 0.001, `birds ${city} ${h}h`);
    }
  // halfway between two hours sits between their levels
  const a = people('esperanca', 'praca-matriz', '2026-11-09T13:00'), b = people('esperanca', 'praca-matriz', '2026-11-09T14:00');
  const mid = people('esperanca', 'praca-matriz', '2026-11-09T13:30');
  assert.ok(mid > Math.min(a, b) && mid < Math.max(a, b));
});

test('Esperança praças are busiest between 14h and 15h', () => {
  for (const scene of ['praca-matriz', 'praca-cultura']) {
    let best = -1, bestH = -1;
    for (let q = 0; q < 96; q++) {
      const v = density('esperanca', scene, Date.UTC(2026, 10, 9, 3) + q * 900_000).people;
      if (v > best + 1e-9) { best = v; bestH = q / 4; }
    }
    assert.ok(bestH >= 14 && bestH <= 15, `${scene} peaks at ${bestH}h`);
    assert.ok(people('esperanca', scene, '2026-11-09T14:30') > people('esperanca', scene, '2026-11-09T11:00'));
  }
});

test('density ordering: 14h > 21h, and movement declines from 19h', () => {
  for (const city of ['esperanca', 'campina', 'joaopessoa'] as const)
    assert.ok(people(city, 'praca-cultura', '2026-11-09T14:00') > people(city, 'praca-cultura', '2026-11-09T21:00'), city);
  const e = (h: string) => people('esperanca', 'praca-matriz', `2026-11-09T${h}`);
  assert.ok(e('19:00') > e('20:00') && e('20:00') > e('21:00'));
  for (const h of ['21:00', '22:00', '23:00', '23:59']) assert.ok(e(h) <= 0.08, `Esperança ${h} should be nearly empty`);
});

test('Campina Grande and João Pessoa are busier than Esperança by day and in the evening', () => {
  for (const h of ['08:00', '10:00', '14:00', '14:30', '16:00', '18:00', '20:00', '21:00']) {
    const esp = Math.max(people('esperanca', 'praca-cultura', `2026-11-09T${h}`), people('esperanca', 'rua-comercio', `2026-11-09T${h}`));
    assert.ok(people('campina', 'acude-velho', `2026-11-09T${h}`) > esp, `Campina ${h}`);
    assert.ok(people('joaopessoa', 'cabo-branco', `2026-11-09T${h}`) > esp, `João Pessoa ${h}`);
  }
});

test('madrugada (00-05h) is low everywhere, including the big cities', () => {
  for (const city of ['esperanca', 'campina', 'joaopessoa', 'areia', 'remigio'] as const)
    for (let q = 0; q <= 20; q++) {
      const d = density(city, 'praca-matriz', Date.UTC(2026, 10, 9, 3) + q * 900_000);
      assert.ok(d.people <= 0.15 && d.traffic <= 0.15, `${city} at ${q / 4}h: ${d.people}`);
    }
  assert.ok(people('campina', 'acude-velho', '2026-11-09T03:00') < people('campina', 'acude-velho', '2026-11-09T14:00') / 5);
});

test('bounded crowd: few people on screen when quiet, never above the pool', () => {
  assert.ok(peopleCap(0.05) <= 2);
  assert.equal(peopleCap(0), 1);
  assert.equal(peopleCap(5), 16);
});

test('birds surge around 17h (time only)', () => {
  const b = (h: string) => birdActivity('esperanca', brt(`2026-11-09T${h}`));
  assert.ok(b('17:00') >= 0.9);
  assert.ok(b('17:00') > 2 * b('12:00') && b('17:00') > 2 * b('14:00'));
  assert.ok(b('16:45') > b('15:00') && b('17:15') > b('19:00'));
  assert.equal(b('23:00'), 0);
  assert.equal(b('02:00'), 0);
  // same clock, same activity: the season (and so the temperature) does not matter
  assert.equal(birdActivity('esperanca', brt('2026-07-15T17:00')), b('17:00'));
  assert.equal(birdActivity('campina', brt('2026-11-09T17:00')), b('17:00'));
});

test('Sunday masses at 07, 09, 16 and 19h, one hour each', () => {
  for (const h of ['07', '09', '16', '19']) {
    assert.equal(massActive(brt(`2026-11-08T${h}:00`)), true, `${h}:00 starts`);
    assert.equal(massActive(brt(`2026-11-08T${h}:59`)), true, `${h}:59 still on`);
  }
  for (const h of ['06:59', '08:00', '08:30', '10:00', '12:00', '15:59', '17:00', '18:59', '20:00', '21:00'])
    assert.equal(massActive(brt(`2026-11-08T${h}`)), false, `Sunday ${h}`);
});

test('weekday mass 19-20h Monday to Friday, none on Saturday', () => {
  for (const day of ['09', '10', '11', '12', '13']) {
    assert.equal(massActive(brt(`2026-11-${day}T19:30`)), true, `${day} 19:30`);
    assert.equal(massActive(brt(`2026-11-${day}T18:59`)), false);
    assert.equal(massActive(brt(`2026-11-${day}T20:00`)), false);
    assert.equal(massActive(brt(`2026-11-${day}T07:30`)), false, 'no weekday morning mass');
    assert.equal(massActive(brt(`2026-11-${day}T16:30`)), false);
  }
  for (const h of ['07:30', '09:30', '16:30', '19:00', '19:30'])
    assert.equal(massActive(brt(`2026-11-14T${h}`)), false, `Saturday ${h}`);
});

test('mass follows Fortaleza/Brasília local time when the UTC date has already rolled over', () => {
  // Sunday 19:30 local = Sunday 22:30 UTC
  const sundayEvening = brt('2026-11-08T19:30');
  assert.equal(new Date(sundayEvening).getUTCDay(), 0);
  assert.equal(massActive(sundayEvening), true);
  // Saturday 21:30 local is Sunday 00:30 UTC: must not count as Sunday (and there is no mass at 21h)
  const satNight = brt('2026-11-14T21:30');
  assert.equal(new Date(satNight).getUTCDay(), 0);
  assert.equal(massActive(satNight), false);
  // Friday 19:30 local is Friday 22:30 UTC; Friday 21:30 local is Saturday 00:30 UTC (mass over)
  assert.equal(massActive(brt('2026-11-13T19:30')), true);
  assert.equal(massActive(brt('2026-11-13T21:30')), false);
  // Explicit UTC instant: Monday 2026-11-09 22:15 UTC = Monday 19:15 local -> weekday mass
  assert.equal(massActive(Date.UTC(2026, 10, 9, 22, 15)), true);
  // Monday 00:30 UTC = Sunday 21:30 local -> nothing (the 19h mass ended at 20h)
  assert.equal(massActive(Date.UTC(2026, 10, 9, 0, 30)), false);
  // Sunday 10:30 UTC = Sunday 07:30 local -> morning mass even though UTC says 10h
  assert.equal(massActive(Date.UTC(2026, 10, 8, 10, 30)), true);
});

test('doors open for the gathering before mass and the leaving after it', () => {
  const s = (iso: string) => massState(brt(iso));
  assert.deepEqual(s('2026-11-09T18:50'), { active: false, doorsOpen: true, arriving: true, leaving: false });
  assert.deepEqual(s('2026-11-09T19:20'), { active: true, doorsOpen: true, arriving: false, leaving: false });
  assert.deepEqual(s('2026-11-09T19:57'), { active: true, doorsOpen: true, arriving: false, leaving: true });
  assert.deepEqual(s('2026-11-09T20:03'), { active: false, doorsOpen: true, arriving: false, leaving: true });
  assert.deepEqual(s('2026-11-09T20:10'), { active: false, doorsOpen: false, arriving: false, leaving: false });
  assert.equal(s('2026-11-14T18:50').doorsOpen, false, 'Saturday stays closed');
});
