/* Screen-space particle pools: rain (with splashes, ripples, drips), snow, and drifting
   petals or leaves. Struct-of-arrays, no per-frame allocation. */
import { G, putS, sx, sy } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import { FOG, HALO, LEAF1, LEAF2, MOMIJI, PETAL, RAIN, RAINB, SAKURAD, SNOW, SNOWS, WDIM, WHITE } from '../engine/palette';
import { S } from '../sky/state';
import { clearDebris, drawDebris } from './wind-debris';

const r = mulberry32(0x5eed11);
const ND = 1400, NS = 300, NR = 60, NP = 40, NF = 1100, NL = 160;

const dX = new Float32Array(ND), dY = new Float32Array(ND), dV = new Float32Array(ND), dE = new Float32Array(ND), dL = new Uint8Array(ND);
const sX = new Float32Array(NS), sY = new Float32Array(NS), sVX = new Float32Array(NS), sVY = new Float32Array(NS), sLf = new Float32Array(NS);
const rX = new Float32Array(NR), rY = new Float32Array(NR), rLf = new Float32Array(NR);
const pX = new Float32Array(NP), pY = new Float32Array(NP), pV = new Float32Array(NP), pE = new Float32Array(NP), pA = new Uint8Array(NP);
const fX = new Float32Array(NF), fY = new Float32Array(NF), fV = new Float32Array(NF), fE = new Float32Array(NF), fP = new Float32Array(NF), fL = new Uint8Array(NF);
const lX = new Float32Array(NL), lY = new Float32Array(NL), lP = new Float32Array(NL), lE = new Float32Array(NL), lRest = new Float32Array(NL), lK = new Uint8Array(NL);
const COS16 = new Float32Array(16), SIN16 = new Float32Array(16);
for (let i = 0; i < 16; i++) { COS16[i] = Math.cos((i / 16) * 6.2832); SIN16[i] = Math.sin((i / 16) * 6.2832); }

export interface Roof { x0: number; x1: number; y: number }
export interface Tip { x: number; y: number; end: number }
export interface Lamp { x: number; y: number }

const P = {
  roofs: [] as Roof[], tips: [] as Tip[], tipT: new Float32Array(0), lamps: [] as Lamp[],
  ground0: 140, horizon: 100,
  rainCap: 600, liveDrops: 0, liveFlakes: 0, liveLeaves: 0,
  jit: new Int8Array(400),
};
export const precip = P;

export function configure(o: { roofs: Roof[]; tips: Tip[]; lamps: Lamp[]; ground0: number; horizon: number }) {
  P.roofs = o.roofs; P.tips = o.tips; P.lamps = o.lamps; P.ground0 = o.ground0; P.horizon = o.horizon;
  P.tipT = new Float32Array(o.tips.length).map(() => r() * 3);
  dL.fill(0); fL.fill(0); lK.fill(0); sLf.fill(0); rLf.fill(0); pA.fill(0); clearDebris();
}

function splash(x: number, y: number, n: number) {
  for (let i = 0; i < NS && n > 0; i++) if (sLf[i] <= 0) { sX[i] = x; sY[i] = y - 1; sVX[i] = (r() - 0.5) * 40; sVY[i] = -25 - r() * 30; sLf[i] = 0.18 + r() * 0.15; n--; }
}
function ripple(x: number, y: number) { for (let i = 0; i < NR; i++) if (rLf[i] <= 0) { rX[i] = x; rY[i] = y; rLf[i] = 0.7; return; } }

