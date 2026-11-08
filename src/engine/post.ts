/* Presents the indexed frame: palette → RGBA, then WebGL2 bloom, rain-on-glass, CRT and grain,
   scaled to cover the whole screen. Falls back to Canvas2D nearest-neighbour scaling. */
import { G } from './gfx';
import { PAL32 } from './palette';

const VS = `#version 300 es
out vec2 v; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); v=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
const FS_BRIGHT = `#version 300 es
precision mediump float; in vec2 v; out vec4 o; uniform sampler2D uS; uniform float uTh;
void main(){ vec3 c=texture(uS,v).rgb; float l=max(c.r,max(c.g,c.b)); o=vec4(c*smoothstep(uTh,.97,l),1.); }`;
const FS_BLUR = `#version 300 es
precision mediump float; in vec2 v; out vec4 o; uniform sampler2D uS; uniform vec2 uD;
void main(){ vec3 c=texture(uS,v).rgb*.227027;
 c+=(texture(uS,v+uD*1.3846).rgb+texture(uS,v-uD*1.3846).rgb)*.3162162;
 c+=(texture(uS,v+uD*3.2308).rgb+texture(uS,v-uD*3.2308).rgb)*.0702703; o=vec4(c,1.); }`;
const FS_FINAL = `#version 300 es
precision highp float; in vec2 v; out vec4 o;
uniform sampler2D uS, uB; uniform float uT, uCrt, uShake, uBloom, uAsp, uH;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 uv=v; vec2 c=v*2.-1.;
  if(uCrt>.5){ vec2 k=c*(1.+dot(c,c)*.045); uv=k*.5+.5; }
  uv.y+=uShake/uH;
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){ o=vec4(0.,0.,0.,1.); return; }
  vec3 col=texture(uS,uv).rgb; col+=texture(uB,uv).rgb*uBloom;
  if(uCrt>.5){ float row=uv.y*uH; col*=.76+.24*sin(fract(row)*3.14159); col*=1.06; }
  vec2 vc=c*vec2(.85,1.); col*=1.-.2*dot(vc,vc);
  col+=(h21(gl_FragCoord.xy+fract(uT*7.)*311.)-.5)*.03;
  o=vec4(col,1.);
}`;

interface GLR {
  gl: WebGL2RenderingContext; pB: WebGLProgram; pBl: WebGLProgram; pF: WebGLProgram; vao: WebGLVertexArrayObject;
  scene?: WebGLTexture; t0?: WebGLTexture; t1?: WebGLTexture; t2?: WebGLTexture;
  f0?: WebGLFramebuffer; f1?: WebGLFramebuffer; f2?: WebGLFramebuffer; bw: number; bh: number; w: number; h: number;
  u: Record<string, WebGLUniformLocation | null>; uBlD: WebGLUniformLocation | null; uBlS: WebGLUniformLocation | null;
  uBS: WebGLUniformLocation | null; uTh: WebGLUniformLocation | null;
}

export const opts = { crt: false };
const view = document.getElementById('view') as HTMLCanvasElement;
let R: GLR | null = null, ctx2d: CanvasRenderingContext2D | null = null;
let low: HTMLCanvasElement | null = null, lowCtx: CanvasRenderingContext2D | null = null;
let img = new ImageData(G.W, G.H), out32 = new Uint32Array(img.data.buffer);
const vp = { x: 0, y: 0, w: 1, h: 1 };
export const backend = () => (R ? 'WebGL2' : 'Canvas2D');

function initGL(): GLR | null {
  const gl = view.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const prog = (fs: string) => {
    const p = gl.createProgram()!;
    for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  };
  try {
    const pF = prog(FS_FINAL), pBl = prog(FS_BLUR), pB = prog(FS_BRIGHT);
    const u: GLR['u'] = {};
    for (const n of ['uS', 'uB', 'uT', 'uCrt', 'uShake', 'uBloom', 'uAsp', 'uH']) u[n] = gl.getUniformLocation(pF, n);
    return {
      gl, pB, pBl, pF, vao: gl.createVertexArray()!, bw: 0, bh: 0, w: 0, h: 0, u,
      uBlD: gl.getUniformLocation(pBl, 'uD'), uBlS: gl.getUniformLocation(pBl, 'uS'), uBS: gl.getUniformLocation(pB, 'uS'), uTh: gl.getUniformLocation(pB, 'uTh'),
    };
  } catch (e) { console.warn('WebGL2 init failed, using Canvas2D', e); return null; }
}

function sizeTargets(r: GLR) {
  const { gl } = r, W = G.W, H = G.H;
  if (r.w === W && r.h === H) return;
  for (const t of [r.scene, r.t0, r.t1, r.t2]) if (t) gl.deleteTexture(t);
  for (const f of [r.f0, r.f1, r.f2]) if (f) gl.deleteFramebuffer(f);
  const tex = (w: number, h: number, filter: number) => {
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const fbo = (t: WebGLTexture) => { const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };
  r.bw = Math.ceil(W / 2); r.bh = Math.ceil(H / 2);
  r.scene = tex(W, H, gl.NEAREST); r.t0 = tex(W, H, gl.LINEAR); r.t1 = tex(r.bw, r.bh, gl.LINEAR); r.t2 = tex(r.bw, r.bh, gl.LINEAR);
  r.f0 = fbo(r.t0); r.f1 = fbo(r.t1); r.f2 = fbo(r.t2); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  r.w = W; r.h = H;
}

export function initPost() {
  R = initGL();
  if (!R) { ctx2d = view.getContext('2d'); low = document.createElement('canvas'); lowCtx = low.getContext('2d'); }
  view.addEventListener('webglcontextlost', (e) => e.preventDefault());
  view.addEventListener('webglcontextrestored', () => { R = initGL(); });
}

/** Canvas fills the window; the frame is scaled to cover it (W,H already match the aspect). */
/** Pointer position (CSS px) to frame pixel coordinates. */
export function toFrame(clientX: number, clientY: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return { x: ((clientX * dpr - vp.x) * G.W) / vp.w, y: ((clientY * dpr - vp.y) * G.H) / vp.h };
}

/** The inverse of toFrame: a frame pixel to CSS px in the window (for DOM overlays such as speech bubbles). */
export function fromFrame(x: number, y: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return { x: ((x * vp.w) / G.W + vp.x) / dpr, y: ((y * vp.h) / G.H + vp.y) / dpr };
}

export function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.width = Math.floor(innerWidth * dpr); view.height = Math.floor(innerHeight * dpr);
  const s = Math.max(view.width / G.W, view.height / G.H);
  vp.w = Math.ceil(G.W * s); vp.h = Math.ceil(G.H * s);
  vp.x = Math.floor((view.width - vp.w) / 2); vp.y = Math.floor((view.height - vp.h) / 2);
  if (img.width !== G.W || img.height !== G.H) { img = new ImageData(G.W, G.H); out32 = new Uint32Array(img.data.buffer); }
  if (low) { low.width = G.W; low.height = G.H; }
}

export function present(t: number, shake: number, dayK: number) {
  const n = G.W * G.H, buf = G.buf;
  for (let i = 0; i < n; i++) out32[i] = PAL32[buf[i]];
  if (R) drawGL(R, t, shake, dayK); else draw2D(shake);
}

function drawGL(r: GLR, t: number, shake: number, dayK: number) {
  sizeTargets(r);
  const { gl } = r, W = G.W, H = G.H;
  gl.bindVertexArray(r.vao);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.scene!);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(img.data.buffer));
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.f0!); gl.viewport(0, 0, W, H); gl.useProgram(r.pB);
  gl.uniform1i(r.uBS, 0); gl.uniform1f(r.uTh, 0.5 + 0.35 * dayK); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.useProgram(r.pBl); gl.uniform1i(r.uBlS, 0); gl.viewport(0, 0, r.bw, r.bh);
  const pass = (src: WebGLTexture, dst: WebGLFramebuffer, dx: number, dy: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(r.uBlD, dx, dy); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  pass(r.t0!, r.f1!, 1 / r.bw, 0); pass(r.t1!, r.f2!, 0, 1 / r.bh); pass(r.t2!, r.f1!, 2 / r.bw, 0); pass(r.t1!, r.f2!, 0, 2 / r.bh);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, view.width, view.height);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(vp.x, view.height - vp.y - vp.h, vp.w, vp.h); gl.useProgram(r.pF);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.scene!);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, r.t2!);
  const u = r.u;
  gl.uniform1i(u.uS, 0); gl.uniform1i(u.uB, 1); gl.uniform1f(u.uT, t);
  gl.uniform1f(u.uCrt, opts.crt ? 1 : 0);
  gl.uniform1f(u.uShake, shake); gl.uniform1f(u.uBloom, 0.95 - 0.6 * dayK);
  gl.uniform1f(u.uAsp, W / H); gl.uniform1f(u.uH, H);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function draw2D(shake: number) {
  if (!ctx2d || !lowCtx || !low) return;
  lowCtx.putImageData(img, 0, 0);
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.drawImage(low, vp.x, vp.y + (shake * vp.h) / G.H, vp.w, vp.h);
}
