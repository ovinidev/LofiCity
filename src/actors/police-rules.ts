/* Pure rules for the Polícia Militar da Paraíba (PMPB) patrol cars in Esperança's street traffic
   (no DOM, unit-tested in test/police-rules.test.ts). Nothing here moves a vehicle: a patrol is just
   one more vehicle kind handed to the existing traffic code (br-traffic.ts, matriz-road.ts,
   persp-rules.ts), which applies the same one-way, signal and zebra rules to it as to everyone else.

   Frequency: one cooldown shared by every Esperança street scene (module state, so switching streets
   neither resets it nor spawns a fresh patrol). It only runs down while an Esperança traffic scene is
   being watched; when it reaches zero the next vehicle to enter becomes a patrol, and the next wait is
   drawn from a seeded PRNG: 15-30 min by day, 10-20 min at night. Only one patrol is on a road at a time.

   #police=1 is a labelled test override for screenshots: a patrol whenever none is on the road, and
   the parked pair at Praça da Matriz. Like #wx= / #wind= it never goes into a shared link.

   Keep this file free of TS-only runtime syntax: `node --test` runs it by stripping the types. */
import { hashf, mulberry32 } from '../engine/math.ts';
import { curbL } from './matriz-road.ts';

/** The only city with PMPB patrols (the other Paraíba cities share the side-on traffic code). */
export const POLICE_CITY = 'esperanca';
/** Seconds between patrols [min, max] by day and at night. */
export const DAY_GAP = [15 * 60, 30 * 60] as const;
export const NIGHT_GAP = [10 * 60, 20 * 60] as const;
/** Longest step the cooldown takes per tick (a tab woken from the background must not burst it). */
export const MAX_STEP = 0.5;

export const policeCity = (city: string) => city === POLICE_CITY;
/** Night for the patrol cadence: the same day window as the side-on traffic (06:00-18:30). */
export const policeNight = (hour: number) => !(hour >= 6 && hour < 18.5);

/** The #police=1 test override (any other value, or none, is off). */
export function policeForced(hash: string): boolean {
  return /(?:^|[#&])police=1(?:&|$)/.test(hash);
}

/** What the HUD shows while the test is on (never a live state). */
export const POLICE_LABEL = 'teste #police=1';

/** Seconds until the next patrol for a uniform draw u in [0, 1). */
export function patrolGap(u: number, night: boolean): number {
  const [a, b] = night ? NIGHT_GAP : DAY_GAP;
  const k = Number.isFinite(u) ? Math.min(Math.max(u, 0), 1) : 0.5;
  return a + (b - a) * k;
}

export interface PatrolClock { wait: number; rnd: () => number; spawned: number }

/** A cooldown that starts a full interval away (opening the app never brings a patrol at once). */
export function makePatrolClock(seed: number, hour = 12): PatrolClock {
  const rnd = mulberry32(seed);
  return { wait: patrolGap(rnd(), policeNight(hour)), rnd, spawned: 0 };
}

/** Viewing time passes (called from an Esperança traffic update only; elsewhere it stands still). */
export function tickPatrol(c: PatrolClock, dt: number, city: string) {
  if (!policeCity(city) || !(dt > 0)) return;
  c.wait = Math.max(0, c.wait - Math.min(dt, MAX_STEP));
}

export interface PatrolCtx { city: string; forced: boolean }

/** Whether the vehicle about to enter should be a patrol: Esperança only, none already on this road,
    and either the cooldown has run out or the #police=1 test asks for one. */
export function patrolDue(c: PatrolClock, ctx: PatrolCtx, onRoad: boolean): boolean {
  return policeCity(ctx.city) && !onRoad && (ctx.forced || c.wait <= 0);
}

/** A patrol entered: draw the next wait (shorter at night). */
export function patrolSpawned(c: PatrolClock, hour: number) {
  c.wait = patrolGap(c.rnd(), policeNight(hour)); c.spawned++;
}

/** The one cooldown shared by all Esperança street scenes. */
export const PATROL = makePatrolClock(0x9017b);

// ---------- the parked viatura at Praça da Matriz ----------
/** Clock slots for the parked pair; it stays from minute 5 to 35 of a slot it is planned in. */
export const PARK_SLOT_MS = 40 * 60_000;
export const PARK_FROM_MS = 5 * 60_000, PARK_TO_MS = 35 * 60_000;
/** Chance per slot (rare; a little likelier at night). */
export const PARK_P_DAY = 0.12, PARK_P_NIGHT = 0.2;

/** Whether the parked PMPB car and its officer are at the praça at epoch ms (so #at= shows it): a
    hash of the slot alone, Esperança only; #police=1 always shows it. */
export function parkedAt(ms: number, hour: number, city: string, forced: boolean): boolean {
  if (!policeCity(city)) return false;
  if (forced) return true;
  if (!Number.isFinite(ms)) return false;
  const slot = Math.floor(ms / PARK_SLOT_MS), t = ms - slot * PARK_SLOT_MS;
  if (t < PARK_FROM_MS || t >= PARK_TO_MS) return false;
  return hashf(Math.imul(slot, 374761393) ^ 0x50b1a) < (policeNight(hour) ? PARK_P_NIGHT : PARK_P_DAY);
}

/** Where it stands, in Praça da Matriz world pixels: a side-on car whose wheels sit on row `y`,
    from x to x + len, on the plaza pavers left of the road's yellow curb and in front of the zebra
    rows; the officer stands just right of it, facing the street. */
export const MATRIZ_PARK = { x: 228, y: 153, len: 31, dir: 1 as 1 | -1, officerX: 262 };

/** The parked pair is clear of the road: every column left of the plaza curb (and its yellow paint)
    on the row it stands on, the officer included. */
export function parkClearOfRoad(p = MATRIZ_PARK): boolean {
  return Math.max(p.x + p.len, p.officerX + 4) < curbL(p.y) - 2;
}

/** What the officer says when tapped: mostly a greeting for the hour, in turn with a couple of calm
    lines (`n` is any counter, e.g. a 5 s clock step). */
export function officerLine(hour: number, n: number): string {
  const hi = ((Math.floor(n) % 4) + 4) % 4;
  if (hi === 1) return 'Tudo tranquilo por aqui.';
  if (hi === 3) return 'Qualquer coisa, ligue 190.';
  return hour >= 5 && hour < 12 ? 'Bom dia, cidadão!' : hour >= 12 && hour < 18 ? 'Boa tarde, cidadão!' : 'Boa noite, cidadão!';
}