export function updatePrecip(dt: number) {
  const W = G.W, scale = W / 320, wind = S.wind, g0 = sy(P.ground0), gH = G.H - g0;
  // ---- rain ----
  const target = Math.min(ND, (S.rain * P.rainCap * scale) | 0);
  let alive = 0, budget = Math.max(6, (target / 24) | 0);
  for (let i = 0; i < ND; i++) {
    if (!dL[i]) continue;
    const py = dY[i];
    dY[i] += dV[i] * dt; dX[i] += wind * dV[i] * dt;
    if (dL[i] === 2) {
      let hit = false;
      for (const rf of P.roofs) {
        const ry = sy(rf.y);
        if (py < ry && dY[i] >= ry && dX[i] > sx(rf.x0) && dX[i] < sx(rf.x1)) { hit = true; if (r() < 0.5) splash(dX[i], ry, 1); break; }
      }
      if (hit) { dL[i] = 0; continue; }
    }
    if (dY[i] >= dE[i]) {
      if (dL[i] === 2) { splash(dX[i], dE[i], r() < 0.5 ? 1 : 2); if (dE[i] >= sy(147) && r() < 0.35) ripple(dX[i], dE[i]); }
      dL[i] = 0; continue;
    }
    alive++;
  }
  let need = target - alive;
  for (let i = 0; i < ND && need > 0 && budget > 0; i++) if (!dL[i]) {
    const far = r() < 0.45; dL[i] = far ? 1 : 2;
    dX[i] = r() * (W + 80) - 40 - wind * 120; dY[i] = -r() * 24;
    dV[i] = far ? 150 + r() * 40 : 250 + r() * 70;
    dE[i] = far ? sy(60) + r() * 90 : g0 + r() * (gH - 1);
    need--; budget--; alive++;
  }
  P.liveDrops = alive;
  for (let i = 0; i < NS; i++) if (sLf[i] > 0) { sLf[i] -= dt; sVY[i] += 260 * dt; sX[i] += sVX[i] * dt; sY[i] += sVY[i] * dt; }
  P.jit.fill(0);
  for (let i = 0; i < NR; i++) if (rLf[i] > 0) {
    rLf[i] -= dt; const y = rY[i] | 0, s = i & 1 ? 1 : -1;
    if (y > 0 && y < P.jit.length - 1) { P.jit[y] += s; P.jit[y + 1] -= s; }
  }
  // drips keep falling for a while after rain stops (wetness)
  const rate = 0.1 + S.rain * 1.2 + S.wet * 0.3;
  for (let k = 0; k < P.tips.length; k++) {
    P.tipT[k] -= dt * rate;
    if (P.tipT[k] > 0) continue;
    P.tipT[k] = 0.8 + r() * 4;
    if (S.wet < 0.15 || S.snowCover > 0.6) continue;
    for (let i = 0; i < NP; i++) if (!pA[i]) { const t = P.tips[k]; pA[i] = 1; pX[i] = sx(t.x); pY[i] = sy(t.y); pV[i] = 0; pE[i] = sy(t.end) + r() * 2; break; }
  }
  for (let i = 0; i < NP; i++) if (pA[i]) { pV[i] += 320 * dt; pY[i] += pV[i] * dt; if (pY[i] >= pE[i]) { pA[i] = 0; splash(pX[i], pE[i], 2); } }

  // ---- snow ----
  const ft = Math.min(NF, (S.snow * 700 * scale) | 0), t = S.ms / 1000;
  let fl = 0, fb = Math.max(4, (ft / 30) | 0);
  for (let i = 0; i < NF; i++) {
    if (!fL[i]) continue;
    fY[i] += fV[i] * dt;
    fX[i] += (wind * (fL[i] === 2 ? 90 : 60) + Math.sin(fP[i] + t * 1.5) * 7) * dt;
    if (fY[i] >= fE[i] || fX[i] < -30 || fX[i] > W + 30) { fL[i] = 0; continue; }
    fl++;
  }
  let fneed = ft - fl;
  for (let i = 0; i < NF && fneed > 0 && fb > 0; i++) if (!fL[i]) {
    const far = r() < 0.5; fL[i] = far ? 1 : 2;
    fX[i] = r() * (W + 120) - 60 - wind * 150; fY[i] = -r() * 10;
    fV[i] = far ? 9 + r() * 7 : 18 + r() * 16; fP[i] = r() * 6.28;
    fE[i] = far ? sy(70) + r() * 80 : g0 + r() * (gH - 1);
    fneed--; fb--; fl++;
  }
  P.liveFlakes = fl;

  // ---- petals / leaves ----
  const kind = S.petals > S.leaves ? 1 : 2, amount = Math.max(S.petals, S.leaves * S.tree.density);
  const lt = Math.min(NL, (amount * 45 * scale * (0.6 + wind * 3)) | 0);
  let ll = 0;
  for (let i = 0; i < NL; i++) {
    if (!lK[i]) continue;
    if (lRest[i] > 0) { lRest[i] -= dt; if (lRest[i] <= 0) lK[i] = 0; else ll++; continue; }
    lP[i] += dt * 3;
    lX[i] += (wind * 80 + 8 * Math.sin(lP[i])) * dt;
    lY[i] += (9 + 5 * Math.sin(lP[i] * 1.3)) * dt;
    if (lY[i] >= lE[i]) { lRest[i] = 3 + r() * 5; }
    if (lX[i] < -20 || lX[i] > W + 20) lK[i] = 0; else ll++;
  }
  if (ll < lt && r() < dt * 6) for (let i = 0; i < NL; i++) if (!lK[i]) {
    lK[i] = kind === 1 ? 1 : 2 + ((r() * 3) | 0);
    lX[i] = r() * (W + 60) - 30 - wind * 100; lY[i] = -4 - r() * 20; lP[i] = r() * 6.28; lRest[i] = 0;
    lE[i] = g0 + r() * (gH - 1); break;
  }
  P.liveLeaves = ll;
}

