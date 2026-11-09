// Praça da Cultura: school hours, student flow, sports windows (src/scenes/praca-cultura-schedule.ts)
// and the plaza games (src/scenes/praca-games.ts). Run with `pnpm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARRIVE_H, LATE_H, LEAVE_H, SHIFTS, schoolDay, schoolState, sessionSeed, sportsState, sportsWindowAt, studentFlow,
} from '../src/scenes/praca-cultura-schedule.ts';
import { BAR, GAME_TO, KickSim, NET_D, OUT_MAX, SET_TO, VolleySim, type Court, type Field } from '../src/scenes/praca-games.ts';

const hm = (h: number, m: number) => h + m / 60;
const LIVE = { kind: 'live' as const, rain: 0, snow: 0 };
const WEEK = [1, 2, 3, 4, 5], WEEKEND = [0, 6];
const ALL_DAY = Array.from({ length: 24 * 12 }, (_, i) => i / 12);

test('school days are Monday to Friday; weekends have no shifts, the entrance stays shut and the windows dark', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(schoolDay), [false, true, true, true, true, true, false]);
  for (const wd of WEEKEND) for (const h of ALL_DAY) {
    const s = schoolState(wd, h), f = studentFlow(wd, h);
    assert.ok(!s.inClass && !s.entranceOpen && !s.lit && !s.arriving && !s.leaving, `weekday ${wd} ${h}h`);
    assert.equal(f.arrive + f.leave, 0);
  }
});

test('morning 07:00-12:00 and afternoon 13:00-17:30 shifts: lit windows only in class', () => {
  assert.deepEqual(SHIFTS.map((s) => [s.start, s.end]), [[7, 12], [13, 17.5]]);
  for (const wd of WEEK) {
    assert.equal(schoolState(wd, hm(6, 59)).inClass, false);
    assert.equal(schoolState(wd, 7).shift, 0);
    assert.equal(schoolState(wd, 9).lit, true);
    assert.equal(schoolState(wd, hm(11, 59)).shift, 0);
    assert.equal(schoolState(wd, 12).inClass, false);
    assert.equal(schoolState(wd, hm(12, 45)).lit, false);
    assert.equal(schoolState(wd, 14.5).shift, 1);
    assert.equal(schoolState(wd, hm(17, 29)).lit, true);
    assert.equal(schoolState(wd, 17.5).lit, false);
    for (const h of ALL_DAY) {
      const s = schoolState(wd, h);
      assert.equal(s.lit, s.inClass);
      if (s.inClass) assert.ok(s.entranceOpen, `entrance shut in class at ${h}`);
      if (h < 6.5 || h >= 17.5 + LEAVE_H) assert.ok(!s.entranceOpen && !s.lit, `open at ${h}`); // night and madrugada: shut and dark
    }
  }
});

test('students arrive before each shift and leave after it, never otherwise', () => {
  for (const wd of WEEK) for (const h of ALL_DAY) {
    const f = studentFlow(wd, h), s = schoolState(wd, h);
    assert.ok(f.arrive >= 0 && f.arrive <= 1 && f.leave >= 0 && f.leave <= 1);
    assert.equal(f.arrive > 0, s.arriving, `arrive ${h}`);
    assert.equal(f.leave > 0, s.leaving, `leave ${h}`);
    if (f.arrive > 0 || f.leave > 0) assert.ok(s.entranceOpen, `students but the entrance is shut at ${h}`);
    const near = SHIFTS.some((x) => (h >= x.start - ARRIVE_H && h < x.start + LATE_H) || (h >= x.end && h < x.end + LEAVE_H));
    if (!near) assert.equal(f.arrive + f.leave, 0, `flow at ${h}`);
  }
  // busiest just before the bell, a trickle of latecomers after it
  assert.ok(studentFlow(1, hm(6, 54)).arrive > 0.9);
  assert.ok(studentFlow(1, hm(6, 31)).arrive < 0.3);
  assert.ok(studentFlow(1, hm(7, 9)).arrive < 0.3);
  assert.ok(studentFlow(3, hm(17, 31)).leave > 0.9);
  assert.equal(studentFlow(3, hm(17, 51)).leave, 0);
});

