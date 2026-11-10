/* Pure rules for the rare geek-culture easter eggs hidden in Esperança's scenes (no DOM, unit-tested
   in test/egg-rules.test.ts). Small original homage figures drawn in code by eggs.ts: a wall-crawling
   web-slinger, a caped vigilante on a rooftop at night, a bat-shaped signal on night clouds, a dot
   eater chasing scared ghosts, a blue police box that comes and goes, a big grey forest spirit
   waiting out the rain, a little electric critter in the grass and a freighter streaking across the
   night sky.

   Scheduling follows ambient-rules.ts but much sparser: Esperança's local clock is cut into 40-minute
   slots and a hash of (scene, slot) decides whether a slot holds an egg, which one, when it starts and
   how long it lasts (tens of seconds). At most one egg per slot and a quiet gap before the next, so a
   scene never shows two at once; the same scene + instant always gives the same answer (#at= is
   respected, no Math.random). Which egg is picked depends on the hour alone; the conditions (night,
   real rain, real clouds) can only cancel it, never cause it, and never touch the weather. Night is
   the existing daylight factor S.dayK; rain is rain-rules.ts `raining()` on the real (gated) state;
   clouds are S.cloud from a genuine reading (or the labelled #wx= test). Unknown weather is never
   rain and never cloudy.

   #egg=<id> is a labelled test override, like #wx=: it forces that egg in a scene that places it,
   bypassing rarity and conditions, so it can be screenshotted.

   Keep this file free of TS-only runtime syntax: `node --test` runs it by stripping the types. */
import { type WxState, raining } from './rain-rules.ts';

export type EggId = 'spiderman' | 'batman' | 'batsignal' | 'pacman' | 'tardis' | 'totoro' | 'poke' | 'falcon';
export const EGG_IDS: readonly EggId[] = ['spiderman', 'batman', 'batsignal', 'pacman', 'tardis', 'totoro', 'poke', 'falcon'];
/** The Konami-code cameo, also accepted by #egg= (it plays what the code would unlock right now). */
export const KONAMI_ID = 'konami';

/** What has to hold for an egg to show (unless forced by #egg=). */
export type Gate = 'any' | 'day' | 'night' | 'night-cloudy' | 'rain';
export const GATES: Readonly<Record<EggId, Gate>> = {
  spiderman: 'any', batman: 'night', batsignal: 'night-cloudy', pacman: 'any',
  tardis: 'any', totoro: 'rain', poke: 'day', falcon: 'night',
};
/** S.dayK below this is night (21:30 in November is 0; dusk and dawn stay out). */
export const NIGHT_DAYK = 0.2;
/** S.dayK above this is day (the little critter is only out in daylight). */
export const DAY_DAYK = 0.3;
/** S.cloud at or above this counts as cloudy (the #wx=cloudy test gives 0.6, a clear sky 0). */
export const CLOUDY_MIN = 0.5;

/** Local hours [from, to) in which a scheduled egg may be planned; to < from wraps past midnight.
    The conditions above still have the last word (a December dusk at 18:30 is not night yet). */
export const EGG_HOURS: Readonly<Record<EggId, readonly [number, number]>> = {
  spiderman: [7, 22], batman: [19, 5], batsignal: [19, 4], pacman: [8, 22],
  tardis: [6, 24], totoro: [0, 24], poke: [7, 17], falcon: [19, 5],
};
/** Seconds each egg lasts [min, max]: short appearances, far shorter than a slot. */
export const EGG_DUR: Readonly<Record<EggId, readonly [number, number]>> = {
  spiderman: [28, 40], batman: [30, 45], batsignal: [30, 45], pacman: [20, 28],
  tardis: [22, 30], totoro: [30, 45], poke: [25, 40], falcon: [12, 16],
};

/** Where each egg sits in each scene (world pixels; y is the feet / the anchor). Esperança scenes only.
    Every fixed spot stays inside x 140..340 so a phone held upright (which shows about x 124..356) sees
    it, and a path runs at least 50 px inside that range; all stay off the roads and the Matriz zebra. */
