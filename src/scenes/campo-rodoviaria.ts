/* CAMPO DA RODOVIÁRIA (Esperança, PB), drawn from a Feb 2025 Google Street View capture: from
   the paver sidewalk (a royal palm in its gravel planter, a concrete utility pole) you look over
   a low wall painted with football murals (a ball, a goal net, a #10 in blue, the Brazilian flag,
   another ball, a kicking silhouette) and through a tall chain-link fence onto the green
   artificial-turf pitch, floodlight poles along the far side and low town buildings behind.
   Kids play pelada on weekday afternoons, amateur sides play with a referee and spectators on
   the wall at weekends, and some evenings the floodlights come on for a late game. Rain stops play. */
import { G, L, Lp, WW, blitLayer, getW, newLayer, put, rect, sx, sy } from '../engine/gfx';
import { bay, clamp, mulberry32 } from '../engine/math';
import {
  BFAR, BMID, BNEAR, CBEIGE, CBLUE, CGREEN, CNAVY, CRED, CYELL, FBLUE, FGREEN, FLILAC, FORNG, HAIR1, HAIR2, HALO, LEAFG, LEAFGD,
  LEDW, SKIN1, SKIN2, SKIN3, SKIN4, STEEL, STONE, STONEL, TILEW, VOID, WHITE, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawAnimalsGround, drawAnimalsPerched, drawAnimalsSky, setupAnimals, updateAnimals } from '../actors/animals';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S, hourIn } from '../sky/state';
import { drawFog, drawSky, drawStreet, type Street } from './common';
import { type Palm, drawPalm, isNight, pole } from './br-kit';
import type { Scene } from './types';

