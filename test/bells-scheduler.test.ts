// Behaviour of the bell timer (src/audio/bells-scheduler.ts) with a fake clock, timers and sound.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR_MS } from '../src/audio/bells-schedule.ts';
import { createBellScheduler, type BellContext } from '../src/audio/bells-scheduler.ts';

const brt = (iso: string) => Date.parse(`${iso}-03:00`);

function harness(startIso: string) {
  let now = brt(startIso), nextId = 1;
  const timers = new Map<number, { fn: () => void; at: number }>();
  const rings: { strikes: number; near: boolean; at: number }[] = [];
  let cancels = 0, sound = true;
  const ctx: BellContext = { cityId: 'esperanca', utc: -3, pinned: false, near: true };
  const s = createBellScheduler({
    now: () => now,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: (id) => { timers.delete(id); },
    soundOn: () => sound,
    audioReady: () => true,
    ring: (strikes, near) => { rings.push({ strikes, near, at: now }); },
    cancelPeal: () => { cancels++; },
  });
  const sync = () => s.sync(() => ({ ...ctx }));
  /** Fire the single pending timer at `at` (default: its due time) after moving the clock there. */
  const fireNext = (lateMs = 0) => {
    assert.equal(timers.size, 1, 'exactly one timer pending');
    const [id, t] = [...timers][0];
    timers.delete(id);
    now = t.at + lateMs;
    t.fn();
  };
  return {
    s, ctx, timers, rings, sync, fireNext,
    get cancels() { return cancels; },
    setNow: (iso: string) => { now = brt(iso); },
    setSound: (on: boolean) => { sound = on; },
  };
}

test('repeated sync keeps exactly one timer, armed for the next hour', () => {
  const h = harness('2026-11-07T18:20:00');
  for (let i = 0; i < 5; i++) h.sync();
  assert.equal(h.timers.size, 1);
  assert.equal(h.s.armedFor(), brt('2026-11-07T19:00:00'));
  h.fireNext();
  assert.deepEqual(h.rings.map((r) => r.strikes), [7]);
  assert.equal(h.timers.size, 1);
  assert.equal(h.s.armedFor(), brt('2026-11-07T20:00:00'));
});

test('a late fire stays silent, does not catch up, and arms only the next hour', () => {
  const h = harness('2026-11-07T18:20:00');
  h.sync();
  h.fireNext(3 * HOUR_MS + 25 * 60_000); // laptop slept from 18:20 to 22:25
  assert.equal(h.rings.length, 0);
  assert.equal(h.timers.size, 1);
  assert.equal(h.s.armedFor(), brt('2026-11-07T23:00:00'));
  h.fireNext();
  assert.deepEqual(h.rings.map((r) => r.strikes), [11]);
});

test('a slightly early fire followed by a sync does not ring the same hour twice', () => {
  const h = harness('2026-11-07T18:20:00');
  h.sync();
  h.fireNext(-300);
  assert.equal(h.rings.length, 1);
  h.sync(); // e.g. a scene change 0.3 s before 19:00
  assert.equal(h.s.armedFor(), brt('2026-11-07T20:00:00'));
});

test('muting clears the timer and unmuting re-arms one', () => {
  const h = harness('2026-11-07T18:20:00');
  h.sync();
  h.setSound(false);
  h.sync();
  assert.equal(h.timers.size, 0);
  assert.equal(h.s.armedFor(), 0);
  h.setSound(true);
  h.sync();
  assert.equal(h.timers.size, 1);
});

test('leaving Esperança clears the timer and cancels the peal; coming back arms it', () => {
  const h = harness('2026-11-07T18:20:00');
  h.sync();
  h.ctx.cityId = 'tokyo';
  h.sync();
  assert.equal(h.timers.size, 0);
  assert.equal(h.cancels, 1);
  h.ctx.cityId = 'esperanca';
  h.sync();
  assert.equal(h.timers.size, 1);
  assert.equal(h.s.armedFor(), brt('2026-11-07T19:00:00'));
});

test('a timer that fires after the city changed (without sync) stays silent and does not re-arm', () => {
  const h = harness('2026-11-07T18:20:00');
  h.sync();
  h.ctx.cityId = 'tokyo';
  h.fireNext();
  assert.equal(h.rings.length, 0);
  assert.equal(h.timers.size, 0);
});

test('pinned time (#at=) never arms or rings', () => {
  const h = harness('2026-11-07T18:20:00');
  h.ctx.pinned = true;
  h.sync();
  assert.equal(h.timers.size, 0);
  assert.equal(h.rings.length, 0);
  h.ctx.pinned = false;
  h.sync();
  h.ctx.pinned = true; // pinned while armed, before any sync
  h.fireNext();
  assert.equal(h.rings.length, 0);
  assert.equal(h.timers.size, 0);
});

test('dispose clears the timer and cancels the peal', () => {
  const h = harness('2026-11-07T18:20:00');
  h.sync();
  h.s.dispose();
  assert.equal(h.timers.size, 0);
  assert.equal(h.cancels, 1);
});
