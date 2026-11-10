// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUDY_MIN, EGG_DUR, EGG_IDS, EGG_SCENES, EGG_SPOTS, type EggCond, type EggId, KONAMI, NIGHT_DAYK, SLOT_GAP_MS, SLOT_MS,
  eggAt, eggLine, eggsIn, forcedEgg, gateOpen, konamiEgg, konamiStep, parseEggParam, plannedEgg, slotAt,
} from '../src/actors/egg-rules.ts';
import { AMBIENT_SCENES, SLOTS_PER_HOUR as AMB_SLOTS, plannedEvent, slotAt as ambSlot } from '../src/actors/ambient-rules.ts';
import { readFileSync, readdirSync } from 'node:fs';

// The scene lists per city, parsed from the sources (scene modules need a DOM), as in scene-rules.test.ts.
const ROOT = new URL('../', import.meta.url), read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
const index = read('src/scenes/index.ts');
const fileOf = new Map([...index.matchAll(/import \{ (\w+) \} from '\.\/([\w-]+)';/g)].map((m) => [m[1], m[2]]));
const idOf = new Map(readdirSync(new URL('src/scenes', ROOT)).filter((f) => f.endsWith('.ts')).flatMap((f) => {
  const m = /export const (\w+): Scene = \{\s*id: '([\w-]+)'/.exec(read(`src/scenes/${f}`));
  return m ? [[m[1], m[2]] as const] : [];
}));
const SCENES: Record<string, string[]> = Object.fromEntries([...index.matchAll(/^\s+(\w+): \[([^\]]*)\],$/gm)]
  .map((m) => [m[1], m[2].split(',').map((s) => s.trim()).filter(Boolean).map((n) => { assert.ok(fileOf.has(n)); return idOf.get(n)!; })]));

const HOUR = 3_600_000, DAY = 24 * HOUR;
/** 2026-03-02 00:00 in Brasília (UTC-3). */
const T0 = Date.UTC(2026, 2, 2, 3);
const DAYS = 28;
const wx = (kind: EggCond['wx']['kind'], rain = 0, cloud = 0) => ({ kind, rain, snow: 0, cloud });
const DAY_CLEAR: EggCond = { dayK: 1, wx: wx('live') };
const NIGHT_CLEAR: EggCond = { dayK: 0, wx: wx('live') };
const NIGHT_CLOUDY: EggCond = { dayK: 0, wx: wx('live', 0, 0.6) };
const NIGHT_RAIN: EggCond = { dayK: 0, wx: wx('live', 0.6, 0.95) };
const DAY_RAIN: EggCond = { dayK: 1, wx: wx('live', 0.6, 0.95) };
const ALL = [DAY_CLEAR, NIGHT_CLEAR, NIGHT_CLOUDY, NIGHT_RAIN, DAY_RAIN];

function plan(scene: string, days = DAYS) {
  const s0 = slotAt(T0), out = [];
  for (let s = s0; s < s0 + (days * DAY) / SLOT_MS; s++) { const e = plannedEgg(scene, s); if (e) out.push({ e, slot: s }); }
  return out;
}

test('eggs live only in Esperança scenes', () => {
  const esp = SCENES.esperanca;
  assert.ok(esp && esp.length >= 10);
  for (const s of EGG_SCENES) assert.ok(esp.includes(s), `${s} is not an Esperança scene`);
  for (const s of esp) if (!['onibus', 'cinema-partage'].includes(s)) assert.ok(eggsIn(s).length >= 1, `${s} hosts no egg`);
  for (const [city, list] of Object.entries(SCENES)) if (city !== 'esperanca') for (const s of list) {
    assert.equal(eggsIn(s).length, 0, s);
    for (const c of ALL) for (let t = T0; t < T0 + 2 * DAY; t += 60_000) assert.equal(eggAt(s, t, c), null, `${s} at ${t}`);
    for (const id of EGG_IDS) assert.equal(eggAt(s, T0, DAY_CLEAR, { id, anchor: T0 }), null, `forced ${id} in ${s}`);
    assert.equal(konamiEgg(s, NIGHT_RAIN), null);
  }
  for (const s of ['acude-velho', 'rain-corner', 'cabo-branco', 'shrine']) assert.equal(plannedEgg(s, slotAt(T0)), null);
});

