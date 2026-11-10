// Run with `pnpm test`. Avenida e Campo (Esperança): vehicles stay on the avenue, horses stay on the grass.
// The scene module needs a DOM, so its wiring is checked from the source; the rules module is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mulberry32 } from '../src/engine/math.ts';
import {
  AVENUE, FAR_LANE, FIELD, FIELD_POLE, HORSE_H, HORSE_HALF, HORSE_LINES, MAX_HORSES, NEAR_LANE, VERGE_Y, horseAt, horseLine, makeHorses, onGrass,
  stepHorse, toGrass,
} from '../src/scenes/avenida-campo-rules.ts';

const src = readFileSync(new URL('../src/scenes/avenida-campo.ts', import.meta.url), 'utf8');
const COATS = [1, 2, 3, 4];
/** Tallest side-on vehicle above its lane row (br-traffic.ts TALL: the carro de som / school bus). */
const TALLEST = 24;

test('both traffic lanes sit on the avenue pavement, one lane each way, and the scene wires exactly those', () => {
  for (const y of [FAR_LANE, NEAR_LANE]) assert.ok(y > AVENUE.y0 && y < AVENUE.y1, `lane ${y} inside the asphalt ${AVENUE.y0}..${AVENUE.y1}`);
  assert.ok(FAR_LANE < NEAR_LANE - 8, 'the lanes are clearly separated');
  assert.match(src, /setCarLanes\(FAR_LANE, NEAR_LANE, 'br'\)/);
  // no crossing, light or one-way road: none was seen in the reference
  assert.doesNotMatch(src, /setBrCrossing|setBrSignal|setBrOneWay/);
});

test('the field is below the avenue: a horse, head up, never reaches the road or the buildings beyond it', () => {
  assert.ok(FIELD.y0 - HORSE_H > AVENUE.y1, 'a horse at the top of the field still stands clear of the near kerb');
  assert.ok(VERGE_Y > AVENUE.y1 && FIELD.y0 > VERGE_Y);
  // and vehicles, drawn upward from their lane row, never come down onto the field
  assert.ok(NEAR_LANE + 2 < FIELD.y0 - HORSE_H);
  assert.ok(FAR_LANE - TALLEST > 80, 'vehicles stay in front of the skyline, not in the sky');
  assert.ok(FIELD.x0 - HORSE_HALF >= 120 && FIELD.x1 + HORSE_HALF <= 360, 'the horses stay whole within the centred portrait crop (world x 120..360)');
});

test('2 to 4 horses, seeded and reproducible, all starting on the grass and apart', () => {
  for (const n of [0, 1, 2, 3, 4, 9]) {
    const hs = makeHorses(n, mulberry32(7), COATS);
    assert.ok(hs.length >= 2 && hs.length <= MAX_HORSES, `n=${n} -> ${hs.length}`);
    for (const h of hs) assert.ok(onGrass(h.x, h.y));
  }
  assert.deepEqual(makeHorses(3, mulberry32(0x40e5), COATS), makeHorses(3, mulberry32(0x40e5), COATS));
});

test('over a long simulated day the horses never leave the grass, never touch the avenue and keep off the pole', () => {
  const totals = { walked: 0, grazed: 0 };
  for (const seed of [1, 2, 3, 0x40e5]) {
    const r = mulberry32(seed), hs = makeHorses(4, r, COATS);
    let walked = 0, grazed = 0;
    for (let i = 0; i < 30 * 60 * 20; i++) {
      for (const h of hs) {
        stepHorse(h, 1 / 30, r, hs);
        assert.ok(onGrass(h.x, h.y), `seed ${seed}: horse at ${h.x},${h.y}`);
        assert.ok(h.y - HORSE_H > AVENUE.y1);
        if (h.st === 'walk') walked++; else if (h.st === 'graze') grazed++;
      }
    }
    assert.ok(walked > 0 && grazed > 0, `seed ${seed}: they graze and also walk`);
    totals.walked += walked; totals.grazed += grazed;
  }
  assert.ok(totals.grazed > totals.walked, 'across seeds they spend more time grazing than walking');
});

test('toGrass pulls any point back onto the grass, including from the avenue and around the pole', () => {
  for (const [x, y] of [[0, 0], [240, AVENUE.y0], [240, NEAR_LANE], [500, 200], [FIELD_POLE.x, FIELD_POLE.y], [FIELD_POLE.x + 1, FIELD_POLE.y - 1]]) {
    const p = toGrass(x, y);
    assert.ok(onGrass(p.x, p.y), `${x},${y} -> ${p.x},${p.y}`);
  }
});

test('tapping a horse finds it; its lines are short, varied and say nothing about the weather', () => {
  const hs = makeHorses(3, mulberry32(5), COATS), h = hs[0];
  assert.equal(horseAt(hs, h.x, h.y - 5), h);
  assert.equal(horseAt(hs, h.x, AVENUE.y0), null);
  assert.ok(new Set([0, 1, 2, 3].map(horseLine)).size === 4);
  assert.equal(horseLine(-1), HORSE_LINES[HORSE_LINES.length - 1]);
  for (const t of HORSE_LINES) {
    assert.ok(t.length <= 20, t);
    assert.doesNotMatch(t, /chuv|sol|calor|frio|quente|vento|nublad|tempo/i, `${t} is not a weather line`);
  }
});