const HORIZON = 100, STREET = 147, SH = 180 - STREET;
/** Far touchline, top of the mural wall, sidewalk, top rail of the fence. */
const FAR = 104, WALLTOP = 126, WALK = 140, FENCE = 82;
const PC = 240; // halfway line
const PITCH = { x0: 30, x1: 450, y0: 107, y1: 125 }, MOUTH = { y0: 112, y1: 120 };
const wr = mulberry32(0xf007), rr = mulberry32(0xba11);
const far = newLayer(), mid = newLayer(), fence = newLayer(), front = newLayer();
const street: Street = { y0: STREET, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const farWins: { x: number; y: number; rank: number }[] = [];
const FLOODS = [60, 180, 300, 420], FLOOD_Y = 68;
const PALM: Palm = { x: 256, ground: 174, h: 150, lean: -3, ph: 1.3, imperial: true };

function buildFar() {
  // low town skyline beyond the pitch
  for (let x = -4; x < WW;) {
    const w = 12 + ((wr() * 20) | 0), top = 88 + ((wr() * 12) | 0);
    L(far, x, top, w, FAR - top, BFAR);
    for (let wy = top + 3; wy < FAR - 2; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (wr() < 0.14) farWins.push({ x: wx, y: wy, rank: wr() });
    x += w + ((wr() * 3) | 0);
  }
  // two-storey building with a stepped parapet (left)
  L(far, 24, 80, 50, FAR - 80, CBEIGE); L(far, 40, 74, 18, 6, CBEIGE); L(far, 45, 70, 8, 4, CBEIGE);
  for (const y of [84, 94]) for (let x = 28; x < 70; x += 8) L(far, x, y, 4, 5, BNEAR);
  L(far, 24, 90, 50, 1, STONEL);
  // red water tank on its tower
  L(far, 214, 72, 12, 9, CRED); L(far, 214, 72, 12, 1, TILEW);
  for (const x of [215, 224]) L(far, x, 81, 1, FAR - 81, STEEL);
  for (let y = 84; y < FAR; y += 6) L(far, 215, y, 10, 1, STEEL);
  // the long gabled hall: pale roof, white walls, coloured band at the base
  for (let i = 0; i < 44; i++) { const y = 88 + Math.round(i / 6); L(far, 300 - i, y, 1, 96 - y, STONEL); L(far, 300 + i, y, 1, 96 - y, TILEW); }
  L(far, 256, 96, 88, FAR - 96, TILEW);
  for (let x = 256; x < 344; x += 4) L(far, x, FAR - 3, 4, 3, [CBLUE, CYELL, CRED, CBLUE][(x >> 2) % 4]);
  // hills on the right
  for (let x = 360; x < WW; x++) { const top = Math.round(97 + Math.sin(x * 0.03) * 2 + Math.sin(x * 0.11) * 1); L(far, x, top, 1, FAR - top, LEAFGD); }
}

function buildPitch() {
  // artificial turf with faint mowing stripes, white lines
  for (let y = FAR; y < WALLTOP; y++) for (let x = 0; x < WW; x++) Lp(mid, x, y, ((x / 24) | 0) % 2 || bay(x, y) < 0.5 ? LEAFG : LEAFGD);
  const line = (x: number, y: number) => Lp(mid, Math.round(x), Math.round(y), TILEW);
  for (let x = 6; x < WW - 6; x++) line(x, PITCH.y0 - 1); // far touchline
  for (let y = PITCH.y0 - 1; y < WALLTOP; y++) { line(PC + 8 - (y - PITCH.y0) * 0.5, y); line(14 - (y - PITCH.y0) * 0.6, y); line(WW - 14 + (y - PITCH.y0) * 0.6, y); }
  for (let a = 0; a < 6.28; a += 0.04) line(PC + 4 + Math.cos(a) * 18, 116 + Math.sin(a) * 4.5);
  for (const [gx, dir] of [[PITCH.x0, 1], [PITCH.x1, -1]] as const) {
    for (let i = 0; i < 40; i++) line(gx - dir * 12 + i * dir, 110);
    for (let y = 110; y < WALLTOP; y++) line(gx + dir * 28 - (y - 110) * 0.4 * dir, y);
  }
  // floodlight poles along the far touchline
  for (const x of FLOODS) { L(mid, x, FLOOD_Y + 3, 1, FAR - FLOOD_Y - 3, STONEL); L(mid, x + 1, FLOOD_Y + 3, 1, FAR - FLOOD_Y - 3, STONE); L(mid, x - 3, FLOOD_Y, 8, 3, STEEL); }
}

/** Soccer ball for the mural: white disc, black patches, dark outline (clipped to the wall). */
function muralBall(cx: number, cy: number, r: number) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const d = i * i + j * j, y = cy + j;
    if (d > r * r || y < WALLTOP || y >= WALK) continue;
    const patch = [[0, 0], [-0.6, 0.4], [0.6, 0.4], [-0.35, -0.6], [0.35, -0.6]].some(([u, v]) => (i - u * r) ** 2 + (j - v * r) ** 2 < (r * 0.24) ** 2);
    Lp(mid, cx + i, y, d > (r - 1) * (r - 1) || patch ? VOID : TILEW);
  }
}

