/* Speech bubbles over the people you tap: small pixel-styled DOM boxes (crisp text on any screen),
   anchored at the speaker's head in world pixels, kept inside the window, hidden after ~3 s, at most
   two at a time and cleared on every scene or city change. Silent: no audio of any kind. The rules
   (phrase choice, placement, lifetime) live in actors/speech-rules.ts. */
import { G } from '../engine/gfx';
import { fromFrame } from '../engine/post';
import { BubbleQueue, placeBubble } from '../actors/speech-rules';

type Pt = { x: number; y: number };
interface Bubble { el: HTMLDivElement; at: Pt; w: number; h: number; track?: () => Pt | null }

const queue = new BubbleQueue<Bubble>();
let host: HTMLElement | null = null;

function root(): HTMLElement {
  if (host) return host;
  host = document.getElementById('bubbles') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'bubbles' }));
  return host;
}

/** Shows `text` over the speaker at world (x, y); `track` follows them as they walk (null = gone, stay put). */
export function say(text: string, at: Pt, track?: () => Pt | null) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  root().appendChild(el);
  const b: Bubble = { el, at: { ...at }, w: el.offsetWidth, h: el.offsetHeight, track }; // measured once
  const { dropped } = queue.add(b, performance.now());
  for (const d of dropped) d.item.el.remove();
  place(b);
}

function place(b: Bubble) {
  const p = b.track?.();
  if (p) b.at = { x: p.x, y: p.y };
  const a = fromFrame(b.at.x - G.camX, b.at.y + G.oy);
  const box = placeBubble(a.x, a.y, b.w, b.h, innerWidth, innerHeight);
  const s = b.el.style;
  s.transform = `translate(${box.left}px, ${box.top}px)`;
  s.setProperty('--tail', `${box.tail}px`);
  b.el.classList.toggle('below', box.below);
}

/** Per frame: hide the expired bubbles and keep the others next to their speakers. */
export function updateBubbles(now = performance.now()) {
  for (const b of queue.expire(now)) b.item.el.remove();
  for (const b of queue.list) place(b.item);
}

/** Removes every bubble (scene or city change). */
export function clearBubbles() {
  for (const b of queue.clear()) b.item.el.remove();
}

export const bubbleCount = () => queue.list.length;
