// Matches at the Campo da Rodoviária (src/scenes/campo-matches.ts). Run with `pnpm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_HEX, NIGHT_HEX } from '../src/engine/palette.ts';
import {
  COLOURS, CROSSBAR, MIN_DAY, MIN_DISTINCT, MIN_NIGHT, MatchSim, NET, PER_SIDE, PLAY_END, SLOT_STARTS,
  contrasting, dayDist, kitsForDay, matchAt, nightDist, rainPause, slotAt, slotWindow, type Day, type Pitch,
} from '../src/scenes/campo-matches.ts';

const PITCH: Pitch = { x0: 30, x1: 450, y0: 107, y1: 125, mouth0: 112, mouth1: 120 };
const DRY = { rain: 0, storm: 0 };
const hm = (h: number, m: number) => h + m / 60;
const dayKeyStr = (d: Day) => `${d.year}-${d.month + 1}-${d.day}`;

const DAYS: Day[] = [];
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 864e5) {
  const d = new Date(t);
  DAYS.push({ year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() });
}

test('slot boundaries: a match every 1h30 from 08:00, the last ending at 21:00', () => {
  assert.equal(slotAt(hm(7, 59)), -1);
  assert.equal(slotAt(8), 0);
  assert.equal(slotAt(hm(9, 29)), 0);
  assert.equal(slotAt(hm(9, 30)), 1);
  assert.equal(slotAt(hm(20, 59)), 8);
  assert.equal(slotAt(21), -1);
  assert.equal(slotAt(0), -1);
  assert.equal(slotAt(23.99), -1);
  assert.deepEqual([...SLOT_STARTS], [8, 9.5, 11, 12.5, 14, 15.5, 17, 18.5, 20]);
  for (let i = 0; i < SLOT_STARTS.length; i++) {
    const w = slotWindow(i);
    assert.equal(w.end - w.start, i === 8 ? 1 : 1.5);
    assert.equal(slotAt(w.start), i);
    assert.equal(slotAt(w.end - 1e-6), i);
  }
  assert.equal(slotWindow(8).end, PLAY_END);
  assert.equal(matchAt(DAYS[0], hm(7, 59), DRY), null);
  assert.equal(matchAt(DAYS[0], 21, DRY), null);
  assert.equal(matchAt(DAYS[0], hm(18, 30), DRY)!.night, true);
  assert.equal(matchAt(DAYS[0], 20.5, DRY)!.night, true);
  assert.equal(matchAt(DAYS[0], 17.5, DRY)!.night, false);
});

test('kit colours match the palette entries they are drawn with', () => {
  for (const [name, [idx, day, night]] of Object.entries(COLOURS)) {
    assert.equal(DAY_HEX[idx], day, name);
    assert.equal(NIGHT_HEX[idx], night, name);
  }
});

test('kits are deterministic from date and slot', () => {
  for (const d of DAYS.slice(0, 60)) assert.deepEqual(kitsForDay({ ...d }), kitsForDay(d));
  const a = matchAt(DAYS[10], 10, DRY)!, b = matchAt({ ...DAYS[10] }, 10.9, DRY)!;
  assert.deepEqual(a.kits, b.kits);
  assert.equal(a.seed, b.seed);
  // and they actually vary across days
  const firsts = new Set(DAYS.map((d) => kitsForDay(d)[0].teams.map((t) => t.shirt).join('-')));
  assert.ok(firsts.size >= 10, `only ${firsts.size} distinct opening pairs in a year`);
});

test('every slot: two high-contrast shirts, keepers and referee distinct; a new pair each slot', () => {
  for (const d of DAYS) {
    const all = kitsForDay(d);
    assert.equal(all.length, SLOT_STARTS.length);
    const pairings = all.map((k) => k.teams.map((t) => t.shirt).sort().join('+'));
    assert.equal(new Set(pairings).size, pairings.length, `a pairing repeats on ${dayKeyStr(d)}: ${pairings}`);
    all.forEach((k, s) => {
      const [a, b] = k.teams.map((t) => t.shirt);
      assert.notEqual(a, b);
      assert.ok(contrasting(a, b) && dayDist(a, b) >= MIN_DAY && nightDist(a, b) >= MIN_NIGHT, `${a}/${b} too close`);
      assert.notEqual(a, 'green'); assert.notEqual(b, 'green');
      const others = [...k.keepers, k.ref];
      assert.equal(new Set([a, b, ...others]).size, 5, `colours repeat: ${a} ${b} ${others}`);
      for (const o of others) for (const t of [a, b]) assert.ok(dayDist(o, t) >= MIN_DISTINCT, `${o} vs ${t}`);
      for (const t of k.teams) assert.ok(t.shorts in COLOURS);
      if (s > 0) {
        const prev = all[s - 1].teams.map((t) => t.shirt);
        assert.ok(!prev.includes(a) && !prev.includes(b), `slot ${s} reuses a shirt from slot ${s - 1}`);
      }
    });
  }
});