/** Painted wall: football murals in panels along the whole pitch. */
function buildMural() {
  const H = WALK - WALLTOP;
  L(mid, 0, WALLTOP, WW, H, TILEW); L(mid, 0, WALK - 2, 60, 2, STONEL); // plain whitewash on the left
  // black panel with a big ball
  L(mid, 60, WALLTOP, 72, H, VOID); muralBall(98, 137, 11);
  // black panel with a goal net seen from the side
  L(mid, 132, WALLTOP, 52, H, VOID);
  for (let y = WALLTOP + 2; y < WALK; y++) for (let x = 140; x < 178; x++) if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) Lp(mid, x, y, BMID);
  for (let i = 0; i < 12; i++) { Lp(mid, 140 + i, WALLTOP + 2 + i, TILEW); Lp(mid, 141 + i, WALLTOP + 2 + i, TILEW); }
  L(mid, 152, WALLTOP + 2, 26, 1, TILEW); L(mid, 176, WALLTOP + 2, 2, H - 2, TILEW);
  // the #10 in light blue under an orange-red sky
  for (let x = 184; x < 246; x++) for (let y = WALLTOP; y < WALK; y++) {
    const s = y - WALLTOP - Math.round(Math.sin((x - 184) * 0.15) * 1.5);
    Lp(mid, x, y, s < 2 ? CRED : s < 4 ? FORNG : CNAVY);
  }
  // the player seen from behind: dark hair, light blue shirt, one arm raised
  for (let j = 4; j < WALK - WALLTOP; j++) { const half = 9 + ((j - 4) >> 1); L(mid, 210 - half, WALLTOP + j, half * 2, 1, FBLUE); }
  for (let i = 0; i < 9; i++) L(mid, 199 - i, WALLTOP + 5 - (i >> 1), 3, 3, FBLUE); // raised arm
  L(mid, 207, WALLTOP + 3, 6, 2, SKIN3); L(mid, 206, WALLTOP, 8, 3, HAIR1);
  // "10" on the back (the 3x5 sign font has no digits)
  L(mid, 203, WALLTOP + 6, 2, 7, CNAVY); Lp(mid, 202, WALLTOP + 7, CNAVY);
  L(mid, 208, WALLTOP + 6, 6, 7, CNAVY); L(mid, 210, WALLTOP + 8, 2, 3, FBLUE);
  // lilac paint splash with drips
  for (let x = 246; x < 260; x++) { const h = H - Math.round(Math.abs(Math.sin(x * 1.7)) * 4); L(mid, x, WALLTOP, 1, h, FLILAC); }
  // the Brazilian flag on mint
  L(mid, 260, WALLTOP, 62, H, FGREEN);
  L(mid, 268, WALLTOP + 1, 46, 12, CGREEN);
  for (let j = 0; j < 12; j++) { const half = Math.round(20 * (1 - Math.abs(j - 5.5) / 6.5)); L(mid, 291 - half, WALLTOP + 1 + j, half * 2, 1, CYELL); }
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (i * i + j * j <= 18) Lp(mid, 291 + i, WALLTOP + 7 + j, Math.abs(j + i * 0.3 - 0.5) < 0.9 ? TILEW : CBLUE);
  // blue with a ball, then the silhouette of a player striking it
  L(mid, 322, WALLTOP, WW - 322, H, CBLUE);
  for (let y = WALLTOP; y < WALK; y++) { const e = 322 + Math.round(Math.sin(y * 1.3) * 3 + 3); L(mid, 322, y, e - 322, 1, FGREEN); }
  muralBall(352, 133, 6);
  for (let x = 372; x < WW; x++) for (let y = WALLTOP; y < WALK; y++) if ((x * 7 + y * 3) % 23 === 0) Lp(mid, x, y, CNAVY);
  const fig = [
    '..........##.....',
    '.........####....',
    '..........##.....',
    '.....#########...',
    '..####..####..##.',
    '.......######....',
    '........#####....',
    '.......###.###...',
    '......###...####.',
    '#######.......###',
    '.##.............#',
  ];
  fig.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') L(mid, 420 + i * 2, WALLTOP + 2 + j, 2, 1, TILEW); });
  L(mid, 0, WALLTOP, WW, 1, STONEL); // coping
}

function buildFence() {
  // tall chain-link: a sparse diamond mesh with posts and a top rail
  for (let y = FENCE + 1; y < WALLTOP; y++) for (let x = 0; x < WW; x++) if (y % 2 === 0 && ((x + y) % 6 === 0 || (x - y + 600) % 6 === 0)) Lp(fence, x, y, STONEL);
  L(fence, 0, FENCE, WW, 1, STONEL); L(fence, 0, FENCE + 1, WW, 1, STEEL);
  for (let x = 4; x < WW; x += 40) { L(fence, x, FENCE - 2, 2, WALLTOP - FENCE + 2, STONEL); L(fence, x + 1, FENCE, 1, WALLTOP - FENCE, STONE); }
}

