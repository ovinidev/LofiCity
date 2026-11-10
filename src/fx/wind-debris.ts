/* Strong dry wind in Esperança: wisps of dust, dry leaves and the odd scrap of paper skittering along
   the ground from the upwind edge. Whether it shows at all is decided by debrisOn() in
   sky/wind-rules.ts (strong real wind, dry weather, Esperança, outdoors); this file only moves and
   draws a small seeded pool. Screen space, struct-of-arrays, no per-frame allocation. */
import { G, putS, sy } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import { BARK, CBEIGE, HAIR2, LEAF1, STONE, TILEW, WOOD } from '../engine/palette';
import { S } from '../sky/state';
import { debrisCount, windDir, windStrength } from '../sky/wind-rules';
import { precip } from './precip';

const r = mulberry32(0xd057ab);
const N = 24;
const X = new Float32Array(N), Y = new Float32Array(N), V = new Float32Array(N), Ph = new Float32Array(N), K = new Uint8Array(N);

export const debris = {
  /** Upper bound on live particles; main.ts lowers it when frames get expensive. */
  cap: 18, live: 0,
};

/** A new scene: nothing in the air yet. */
export function clearDebris() { K.fill(0); debris.live = 0; }

/** `on`: debrisOn() for this scene right now. When off, what is in the air blows out (no new ones). */
export function updateDebris(dt: number, on: boolean) {
  const W = G.W, dir = windDir(S.wind) || 1, st = windStrength(S.wind), g0 = sy(precip.ground0), gH = Math.max(4, G.H - g0 - 2);
  const target = on ? debrisCount(S.wind, Math.min(N, Math.round(debris.cap * Math.max(0.8, W / 320)))) : 0;
  let live = 0;
  for (let i = 0; i < N; i++) {
    if (!K[i]) continue;
    Ph[i] += dt * (K[i] === 1 ? 4 : 7);
    X[i] += dir * V[i] * (0.75 + 0.25 * Math.sin(Ph[i] * 0.7)) * dt; // gusts: speeds up and slows
    if (X[i] < -12 || X[i] > W + 12) K[i] = 0; else live++;
  }
  // spawn at the upwind edge, a few per second, so they cross the frame instead of popping in
  if (live < target && r() < dt * (3 + 5 * st)) for (let i = 0; i < N; i++) if (!K[i]) {
    const roll = r();
    K[i] = roll < 0.5 ? 1 : roll < 0.88 ? 2 : 3; // dust, dry leaf, paper
    X[i] = dir > 0 ? -6 - r() * 6 : W + 6 + r() * 6;
    Y[i] = g0 + 2 + r() * gH;
    V[i] = (K[i] === 1 ? 55 : 35) + 45 * st + r() * 25;
    Ph[i] = r() * 6.28;
    live++;
    break;
  }
  debris.live = live;
}

/** Drawn with the near precipitation (in front of the street, behind nothing). */
export function drawDebris() {
  const dir = windDir(S.wind) || 1;
  for (let i = 0; i < N; i++) {
    const k = K[i];
    if (!k) continue;
    const x = X[i], p = Ph[i];
    // earthy colours that read on both the pale paving and the dark asphalt
    if (k === 1) { // a low, thin streak of red-brown Agreste dust trailing upwind
      const y = Y[i] - Math.abs(Math.sin(p)) * 1.5;
      putS(x, y, HAIR2); putS(x - dir, y, CBEIGE); putS(x - dir * 2, y - (i & 1), HAIR2); putS(x - dir * 3, y, CBEIGE);
      if (i % 3 === 0) putS(x - dir * 5, y - 1, CBEIGE);
    } else if (k === 2) { // a dry leaf hopping and tumbling
      const y = Y[i] - Math.abs(Math.sin(p)) * 4, flip = Math.sin(p * 1.7) > 0, c = i % 3 ? WOOD : LEAF1;
      putS(x, y, c); if (flip) putS(x + 1, y, BARK); else { putS(x, y - 1, BARK); putS(x + 1, y - 1, c); }
    } else { // a scrap of paper, lifted by the gusts, with its shadow on the ground
      const lift = Math.abs(Math.sin(p * 0.6)) * 7, y = Y[i] - lift, flip = Math.sin(p * 1.3) > 0;
      putS(x, y, TILEW); putS(x + 1, y, TILEW); putS(x, y + 1, TILEW); if (flip) putS(x + 1, y - 1, TILEW);
      if (lift > 1.5) { putS(x, Y[i] + 2, STONE); putS(x + 1, Y[i] + 2, STONE); }
    }
  }
}
