// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
// The traffic light at Centro · Casa de Amigos (signal-rules.ts, used by br-traffic.ts): the phase
// cycle, the stop / go decision on yellow by distance, one-way spawning, and the pedestrian phase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGNAL, type Phase, cycleLength, mayGo, nextCommitted, pedestrianLight, pedestrianMayStart, signalAt, spawnDir, stoppingDistance,
} from '../src/actors/signal-rules.ts';
import { type QVeh, QUEUE_GAP, leadX, queueLimit } from '../src/actors/street-rules.ts';

test('the cycle runs green -> yellow -> red with the plan durations, and repeats', () => {
  const { green, yellow, red } = SIGNAL;
  assert.equal(cycleLength(), green + yellow + red);
  assert.equal(signalAt(0).phase, 'green');
  assert.equal(signalAt(green - 0.01).phase, 'green');
  assert.equal(signalAt(green).phase, 'yellow');
  assert.equal(signalAt(green + yellow - 0.01).phase, 'yellow');
  assert.equal(signalAt(green + yellow).phase, 'red');
  assert.equal(signalAt(cycleLength() - 0.01).phase, 'red');
  assert.equal(signalAt(cycleLength()).phase, 'green');
  assert.equal(signalAt(5 + 3 * cycleLength()).phase, signalAt(5).phase);
  assert.equal(signalAt(-1).phase, 'red'); // negative times wrap
  const s = signalAt(green + 1);
  assert.equal(s.elapsed, 1);
  assert.equal(s.left, yellow - 1);
});

test('realistic durations: 3-5 s of yellow, green and red long enough to matter', () => {
  assert.ok(SIGNAL.yellow >= 3 && SIGNAL.yellow <= 5);
  assert.ok(SIGNAL.green >= 15 && SIGNAL.red >= 15);
  assert.ok(SIGNAL.clear >= 1);
});

test('phases follow each other in order, never skipping yellow', () => {
  const next: Record<Phase, Phase> = { green: 'yellow', yellow: 'red', red: 'green' };
  let prev = signalAt(0).phase;
  for (let t = 0.1; t < 3 * cycleLength(); t += 0.1) {
    const p = signalAt(t).phase;
    if (p !== prev) { assert.equal(p, next[prev]); prev = p; }
  }
});

test('green: go; red: stop before the line; past the line: always go', () => {
  assert.equal(mayGo('green', 30, 50), true);
  assert.equal(mayGo('red', 30, 50), false);
  assert.equal(mayGo('red', 0, 0), false); // standing at the line
  assert.equal(mayGo('red', 200, 50), false);
  assert.equal(mayGo('red', -5, 50), true); // already through: clear the crossing
  assert.equal(mayGo('yellow', -5, 50), true);
});

test('yellow: stop if it can stop in time before the line, otherwise proceed', () => {
  const v = 50, need = stoppingDistance(v);
  assert.ok(need > 0);
  assert.equal(mayGo('yellow', need + 10, v), false, 'far enough to stop: stops');
  assert.equal(mayGo('yellow', need - 10, v), true, 'too close to stop comfortably: proceeds');
  // a slow vehicle close to the line can still stop
  assert.equal(mayGo('yellow', 10, 5), false);
  // stopping distance grows with speed
  assert.ok(stoppingDistance(70) > stoppingDistance(40));
});

test('a vehicle that went on yellow stays committed into red, until past the line or green', () => {
  let c = nextCommitted('yellow', 8, mayGo('yellow', 8, 60), false);
  assert.equal(c, true);
  assert.equal(mayGo('red', 2, 60, c), true);
  c = nextCommitted('red', 2, true, c);
  assert.equal(c, true);
  assert.equal(nextCommitted('red', -3, true, c), false); // past the line
  assert.equal(nextCommitted('green', 5, true, true), false);
  // a vehicle that arrives on red is never committed
  assert.equal(nextCommitted('red', 40, mayGo('red', 40, 50), false), false);
});

test('one-way road: every vehicle drives left to right, on both lanes; two-way unchanged', () => {
  for (const lane of [0, 1]) assert.equal(spawnDir(lane, 1), 1);
  assert.equal(spawnDir(0, 0), -1);
  assert.equal(spawnDir(1, 0), 1);
});

