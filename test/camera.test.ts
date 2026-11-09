// Run with `pnpm test`. The camera x for a frame, centred or following a scene's portrait focus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WW, camFor } from '../src/engine/gfx.ts';

test('without a focus the camera is centred on the world (as before)', () => {
  for (const W of [240, 270, 360, 480]) assert.equal(camFor(W), Math.floor((WW - W) / 2));
  assert.equal(camFor(240, null), 120);
  assert.equal(camFor(240, Number.NaN), 120);
});

test('a focus centres a narrow frame on it, clamped to the world', () => {
  assert.equal(camFor(240, 160), 40);
  assert.equal(camFor(240, 20), 0);
  assert.equal(camFor(240, 470), WW - 240);
  // a frame as wide as the world shows all of it whatever the focus
  for (const f of [0, 160, 400]) assert.equal(camFor(WW, f), 0);
});
