import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_GAP, MATRIZ_PARK, NIGHT_GAP, PARK_FROM_MS, PARK_SLOT_MS, PARK_TO_MS, makePatrolClock, officerLine, parkClearOfRoad, parkedAt,
  patrolDue, patrolGap, patrolSpawned, policeCity, policeForced, policeNight, tickPatrol,
} from '../src/actors/police-rules.ts';
import { CROSS0, CROSS1, curbL } from '../src/actors/matriz-road.ts';

const CITIES = ['esperanca', 'campina', 'joao-pessoa', 'areia', 'remigio', 'tokyo'];

test('patrols only in Esperança, even with the test override', () => {
  for (const city of CITIES) {
    const c = makePatrolClock(1); c.wait = 0;
    assert.equal(policeCity(city), city === 'esperanca');
    assert.equal(patrolDue(c, { city, forced: false }, false), city === 'esperanca');
    assert.equal(patrolDue(c, { city, forced: true }, false), city === 'esperanca');
    assert.equal(parkedAt(0, 21, city, true), city === 'esperanca');
  }
});

test('the next patrol is 15-30 min away by day and 10-20 min at night', () => {
  assert.deepEqual([DAY_GAP[0], DAY_GAP[1]], [900, 1800]);
  assert.deepEqual([NIGHT_GAP[0], NIGHT_GAP[1]], [600, 1200]);
  assert.equal(patrolGap(0, false), 900); assert.equal(patrolGap(1, false), 1800);
  assert.equal(patrolGap(0, true), 600); assert.equal(patrolGap(1, true), 1200);
  assert.equal(patrolGap(NaN, false), 1350);
  assert.ok(policeNight(21.5) && policeNight(3) && policeNight(18.5) && !policeNight(6) && !policeNight(15));
  const c = makePatrolClock(42);
  for (let i = 0; i < 200; i++) {
    const night = i % 2 === 1;
    patrolSpawned(c, night ? 22 : 10);
    const [a, b] = night ? NIGHT_GAP : DAY_GAP;
    assert.ok(c.wait >= a && c.wait <= b, `${c.wait}`);
  }
  assert.equal(c.spawned, 200);
});

test('the cooldown runs only while Esperança traffic is watched, and is never skipped', () => {
  const c = makePatrolClock(7, 12);
  assert.ok(c.wait >= DAY_GAP[0], 'opening the app never brings a patrol at once');
  const w = c.wait;
  tickPatrol(c, 60, 'campina'); tickPatrol(c, -1, 'esperanca'); tickPatrol(c, NaN, 'esperanca');
  assert.equal(c.wait, w);
  tickPatrol(c, 3600, 'esperanca'); // a tab back from the background: one capped step, not an hour
  assert.equal(c.wait, w - 0.5);
  assert.equal(patrolDue(c, { city: 'esperanca', forced: false }, false), false);
  // simulate viewing at 30 fps: a patrol comes due once its interval has passed, not before
  let t = 0;
  while (!patrolDue(c, { city: 'esperanca', forced: false }, false)) { tickPatrol(c, 1 / 30, 'esperanca'); t += 1 / 30; }
  assert.ok(Math.abs(t - (w - 0.5)) < 0.1);
  assert.equal(patrolDue(c, { city: 'esperanca', forced: false }, true), false, 'one patrol on a road at a time');
});

test('#police=1 forces a patrol whenever none is on the road; nothing else does', () => {
  assert.ok(policeForced('#police=1'));
  assert.ok(policeForced('#city=esperanca&scene=rua-comercio&police=1'));
  assert.ok(policeForced('#police=1&debug'));
  for (const h of ['', '#police=0', '#police=10', '#police=yes', '#nopolice=1', '#city=esperanca']) assert.ok(!policeForced(h), h);
  const c = makePatrolClock(3);
  assert.ok(c.wait > 0);
  assert.equal(patrolDue(c, { city: 'esperanca', forced: true }, false), true);
  assert.equal(patrolDue(c, { city: 'esperanca', forced: true }, true), false);
});

test('the parked pair at the Matriz: rare clock slots, reproducible, always with the test', () => {
  const base = Date.UTC(2026, 10, 10, 18), slots = 3000;
  let n = 0;
  for (let i = 0; i < slots; i++) {
    const mid = base + i * PARK_SLOT_MS + PARK_FROM_MS + 60_000;
    const on = parkedAt(mid, 15, 'esperanca', false);
    if (on) n++;
    assert.equal(parkedAt(mid, 15, 'esperanca', false), on, 'same instant, same answer');
    assert.equal(parkedAt(base + i * PARK_SLOT_MS + 60_000, 15, 'esperanca', false), false, 'not in a slot\'s first minutes');
    assert.equal(parkedAt(base + i * PARK_SLOT_MS + PARK_TO_MS, 15, 'esperanca', false), false, 'gone before the slot ends');
  }
  assert.ok(n > slots * 0.07 && n < slots * 0.17, `day share ${n / slots}`);
  let night = 0;
  for (let i = 0; i < slots; i++) if (parkedAt(base + i * PARK_SLOT_MS + PARK_FROM_MS, 22, 'esperanca', false)) night++;
  assert.ok(night > n, 'a little likelier at night');
  assert.equal(parkedAt(base, 15, 'esperanca', true), true);
  assert.equal(parkedAt(NaN, 15, 'esperanca', false), false);
});

test('the parked viatura stands off the road and the zebra', () => {
  assert.ok(parkClearOfRoad());
  const p = MATRIZ_PARK;
  assert.ok(p.y > CROSS1, 'in front of the zebra rows, not on them');
  for (let y = CROSS0; y <= p.y; y++) assert.ok(Math.max(p.x + p.len, p.officerX + 4) < curbL(y) - 2, `row ${y}`);
  assert.equal(parkClearOfRoad({ ...p, x: 270 }), false);
});

test('the officer greets for the hour, mostly', () => {
  assert.equal(officerLine(8, 0), 'Bom dia, cidadão!');
  assert.equal(officerLine(15, 0), 'Boa tarde, cidadão!');
  assert.equal(officerLine(21.5, 0), 'Boa noite, cidadão!');
  assert.equal(officerLine(2, 2), 'Boa noite, cidadão!');
  assert.equal(officerLine(15, 1), 'Tudo tranquilo por aqui.');
  assert.equal(officerLine(15, 3), 'Qualquer coisa, ligue 190.');
  assert.equal(officerLine(15, -4), 'Boa tarde, cidadão!');
});
