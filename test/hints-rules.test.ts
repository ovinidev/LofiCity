// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HINT_END, HINT_START, hintAlpha, hintBob, hintBlink } from '../src/fx/hints-rules.ts';

test('hints show only in the first seconds after entering a scene', () => {
  assert.equal(hintAlpha(0, false), 0);
  assert.equal(hintAlpha(HINT_START - 0.01, false), 0);
  assert.equal(hintAlpha((HINT_START + HINT_END) / 2, false), 1);
  assert.equal(hintAlpha(HINT_END, false), 0);
  assert.equal(hintAlpha(120, false), 0);
});

test('they fade in and out instead of popping', () => {
  const a = hintAlpha(HINT_START + 0.3, false), b = hintAlpha(HINT_END - 0.3, false);
  assert.ok(a > 0 && a < 1 && b > 0 && b < 1);
});

test('once the user has used a door or a bus they stay off', () => {
  assert.equal(hintAlpha(4, true), 0);
});

test('bounce and blink are deterministic functions of the clock', () => {
  for (let t = 0; t < 10; t += 0.13) { const b = hintBob(t); assert.ok(b >= 0 && b <= 2); assert.equal(hintBob(t), b); }
  assert.equal(typeof hintBlink(1), 'boolean');
});