test('pedestrians may start only during red, after the clearance, with time to cross', () => {
  const cross = 6, { green, yellow, red, clear } = SIGNAL;
  for (let t = 0; t < cycleLength(); t += 0.05) {
    const s = signalAt(t), ok = pedestrianMayStart(s, cross);
    if (ok) {
      assert.equal(s.phase, 'red', `walk at t=${t.toFixed(2)} outside red`);
      assert.ok(s.elapsed >= clear);
      assert.ok(s.left >= cross + clear, 'off the road before vehicles get green');
    }
    assert.equal(pedestrianLight(s, cross), ok ? 'walk' : 'dont');
  }
  assert.equal(pedestrianMayStart(signalAt(green + yellow + clear + 1), cross), true);
  assert.equal(pedestrianMayStart(signalAt(green + yellow + 0.5), cross), false); // opening clearance
  assert.equal(pedestrianMayStart(signalAt(green + yellow + red - cross - clear + 0.5), cross), false); // too late to finish
  assert.equal(pedestrianMayStart(signalAt(1), cross), false);
  assert.equal(pedestrianMayStart(signalAt(green + 1), cross), false);
});

/** A small simulation of br-traffic's one-way approach to the light: same decision and queue rules. */
test('simulated traffic: nobody runs the red uncommitted, nobody overlaps, nobody drives right to left, all resume on green', () => {
  const STOP = 67, dt = 1 / 30;
  type Sim = QVeh & { sp: number; cruise: number; committed: boolean };
  const vs: Sim[] = [];
  let t = 0, spawnT = 0, n = 0, redRuns = 0, passedOnGreen = 0;
  for (let step = 0; step < 30 * 300; step++) {
    t += dt;
    const ph = signalAt(t).phase;
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 1.5 + ((n * 7919) % 13) / 4;
      const lane = n % 2, len = n % 3 === 0 ? 12 : 31, x = -len - 40;
      if (!vs.some((o) => o.lane === lane && o.x < x + len + 20)) vs.push({ x, len, dir: spawnDir(lane, 1), lane, moto: false, beside: false, sp: 50, cruise: 40 + (n % 4) * 8, committed: false });
      n++;
    }
    vs.sort((a, b) => leadX(b) - leadX(a)); // front first, as br-traffic does at a crossing
    const held: Sim[] = [], ahead: Sim[] = [];
    for (const v of vs) {
      assert.equal(v.dir, 1);
      const dist = STOP - leadX(v), go = mayGo(ph, dist, v.sp, v.committed);
      v.committed = nextCommitted(ph, dist, go, v.committed);
      let lim = go ? Infinity : Math.max(0, dist);
      lim = Math.min(lim, queueLimit(v, held));
      if (lim < Infinity) held.push(v);
      const want = Math.min(v.cruise, lim < Infinity ? lim * 1.5 : Infinity);
      v.sp += (want - v.sp) * Math.min(1, dt * 2);
      // free-flow car following (br-traffic slows behind the vehicle ahead); here simply never closer than the queue gap
      const move = Math.min(v.sp * dt, lim, queueLimit(v, ahead));
      if (move < v.sp * dt) v.sp = move / dt;
      ahead.push(v);
      const wasBefore = STOP - leadX(v) >= -0.5;
      v.x += v.dir * move;
      if (wasBefore && STOP - leadX(v) < -0.5) {
        if (ph === 'red' && !v.committed) redRuns++;
        if (ph === 'green') passedOnGreen++;
      }
    }
    // no two vehicles in a lane overlap
    for (const a of vs) for (const b of vs) if (a !== b && a.lane === b.lane) assert.ok(a.x + a.len <= b.x + 1e-6 || b.x + b.len <= a.x + 1e-6, 'overlap');
    for (let i = vs.length - 1; i >= 0; i--) if (vs[i].x > 600) vs.splice(i, 1);
  }
  assert.equal(redRuns, 0);
  assert.ok(passedOnGreen > 10, 'traffic flows on green');
  assert.ok(QUEUE_GAP > 0);
});
