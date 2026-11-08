// Visitors and mass at the Capelinha das Pedras (src/scenes/capelinha-schedule.ts). Run with `pnpm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ATTENDEES_MAX, ATTENDEES_MIN, DAY_END, DAY_START, MASS_MAX, MASS_MIN, VISIT_MAX, VISIT_MIN, VISITORS_MAX,
  figuresAt, massActive, scheduleFor, type Day, type DaySchedule,
} from '../src/scenes/capelinha-schedule.ts';

const STAGE = { door: 249, worldW: 480 };
const EPS = 1e-9;

/** Every day of 2026 and 2027, with the weekday from the calendar. */
const DAYS: Day[] = [];
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 864e5) {
  const d = new Date(t);
  DAYS.push({ year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() });
}
const ALL = DAYS.map((d) => [d, scheduleFor(d)] as const);
const minutes = (h: number) => h * 60;

test('same date gives the same schedule and the same figures', () => {
  for (const [d, s] of ALL.slice(0, 120)) {
    assert.deepEqual(scheduleFor(d), s);
    for (let h = 0; h < 24; h += 0.05) assert.deepEqual(figuresAt(scheduleFor(d), h, STAGE), figuresAt(s, h, STAGE));
  }
});

test('different dates give different schedules', () => {
  const busy = ALL.filter(([, s]) => s.mass || s.visits.length);
  const keys = new Set(busy.map(([, s]) => JSON.stringify({ m: s.mass, v: s.visits })));
  assert.ok(busy.length > ALL.length * 0.5 && keys.size === busy.length);
});

test('mass: at most one, daytime only, 45 to 60 minutes, 3 to 6 people', () => {
  let masses = 0;
  for (const [, s] of ALL) {
    if (!s.mass) continue;
    masses++;
    const { start, end, attendees } = s.mass;
    assert.ok(start >= DAY_START - EPS && end <= DAY_END + EPS, `${start}-${end}`);
    const len = minutes(end - start);
    assert.ok(len >= MASS_MIN - EPS && len <= MASS_MAX + EPS, `length ${len}`);
    assert.ok(attendees >= ATTENDEES_MIN && attendees <= ATTENDEES_MAX);
  }
  // occasional: some days, not most
  assert.ok(masses > ALL.length * 0.1 && masses < ALL.length * 0.5, `${masses} masses`);
});

test('visits: a few short daytime windows that never overlap each other or the mass', () => {
  for (const [, s] of ALL) {
    assert.ok(s.visits.length <= VISITORS_MAX);
    s.visits.forEach((v, i) => {
      assert.ok(v.start >= DAY_START - EPS && v.end <= DAY_END + EPS);
      const len = minutes(v.end - v.start);
      assert.ok(len >= VISIT_MIN - EPS && len <= VISIT_MAX + EPS, `length ${len}`);
      if (i > 0) assert.ok(v.start >= s.visits[i - 1].end);
      if (s.mass) assert.ok(v.end <= s.mass.start || v.start >= s.mass.end);
    });
  }
});

test('festa days always have a mass, still bounded', () => {
  const s = scheduleFor({ year: 2026, month: 5, day: 27, weekday: 6, festa: true });
  assert.ok(s.mass && s.mass.start === 16 && s.mass.end <= DAY_END);
});

/** Samples a day every 20 seconds. */
function sample(s: DaySchedule, fn: (h: number, n: number) => void) {
  for (let h = 0; h < 24; h += 20 / 3600) fn(h, figuresAt(s, h, STAGE).length);
}

test('nobody at night, and nobody outside the windows', () => {
  for (const [, s] of ALL.slice(0, 200)) sample(s, (h, n) => {
    const inWin = massActive(s, h) || s.visits.some((v) => h >= v.start && h < v.end);
    if (!inWin) assert.equal(n, 0, `hour ${h}`);
    if (h < DAY_START || h >= DAY_END) assert.equal(n, 0, `night hour ${h}`);
  });
});

test('a day without events stays empty all day', () => {
  sample({ key: 0, mass: null, visits: [] }, (_h, n) => assert.equal(n, 0));
});

test('mass figures: priest plus the attendees mid-service, everyone gone at the end', () => {
  const [, s] = ALL.find(([, x]) => x.mass)!;
  const m = s.mass!, mid = (m.start + m.end) / 2, f = figuresAt(s, mid, STAGE);
  assert.equal(f.filter((x) => x.role === 'priest').length, 1);
  assert.equal(f.filter((x) => x.role === 'attendee').length, m.attendees);
  assert.ok(f.every((x) => x.pose === 'stand'));
  // no one blocks the door
  assert.ok(f.filter((x) => x.role === 'attendee').every((x) => Math.abs(x.x - STAGE.door) >= 8));
  assert.equal(figuresAt(s, m.end - 0.5 / 3600, STAGE).length, 0);
  assert.equal(figuresAt(s, m.end, STAGE).length, 0);
});

test('visitor: one person, raises the phone, has left by the end of the window', () => {
  const [, s] = ALL.find(([, x]) => x.visits.length)!;
  const v = s.visits[0];
  let photo = false, flash = false;
  for (let h = v.start; h < v.end; h += 0.1 / 3600) {
    const f = figuresAt(s, h, STAGE);
    assert.ok(f.length <= 1);
    if (f[0]?.pose === 'photo') photo = true;
    if (f[0]?.flash) flash = true;
  }
  assert.ok(photo && flash);
  assert.equal(figuresAt(s, v.end - 1 / 3600, STAGE).length, 0);
});

test('the scene uses no traffic, vehicles or random pedestrians', () => {
  const src = readFileSync(new URL('../src/scenes/capelinha.ts', import.meta.url), 'utf8');
  for (const mod of ['actors/cars', 'actors/br-traffic', 'actors/people']) assert.ok(!src.includes(mod), `imports ${mod}`);
  assert.ok(!/\b(spawnCar|tickTraffic|tickSpawns|spawnPerson|moto|motorcycle)\b/i.test(src));
});