function buildFront() {
  // grey paver sidewalk
  L(front, 0, WALK, WW, STREET - WALK, STONEL);
  for (let y = WALK + 1; y < STREET; y += 3) for (let x = (y % 2) * 3; x < WW; x += 6) { Lp(front, x, y, STONE); Lp(front, x + 1, y, STONE); }
  L(front, 0, WALK, WW, 1, STONE);
  pole(front, 114, 142, 136);
  L(front, 112, 112, 7, 8, TILEW); L(front, 112, 121, 7, 6, TILEW); // flyers stuck to the pole
}

function buildGround() {
  // paver sidewalk continues to the bottom of the frame: offset rows of grey blocks
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    const row = (d / 4) | 0, joint = (d % 4 === 0 && x % 2 === 0) || (x + (row & 1) * 4) % 8 === 0;
    street.base[d * WW + x] = joint ? STONE : wr() < 0.08 ? STONE : STONEL;
  }
  // gravel planter round the palm
  for (let d = 168 - STREET; d < SH; d++) for (let x = 244; x < 270; x++) {
    const edge = d === 168 - STREET || x === 244 || x === 269;
    street.base[d * WW + x] = edge ? STONE : wr() < 0.5 ? BMID : wr() < 0.5 ? STONE : STONEL;
  }
  for (let p = 0; p < 4; p++) {
    const cx = wr() * WW, cy = 3 + wr() * (SH - 6), rx = 8 + wr() * 18, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) { const a = (x - cx) / rx, b = (d - cy) / ry; if (a * a + b * b < 1) street.pud[d * WW + x] = 1; }
  }
}

// ---------- the match ----------
type Mode = 'none' | 'kids' | 'match' | 'night';
interface Player { x: number; y: number; hx: number; hy: number; team: 0 | 1; ph: number; skin: number; hair: number; shirt: number; shorts: number; H: number; gk: boolean; ref: boolean; jump: number }
const BALL0 = { x: PC, y: 116 };
const ball = { x: BALL0.x, y: BALL0.y, z: 0, vx: 0, vy: 0, vz: 0 };
let players: Player[] = [], mode: Mode = 'none', kickCd = 0, celebrate = 0, lastTeam: 0 | 1 = 0, score = [0, 0];

function gameMode(): Mode {
  if (S.rain > 0.4 || S.storm > 0.2) return 'none';
  const h = S.cal.hour, wd = S.cal.weekday;
  if ((wd === 0 && hourIn(h, 15.5, 17.6)) || (wd === 6 && hourIn(h, 15, 17.5))) return 'match';
  if (wd >= 1 && wd <= 5 && hourIn(h, 15.5, 18)) return 'kids';
  if ((wd === 2 || wd === 4) && hourIn(h, 19, 21.5)) return 'night';
  return 'none';
}

function setupPlayers(m: Mode) {
  players = []; score = [0, 0];
  if (m === 'none') return;
  const n = m === 'kids' ? 4 : m === 'match' ? 6 : 5;
  const kits = m === 'match' ? [[CRED, WHITE], [CBLUE, WHITE]] : [[WHITE, CBLUE], [0, VOID]]; // kids/night: one side plays shirtless
  const skins = [SKIN1, SKIN2, SKIN2, SKIN3, SKIN3, SKIN4];
  const depth = PITCH.y1 - PITCH.y0 - 3;
  for (const team of [0, 1] as const) for (let i = 0; i < n; i++) {
    const gk = i === 0 && m !== 'kids';
    const hx = team === 0 ? (gk ? PITCH.x0 + 6 : 70 + (i / n) * 150) : gk ? PITCH.x1 - 6 : 410 - (i / n) * 150;
    const hy = PITCH.y0 + 2 + ((i * 7 + team * 3) % depth);
    const skin = skins[(rr() * skins.length) | 0];
    players.push({
      x: hx, y: hy, hx, hy, team, ph: rr() * 6, skin, hair: rr() < 0.7 ? HAIR1 : HAIR2,
      shirt: gk ? CYELL : kits[team][0] || skin, shorts: kits[team][1], H: m === 'kids' ? 9 + ((rr() * 2) | 0) : 11, gk, ref: false, jump: 0,
    });
  }
  if (m === 'match') players.push({ x: PC, y: 120, hx: PC, hy: 120, team: 0, ph: 0, skin: SKIN2, hair: HAIR1, shirt: VOID, shorts: VOID, H: 11, gk: false, ref: true, jump: 0 });
  resetBall();
}
function resetBall() { ball.x = BALL0.x; ball.y = BALL0.y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; kickCd = 0.8; }

