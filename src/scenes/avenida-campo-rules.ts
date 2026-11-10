/* Pure rules of the Avenida e Campo scene (Esperança): where the avenue's pavement and its two traffic
   lanes are, where the grass field is, and how the few horses graze and amble on it. No DOM, so the
   unit tests (test/avenida-campo.test.ts) can check that vehicles stay on the avenue and the horses
   stay on the grass, never on the road nor in the buildings beyond it.

   The place's real name and the avenue's traffic direction are unknown (the reference is one owner
   snapshot): the road is drawn two-way, one lane each way, with the same convention as every other
   side-on Esperança street (far lane leftbound, near lane rightbound, actors/br-traffic.ts). */

/** World rows of the avenue: far kerb (top of the asphalt) and near kerb (bottom). */
export const AVENUE = { y0: 106, y1: 131 } as const;
/** Ground rows of the two traffic lanes (setCarLanes(far, near, 'br')): wheels sit on these rows. */
export const FAR_LANE = 117, NEAR_LANE = 128;
/** The grass verge between the near kerb and the field. */
export const VERGE_Y = 134;
/** Where a horse's hooves may stand (world x and ground y). Kept in the middle of the world so the
    portrait crop (240 px wide, centred) still shows them, and well below the near kerb. */
export const FIELD = { x0: 132, x1: 350, y0: 148, y1: 175 } as const;
/** The foot of the concrete pole standing in the field (horses keep clear of it). */
export const FIELD_POLE = { x: 330, y: 168, r: 12 } as const;
/** How far a horse's body reaches from its hooves' x (half its length) and above its hooves (its height). */
export const HORSE_HALF = 10, HORSE_H = 15;
/** Keep the horses' hooves at least this far apart (they graze near each other, not on top of each other). */
export const HORSE_GAP = 22;
export const MAX_HORSES = 4;

export type HorseState = 'graze' | 'idle' | 'walk';
export interface Horse { x: number; y: number; dir: 1 | -1; st: HorseState; t: number; tx: number; ty: number; coat: number; ph: number }
type Rng = () => number;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** Whether a ground point is on the grass where horses may stand (inside FIELD, off the pole). */
export function onGrass(x: number, y: number): boolean {
  return x >= FIELD.x0 && x <= FIELD.x1 && y >= FIELD.y0 && y <= FIELD.y1 && Math.hypot(x - FIELD_POLE.x, (y - FIELD_POLE.y) * 2) >= FIELD_POLE.r;
}
/** The nearest point on the grass (a step that would leave it is pulled back). */
export function toGrass(x: number, y: number): { x: number; y: number } {
  x = clamp(x, FIELD.x0, FIELD.x1); y = clamp(y, FIELD.y0, FIELD.y1);
  const dx = x - FIELD_POLE.x, dy = (y - FIELD_POLE.y) * 2, d = Math.hypot(dx, dy);
  if (d < FIELD_POLE.r) {
    // push out around the pole, toward the field's open side
    const ux = d > 0.01 ? dx / d : -1, uy = d > 0.01 ? dy / d : 0;
    x = clamp(FIELD_POLE.x + ux * FIELD_POLE.r, FIELD.x0, FIELD.x1);
    y = clamp(FIELD_POLE.y + (uy * FIELD_POLE.r) / 2, FIELD.y0, FIELD.y1);
    if (!onGrass(x, y)) x = FIELD_POLE.x - FIELD_POLE.r - 1;
  }
  return { x, y };
}

function farFromOthers(x: number, y: number, others: readonly Horse[], self: Horse | null): boolean {
  return others.every((o) => o === self || Math.hypot(o.x - x, (o.y - y) * 1.6) >= HORSE_GAP);
}
/** A free grass spot for a horse (a few tries; the last try is still on the grass). */
function spot(rng: Rng, others: readonly Horse[], self: Horse | null, near?: { x: number; y: number }): { x: number; y: number } {
  let p: { x: number; y: number } = { x: FIELD.x0, y: FIELD.y1 };
  for (let i = 0; i < 12; i++) {
    p = near
      ? toGrass(near.x + (rng() - 0.5) * 40, near.y + (rng() - 0.5) * 10)
      : toGrass(FIELD.x0 + rng() * (FIELD.x1 - FIELD.x0), FIELD.y0 + rng() * (FIELD.y1 - FIELD.y0));
    if (onGrass(p.x, p.y) && farFromOthers(p.x, p.y, others, self)) break;
  }
  return p;
}

/** n horses (2..4) on the grass, seeded; coats are palette indices picked from `coats`. */
export function makeHorses(n: number, rng: Rng, coats: readonly number[]): Horse[] {
  const out: Horse[] = [];
  const k = clamp(Math.round(n), 2, MAX_HORSES);
  for (let i = 0; i < k; i++) {
    const p = spot(rng, out, null);
    out.push({ x: p.x, y: p.y, dir: rng() < 0.5 ? 1 : -1, st: rng() < 0.7 ? 'graze' : 'idle', t: 2 + rng() * 8, tx: p.x, ty: p.y, coat: coats[i % coats.length], ph: rng() * 6 });
  }
  return out;
}

/** Walking pace (world px per second): a slow amble. */
export const WALK_SP = 4;

/** Advance one horse by dt: mostly grazing, sometimes standing, now and then a short walk to a nearby
    free patch. Every position it takes is on the grass. */
export function stepHorse(h: Horse, dt: number, rng: Rng, others: readonly Horse[]) {
  h.t -= dt; h.ph += dt;
  if (h.st === 'walk') {
    const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy), step = WALK_SP * dt;
    if (d <= step) { h.x = h.tx; h.y = h.ty; h.st = 'graze'; h.t = 4 + rng() * 10; }
    else {
      const nx = h.x + (dx / d) * step, ny = h.y + (dy / d) * step;
      // stop short rather than walk into another horse
      if (farFromOthers(nx, ny, others, h) || !farFromOthers(h.x, h.y, others, h)) { h.x = nx; h.y = ny; }
      else { h.st = 'idle'; h.t = 2 + rng() * 3; }
      if (Math.abs(dx) > 0.5) h.dir = dx > 0 ? 1 : -1;
    }
  } else if (h.t <= 0) {
    const q = rng();
    if (q < 0.35) {
      const p = spot(rng, others, h, h);
      h.tx = p.x; h.ty = p.y; h.st = 'walk'; h.t = 60;
    } else { h.st = q < 0.8 ? 'graze' : 'idle'; h.t = 3 + rng() * 9; if (rng() < 0.25) h.dir = h.dir > 0 ? -1 : 1; }
  }
  const p = toGrass(h.x, h.y); h.x = p.x; h.y = p.y;
}

/** The horse under a tap at world (x, y), if any (front-most first). */
export function horseAt(horses: readonly Horse[], x: number, y: number): Horse | null {
  let best: Horse | null = null;
  for (const h of horses) if (Math.abs(x - h.x) <= HORSE_HALF + 1 && y <= h.y + 1 && y >= h.y - HORSE_H - 1 && (!best || h.y > best.y)) best = h;
  return best;
}

/** Quiet pt-BR lines for a tapped horse: snorts and plain remarks, nothing about the weather. */
export const HORSE_LINES = ['Rrrff!', 'Hiiiin!', 'Capim bom.', 'Tô só pastando.', 'Prrr...', 'Sossego aqui.'] as const;
export const horseLine = (n: number) => HORSE_LINES[((n % HORSE_LINES.length) + HORSE_LINES.length) % HORSE_LINES.length];
