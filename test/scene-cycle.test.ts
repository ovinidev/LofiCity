// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE_MS, HOLD_SCENES, cycleDefault, nextCycleIndex, shouldAdvance } from '../src/scene-cycle.ts';

const base = { enabled: true, elapsedMs: 0, sceneId: 'praca-matriz', dialogOpen: false };

test('the scene advances after 2 minutes, not before', () => {
  assert.equal(CYCLE_MS, 120_000);
  assert.equal(shouldAdvance({ ...base, elapsedMs: CYCLE_MS - 1 }), false);
  assert.equal(shouldAdvance({ ...base, elapsedMs: CYCLE_MS }), true);
  assert.equal(shouldAdvance({ ...base, elapsedMs: CYCLE_MS * 3 }), true);
});

test('it never advances while off, behind a dialog or inside the bus / the cinema room', () => {
  const due = { ...base, elapsedMs: CYCLE_MS };
  assert.equal(shouldAdvance({ ...due, enabled: false }), false);
  assert.equal(shouldAdvance({ ...due, dialogOpen: true }), false);
  for (const id of HOLD_SCENES) assert.equal(shouldAdvance({ ...due, sceneId: id }), false, id);
  assert.ok(HOLD_SCENES.includes('onibus') && HOLD_SCENES.includes('cinema-remigio') && HOLD_SCENES.includes('partage-interior'));
});

test('the next scene skips the bus and the cinema room and wraps around', () => {
  const ids = ['a', 'onibus', 'b', 'cinema-remigio', 'c'];
  assert.equal(nextCycleIndex(ids, 0), 2);
  assert.equal(nextCycleIndex(ids, 2), 4);
  assert.equal(nextCycleIndex(ids, 4), 0);
  assert.equal(nextCycleIndex(['x'], 0), 0, 'a single scene stays');
  assert.equal(nextCycleIndex(['onibus'], 0), 0);
  // Campina: from the mall's street front the cycle goes past its inside to the terminal
  assert.equal(nextCycleIndex(['partage-shopping', 'partage-interior', 'terminal-integracao'], 0), 2);
});

test('the cycle is off when the URL pins a scene or asks for #cycle=off, on otherwise', () => {
  assert.equal(cycleDefault(''), true);
  assert.equal(cycleDefault('#city=esperanca'), true);
  assert.equal(cycleDefault('#city=esperanca&scene=praca-matriz'), false);
  assert.equal(cycleDefault('#scene=praca-matriz'), false);
  assert.equal(cycleDefault('#city=esperanca&cycle=off'), false);
  assert.equal(cycleDefault('#cycle=off&debug'), false);
  assert.equal(cycleDefault('#at=2026-11-09T10:00&wx=clear'), true);
});
