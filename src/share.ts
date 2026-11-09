/* Sharing, all local: copy the view's permalink and save a 1080x1920 story card (PNG) drawn from the
   scene's own framebuffer. Nothing is uploaded or posted; the person sends the link or image themselves. */
import { G, frameFor, setFrame } from './engine/gfx';
import { PAL32 } from './engine/palette';

export const CARD_W = 1080, CARD_H = 1920;
const ART_H = 1500; // the scene fills the top; the caption sits below
const SITE = 'loficity-lac.vercel.app';

/** Copy text; the async Clipboard API first, then the old textarea route (http, older WebViews). */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
  ta.remove();
  return ok;
}

/**
 * Render the scene once more into a portrait frame sized for the card (the engine shows extra sky on tall
 * frames, exactly as on an upright phone), read it through the current graded palette, then put the live
 * frame back untouched. No update step runs, so nothing in the scene moves or changes.
 */
function sceneArt(render: () => void): HTMLCanvasElement {
  const W0 = G.W, H0 = G.H, buf0 = G.buf;
  const f = frameFor(CARD_W / ART_H);
  const c = document.createElement('canvas');
  c.width = f.W; c.height = f.H;
  setFrame(f.W, f.H);
  try {
    render();
    const img = new ImageData(f.W, f.H), out = new Uint32Array(img.data.buffer);
    for (let i = 0; i < out.length; i++) out[i] = PAL32[G.buf[i]];
    c.getContext('2d')!.putImageData(img, 0, 0);
  } finally {
    setFrame(W0, H0); G.buf = buf0;
  }
  return c;
}

export interface CardText { city: string; scene: string; time: string; date: string }

/** Draw the story card: scene art (crisp pixels, cover-cropped), a dark caption band and the text. */
export async function drawCard(render: () => void, t: CardText): Promise<HTMLCanvasElement> {
  try { await Promise.race([document.fonts.load('64px Silkscreen'), new Promise((r) => setTimeout(r, 1200))]); } catch { /* fallback font */ }
  const art = sceneArt(render);
  const c = document.createElement('canvas');
  c.width = CARD_W; c.height = CARD_H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#05040b'; g.fillRect(0, 0, CARD_W, CARD_H);
  g.imageSmoothingEnabled = false;
  const s = Math.max(CARD_W / art.width, ART_H / art.height);
  const dw = art.width * s, dh = art.height * s;
  g.drawImage(art, (CARD_W - dw) / 2, ART_H - dh, dw, dh); // anchored at the ground, like the app
  const fade = g.createLinearGradient(0, ART_H - 140, 0, ART_H);
  fade.addColorStop(0, 'rgba(5,4,11,0)'); fade.addColorStop(1, 'rgba(5,4,11,1)');
  g.fillStyle = fade; g.fillRect(0, ART_H - 140, CARD_W, 141);

  const font = (px: number) => `${px}px Silkscreen, ui-monospace, Menlo, monospace`;
  const fit = (text: string, px: number, max: number) => {
    g.font = font(px);
    while (px > 20 && g.measureText(text).width > max) g.font = font(--px);
  };
  const x = 72, max = CARD_W - 2 * x;
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowOffsetY = 4;
  g.fillStyle = '#ff4fa3'; g.font = font(44); g.fillText('LOFI CITY', x, 140); // brand, over the sky
  g.fillStyle = '#ddd7f5'; fit(t.time, 110, max); g.fillText(t.time, x, ART_H + 115);
  g.fillStyle = '#4ff0ff'; fit(t.city.toUpperCase(), 58, max); g.fillText(t.city.toUpperCase(), x, ART_H + 200);
  g.fillStyle = '#ffcf7a'; fit(t.scene, 42, max); g.fillText(t.scene, x, ART_H + 262);
  g.fillStyle = '#a49ec8'; fit(t.date, 32, max); g.fillText(t.date, x, ART_H + 316);
  g.shadowOffsetY = 0;
  g.fillStyle = '#7d77a6'; g.font = font(28); g.fillText(SITE, x, CARD_H - 40);
  return c;
}

/** Save a canvas as a PNG through a temporary object URL (no network). */
export function downloadCanvas(c: HTMLCanvasElement, name: string): Promise<boolean> {
  return new Promise((done) => {
    c.toBlob((blob) => {
      if (!blob) { done(false); return; }
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      done(true);
    }, 'image/png');
  });
}
