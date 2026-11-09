// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIENT_EXCLUDED, AMBIENT_SCENES, HOURS, MADRUGADA_END, SLOTS_PER_HOUR, SLOT_GAP_MS, SLOT_MS,
  type AmbientWx, ambientAt, cueAllowed, nextPlanned, plannedEvent, slotAt, weatherAllows,
} from '../src/actors/ambient-rules.ts';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const SCENES = Object.keys(AMBIENT_SCENES);
const DRY: AmbientWx = { kind: 'live', rain: 0, snow: 0 };
const RAIN: AmbientWx = { kind: 'live', rain: 0.6, snow: 0 };
const UNKNOWN: AmbientWx = { kind: 'unavailable', rain: 0, snow: 0 };
/** 2026-03-02 00:00 in Brasília (UTC-3), a Monday. */
const T0 = Date.UTC(2026, 2, 2, 3);
const DAYS = 28;
/** Every planned event in a scene over DAYS days, with its local start hour. */
function plan(scene: string) {
  const s0 = slotAt(scene, T0), out = [];
  for (let s = s0; s < s0 + DAYS * 24 * SLOTS_PER_HOUR; s++) {
    const ev = plannedEvent(scene, s);
    if (ev) out.push({ ev, slot: s, hour: (((ev.start - 3 * HOUR) % DAY) + DAY) % DAY / HOUR });
  }
  return out;
}

test('rare: never more than one event per slot, a few per hour on average', () => {
  for (const scene of SCENES) {
    const evs = plan(scene), perHour = new Map<number, number>();
    for (const { ev } of evs) { const h = Math.floor((ev.start - T0) / HOUR); perHour.set(h, (perHour.get(h) ?? 0) + 1); }
    for (const n of perHour.values()) assert.ok(n <= SLOTS_PER_HOUR, `${scene}: ${n} in one hour`);
    const day = evs.filter((e) => e.hour >= 8 && e.hour < 18).length / (DAYS * 10);
    assert.ok(day >= 0.5 && day <= 3.5, `${scene}: ${day.toFixed(2)} per daytime hour`);
    assert.ok(evs.length / (DAYS * 24) <= 3, `${scene}: too many overall`);
  }
});

test('one at a time: each event fits inside its slot, leaving a quiet gap before the next', () => {
  for (const scene of SCENES) {
    let prevEnd = -Infinity;
    for (const { ev, slot } of plan(scene)) {
      assert.equal(slotAt(scene, ev.start), slot);
      assert.ok(ev.end > ev.start);
      assert.ok(ev.end - ev.start < SLOT_MS - SLOT_GAP_MS);
      assert.ok(slotAt(scene, ev.end + SLOT_GAP_MS - 1) === slot, `${scene}: event spills into the next slot`);
      assert.ok(ev.start >= prevEnd + SLOT_GAP_MS, `${scene}: overlap`);
      prevEnd = ev.end;
    }
  }
  // and the instant query agrees: sampling every 20 s, nothing but the slot's own event is ever active
  for (const scene of SCENES) for (let t = T0; t < T0 + 2 * DAY; t += 20_000) {
    const ev = ambientAt(scene, t, DRY);
    if (ev) assert.ok(t >= ev.start && t < ev.end);
  }
});

test('madrugada (00–05): only the occasional street dog', () => {
  for (const scene of SCENES) {
    const night = plan(scene).filter((e) => e.hour < MADRUGADA_END);
    for (const { ev } of night) assert.equal(ev.kind, 'dog-follow', `${scene} at madrugada: ${ev.kind}`);
    assert.ok(night.length / (DAYS * MADRUGADA_END) < 1, `${scene}: dogs too often at night`);
  }
  // at least one dog somewhere at madrugada over four weeks, so it really is occasional, not never
  assert.ok(SCENES.some((s) => plan(s).some((e) => e.hour < MADRUGADA_END)));
});

test('each kind only starts within its hours and only in scenes that list it', () => {
  for (const scene of SCENES) for (const { ev, hour } of plan(scene)) {
    assert.ok(AMBIENT_SCENES[scene].kinds.includes(ev.kind));
    const [a, b] = HOURS[ev.kind];
    assert.ok(hour >= a && hour < b, `${scene} ${ev.kind} at ${hour.toFixed(2)}`);
    if (ev.kind === 'vendor') assert.ok(ev.vendor);
  }
  // only João Pessoa sells água de coco
  for (const scene of SCENES) if (AMBIENT_SCENES[scene].city !== 'joaopessoa')
    assert.ok(plan(scene).every(({ ev }) => ev.vendor !== 'coco'));
});