function kick(p: Player) {
  const goalX = p.team === 0 ? PITCH.x1 : PITCH.x0, dist = Math.abs(goalX - p.x);
  if (dist < 110 && rr() < 0.6) { // shoot
    const ty = MOUTH.y0 + rr() * (MOUTH.y1 - MOUTH.y0) + (rr() - 0.5) * 6, sp = 140 + rr() * 50, dx = goalX - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    ball.vx = (dx / d) * sp; ball.vy = (dy / d) * sp; ball.vz = 15 + rr() * 35;
  } else { // pass forward to a teammate, or punt it upfield
    const mates = players.filter((q) => !q.ref && q !== p && q.team === p.team && (p.team === 0 ? q.x > p.x - 10 : q.x < p.x + 10));
    const t = mates.length ? mates[(rr() * mates.length) | 0] : null;
    const tx = t ? t.x : goalX, ty = t ? t.y : BALL0.y, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, sp = 80 + rr() * 50;
    ball.vx = (dx / d) * sp; ball.vy = (dy / d) * sp; ball.vz = rr() < 0.3 ? 32 : 5;
  }
  lastTeam = p.team; kickCd = 0.35;
}

function updateMatch(dt: number) {
  const m = gameMode();
  if (m !== mode) { mode = m; setupPlayers(m); }
  if (mode === 'none') return;
  kickCd -= dt;
  if (celebrate > 0) {
    celebrate -= dt;
    for (const p of players) { p.jump = p.team === lastTeam && !p.ref && !p.gk ? Math.abs(Math.sin(celebrate * 9 + p.ph)) * 2 : 0; p.x += (p.hx - p.x) * dt * 0.8; p.y += (p.hy - p.y) * dt * 0.8; }
    if (celebrate <= 0) resetBall();
    return;
  }
  // ball physics: rolling friction, gravity, bounces; a wet pitch slows it down
  const drag = 1.0 + S.wet * 1.2;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vx *= Math.exp(-drag * dt); ball.vy *= Math.exp(-drag * dt);
  ball.vz -= 160 * dt; ball.z += ball.vz * dt; if (ball.z < 0) { ball.z = 0; ball.vz = -ball.vz * 0.45; if (Math.abs(ball.vz) < 8) ball.vz = 0; }
  // goal or out of play
  if (ball.x < PITCH.x0 || ball.x > PITCH.x1) {
    if (ball.y > MOUTH.y0 && ball.y < MOUTH.y1 && ball.z < 9) { score[ball.x > PC ? 0 : 1]++; lastTeam = ball.x > PC ? 0 : 1; celebrate = 3; ball.vx = ball.vy = 0; return; }
    ball.x = clamp(ball.x, PITCH.x0 + 8, PITCH.x1 - 8); ball.vx = ball.vy = 0; ball.z = 0; kickCd = 0.6; // goal kick
  }
  if (ball.y < PITCH.y0 || ball.y > PITCH.y1) { ball.y = clamp(ball.y, PITCH.y0 + 1, PITCH.y1 - 1); ball.vx *= 0.2; ball.vy = 0; kickCd = 0.6; } // throw-in
  // players: the nearest of each side chases, keepers guard the line, the rest hold shape around the ball
  const chaser = [0, 1].map((team) => players.filter((p) => !p.ref && !p.gk && p.team === team).reduce((a, b) => (Math.hypot(a.x - ball.x, a.y - ball.y) < Math.hypot(b.x - ball.x, b.y - ball.y) ? a : b)));
  for (const p of players) {
    let tx: number, ty: number, sp = mode === 'kids' ? 40 : 36;
    if (p.ref) { tx = ball.x + 24; ty = clamp(ball.y + 4, PITCH.y0, PITCH.y1); sp = 28; }
    else if (p.gk) { tx = p.hx; ty = clamp(ball.y, MOUTH.y0, MOUTH.y1); sp = 22; }
    else if (p === chaser[p.team]) { tx = ball.x; ty = ball.y; sp *= 1.15; }
    else { tx = p.hx + (ball.x - PC) * 0.55; ty = p.hy + (ball.y - p.hy) * 0.25; }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > 1.5) { const k = Math.min(1, (sp * dt) / d); p.x += dx * k; p.y += dy * k; p.ph += sp * dt * 0.45; }
    p.jump = 0;
    if (!p.ref && kickCd <= 0 && ball.z < 5 && Math.hypot(p.x - ball.x, p.y - ball.y) < 3.5) kick(p);
  }
}

