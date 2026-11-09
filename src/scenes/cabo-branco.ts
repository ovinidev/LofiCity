/* ORLA DO CABO BRANCO (João Pessoa, PB): the city where the sun rises first in the Americas.
   Looking east over the Atlantic: the sea with rolling surf and jangadas, the beach with
   umbrellas and a kiosk, coconut palms along the calçadão full of joggers and cyclists, the
   avenue in front, and on the right the reddish cliff (falésia) of Cabo Branco topped by its
   white triangular lighthouse, whose beam sweeps the sky at night. */
import { G, L, Lp, WW, blitLayer, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, mulberry32 } from '../engine/math';
import {
  ASPH, BNEAR, CBEIGE, CBLUE, CRED, CYELL, FBLUE, HAZE, LEAFG, LEAFGD, LIGHT, SKYIDX, STEEL, STONE, STONEL, TERRA,
  TILEW, WOOD, WWARM, CGREEN, FPINK, WDIM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { drawCars, setCarLanes, updateCars } from '../actors/cars';
import { drawAmbient, drawAmbientRoad, setupAmbient, updateAmbient } from '../actors/ambient';
import { S } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { type Lamp, type Palm, drawPalm, isNight, lampLight, lampPost, water } from './br-kit';
import type { Scene } from './types';

const HORIZON = 104, SEA = 104, SAND = 128, WALK = 140, STREET = 148, SH = 180 - STREET;
const wr = mulberry32(0x5ea);
const mid = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const LAMPS: Lamp[] = [{ x: 40, top: 100, ground: WALK + 6, arms: 1 }, { x: 200, top: 100, ground: WALK + 6, arms: 1 }, { x: 330, top: 100, ground: WALK + 6, arms: 1 }];
const PALMS: Palm[] = [16, 74, 128, 170, 236, 286, 356].map((x, i) => ({ x, ground: WALK + 1, h: 46 + ((i * 7) % 14), lean: i % 2 ? 6 : -5, ph: i * 1.7 }));
const CLIFF_X = 392, FAROL_X = 440;

/** Cliff profile: rises from the beach to a green top on the right. */
const cliffTop = (x: number) => (x < CLIFF_X ? 999 : Math.round(80 + Math.max(0, 22 - (x - CLIFF_X) * 0.9) + Math.sin(x * 0.2) * 1.5));

function buildCliff() {
  for (let x = CLIFF_X; x < WW; x++) {
    const top = cliffTop(x);
    for (let y = top; y < SAND + 4; y++) {
      const strata = Math.sin(y * 0.55 + x * 0.04) + (wr() - 0.5) * 0.6;
      Lp(mid, x, y, y - top < 3 ? (wr() < 0.6 ? LEAFG : LEAFGD) : strata > 0.6 ? CBEIGE : strata < -0.5 ? WOOD : TERRA);
    }
    for (let k = 0; k < 4; k++) if (wr() < 0.5) Lp(mid, x, top - 1 - k, k < 2 ? LEAFGD : LEAFG); // scrub on top
  }
  // the lighthouse: white triangular shaft with a central fin, gallery and lantern
  const base = cliffTop(FAROL_X);
  for (let y = 0; y < 38; y++) {
    const half = Math.round(7 - y * 0.08), yy = base - y;
    L(mid, FAROL_X - half, yy, half * 2 + 1, 1, TILEW);
    Lp(mid, FAROL_X + half, yy, STONEL); Lp(mid, FAROL_X, yy, y % 6 === 0 ? STONEL : TILEW); // shaded edge, fin
  }
  L(mid, FAROL_X - 6, base - 39, 13, 2, STONEL); L(mid, FAROL_X - 3, base - 45, 7, 6, BNEAR); L(mid, FAROL_X - 4, base - 46, 9, 1, CRED);
}

function buildBeach() {
  // sand with a darker wet band near the surf
  for (let y = SAND; y < WALK; y++) for (let x = 0; x < CLIFF_X + 6; x++) Lp(mid, x, y, y < SAND + 3 ? STONE : wr() < 0.12 ? STONEL : CBEIGE);
  // kiosk
  L(mid, 262, 126, 30, 2, WOOD); L(mid, 260, 124, 34, 2, CBEIGE); for (let i = 0; i < 34; i += 2) Lp(mid, 260 + i, 123, WOOD);
  L(mid, 264, 128, 2, 10, WOOD); L(mid, 288, 128, 2, 10, WOOD); L(mid, 266, 132, 22, 6, CBEIGE);
  // calçadão: patterned paving and the sea wall
  for (let y = WALK; y < STREET; y++) for (let x = 0; x < WW; x++) Lp(front, x, y, ((x >> 2) + (y >> 1)) % 2 ? STONEL : TILEW);
  L(front, 0, WALK, WW, 1, STONE); L(front, 0, STREET - 1, WW, 1, STONE);
  for (const l of LAMPS) lampPost(front, l);
}

function buildGround() {
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) street.base[d * WW + x] = wr() < 0.06 ? STONE : ASPH;
  for (let x = 6; x < WW; x += 22) for (let i = 0; i < 11; i++) street.base[15 * WW + x + i] = TILEW;
  for (let p = 0; p < 4; p++) {
    const cx = wr() * WW, cy = 2 + wr() * (SH - 4), rx = 8 + wr() * 16, ry = 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- dynamic ----------
/** Surf: lines of foam roll in and wash up the wet sand. */
function surf() {
  const t = S.ms / 1000, swell = 0.6 + Math.abs(S.wind) * 1.5;
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.12 + k / 3) % 1, y = Math.round(SEA + 6 + ph * (SAND - SEA - 4));
    for (let x = 0; x < CLIFF_X + 2; x++) {
      const n = Math.sin(x * 0.07 + k * 2 + t * 0.4) + Math.sin(x * 0.19 - t * 0.3);
      if (n > 0.3 - ph * swell && bay(sx(x), sy(y)) < 0.4 + ph * 0.5) put(x, y + (n > 1.2 ? -1 : 0), TILEW);
    }
  }
  const wash = Math.sin(t * 0.5) * 1.5;
  for (let x = 0; x < CLIFF_X + 2; x++) if (Math.sin(x * 0.11 + t) > -0.2) put(x, SAND + 1 + Math.round(wash + Math.sin(x * 0.05) * 1), TILEW);
}