test('rare: about one egg every couple of hours at most, far sparser than ambient events, and short', () => {
  for (const scene of EGG_SCENES) {
    const evs = plan(scene), perHour = evs.length / (DAYS * 24);
    // planned before the conditions cancel some (night-only eggs on a clear night, the spirit in the dry)
    assert.ok(perHour <= 0.6, `${scene}: ${perHour.toFixed(2)} planned per hour`);
    for (const { e } of evs) {
      const d = (e.end - e.start) / 1000;
      assert.ok(d >= 10 && d <= 60, `${scene}: ${e.id} lasts ${d}s`);
    }
  }
  // the busiest egg scene, by day: roughly one per two hours (0.25..0.6 an hour)
  const day = plan('praca-matriz').filter(({ e }) => { const h = (((e.start - 3 * HOUR) % DAY) + DAY) % DAY / HOUR; return h >= 8 && h < 18; });
  const rate = day.length / (DAYS * 10);
  assert.ok(rate >= 0.25 && rate <= 0.6, `praca-matriz daytime eggs per hour ${rate.toFixed(2)}`);
  // ambient life events are several times more frequent where both exist
  for (const scene of Object.keys(AMBIENT_SCENES).filter((s) => EGG_SPOTS[s])) {
    let amb = 0;
    const a0 = ambSlot(scene, T0);
    for (let s = a0; s < a0 + DAYS * 24 * AMB_SLOTS; s++) if (plannedEvent(scene, s)) amb++;
    assert.ok(amb > 3 * plan(scene).length, `${scene}: ambient ${amb} vs eggs ${plan(scene).length}`);
  }
});

test('one at a time and deterministic: each egg fits its slot with a quiet gap, same instant same answer', () => {
  for (const scene of EGG_SCENES) {
    let prevEnd = -Infinity;
    for (const { e, slot } of plan(scene, 7)) {
      assert.equal(slotAt(e.start), slot);
      assert.ok(slotAt(e.end + SLOT_GAP_MS - 1) === slot, `${scene}: spills into the next slot`);
      assert.ok(e.start >= prevEnd + SLOT_GAP_MS);
      prevEnd = e.end;
      assert.deepEqual(plannedEgg(scene, slot), e);
    }
    for (let t = T0; t < T0 + DAY; t += 30_000) {
      const a = eggAt(scene, t, NIGHT_RAIN), b = eggAt(scene, t, NIGHT_RAIN);
      assert.deepEqual(a, b);
      if (a) assert.ok(t >= a.start && t < a.end);
    }
  }
});

/** Every instant (every 20 s over DAYS days) at which an egg shows under a condition. */
function shown(scene: string, c: EggCond) {
  const out: EggId[] = [];
  for (const { e } of plan(scene)) for (let t = e.start; t < e.end; t += 20_000) { const x = eggAt(scene, t, c); if (x) out.push(x.id); }
  return out;
}

test('night-only eggs never show by day; the bat signal also needs real clouds', () => {
  for (const scene of EGG_SCENES) {
    for (const c of [DAY_CLEAR, DAY_RAIN, { dayK: 0.5, wx: wx('live', 0, 0.9) }]) {
      const s = shown(scene, c);
      for (const id of ['batman', 'falcon', 'batsignal'] as const) assert.ok(!s.includes(id), `${scene}: ${id} by day`);
    }
    assert.ok(!shown(scene, NIGHT_CLEAR).includes('batsignal'), `${scene}: bat signal on a clear night (#wx=clear)`);
    assert.ok(!shown(scene, { dayK: 0, wx: wx('unavailable', 0, 0.9) }).includes('batsignal'), `${scene}: bat signal with unknown weather`);
  }
  assert.equal(gateOpen('batsignal', NIGHT_CLOUDY), true);
  assert.equal(gateOpen('batsignal', { dayK: 0, wx: wx('live', 0, CLOUDY_MIN - 0.01) }), false);
  assert.equal(gateOpen('batman', { dayK: NIGHT_DAYK, wx: wx('live') }), false);
  assert.equal(gateOpen('batman', NIGHT_CLEAR), true);
  // and over a long run they do show at night on the Matriz, cloudy nights for the signal
  const night = shown('praca-matriz', NIGHT_CLOUDY);
  for (const id of ['batman', 'batsignal', 'falcon'] as const) assert.ok(night.includes(id), `praca-matriz never shows ${id} at night`);
});

test('the forest spirit only shows in real rain; unknown weather is never rain', () => {
  for (const c of [DAY_CLEAR, NIGHT_CLEAR, NIGHT_CLOUDY, { dayK: 1, wx: wx('unavailable', 0.9) }]) assert.ok(!shown('centro-teatro', c).includes('totoro'));
  assert.ok(shown('centro-teatro', DAY_RAIN).includes('totoro'));
  assert.equal(gateOpen('totoro', { dayK: 1, wx: wx('override', 0.6, 0.95) }), true, '#wx=rain test');
});