test('sports windows: weekday afternoons after lunch, weekend mornings and afternoons, never at night', () => {
  for (const wd of WEEK) {
    assert.equal(sportsWindowAt(wd, 10), -1); // in class
    assert.equal(sportsWindowAt(wd, hm(13, 59)), -1);
    assert.equal(sportsWindowAt(wd, 14.5), 0);
    assert.equal(sportsWindowAt(wd, 17.5), -1);
  }
  assert.equal(sportsWindowAt(6, 9), 0); assert.equal(sportsWindowAt(6, 12), -1); assert.equal(sportsWindowAt(6, 15), 1);
  assert.equal(sportsWindowAt(0, 9), 0); assert.equal(sportsWindowAt(0, 14.5), -1); assert.equal(sportsWindowAt(0, 16), 1);
  for (const wd of [0, 1, 2, 3, 4, 5, 6]) for (const h of ALL_DAY) {
    if (h < 8 || h >= 17.5) assert.equal(sportsState(wd, h, LIVE), 'off', `${wd} ${h}h`);
  }
});

test('sports follow only the real weather: rain pauses, unknown weather means nobody plays', () => {
  assert.equal(sportsState(2, 15, LIVE), 'play');
  assert.equal(sportsState(2, 15, { kind: 'stale', rain: 0, snow: 0 }), 'play');
  assert.equal(sportsState(2, 15, { kind: 'live', rain: 0.5, snow: 0 }), 'rain');
  assert.equal(sportsState(2, 15, { kind: 'override', rain: 0.5, snow: 0 }), 'rain');
  assert.equal(sportsState(2, 15, { kind: 'unavailable', rain: 0, snow: 0 }), 'off');
  assert.equal(sportsState(2, 15, { kind: 'unavailable', rain: 1, snow: 0 }), 'off');
  assert.equal(sportsState(6, 9, LIVE, true), 'off'); // the craft fair takes the plaza
  assert.notEqual(sessionSeed(20261109, 0, 0), sessionSeed(20261109, 0, 1));
  assert.notEqual(sessionSeed(20261109, 0, 0), sessionSeed(20261110, 0, 0));
});

test('students never cross the plaza while a game is on', () => {
  for (const wd of [0, 1, 2, 3, 4, 5, 6]) for (const h of ALL_DAY) {
    const f = studentFlow(wd, h);
    if (f.arrive + f.leave > 0) assert.equal(sportsState(wd, h, LIVE), 'off', `${wd} ${h}h`);
  }
});

// ---------- football ----------
const FIELD: Field = { x0: 8, x1: 92, y0: 116, y1: 124, mouth0: 118, mouth1: 122 };
/** The portrait field on the lower paving right of the blue steps (praca-cultura.ts FIELD_NARROW). */
const FIELD_NARROW: Field = { x0: 258, x1: 342, y0: 128, y1: 136, mouth0: 130, mouth1: 134 };
function kick(seed: number, secs: number, each?: (m: KickSim) => void, paused = false, F = FIELD) {
  const m = new KickSim(F, seed);
  for (let i = 0; i < secs * 30; i++) { m.step(1 / 30, paused); each?.(m); }
  return m;
}

test('kick-about: two or three a side, everyone on the field, the ball leaves it only into a goal (landscape and portrait fields)', () => {
  for (const F of [FIELD, FIELD_NARROW]) for (const seed of [1, 2, 3, 4]) kick(seed, 600, (m) => {
    assert.ok(m.perSide === 2 || m.perSide === 3);
    assert.equal(m.kids.length, m.perSide * 2);
    for (const p of m.kids) assert.ok(p.x >= F.x0 && p.x <= F.x1 && p.y >= F.y0 && p.y <= F.y1, `kid off at ${p.x},${p.y}`);
    const b = m.ball;
    assert.ok(b.z >= 0);
    if (m.phase === 'goal') {
      assert.ok(b.x === F.x0 - NET_D || b.x === F.x1 + NET_D);
      assert.ok(b.y > F.mouth0 && b.y < F.mouth1);
    } else assert.ok(b.x >= F.x0 && b.x <= F.x1 && b.y >= F.y0 && b.y <= F.y1, `ball off at ${b.x},${b.y} (${m.phase})`);
  }, false, F);
});

test('portrait field: as long as the landscape one, clear of the volleyball court and inside a phone-portrait view', () => {
  assert.equal(FIELD_NARROW.x1 - FIELD_NARROW.x0, FIELD.x1 - FIELD.x0);
  assert.equal(FIELD_NARROW.y1 - FIELD_NARROW.y0, FIELD.y1 - FIELD.y0);
  const court = { x0: 184, x1: 248 };
  assert.ok(FIELD_NARROW.x0 - 3 > court.x1, 'right of the court');
  // a 240 px frame centred on the 480 px world (camX 120), less a few px of cover crop on a tall phone
  assert.ok(FIELD_NARROW.x0 - 3 >= 126 && FIELD_NARROW.x1 + 3 <= 354);
  assert.ok(court.x0 >= 126 && court.x1 <= 354);
});

