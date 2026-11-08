// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
// Queue spacing at a zebra crossing on the side-on road (br-traffic.ts): motorcycles stop behind
// cars, or ride beside them (drawn between the lanes), never on top of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUEUE_GAP, type QVeh, besideAny, holdLimit, leadX, overlaps, queueLimit, yieldLimit } from '../src/actors/street-rules.ts';

// Crossing between x 212 and 236 with stop lines 3 px out, as in Praça da Cultura.
const FWD = 209, BACK = 239;
type Sim = QVeh & { sp: number };
const veh = (x: number, len: number, dir: number, moto: boolean, sp: number, lane = dir > 0 ? 1 : 0): Sim => ({ x, len, dir, lane, moto, beside: false, sp });
const car = (x: number, dir = 1, sp = 50) => veh(x, 31, dir, false, sp);
const moto = (x: number, dir = 1, sp = 70) => veh(x, 12, dir, true, sp);

/** One tick of br-traffic's crossing logic (same rules, same order). */
function step(vs: Sim[], dt: number, occupied: boolean) {
  for (const v of vs) {
    const queuing = occupied && !v.beside && yieldLimit(leadX(v), v.dir, FWD, BACK, true) < Infinity;
    v.beside = besideAny(v, vs, queuing ? 0 : 6);
  }
  const held: Sim[] = [];
  for (const v of [...vs].sort((a, b) => leadX(b) * b.dir - leadX(a) * a.dir)) {
    const lim = holdLimit(v, held, FWD, BACK, occupied);
    if (lim < Infinity) held.push(v);
    v.x += v.dir * Math.min(v.sp * dt, lim);
  }
}

/** Pairs in the same lane and row whose bodies overlap (what would draw as one sprite on another). */
function clashes(vs: Sim[]) {
  const out: string[] = [];
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const a = vs[i], b = vs[j];
    if (a.lane === b.lane && a.beside === b.beside && overlaps(a.x, a.len, b.x, b.x + b.len)) out.push(`${i}/${j} at ${a.x.toFixed(1)},${b.x.toFixed(1)}`);
  }
  return out;
}

test('a motorcycle behind a car held at the line stops QUEUE_GAP behind it', () => {
  const c = car(FWD - 31), m = moto(100);
  const lim = queueLimit(m, [c]);
  assert.equal(lim, FWD - 31 - 112 - QUEUE_GAP);
  assert.equal(holdLimit(m, [c], FWD, BACK, true), lim);
  assert.equal(holdLimit(m, [c], FWD, BACK, false), Infinity); // a clear crossing holds no one
  // already that close: may not move at all
  assert.equal(queueLimit(moto(FWD - 31 - 12 - 1), [c]), 0);
  // the oncoming lane mirrors it
  const c2 = car(BACK, -1), m2 = moto(300, -1);
  assert.equal(queueLimit(m2, [c2]), 300 - (BACK + 31) - QUEUE_GAP);
});

test('a motorcycle riding beside a car queues only with others beside it', () => {
  const c = car(FWD - 31), m = { ...moto(FWD - 20), beside: true };
  assert.equal(queueLimit(m, [c]), Infinity);
  assert.equal(holdLimit(m, [c], FWD, BACK, true), 8); // still stops at the line
  assert.ok(besideAny(m, [c, m]));
  assert.ok(!besideAny(car(0), [c])); // only motorcycles ride beside
});

test('motorcycles never overlap a car in their row while queuing at an occupied crossing', () => {
  // near lane (rightbound): car ahead, fast motorcycles behind; far lane mirrors it
  const vs = [car(120), moto(60), moto(30, 1, 80), car(-10), moto(-40), car(330, -1), moto(380, -1), moto(410, -1, 80), car(440, -1)];
  for (let t = 0; t < 600; t++) {
    step(vs, 1 / 30, true);
    assert.deepEqual(clashes(vs), [], `tick ${t}`);
    for (const v of vs) assert.ok(v.dir > 0 ? leadX(v) <= FWD + 1e-9 : leadX(v) >= BACK - 1e-9, 'no one passes an occupied stop line');
  }
  // they all ended up queued, not frozen far away
  assert.ok(Math.abs(leadX(vs[0]) - FWD) < 1e-6);
  assert.ok(vs.filter((v) => v.dir > 0).every((v) => !v.beside));
});

test('a motorcycle caught alongside a car when someone steps on the zebra stops beside it, not on top of it', () => {
  const c = car(150, 1, 40), m = moto(160, 1, 40); // level with the car
  const vs = [c, m, moto(110)];
  for (let t = 0; t < 600; t++) {
    step(vs, 1 / 30, true);
    assert.deepEqual(clashes(vs), [], `tick ${t}`);
  }
  assert.ok(m.beside, 'the one alongside rides beside');
  assert.ok(!vs[2].beside, 'the one arriving later stops behind');
  assert.ok(leadX(vs[2]) <= c.x - QUEUE_GAP + 1e-9);
});

test('random mixed queues never overlap within a row', () => {
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let run = 0; run < 40; run++) {
    const vs: Sim[] = [];
    for (const dir of [1, -1]) {
      let x = dir > 0 ? 150 : 270;
      for (let i = 0; i < 5; i++) {
        const isMoto = rnd() < 0.5, len = isMoto ? 12 : 26 + Math.round(rnd() * 40);
        x -= dir * (len + 20 + rnd() * 60);
        vs.push(veh(dir > 0 ? x : x - len, len, dir, isMoto, 30 + rnd() * 50));
      }
    }
    // crossing busy for 20 s (free flow afterwards is br-traffic's soft following, not modelled here)
    for (let t = 0; t < 600; t++) {
      step(vs, 1 / 30, true);
      assert.deepEqual(clashes(vs), [], `run ${run} tick ${t}`);
    }
  }
});
