// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLACK_S, CLOSE_H, FADE_S, OPEN_H, PRESHOW_MIN, SHOTS, SHOT_S, localTime, sessionAt, sessionSeed, shotAt, shotIn,
} from '../src/scenes/cinema-rules.ts';

const UTC = -3; // Remígio
const at = (iso: string) => Date.parse(`${iso}-03:00`);

test('the room is closed outside 14:00-23:00 and opens with a pre-show', () => {
  for (const h of [0, 3, 9.5, 13.99, 23, 23.5]) assert.equal(sessionAt(h).phase, 'closed', `${h}h`);
  assert.equal(sessionAt(13.99).next, OPEN_H);
  assert.equal(sessionAt(23.2).next, OPEN_H, 'after closing the next session is 14:00 tomorrow');
  assert.deepEqual(sessionAt(OPEN_H), { phase: 'preshow', block: 0, sec: 0, next: 14 });
  assert.equal(sessionAt(OPEN_H + (PRESHOW_MIN - 1) / 60).phase, 'preshow');
  assert.equal(sessionAt(OPEN_H + PRESHOW_MIN / 60).phase, 'film');
  assert.equal(sessionAt(CLOSE_H - 0.01).phase, 'film');
});

test('sessions start every 2h30: 14:00, 16:30, 19:00, 21:30', () => {
  const starts = [14, 16.5, 19, 21.5];
  starts.forEach((h, i) => {
    const s = sessionAt(h + 0.05);
    assert.equal(s.phase, 'preshow');
    assert.equal(s.block, i);
  });
  assert.equal(sessionAt(15).next, 16.5);
  assert.equal(sessionAt(21).next, 21.5);
  assert.equal(sessionAt(22.5).next, OPEN_H, 'last session: next is tomorrow');
  assert.ok(Math.abs(sessionAt(16.6).sec - 360) < 1e-6);
});

test('the clock is the city clock (#at= reproducible, UTC offset respected)', () => {
  assert.equal(localTime(at('2026-11-09T15:30'), UTC).hour, 15.5);
  assert.equal(shotAt(at('2026-11-09T10:00'), UTC), null, 'no film in the morning');
  assert.equal(shotAt(at('2026-11-09T14:05'), UTC), null, 'pre-show, no film yet');
  assert.ok(shotAt(at('2026-11-09T15:00'), UTC));
  assert.deepEqual(shotAt(at('2026-11-09T20:13:21'), UTC), shotAt(at('2026-11-09T20:13:21'), UTC));
});

test('shots never repeat back to back and every kind shows up', () => {
  for (const day of [20401, 20402, 20766]) for (let block = 0; block < 4; block++) {
    const seed = sessionSeed(day, block), seen = new Set<string>();
    let prev = '';
    for (let i = 0; i < 1200; i++) {
      const s = shotIn(seed, i * SHOT_S + 1);
      assert.equal(s.index, i);
      assert.notEqual(s.kind, prev, `repeat at shot ${i}`);
      prev = s.kind; seen.add(s.kind);
    }
    assert.equal(seen.size, SHOTS.length);
  }
});

test('different sessions get different orders', () => {
  const seq = (seed: number) => Array.from({ length: 14 }, (_, i) => shotIn(seed, i * SHOT_S).kind).join();
  assert.notEqual(seq(sessionSeed(20401, 0)), seq(sessionSeed(20401, 1)));
  assert.notEqual(seq(sessionSeed(20401, 0)), seq(sessionSeed(20402, 0)));
});

test('each shot fades in and ends on black frames (trailer cut)', () => {
  const seed = sessionSeed(20401, 2);
  assert.equal(shotIn(seed, 0).vis, 0);
  assert.equal(shotIn(seed, FADE_S / 2).vis, 0.5);
  assert.equal(shotIn(seed, 3).vis, 1);
  assert.equal(shotIn(seed, SHOT_S - BLACK_S / 2).vis, 0);
  assert.equal(shotIn(seed, SHOT_S).t, 0);
  assert.notEqual(shotIn(seed, 1).seed, shotIn(seed, SHOT_S + 1).seed);
});