test('kick-about: goals, celebrations, first to five then a short rest and a new game', () => {
  let goals = 0, games = 0;
  for (const seed of [11, 12, 13, 14]) {
    let rested = false;
    const m = kick(seed, 900, (m) => {
      assert.ok(Math.max(...m.score) <= GAME_TO);
      if (m.phase === 'rest') { rested = true; assert.equal(Math.max(...m.score), GAME_TO); }
    });
    goals += m.goals; games += m.games;
    if (m.games) assert.ok(rested);
  }
  const perHour = goals / 1; // four 15-minute runs
  assert.ok(perHour >= 10 && perHour <= 150, `${perHour} goals per hour`);
  assert.ok(games >= 1, 'no game was ever finished');
  assert.equal(BAR, 5);
});

test('kick-about: rain pauses it at the back of the field, then a kickoff', () => {
  const m = kick(5, 30);
  for (let i = 0; i < 30 * 15; i++) m.step(1 / 30, true);
  assert.equal(m.phase, 'paused');
  for (const p of m.kids) assert.ok(Math.abs(p.y - FIELD.y0) < 0.6, `still at y ${p.y}`);
  const g = m.goals;
  for (let i = 0; i < 30 * 60; i++) m.step(1 / 30, true);
  assert.equal(m.goals, g);
  m.step(1 / 30, false);
  assert.equal(m.phase, 'kickoff');
});

test('kick-about is deterministic for a seed', () => {
  const a = kick(7, 120), b = kick(7, 120);
  assert.deepEqual(a.score, b.score);
  assert.deepEqual(a.kids.map((p) => [p.x, p.y]), b.kids.map((p) => [p.x, p.y]));
});

// ---------- volleyball ----------
const COURT: Court = { x0: 184, net: 216, x1: 248, y0: 119, y1: 124 };
function volley(seed: number, secs: number, each?: (m: VolleySim) => void) {
  const m = new VolleySim(COURT, seed);
  for (let i = 0; i < secs * 30; i++) { m.step(1 / 30); each?.(m); }
  return m;
}

test('volleyball: two a side, each player stays in their own half, the ball lands near the court', () => {
  for (const seed of [1, 2, 3, 4]) volley(seed, 600, (m) => {
    assert.equal(m.kids.length, 4);
    m.kids.forEach((p, i) => {
      assert.equal(p.team, i < 2 ? 0 : 1);
      const [a, b] = m.half(p.team);
      assert.ok(p.x >= a && p.x <= b && p.y >= COURT.y0 && p.y <= COURT.y1, `player ${i} out of the half at ${p.x},${p.y}`);
      assert.ok(i < 2 ? p.x < COURT.net : p.x > COURT.net);
    });
    const b = m.ball;
    assert.ok(b.z >= 0 && b.z < 40, `ball height ${b.z}`);
    assert.ok(b.x >= COURT.x0 - OUT_MAX && b.x <= COURT.x1 + OUT_MAX && b.y >= COURT.y0 - OUT_MAX && b.y <= COURT.y1 + OUT_MAX, `ball at ${b.x},${b.y}`);
  });
});

test('volleyball: rallies with up to three touches, points, sets to seven and a break', () => {
  let points = 0, sets = 0, three = 0;
  for (const seed of [21, 22, 23, 24]) {
    let sawBreak = false;
    const m = volley(seed, 900, (m) => {
      assert.ok(Math.max(...m.score) <= SET_TO);
      assert.ok(m.touches <= 3, `${m.touches} touches`);
      if (m.phase === 'break') sawBreak = true;
    });
    points += m.points; sets += m.sets; if (m.touchesMax === 3) three++;
    if (m.sets) assert.ok(sawBreak);
  }
  assert.ok(points >= 40, `only ${points} points in an hour`);
  assert.ok(points <= 1200, `${points} points in an hour`);
  assert.ok(sets >= 2, `${sets} sets`);
  assert.ok(three >= 2, 'rallies never reach a third touch');
});

test('volleyball: rain sends the players to the back of their halves, then a serve', () => {
  const m = volley(9, 20);
  for (let i = 0; i < 30 * 15; i++) m.step(1 / 30, true);
  assert.equal(m.phase, 'paused');
  for (const p of m.kids) assert.ok(Math.abs(p.y - COURT.y0) < 0.6);
  const pts = m.points;
  for (let i = 0; i < 30 * 30; i++) m.step(1 / 30, true);
  assert.equal(m.points, pts);
  m.step(1 / 30, false);
  assert.equal(m.phase, 'serve');
});

test('volleyball is deterministic for a seed', () => {
  const a = volley(3, 120), b = volley(3, 120);
  assert.deepEqual(a.score, b.score);
  assert.deepEqual(a.kids.map((p) => [p.x, p.y]), b.kids.map((p) => [p.x, p.y]));
});