test('#egg= forces the named egg where it is placed, bypassing rarity and conditions', () => {
  assert.equal(parseEggParam('Batman'), 'batman');
  assert.equal(parseEggParam('konami'), 'konami');
  assert.equal(parseEggParam('mario'), null);
  assert.equal(parseEggParam(null), null);
  for (const scene of EGG_SCENES) for (const id of eggsIn(scene)) for (const c of ALL) {
    const t = T0 + 5 * HOUR + 17_000, e = eggAt(scene, t, c, { id, anchor: T0 + 5 * HOUR });
    assert.ok(e && e.id === id && e.forced && t >= e.start && t < e.end, `${scene}/${id}`);
  }
  // looping: still showing much later
  const e = forcedEgg('praca-matriz', 'batman', T0 + HOUR, T0)!;
  assert.ok(e && T0 + HOUR >= e.start && T0 + HOUR < e.end);
  // a scene that does not place it shows nothing
  assert.equal(eggAt('capelinha', T0, DAY_CLEAR, { id: 'pacman', anchor: T0 }), null);
});

test('the Konami unlock respects the hard conditions and prefers the rarest fit', () => {
  assert.equal(konamiEgg('praca-matriz', DAY_CLEAR), 'spiderman');
  assert.equal(konamiEgg('praca-matriz', NIGHT_CLOUDY), 'batsignal');
  assert.equal(konamiEgg('praca-matriz', NIGHT_CLEAR), 'batman');
  assert.equal(konamiEgg('centro-teatro', DAY_RAIN), 'totoro');
  assert.equal(konamiEgg('centro-teatro', DAY_CLEAR), 'tardis');
  assert.equal(konamiEgg('rua-jose-bezerra', DAY_CLEAR), null);
  assert.equal(konamiEgg('capelinha', DAY_CLEAR), null);
});

test('Konami code: completes only on the exact sequence; a typo resets', () => {
  const run = (keys: string[]) => { let s = 0, done = 0; for (const k of keys) { const r = konamiStep(s, k); s = r.state; if (r.done) done++; } return { s, done }; };
  const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  assert.equal(KONAMI.length, 10);
  assert.equal(run(CODE).done, 1);
  assert.equal(run(CODE.map((k) => k.toUpperCase())).done, 1, 'case-insensitive (Shift / Caps Lock)');
  // only the final key completes it
  let s = 0;
  for (let i = 0; i < CODE.length; i++) { const r = konamiStep(s, CODE[i]); assert.equal(r.done, i === CODE.length - 1); s = r.state; }
  assert.equal(s, 0, 'starts over after completing');
  // typos
  assert.equal(run([...CODE.slice(0, 5), 'x', ...CODE.slice(5)]).done, 0);
  assert.equal(run([...CODE.slice(0, 9), 'c', 'a']).done, 0);
  assert.equal(run(['a', 'b', ...CODE.slice(0, 9)]).done, 0);
  assert.equal(run([...CODE.slice(0, 8), 'a', 'b']).done, 0, 'A before B is wrong');
  // a stray extra ↑ at the start still counts, and a typo followed by the full code works
  assert.equal(run(['ArrowUp', ...CODE]).done, 1);
  assert.equal(run(['ArrowDown', 'q', ...CODE]).done, 1);
  assert.equal(run([...CODE.slice(0, 4), 'm', ...CODE]).done, 1);
  assert.equal(run([...CODE, ...CODE]).done, 2);
  // a plain 'a' on its own (the auto-cycle shortcut) never completes anything
  assert.deepEqual(konamiStep(0, 'a'), { state: 0, done: false });
});

test('every egg has lines and every placed egg has a sensible spot', () => {
  for (const id of EGG_IDS) { assert.ok(eggLine(id, 0).length > 0 && eggLine(id, 0).length <= 60, id); assert.ok(EGG_DUR[id][0] <= EGG_DUR[id][1]); }
  for (const scene of EGG_SCENES) for (const id of eggsIn(scene)) {
    const sp = EGG_SPOTS[scene][id]!;
    if (sp.x1 === undefined) assert.ok(sp.x >= 140 && sp.x <= 340, `${scene}/${id}: x off an upright phone's view`);
    else assert.ok(Math.min(sp.x1, 340) - Math.max(sp.x, 140) >= 50, `${scene}/${id}: path mostly off an upright phone's view`);
    assert.ok(sp.y < 147, `${scene}/${id}: in the street (y >= 147)`);
  }
  // the critter stays on the Campo turf (rows 104..126), above the mural wall and the street
  const p = EGG_SPOTS['campo-rodoviaria'].poke!;
  assert.ok(p.y > 104 && p.y < 126);
});