export function drawFarPrecip() {
  for (let i = 0; i < ND; i++) if (dL[i] === 1) { putS(dX[i], dY[i], WDIM); putS(dX[i] - S.wind * 2, dY[i] - 2, WDIM); }
  for (let i = 0; i < NF; i++) if (fL[i] === 1) putS(fX[i], fY[i], SNOWS);
}

function inLamp(x: number, y: number) {
  if (!S.lampOn) return false;
  for (const l of P.lamps) { const lx = sx(l.x), ly = sy(l.y); if (y > ly && y < sy(146) && Math.abs(x - lx) < (y - ly) * 0.35 + 8) return true; }
  return false;
}

export function drawNearPrecip() {
  const sl = S.wind;
  for (let i = 0; i < ND; i++) if (dL[i] === 2) {
    const x = dX[i], y = dY[i], lit = inLamp(x, y);
    for (let k = 0; k < 6; k++) putS(x - sl * k, y - k, k === 0 ? (lit ? WHITE : RAINB) : lit ? HALO : RAIN);
  }
  for (let i = 0; i < NS; i++) if (sLf[i] > 0) putS(sX[i], sY[i], RAINB);
  for (let i = 0; i < NP; i++) if (pA[i]) { putS(pX[i], pY[i], RAINB); putS(pX[i], pY[i] - 1, RAIN); }
  for (let i = 0; i < NF; i++) if (fL[i] === 2) {
    const c = inLamp(fX[i], fY[i]) ? WHITE : SNOW;
    putS(fX[i], fY[i], c);
    if (i % 4 === 0) putS(fX[i] + 1, fY[i], c);
  }
  for (let i = 0; i < NL; i++) if (lK[i]) {
    const flip = Math.sin(lP[i]) > 0;
    const c = lK[i] === 1 ? (flip ? PETAL : SAKURAD) : [MOMIJI, LEAF1, LEAF2][lK[i] - 2];
    putS(lX[i], lY[i], c);
    if (!flip && lRest[i] <= 0) putS(lX[i] + 1, lY[i], c);
  }
  drawDebris(); // strong dry wind (Esperança only; updateDebris decides, wind-debris.ts)
}

export function drawRipples() {
  for (let i = 0; i < NR; i++) if (rLf[i] > 0) {
    const t = 1 - rLf[i] / 0.7, rad = 1 + t * 6, c = t < 0.5 ? RAIN : FOG;
    for (let a = 0; a < 16; a += t < 0.5 ? 1 : 2) putS(rX[i] + COS16[a] * rad, rY[i] + SIN16[a] * rad * 0.35, c);
  }
}