export interface EggSpot {
  x: number; y: number;
  /** A second x or y for eggs that move along a path (crawl / run / scurry). */
  x1?: number; y1?: number;
}
export const EGG_SPOTS: Readonly<Record<string, Partial<Record<EggId, EggSpot>>>> = {
  // hanging from the right outer bay's cornice; on the left corner pilaster cap at night; signal and
  // fly-by in the open sky beside the tower
  'praca-matriz': {
    spiderman: { x: 301, y: 55 }, batman: { x: 170, y: 37 }, batsignal: { x: 322, y: -44 },
    falcon: { x: 140, y: -34, x1: 340, y1: -58 },
  },
  'capelinha': { batman: { x: 264, y: 35 }, falcon: { x: 140, y: -20, x1: 340, y1: -46 } },
  // crawling up the lilac building's wall
  'rua-comercio': { spiderman: { x: 148, y: 128, y1: 98 }, falcon: { x: 140, y: -20, x1: 340, y1: -44 } },
  // along the orange swoosh under FIADO SÓ AQUI, between the two round badges; climbing the red-and-white mast
  'armazem-paraiba': {
    pacman: { x: 78, y: 93, x1: 198 }, spiderman: { x: 197, y: 44, y1: 12 },
    falcon: { x: 140, y: -40, x1: 340, y1: -62 },
  },
  // the police box in front of the grey building; the spirit under the Casa de Amigos marquise
  'centro-teatro': { tardis: { x: 176, y: 140 }, totoro: { x: 290, y: 141 }, falcon: { x: 140, y: -40, x1: 340, y1: -64 } },
  // on the turf, just above the mural wall
  'campo-rodoviaria': { poke: { x: 170, y: 124, x1: 330 }, falcon: { x: 140, y: -10, x1: 340, y1: -36 } },
  'praca-cultura': { falcon: { x: 140, y: -30, x1: 340, y1: -52 } },
  // hanging from the near pole's crossbar
  'rua-faustino': { spiderman: { x: 196, y: 36 }, falcon: { x: 140, y: -40, x1: 340, y1: -62 } },
  'rua-jose-bezerra': { falcon: { x: 140, y: -40, x1: 340, y1: -62 } },
  'rua-manoel-rodrigues': { falcon: { x: 140, y: -40, x1: 340, y1: -62 } },
  // the city-wide fly-by only, over the diagonal wires (no scene-specific egg here)
  'avenida-campo': { falcon: { x: 140, y: -44, x1: 340, y1: -70 } },
};
/** Scenes that host eggs (all in Esperança). */
export const EGG_SCENES: readonly string[] = Object.keys(EGG_SPOTS);
export const eggsIn = (scene: string): EggId[] => EGG_IDS.filter((id) => EGG_SPOTS[scene]?.[id]);

export const SLOT_MIN = 40;
export const SLOT_MS = SLOT_MIN * 60_000;
/** Quiet time kept free at the end of every slot. */
export const SLOT_GAP_MS = 5 * 60_000;
/** Chance that a slot holds an egg (about one every couple of hours where an egg fits the hour). */
export const SLOT_P = 0.32;
/** Esperança's offset from UTC, hours (no daylight saving). */
const UTC_OFF = -3;
const HOUR_MS = 3_600_000;

export interface EggWx { kind: WxState; rain: number; snow: number; cloud: number }
export interface EggCond { dayK: number; wx: EggWx }

export interface Egg {
  id: EggId;
  scene: string;
  /** Epoch ms when it starts and ends. */
  start: number;
  end: number;
  /** Stable per appearance: picks sides, colours, lines. */
  seed: number;
  /** True when forced by #egg= (test override) or unlocked by the Konami code. */
  forced?: boolean;
}

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
/** Uniform [0, 1) from a seed and a stream number. */
const u = (seed: number, k: number) => mix(seed + Math.imul(k, 0x9e3779b9)) / 4294967296;

const inHours = (id: EggId, h: number) => { const [a, b] = EGG_HOURS[id]; return a <= b ? h >= a && h < b : h >= a || h < b; };

/** The Esperança-local slot index containing an instant. */
export const slotAt = (ms: number) => Math.floor((ms + UTC_OFF * HOUR_MS) / SLOT_MS);

/** The egg planned for a slot before the conditions are consulted; null if the slot stays quiet. */
export function plannedEgg(scene: string, slot: number): Egg | null {
  const ids = eggsIn(scene);
  if (!ids.length) return null;
  const startLocal = slot * SLOT_MS, hour = (((startLocal % (24 * HOUR_MS)) + 24 * HOUR_MS) % (24 * HOUR_MS)) / HOUR_MS;
  const seed = mix(strHash(`egg:${scene}`) ^ mix(slot));
  const fit = ids.filter((id) => inHours(id, hour));
  if (!fit.length || u(seed, 1) >= SLOT_P) return null;
  const id = fit[Math.floor(u(seed, 2) * fit.length)];
  const [d0, d1] = EGG_DUR[id], dur = Math.round((d0 + (d1 - d0) * u(seed, 3)) * 1000);
  const start = startLocal - UTC_OFF * HOUR_MS + Math.floor(u(seed, 4) * (SLOT_MS - SLOT_GAP_MS - dur));
  return { id, scene, start, end: start + dur, seed };
}

export const isNight = (c: EggCond) => c.dayK < NIGHT_DAYK;
export const isRaining = (c: EggCond) => raining(c.wx.kind, c.wx.rain, c.wx.snow);
export const isCloudy = (c: EggCond) => c.wx.kind !== 'unavailable' && Number.isFinite(c.wx.cloud) && c.wx.cloud >= CLOUDY_MIN;

/** Whether an egg's hard condition holds now. Reads the state only; never changes it. */
export function gateOpen(id: EggId, c: EggCond): boolean {
  switch (GATES[id]) {
    case 'night': return isNight(c);
    case 'night-cloudy': return isNight(c) && isCloudy(c);
    case 'rain': return isRaining(c);
    case 'day': return c.dayK > DAY_DAYK;
    default: return true;
  }
}