test('scene exclusions: Capelinha, Matriz and the rest never get an event; motos only where there is a road', () => {
  for (const scene of AMBIENT_EXCLUDED) {
    assert.ok(!(scene in AMBIENT_SCENES));
    for (let t = T0; t < T0 + DAY; t += 60_000) assert.equal(ambientAt(scene, t, DRY), null);
    assert.equal(nextPlanned(scene, T0), null);
  }
  assert.ok(!AMBIENT_SCENES['parque-da-crianca'].kinds.includes('moto-delivery')); // a park path, no road
  assert.ok(!AMBIENT_SCENES['praca-cultura'].kinds.includes('moto-delivery'));
  for (const scene of SCENES) assert.ok(['esperanca', 'campina', 'joaopessoa'].includes(AMBIENT_SCENES[scene].city));
  assert.equal(ambientAt('konbini', T0 + 12 * HOUR, DRY), null);
});

test('deterministic: same scene and instant, same event; scenes differ', () => {
  for (const scene of SCENES) {
    const a = plan(scene), b = plan(scene);
    assert.deepEqual(a, b);
    for (const { ev } of a.slice(0, 40)) {
      assert.deepEqual(ambientAt(scene, (ev.start + ev.end) / 2, DRY), ev); // a dry live reading allows every kind
      assert.equal(ambientAt(scene, ev.start - 1, DRY), null);
      assert.equal(ambientAt(scene, ev.end, DRY), null);
    }
  }
  const starts = (s: string) => plan(s).map(({ ev }) => Math.round(ev.start / 1000)).join();
  assert.notEqual(starts('rua-comercio'), starts('estacao-velha'));
});

test('weather: rain keeps fair-weather events away; unknown weather never counts as dry', () => {
  for (const kind of ['vendor', 'kid-ball', 'pigeons'] as const) {
    assert.equal(weatherAllows(kind, DRY), true);
    assert.equal(weatherAllows(kind, { kind: 'stale', rain: 0, snow: 0 }), true);
    assert.equal(weatherAllows(kind, { kind: 'override', rain: 0, snow: 0 }), true);
    assert.equal(weatherAllows(kind, RAIN), false);
    assert.equal(weatherAllows(kind, { kind: 'stale', rain: 0.4, snow: 0 }), false);
    assert.equal(weatherAllows(kind, UNKNOWN), false);
    assert.equal(weatherAllows(kind, { kind: 'unavailable', rain: 0.9, snow: 0 }), false);
  }
  assert.equal(weatherAllows('cat-wall', RAIN), false);
  assert.equal(weatherAllows('cat-wall', UNKNOWN), true); // a cat on a wall says nothing about the sky
  for (const kind of ['dog-follow', 'moto-delivery'] as const)
    for (const wx of [DRY, RAIN, UNKNOWN]) assert.equal(weatherAllows(kind, wx), true);
  // the weather only cancels: it never changes what a slot holds or when
  for (const scene of SCENES) for (const { ev } of plan(scene)) {
    const mid = (ev.start + ev.end) / 2;
    const wet = ambientAt(scene, mid, RAIN), unk = ambientAt(scene, mid, UNKNOWN);
    if (wet) assert.deepEqual(wet, ev);
    if (unk) assert.deepEqual(unk, ev);
    if (['vendor', 'kid-ball', 'pigeons'].includes(ev.kind)) { assert.equal(wet, null); assert.equal(unk, null); }
  }
});

test('next planned event is in the future and matches the plan', () => {
  for (const scene of SCENES) {
    const ev = nextPlanned(scene, T0 + 10 * HOUR);
    assert.ok(ev && ev.start > T0 + 10 * HOUR);
    assert.deepEqual(plannedEvent(scene, slotAt(scene, ev.start)), ev);
  }
});

test('sound cue only with ambience on, audio unlocked and the radio off', () => {
  assert.equal(cueAllowed({ soundOn: true, unlocked: true, radioOn: false }), true);
  for (const [soundOn, unlocked, radioOn] of [[false, true, false], [true, false, false], [true, true, true], [false, false, true]])
    assert.equal(cueAllowed({ soundOn, unlocked, radioOn }), false);
});
