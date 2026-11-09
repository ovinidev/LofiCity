// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
// Partage Shopping's hours, shared by its street front and its inside (src/scenes/partage-rules.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHUTTER_MIN, cinemaDoorTap, doorTap, hoursOn, insideCrowd, mallOpen, shutterAt } from '../src/scenes/partage-rules.ts';
import { doorTap as roomDoor } from '../src/scenes/cinema-rules.ts';

const MINUTES = Array.from({ length: 24 * 60 }, (_, m) => m / 60);
const N = 10;

test('hours: Monday to Saturday 10h-22h, Sundays 14h-20h', () => {
  assert.deepEqual(hoursOn(0), [14, 20]);
  for (let d = 1; d <= 6; d++) assert.deepEqual(hoursOn(d), [10, 22]);
  assert.equal(mallOpen(1, 9.99), false);
  assert.equal(mallOpen(1, 10), true);
  assert.equal(mallOpen(1, 21.99), true);
  assert.equal(mallOpen(1, 22), false);
  assert.equal(mallOpen(0, 12), false);
  assert.equal(mallOpen(0, 14), true);
  assert.equal(mallOpen(0, 20), false);
});

test('the door lets you in exactly while the mall is open, otherwise says when it opens', () => {
  for (let d = 0; d < 7; d++) for (const h of MINUTES) assert.equal(doorTap(d, h).enter, mallOpen(d, h), `day ${d} ${h}`);
  assert.deepEqual(doorTap(1, 8), { enter: false, say: 'Fechado, abre às 10h' });
  assert.deepEqual(doorTap(0, 11), { enter: false, say: 'Fechado, abre às 14h' });
  assert.deepEqual(doorTap(6, 23), { enter: false, say: 'Fechado, abre amanhã às 14h' }); // Saturday night: Sunday opens at 14h
  assert.deepEqual(doorTap(0, 21), { enter: false, say: 'Fechado, abre amanhã às 10h' });
});

test('shutters: all up while open, all down while closed, staggered over the last minutes', () => {
  for (let d = 0; d < 7; d++) for (const h of MINUTES) for (let i = 0; i < N; i++) {
    const s = shutterAt(d, h, i, N);
    assert.ok(s >= 0 && s <= 1);
    if (!mallOpen(d, h)) assert.equal(s, 1);
    else if ((hoursOn(d)[1] - h) * 60 > SHUTTER_MIN) assert.equal(s, 0, `day ${d} ${h} shop ${i}`);
  }
  // in the last minutes some shops are already down while others are still open
  const h = 22 - 5 / 60, states = Array.from({ length: N }, (_, i) => shutterAt(1, h, i, N));
  assert.ok(states.some((s) => s === 1) && states.some((s) => s === 0), JSON.stringify(states));
  // a shutter only ever goes down as closing comes nearer
  for (let i = 0; i < N; i++) for (let m = 1; m < SHUTTER_MIN * 4; m++) {
    assert.ok(shutterAt(1, 22 - (m - 1) / 240, i, N) >= shutterAt(1, 22 - m / 240, i, N));
  }
  // just before closing every shutter is down
  for (let i = 0; i < N; i++) assert.equal(shutterAt(1, 22 - 0.5 / 60, i, N), 1);
});

test('the crowd inside: nobody while closed, thins out before closing, busier evenings and weekends', () => {
  for (let d = 0; d < 7; d++) for (const h of MINUTES) {
    const k = insideCrowd(d, h);
    if (!mallOpen(d, h)) assert.equal(k, 0);
    else assert.ok(k > 0 && k <= 3);
  }
  assert.ok(insideCrowd(2, 19) > insideCrowd(2, 15));
  assert.ok(insideCrowd(6, 15) > insideCrowd(2, 15));
  assert.ok(insideCrowd(2, 22 - 5 / 60) < insideCrowd(2, 21));
});

test('the cinema door inside the mall: in only while both the mall and the cinema are open', () => {
  for (let d = 0; d < 7; d++) for (const h of MINUTES) {
    const c = cinemaDoorTap(d, h);
    assert.equal(c.enter, mallOpen(d, h) && roomDoor(h).enter, `day ${d} ${h}`);
  }
  assert.deepEqual(cinemaDoorTap(1, 11), { enter: false, say: 'Fechado, volta às 14h' }); // mall open, cinema not yet
  assert.equal(cinemaDoorTap(1, 15).enter, true);
});