/** A valid #egg= value, or null. 'konami' plays the code's unlock. */
export function parseEggParam(v: string | null | undefined): EggId | 'konami' | null {
  const s = (v ?? '').trim().toLowerCase();
  if (s === KONAMI_ID) return KONAMI_ID;
  return (EGG_IDS as readonly string[]).includes(s) ? (s as EggId) : null;
}

/** A forced egg (#egg= test or the Konami unlock), looping every `dur` from `anchor` (the moment it was
    first shown) so a screenshot taken any time later still catches it. Null if the scene does not place it. */
export function forcedEgg(scene: string, id: EggId, ms: number, anchor: number): Egg | null {
  if (!EGG_SPOTS[scene]?.[id]) return null;
  const [d0, d1] = EGG_DUR[id], dur = Math.round((d0 + d1) * 500);
  const n = Math.max(0, Math.floor((ms - anchor) / dur)), start = anchor + n * dur;
  return { id, scene, start, end: start + dur, seed: mix(strHash(`egg:${scene}:${id}`) ^ n), forced: true };
}

/** The egg showing in a scene at an instant, or null. At most one, by construction. A forced id
    (#egg=) wins over the schedule and ignores the conditions; `anchor` is when the override began. */
export function eggAt(scene: string, ms: number, c: EggCond, force?: { id: EggId; anchor: number } | null): Egg | null {
  if (!EGG_SPOTS[scene]) return null;
  if (force) return forcedEgg(scene, force.id, ms, force.anchor);
  const e = plannedEgg(scene, slotAt(ms));
  return e && ms >= e.start && ms < e.end && gateOpen(e.id, c) ? e : null;
}

/** The next planned egg starting after `ms` within `withinMs` (debug panel; conditions not applied). */
export function nextEgg(scene: string, ms: number, withinMs = 12 * HOUR_MS): Egg | null {
  if (!EGG_SPOTS[scene]) return null;
  const s0 = slotAt(ms), n = Math.ceil(withinMs / SLOT_MS);
  for (let s = s0; s <= s0 + n; s++) {
    const e = plannedEgg(scene, s);
    if (e && e.start > ms) return e;
  }
  return null;
}

/** Konami unlock order: the rarest fitting cameo first. */
const KONAMI_ORDER: readonly EggId[] = ['batsignal', 'totoro', 'batman', 'falcon', 'tardis', 'pacman', 'poke', 'spiderman'];
/** What the Konami code unlocks in a scene right now: the rarest egg the scene places whose hard
    condition holds (no batman at noon, no spirit in the dry), or null (then only the toast plays). */
export function konamiEgg(scene: string, c: EggCond): EggId | null {
  return KONAMI_ORDER.find((id) => EGG_SPOTS[scene]?.[id] && gateOpen(id, c)) ?? null;
}

/** Short pt-BR lines shown in a bubble when an egg is tapped (playful allusions, cycled in order). */
export const EGG_LINES: Readonly<Record<EggId, readonly string[]>> = {
  spiderman: ['Seu amigo da vizinhança, agora no Brejo!', 'Grandes poderes, grandes responsabilidades.', 'Meu sentido aranha diz: vai ter cuscuz.'],
  batman: ['Eu sou a noite… de Esperança.', 'Gotham? Não, Brejo paraibano.', 'Shhh. Tô de vigia.'],
  batsignal: ['Alguém chamou um morcego?', 'Holofote nas nuvens: chamado aceito.'],
  pacman: ['Waka waka waka!', 'Fiado só aqui… e os fantasmas também.', 'Pegou a pílula de poder!'],
  tardis: ['É maior por dentro!', 'Allons-y!', 'Uma cabine azul? Aqui?'],
  totoro: ['…', 'Esperando o ônibus-gato.', 'Chuva boa pras sementes.'],
  poke: ['Um bichinho selvagem apareceu!', 'Pi-pi! ⚡', 'Esse aí não cabe na bola.'],
  falcon: ['Que a Força esteja com você!', 'Menos de doze parsecs!', 'Foi um cometa? Não…'],
};
export const eggLine = (id: EggId, n: number) => { const l = EGG_LINES[id]; return l[((n % l.length) + l.length) % l.length]; };

// ---------- Konami code ----------
/** ↑ ↑ ↓ ↓ ← → ← → B A, as lower-cased KeyboardEvent.key values. */
export const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'] as const;

/** Feeds one key into the matcher. `state` is how many keys of the code are matched so far; a wrong
    key falls back to the longest tail that still starts the code (so ↑ ↑ ↑ still counts as ↑ ↑).
    `done` is true only on the exact final key; the state then starts over. */
export function konamiStep(state: number, key: string): { state: number; done: boolean } {
  const k = key.toLowerCase(), seq: string[] = [...KONAMI.slice(0, Math.max(0, Math.min(state, KONAMI.length - 1))), k];
  for (let start = 0; start < seq.length; start++) {
    const tail = seq.slice(start);
    if (tail.every((x, i) => x === KONAMI[i])) {
      if (tail.length === KONAMI.length) return { state: 0, done: true };
      return { state: tail.length, done: false };
    }
  }
  return { state: 0, done: false };
}