test('heavy rain or a storm (real reading) pauses play; light rain plays on', () => {
  assert.equal(rainPause({ rain: 0.2, storm: 0 }), false);
  assert.equal(rainPause({ rain: 0.5, storm: 0 }), true);
  assert.equal(rainPause({ rain: 0, storm: 0.3 }), true);
  assert.equal(matchAt(DAYS[0], 10, { rain: 0.8, storm: 0 })!.paused, true);
});

/** Run a match for `secs` simulated seconds at 30 fps, checking every frame. */
function run(seed: number, secs: number, each?: (m: MatchSim) => void) {
  const m = new MatchSim(PITCH, seed);
  for (let i = 0; i < secs * 30; i++) { m.step(1 / 30); each?.(m); }
  return m;
}

test('a match has two sides of five plus a keeper and a referee', () => {
  const m = new MatchSim(PITCH, 1);
  assert.equal(m.players.length, PER_SIDE * 2 + 1);
  for (const team of [0, 1]) {
    assert.equal(m.players.filter((p) => p.team === team && p.role === 'out').length, 5);
    assert.equal(m.players.filter((p) => p.team === team && p.role === 'gk').length, 1);
  }
  assert.equal(m.players.filter((p) => p.role === 'ref').length, 1);
});

test('everyone stays on the turf; the ball leaves it only into a net', () => {
  for (const seed of [1, 2, 3]) run(seed, 600, (m) => {
    for (const p of m.players) {
      assert.ok(p.x >= PITCH.x0 && p.x <= PITCH.x1 && p.y >= PITCH.y0 && p.y <= PITCH.y1, `player off the pitch at ${p.x},${p.y}`);
    }
    const b = m.ball;
    if (m.phase === 'goal') {
      assert.ok(b.x === PITCH.x0 - NET || b.x === PITCH.x1 + NET);
      assert.ok(b.y > PITCH.mouth0 && b.y < PITCH.mouth1 && b.z < CROSSBAR);
    } else if (m.phase !== 'play' || m.owner >= 0) {
      assert.ok(b.x >= PITCH.x0 && b.x <= PITCH.x1 && b.y >= PITCH.y0 && b.y <= PITCH.y1, `ball off at ${b.x},${b.y} (${m.phase})`);
    }
  });
});

test('goals happen occasionally, with a celebration then a kickoff from the centre', () => {
  let goals = 0, sawPlay = 0;
  for (const seed of [11, 12, 13, 14]) {
    let was = '', kickoffAfterGoal = 0;
    const m = run(seed, 1800, (m) => {
      if (was === 'goal' && m.phase === 'kickoff') { kickoffAfterGoal++; assert.equal(m.ball.x, (PITCH.x0 + PITCH.x1) / 2); }
      if (m.phase === 'play') sawPlay++;
      was = m.phase;
    });
    assert.equal(m.score[0] + m.score[1], m.goals);
    assert.ok(kickoffAfterGoal >= m.goals - 1);
    goals += m.goals;
  }
  const perHour = goals / 2; // four 30-minute runs
  assert.ok(perHour >= 4 && perHour <= 30, `${perHour} goals per hour`);
  assert.ok(sawPlay > 0);
});

test('the simulation is deterministic for a seed', () => {
  const a = run(7, 120), b = run(7, 120);
  assert.deepEqual(a.score, b.score);
  assert.deepEqual(a.players.map((p) => [p.x, p.y]), b.players.map((p) => [p.x, p.y]));
});

test('paused by rain, players wait on the far touchline and the ball stays put', () => {
  const m = run(5, 30);
  for (let i = 0; i < 30 * 20; i++) m.step(1 / 30, true);
  assert.equal(m.phase, 'paused');
  for (const p of m.players) assert.ok(Math.abs(p.y - PITCH.y0) <= 1, `still at y ${p.y}`);
  const g = m.goals;
  for (let i = 0; i < 30 * 60; i++) m.step(1 / 30, true);
  assert.equal(m.goals, g);
  m.step(1 / 30, false);
  assert.equal(m.phase, 'kickoff');
});
