/* Pure rules for the little speech bubbles people say when tapped (no DOM, unit-tested in
   test/speech-rules.test.ts): which authored phrase fits the city, the scene, the hour and the
   REAL weather, without repeating itself; where the bubble goes on screen; and when it hides.
   Weather phrases follow the same rule as everything else: only a genuine Open-Meteo reading
   (live or stale) or the explicit #wx= test counts. Unknown weather gives no weather phrase at all. */
import { type WxState, raining } from './rain-rules.ts';
import { PHRASES, type Phrase, type Role, type Tod, type WxTag } from './phrases.ts';

export type { Phrase, Role, Tod, WxTag };
export type City = 'esperanca' | 'campina' | 'joaopessoa' | 'areia' | 'remigio' | 'tokyo';

/** At or above this real temperature (°C) people may complain about the heat. */
export const HOT_C = 30;
/** At or below this real temperature (°C) people may mention the cold (the Nordeste feels it sooner). */
export const COLD_C = { br: 18, tokyo: 8 } as const;

export interface WxCtx { kind: WxState; temp: number | null; rain: number; snow: number }
export interface SpeechCtx { city: City; scene: string; hour: number; role: Role; wx: WxCtx }

/** manhã 5–12, tarde 12–18, noite 18–24, madrugada 0–5 (city time). */
export function timeOfDay(hour: number): Tod {
  const h = ((hour % 24) + 24) % 24;
  return h < 5 ? 'madrugada' : h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite';
}

/** Weather tags allowed right now. Empty when the weather is unknown, whatever the numbers say. */
export function weatherTags(wx: WxCtx, city: City): WxTag[] {
  if (wx.kind === 'unavailable') return [];
  const tags: WxTag[] = [];
  if (raining(wx.kind, wx.rain, wx.snow)) tags.push(wx.snow > wx.rain ? 'snow' : 'rain');
  const t = wx.temp;
  if (t !== null && Number.isFinite(t)) {
    if (t >= HOT_C) tags.push('heat');
    else if (t <= COLD_C[city === 'tokyo' ? 'tokyo' : 'br']) tags.push('cold');
  }
  return tags;
}

/** Whether a phrase fits the place, the hour, the weather tags and who is speaking. */
export function fits(p: Phrase, ctx: SpeechCtx, tags: readonly WxTag[]): boolean {
  if (!(p.who ?? ['passerby']).includes(ctx.role)) return false;
  if (p.scene) { if (p.scene !== ctx.scene) return false; }
  else if (p.city === 'br') { if (ctx.city === 'tokyo') return false; }
  else if (p.city !== ctx.city) return false;
  if (p.tod && !p.tod.includes(timeOfDay(ctx.hour))) return false;
  if (p.wx && !tags.includes(p.wx)) return false;
  return true;
}

/** Every phrase that fits the context (for tests and the debug panel). */
export function candidates(ctx: SpeechCtx, pool: readonly Phrase[] = PHRASES): Phrase[] {
  const tags = weatherTags(ctx.wx, ctx.city);
  return pool.filter((p) => fits(p, ctx, tags));
}

/** How many recent phrases are kept out of the draw. */
export const RECENT = 6;

/** Picks a phrase for the context, weighted towards the specific ones (scene, weather, hour) and
    never one of the recent ones while anything else fits; never the very last one if there is any
    other choice. `rnd` returns [0, 1). Returns null only if nothing at all fits. */
export function pickPhrase(ctx: SpeechCtx, recent: readonly string[], rnd: () => number, pool: readonly Phrase[] = PHRASES): string | null {
  const all = candidates(ctx, pool);
  if (!all.length) return null;
  const last = recent[recent.length - 1];
  let list = all.filter((p) => !recent.includes(p.t));
  if (!list.length) list = all.filter((p) => p.t !== last);
  if (!list.length) list = all;
  const w = list.map((p) => 1 + (p.scene ? 2 : 0) + (p.wx ? 3 : 0) + (p.tod ? 1 : 0) + (p.who ? 1 : 0));
  let r = Math.min(Math.max(rnd(), 0), 0.999999) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i].t; }
  return list[list.length - 1].t;
}

/** Appends a phrase to the recent history, keeping at most `max`. */
export function remember(recent: string[], t: string, max = RECENT): string[] {
  const next = [...recent.filter((x) => x !== t), t];
  return next.length > max ? next.slice(next.length - max) : next;
}

// ---------- placement ----------
export interface BubbleBox { left: number; top: number; below: boolean; tail: number }

/** Places a w×h bubble above the anchor (ax, ay) — the speaker's head, in CSS px — inside a vw×vh
    viewport with a margin; flips below the anchor when there is no room above. `tail` is the arrow's
    x inside the bubble, pointing at the speaker as far as the bubble's corners allow. */
export function placeBubble(ax: number, ay: number, w: number, h: number, vw: number, vh: number, margin = 8, gap = 10): BubbleBox {
  const maxL = Math.max(margin, vw - margin - w), maxT = Math.max(margin, vh - margin - h);
  const left = Math.min(Math.max(ax - w / 2, margin), maxL);
  let top = ay - gap - h, below = false;
  if (top < margin) { top = ay + gap; below = true; }
  top = Math.min(Math.max(top, margin), maxT);
  const tail = Math.min(Math.max(ax - left, 8), Math.max(8, w - 8));
  return { left: Math.round(left), top: Math.round(top), below, tail: Math.round(tail) };
}

// ---------- lifecycle ----------
/** How long a bubble stays up (ms), and how many can be up at once. */
export const BUBBLE_MS = 3000;
export const MAX_BUBBLES = 2;

export interface Live<T> { id: number; born: number; item: T }

/** The bubbles currently shown: a new one pushes out the oldest past `max`, each hides after `ttl`. */
export class BubbleQueue<T> {
  list: Live<T>[] = [];
  private n = 0;
  readonly max: number;
  readonly ttl: number;
  constructor(max = MAX_BUBBLES, ttl = BUBBLE_MS) { this.max = max; this.ttl = ttl; }
  /** Adds an item; returns it and whatever it pushed out. */
  add(item: T, now: number): { added: Live<T>; dropped: Live<T>[] } {
    const added = { id: ++this.n, born: now, item };
    this.list.push(added);
    const dropped = this.list.length > this.max ? this.list.splice(0, this.list.length - this.max) : [];
    return { added, dropped };
  }
  /** Removes and returns the bubbles whose time is up. */
  expire(now: number): Live<T>[] {
    const gone = this.list.filter((b) => now - b.born >= this.ttl);
    if (gone.length) this.list = this.list.filter((b) => now - b.born < this.ttl);
    return gone;
  }
  /** Removes everything (scene or city change). */
  clear(): Live<T>[] { const all = this.list; this.list = []; return all; }
}
