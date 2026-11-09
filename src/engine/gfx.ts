/* Indexed frame buffer with a camera.
   Scenes are authored in world space: WW pixels wide, ground anchored at y = BASE_H.
   The visible frame is W x H (chosen from the screen's aspect ratio), centred horizontally
   on the world; extra height on tall screens reveals more sky above y = 0. */

export const WW = 480;      // world width
export const BASE_H = 180;  // classic frame height; y in [0,180) is the landscape frame
export const WY0 = -320;    // highest world row a portrait screen can reveal
/** Rows shown on a landscape screen: more than BASE_H, so the camera sits further back. */
export const VIEW_H = 270;
export const WHT = BASE_H - WY0;
export const MAX_H = BASE_H - WY0;

export const G = { W: 320, H: 180, camX: 80, oy: 0, buf: new Uint8Array(320 * 180) };

/** Pick a frame size that matches the screen aspect with no letterboxing. */
export function frameFor(aspect: number): { W: number; H: number } {
  let W = Math.round(VIEW_H * aspect), H = VIEW_H;
  if (W > WW) { W = WW; H = Math.max(BASE_H, Math.round(WW / aspect)); }
  if (W < 240) { W = 240; H = Math.min(MAX_H, Math.round(240 / aspect)); }
  return { W, H };
}

export function setFrame(W: number, H: number) {
  G.W = W; G.H = H; G.camX = camFor(W); G.oy = H - BASE_H;
  G.buf = new Uint8Array(W * H);
}

/** Camera x for a frame W px wide: centred on the world, or centred on a scene's focus (world x) when
    it asks for one (Scene.focusX), clamped to the world. Wide frames that show the whole world ignore it. */
export function camFor(W: number, focus: number | null = null): number {
  if (focus === null || !Number.isFinite(focus)) return Math.floor((WW - W) / 2);
  return Math.max(0, Math.min(WW - W, Math.round(focus - W / 2)));
}

/** World → screen helpers. */
export const sx = (x: number) => x - G.camX;
export const sy = (y: number) => y + G.oy;

export function put(x: number, y: number, c: number) {
  x = Math.round(x) - G.camX; y = Math.round(y) + G.oy;
  if (x >= 0 && x < G.W && y >= 0 && y < G.H) G.buf[y * G.W + x] = c;
}
/** Screen-space put. */
export function putS(x: number, y: number, c: number) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < G.W && y >= 0 && y < G.H) G.buf[y * G.W + x] = c;
}
export function getW(x: number, y: number): number {
  x = Math.round(x) - G.camX; y = Math.round(y) + G.oy;
  return x >= 0 && x < G.W && y >= 0 && y < G.H ? G.buf[y * G.W + x] : 255;
}
export function rect(x: number, y: number, w: number, h: number, c: number) {
  const x0 = Math.max(0, Math.round(x) - G.camX), x1 = Math.min(G.W, Math.round(x + w) - G.camX);
  const y0 = Math.max(0, Math.round(y) + G.oy), y1 = Math.min(G.H, Math.round(y + h) + G.oy);
  for (let j = y0; j < y1; j++) G.buf.fill(c, j * G.W + x0, j * G.W + Math.max(x0, x1));
}

/** Character map → palette index lookup (255 = transparent). */
export function M(o: Record<string, number>): Uint8Array {
  const m = new Uint8Array(128).fill(255);
  for (const k in o) m[k.charCodeAt(0)] = o[k];
  return m;
}
/** Draw a string-row sprite in world space; '.' is transparent. */
export function spr(rows: string[], x: number, y: number, map: Uint8Array, flip = false) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j], w = r.length;
    for (let i = 0; i < w; i++) {
      const c = map[r.charCodeAt(flip ? w - 1 - i : i)];
      if (c !== 255) put(x + i, y + j, c);
    }
  }
}

// ---------- static layers (world space, 255 = transparent) ----------
export type Layer = Uint8Array;
export const newLayer = (): Layer => new Uint8Array(WW * WHT).fill(255);
export function L(ly: Layer, x: number, y: number, w: number, h: number, c: number) {
  const x0 = Math.max(0, x | 0), x1 = Math.min(WW, (x + w) | 0), y0 = Math.max(WY0, y | 0), y1 = Math.min(BASE_H, (y + h) | 0);
  for (let j = y0; j < y1; j++) ly.fill(c, (j - WY0) * WW + x0, (j - WY0) * WW + Math.max(x0, x1));
}
export function Lp(ly: Layer, x: number, y: number, c: number) {
  if (x >= 0 && x < WW && y >= WY0 && y < BASE_H) ly[(y - WY0) * WW + x] = c;
}
export const Lget = (ly: Layer, x: number, y: number) =>
  x >= 0 && x < WW && y >= WY0 && y < BASE_H ? ly[(y - WY0) * WW + x] : 255;

export function blitLayer(ly: Layer, ox = 0) {
  const { W, H, buf, camX, oy } = G;
  for (let y = 0; y < H; y++) {
    const wy = y - oy;
    if (wy < WY0 || wy >= BASE_H) continue;
    const row = (wy - WY0) * WW, o = y * W;
    for (let x = 0; x < W; x++) {
      const wx = x + camX - ox;
      if (wx < 0 || wx >= WW) continue;
      const c = ly[row + wx];
      if (c !== 255) buf[o + x] = c;
    }
  }
}

/** Top edges of a layer where snow settles: [x, y, rank] triples, rank in [0,1). */
export function snowCaps(ly: Layer, rnd: () => number): Float32Array<ArrayBuffer> {
  const out: number[] = [];
  for (let y = WY0 + 1; y < BASE_H - 1; y++)
    for (let x = 0; x < WW; x++) {
      if (Lget(ly, x, y) === 255 || Lget(ly, x, y - 1) !== 255 || Lget(ly, x, y + 1) === 255) continue;
      out.push(x, y, rnd());
    }
  return new Float32Array(out);
}