function drawPlayer(p: Player) {
  const x = Math.round(p.x) - 1, feet = Math.round(p.y - p.jump), H = p.H, step = Math.sin(p.ph);
  const legH = Math.round(H * 0.36), bodyH = Math.round(H * 0.34), headH = 3, top = feet - H;
  rect(x - 1, Math.round(p.y), 5, 1, LEAFGD); // shadow on the turf
  // legs scissor with the stride; boots dark
  const a = Math.round(step), b = -a;
  rect(x + a, feet - legH, 1, legH, p.skin); rect(x + 2 + b, feet - legH, 1, legH, p.skin);
  put(x + a, feet - 1, VOID); put(x + 2 + b, feet - 1, VOID);
  rect(x, feet - legH - 2, 3, 2, p.shorts);
  rect(x, top + headH, 3, bodyH, p.shirt);
  put(x + (step > 0 ? 3 : -1), top + headH + 1, p.skin); put(x + (step > 0 ? -1 : 3), top + headH + 2, p.skin); // arms swing
  rect(x, top, 3, headH, p.skin); rect(x, top, 3, 1, p.hair);
}

function drawGoal(gx: number, dir: number) {
  // side view: near post low on screen, far post higher up, crossbar between, netting behind
  const nearY = MOUTH.y1, farY = MOUTH.y0, h = 9;
  const back = gx - dir * 4;
  for (let y = farY; y <= nearY; y++) for (let j = 0; j < h; j++) if ((y + j) % 2 === 0) put(back, y - h + j, WHITE);
  rect(gx, nearY - h, 1, h, WHITE); rect(gx, farY - h, 1, h, STONEL);
  for (let y = farY; y <= nearY; y++) put(gx, y - h, WHITE);
  for (let i = 0; i < 4; i++) { put(gx - dir * i, nearY - h, WHITE); put(gx - dir * i, farY - h, STONEL); }
}

function drawBall() {
  put(ball.x, ball.y, LEAFGD);
  rect(Math.round(ball.x), Math.round(ball.y - ball.z) - 2, 2, 2, WHITE); put(Math.round(ball.x) + 1, Math.round(ball.y - ball.z) - 1, VOID);
}

