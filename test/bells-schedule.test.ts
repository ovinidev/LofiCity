// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUR_MS, LATE_MS, localHour, msUntilNextHour, nextTargetMs, strikesForHour, strikesToRing, type RingCheck,
} from '../src/audio/bells-schedule.ts';

const BRT = -3; // Esperança: Brasília time, no daylight saving
/** Epoch ms for a wall-clock time in Brasília time. */
const brt = (iso: string) => Date.parse(`${iso}-03:00`);

test('strike count is the 12-hour value', () => {
  assert.equal(strikesForHour(0), 12);
  assert.equal(strikesForHour(5), 5);
  assert.equal(strikesForHour(12), 12);
  assert.equal(strikesForHour(13), 1);
  assert.equal(strikesForHour(19), 7);
  assert.equal(strikesForHour(23), 11);
});

test('01:00 to 04:00 are silent, 05:00 through 00:00 ring', () => {
  for (const h of [1, 2, 3, 4]) assert.equal(strikesForHour(h), 0, `hour ${h}`);
  for (let h = 5; h < 24; h++) assert.ok(strikesForHour(h) > 0, `hour ${h}`);
  assert.ok(strikesForHour(0) > 0);
});

test('local hour follows the fixed UTC offset', () => {
  assert.equal(localHour(Date.parse('2026-11-07T03:00:00Z'), BRT), 0);
  assert.equal(localHour(brt('2026-11-07T23:59:59'), BRT), 23);
  assert.equal(localHour(brt('2026-11-08T00:00:00'), BRT), 0);
  assert.equal(localHour(Date.parse('2026-11-07T15:00:00Z'), 9), 0); // Tokyo
});

test('ms until the next whole hour, across minute boundaries', () => {
  assert.equal(msUntilNextHour(brt('2026-11-07T13:00:00'), BRT), HOUR_MS); // on the hour: the next one
  assert.equal(msUntilNextHour(brt('2026-11-07T13:00:00.001'), BRT), HOUR_MS - 1);
  assert.equal(msUntilNextHour(brt('2026-11-07T13:59:00'), BRT), 60_000);
  assert.equal(msUntilNextHour(brt('2026-11-07T13:59:59.999'), BRT), 1);
  assert.equal(msUntilNextHour(brt('2026-11-07T13:30:00'), BRT), 30 * 60_000);
  assert.equal(msUntilNextHour(brt('2026-11-07T23:45:00'), BRT), 15 * 60_000); // rolls over midnight
  // half-hour offsets still land on local whole hours
  assert.equal(msUntilNextHour(Date.parse('2026-11-07T10:00:00Z'), 5.5), 30 * 60_000);
});

test('next target never repeats the previous hour', () => {
  const t = brt('2026-11-07T19:00:00');
  assert.equal(nextTargetMs(brt('2026-11-07T18:20:00'), BRT), t);
  assert.equal(nextTargetMs(t - 300, BRT, t), t + HOUR_MS); // timer fired 300 ms early
  assert.equal(nextTargetMs(t + 5_000, BRT, t), t + HOUR_MS);
  assert.equal(nextTargetMs(t + 3 * HOUR_MS + 10, BRT, t), t + 4 * HOUR_MS); // after a long sleep: next hour only
});

const base = (over: Partial<RingCheck> = {}): RingCheck => ({
  targetMs: brt('2026-11-07T19:00:00'), nowMs: brt('2026-11-07T19:00:00.020'), utcOffsetH: BRT,
  soundOn: true, audioReady: true, inCity: true, pinned: false, ...over,
});

test('rings the hour when everything is on', () => {
  assert.equal(strikesToRing(base()), 7);
  assert.equal(strikesToRing(base({ targetMs: brt('2026-11-08T00:00:00'), nowMs: brt('2026-11-08T00:00:01') })), 12);
  assert.equal(strikesToRing(base({ targetMs: brt('2026-11-07T05:00:00'), nowMs: brt('2026-11-07T05:00:00') })), 5);
  assert.equal(strikesToRing(base({ targetMs: brt('2026-11-07T13:00:00'), nowMs: brt('2026-11-07T13:00:00') })), 1);
});

test('silent at night, when sound is off, audio locked, other city or pinned time', () => {
  assert.equal(strikesToRing(base({ targetMs: brt('2026-11-07T03:00:00'), nowMs: brt('2026-11-07T03:00:00') })), 0);
  assert.equal(strikesToRing(base({ soundOn: false })), 0);
  assert.equal(strikesToRing(base({ audioReady: false })), 0);
  assert.equal(strikesToRing(base({ inCity: false })), 0);
  assert.equal(strikesToRing(base({ pinned: true })), 0);
});

test('a late timer (tab resumed, machine woke up) does not replay the missed hour', () => {
  const t = brt('2026-11-07T19:00:00');
  assert.equal(strikesToRing(base({ nowMs: t + LATE_MS })), 7);
  assert.equal(strikesToRing(base({ nowMs: t + LATE_MS + 1 })), 0);
  assert.equal(strikesToRing(base({ nowMs: t + 25 * 60_000 })), 0);
  assert.equal(strikesToRing(base({ nowMs: t - 5_000 })), 0); // far too early
});