/** Jangadas: rafts with a tall triangular sail, bobbing out at sea. */
const jangadas = [{ x: 120, y: 112, sp: 1.2, sail: TILEW }, { x: 300, y: 109, sp: -0.8, sail: CBEIGE }];
function drawJangadas(dt: number) {
  const t = S.ms / 1000;
  for (const j of jangadas) {
    j.x += j.sp * dt; if (j.x < -10) j.x = CLIFF_X - 10; if (j.x > CLIFF_X - 4) j.x = -8;
    const x = Math.round(j.x), y = j.y + Math.round(Math.sin(t * 1.2 + j.x) * 0.6);
    rect(x - 4, y, 9, 1, WOOD);
    for (let i = 0; i < 8; i++) rect(x, y - 8 + i, Math.max(1, Math.round(i * 0.6)), 1, j.sail);
    put(x, y - 9, WOOD);
  }
}

/** Beach umbrellas by day. */
function umbrellas() {
  if (isNight() || S.rain > 0.15) return;
  for (const [x, c] of [[60, CRED], [100, CYELL], [150, CBLUE], [214, FPINK], [330, CGREEN]] as const) {
    for (let i = -6; i <= 6; i++) put(x + i, 126 + Math.round((i * i) / 14), ((i + 6) >> 1) % 2 ? c : TILEW);
    rect(x, 127, 1, 9, STEEL); rect(x - 4, 135, 3, 2, c); rect(x + 2, 135, 3, 2, TILEW); // chairs
  }
}

/** The lighthouse beam sweeps across the sky after dark. */
function beam() {
  const base = cliffTop(FAROL_X), lx = FAROL_X, ly = base - 42;
  if (!isNight()) { rect(lx - 2, ly - 1, 5, 3, WDIM); return; }
  rect(lx - 2, ly - 1, 5, 3, LIGHT);
  const a = (S.ms / 1000) * 0.9, dx = Math.cos(a), back = Math.sin(a) < 0; // beam rotates; dim when it faces away
  if (back) return;
  const { buf, W } = G;
  for (let s = 4; s < 260; s++) {
    const x = lx + dx * s * 1.6, y = ly - s * 0.18;
    for (let j = -1 - s * 0.03; j <= 1 + s * 0.03; j++) {
      const X = sx(x), Y = sy(Math.round(y + j));
      if (X < 0 || X >= W || Y < 0 || Y >= G.H) continue;
      const i = Y * W + X;
      if (SKYIDX[buf[i]] && bay(X, Y) < 0.35 * (1 - s / 260)) buf[i] = HAZE;
    }
  }
}

function update(dt: number) {
  updateAnimals(dt);
  tickSpawns(dt, 1.6); updatePeople(dt); updateCars(dt, 1); updateAmbient(dt);
}

const FOG = [{ y: 106, h: 8, sp: 0.6 }, { y: 136, h: 5, sp: -0.4 }];
let lastT = 0;
function render() {
  const now = S.ms / 1000, dt = Math.min(0.1, Math.max(0, now - lastT)); lastT = now;
  drawSky(HORIZON); drawAnimalsSky(); drawLightning(); drawFireworks();
  // the sea mirrors the sky; deeper blue toward the horizon
  water(SEA, SAND, 0, WW, FBLUE, CBLUE, 2.2);
  drawJangadas(dt); surf();
  blitLayer(mid); beam();
  umbrellas();
  if (isNight()) rect(266, 129, 22, 3, WWARM); // kiosk lights
  drawFarPrecip();
  for (const p of PALMS) drawPalm(p);
  blitLayer(front);
  for (const l of LAMPS) lampLight(l);
  drawAnimalsPerched(); drawPeople(); drawAmbient(); drawAnimalsGround();
  drawStreet(street); drawAmbientRoad(); drawCars(); drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const caboBranco: Scene = {
  id: 'cabo-branco',
  name: 'Orla do Cabo Branco',
  build() {
    if (!built) { buildCliff(); buildBeach(); buildGround(); built = true; }
    setLanes([{ y: 143 }, { y: 146 }]);
    setupAnimals({ ground: [143, 146], dogs: 1, lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })) });
    setCarLanes(162, 175, 'br');
    // água de coco by the kiosk, a kid on the calçadão, a delivery pulling over at the kiosk
    setupAmbient('cabo-branco', { walk: 146, stop: 262, kid: 120, curb: 154, shop: 290 });
    configure({ roofs: [], tips: [], lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })), ground0: WALK, horizon: HORIZON });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}`; },
};