/** Spectators sitting on the mural wall during weekend matches. */
function wallCrowd() {
  if (mode !== 'match') return;
  const t = S.ms / 1000, cheer = celebrate > 0;
  for (let i = 0; i < 16; i++) {
    const x = 8 + ((i * 59) % 464);
    if (Math.abs(x - PALM.x) < 6 || Math.abs(x - 115) < 5) continue;
    const c = [CRED, CBLUE, WHITE, CYELL, CGREEN, VOID][i % 6], up = cheer && Math.sin(t * 10 + i) > 0 ? 1 : 0;
    rect(x, WALLTOP - 6 - up, 2, 4, c); rect(x, WALLTOP - 9 - up, 2, 3, [SKIN1, SKIN2, SKIN3, SKIN4][i % 4]); put(x, WALLTOP - 2, BNEAR); put(x + 1, WALLTOP - 1, BNEAR);
  }
}

// ---------- lights ----------
function lit() {
  const n = isNight();
  for (const f of farWins) put(f.x, f.y, n && f.rank < 0.45 ? WWARM : BFAR);
}
const floodsOn = () => mode === 'night' || (mode !== 'none' && S.dayK < 0.4);
const TURF = new Set([LEAFG, LEAFGD, TILEW]);
function floodlights() {
  const on = floodsOn();
  for (const x of FLOODS) for (let i = 0; i < 3; i++) rect(x - 2 + i * 2, FLOOD_Y + 1, 1, 1, on ? LEDW : STONEL);
  if (!on) return;
  for (let y = FAR; y < WALLTOP; y++) for (let x = 0; x < WW; x++) {
    const X = sx(x), Y = sy(y);
    if (X < 0 || X >= G.W || Y < 0 || Y >= G.H) continue;
    if (!TURF.has(getW(x, y))) continue;
    let d = 1;
    for (const f of FLOODS) d = Math.min(d, Math.hypot((x - f) / 90, (y - FAR) / 30));
    if (bay(X, Y) < 0.3 * (1 - d)) put(x, y, HALO);
  }
}

function update(dt: number) {
  updateAnimals(dt);
  updateMatch(dt);
  tickSpawns(dt, mode === 'match' ? 2 : 1); updatePeople(dt);
}

const FOG = [{ y: 98, h: 9, sp: 0.4 }, { y: 138, h: 6, sp: -0.3 }];
function render() {
  drawSky(HORIZON); drawAnimalsSky(); drawLightning();
  blitLayer(far); drawFireworks();
  blitLayer(mid); lit(); floodlights(); drawFarPrecip();
  drawGoal(PITCH.x0, 1); drawGoal(PITCH.x1, -1);
  if (mode !== 'none') {
    const list = [...players].sort((a, b) => a.y - b.y);
    let drawn = false;
    for (const p of list) { if (!drawn && p.y > ball.y) { drawBall(); drawn = true; } drawPlayer(p); }
    if (!drawn) drawBall();
  }
  blitLayer(fence); wallCrowd();
  blitLayer(front); drawAnimalsPerched(); drawPeople(); drawAnimalsGround();
  drawStreet(street); drawPalm(PALM);
  drawRipples(); drawFog(FOG); drawNearPrecip();
}

let built = false;
export const campoRodoviaria: Scene = {
  id: 'campo-rodoviaria',
  name: 'Campo da Rodoviária',
  build() {
    if (!built) { buildFar(); buildPitch(); buildMural(); buildFence(); buildFront(); buildGround(); built = true; }
    setLanes([{ y: 142 }, { y: 145 }]);
    setupAnimals({ ground: [143, 145], dogs: 2, sleepSpots: [330], lamps: FLOODS.map((x) => ({ x, y: FLOOD_Y })),
      walls: [{ x0: 0, x1: WW, y: FENCE }, { x0: 0, x1: 108, y: WALLTOP }, { x0: 380, x1: WW, y: WALLTOP }] });
    configure({ roofs: [], tips: [], lamps: [], ground0: WALK, horizon: HORIZON });
    mode = 'none';
    for (let i = 0; i < 120; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}  jogo ${mode}  placar ${score[0]}x${score[1]}`; },
};
