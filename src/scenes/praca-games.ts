/* The teenagers' games on the Praça da Cultura plaza: a football kick-about between two tiny goals
   and a two-a-side volleyball game over a low net. When they play comes from
   ./praca-cultura-schedule.ts; this module is only the games themselves.

   Both are small deterministic simulations seeded per session, stepped at a fixed 1/30 s, with
   deliberately simple, believable physics: a rolling ball with friction, a little gravity and
   bounces; volleyball flights as plain parabolas. Everyone stays inside their own area (the whole
   kick-about field; their own half of the volleyball court). The football never leaves the field
   except into a goal (it rebounds off the planters and the wall around it); a volleyball only
   ever lands within a few pixels of the court. Real rain (decided by the scene from the real
   reading) pauses either game: the players wait at the back of their area until it stops.

   Pure module: no DOM, no engine imports. */
import { rng } from './campo-matches.ts';

const STEP = 1 / 30;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export interface Ball { x: number; y: number; z: number; vx: number; vy: number; vz: number }
export interface Kid { x: number; y: number; team: 0 | 1; ph: number; jump: number; cd: number }

/** Walk or run towards a target inside a box, never leaving it. Returns the distance covered. */
function moveIn(p: Kid, tx: number, ty: number, sp: number, h: number, x0: number, x1: number, y0: number, y1: number) {
  tx = clamp(tx, x0, x1); ty = clamp(ty, y0, y1);
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d > 0.5 && sp > 0) { const k = Math.min(1, (sp * h) / d); p.x += dx * k; p.y += dy * k; p.ph += d * k * 0.5; }
  p.x = clamp(p.x, x0, x1); p.y = clamp(p.y, y0, y1);
}

// ---------- football kick-about ----------

/** The kick-about field in world pixels: goal lines x0 / x1, back and front edges y0 / y1, goal mouths. */
export interface Field { x0: number; x1: number; y0: number; y1: number; mouth0: number; mouth1: number }
/** Crossbar height, how far into the net a goal ends up, first to GAME_TO wins a game, then a rest. */
export const BAR = 5, NET_D = 2, GAME_TO = 5, CELEB = 2.5, REST = 20, KICK_WAIT = 1.2;
export type KickPhase = 'kickoff' | 'play' | 'goal' | 'rest' | 'paused';

export class KickSim {
  kids: Kid[] = [];
  ball: Ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  score: [number, number] = [0, 0];
  goals = 0; games = 0;
  phase: KickPhase = 'kickoff';
  timer = KICK_WAIT;
  /** Who is on the ball (-1 loose), who scored last. */
  owner = -1; scorer = -1;
  lastTeam: 0 | 1 = 0;
  readonly F: Field; readonly perSide: number; readonly cx: number; readonly cy: number;
  private r: () => number; private t = 0; private decide = 0; private shot = false; private saveTried = false; private kickTeam: 0 | 1;

  constructor(F: Field, seed: number, perSide?: number) {
    this.F = F; this.r = rng(seed ^ 0x6b1c);
    this.perSide = perSide ?? (this.r() < 0.5 ? 2 : 3);
    this.cx = (F.x0 + F.x1) / 2; this.cy = (F.y0 + F.y1) / 2;
    for (const team of [0, 1] as const) for (let i = 0; i < this.perSide; i++) this.kids.push({ x: this.cx, y: this.cy, team, ph: this.r() * 6, jump: 0, cd: 0 });
    this.kickTeam = this.r() < 0.5 ? 0 : 1;
    this.setKickoff(this.kickTeam, true);
  }

  private dir = (team: number) => (team === 0 ? 1 : -1);
  private goalX = (team: number) => (team === 0 ? this.F.x1 : this.F.x0); // the goal a team attacks
  private ownX = (team: number) => (team === 0 ? this.F.x0 : this.F.x1);
  /** Player i's place in the team: 0 hangs back by the own goal, the others play out. */
  private slot = (i: number) => i % this.perSide;
  private move(p: Kid, tx: number, ty: number, sp: number, h: number) { moveIn(p, tx, ty, sp, h, this.F.x0, this.F.x1, this.F.y0, this.F.y1); }

  /** Where each player stands when the game is not running: own end, spread along the field. */
  home(i: number) {
    const p = this.kids[i], s = this.slot(i), L = this.F.x1 - this.F.x0, W = this.F.y1 - this.F.y0, dir = this.dir(p.team);
    if (s === 0) return { x: this.ownX(p.team) + dir * 4, y: this.cy };
    return { x: this.ownX(p.team) + dir * L * (0.25 + 0.12 * s), y: this.F.y0 + W * (s === 1 ? 0.3 : 0.75) };
  }
  /** Waiting out the rain or resting between games: along the back edge, each side at its own end. */
  bench(i: number) {
    const p = this.kids[i], dir = this.dir(p.team);
    return { x: this.cx - dir * (6 + this.slot(i) * 5), y: this.F.y0 };
  }

  private setKickoff(team: 0 | 1, snap = false) {
    const b = this.ball;
    b.x = this.cx; b.y = this.cy; b.z = b.vx = b.vy = b.vz = 0;
    this.phase = 'kickoff'; this.timer = KICK_WAIT; this.owner = -1; this.scorer = -1; this.kickTeam = team; this.shot = false;
    if (snap) this.kids.forEach((p, i) => { const s = this.kickoffSpot(i); p.x = s.x; p.y = s.y; });
  }
  private taker = () => this.kickTeam * this.perSide + 1;
  private kickoffSpot(i: number) {
    const p = this.kids[i];
    if (i === this.taker()) return { x: this.cx - this.dir(p.team) * 2, y: this.cy };
    const h = this.home(i);
    return { x: p.team === 0 ? Math.min(h.x, this.cx - 6) : Math.max(h.x, this.cx + 6), y: h.y };
  }

  /** Advance the game; `paused` comes from the real weather (the scene decides). */
  step(dt: number, paused = false) {
    let left = Math.min(dt, 1);
    while (left > 1e-6) { const h = Math.min(left, STEP); this.tick(h, paused); left -= h; }
  }

  private tick(h: number, paused: boolean) {
    this.t += h;
    for (const p of this.kids) { p.cd = Math.max(0, p.cd - h); p.jump = 0; }
    if (paused) {
      if (this.phase !== 'paused') { this.phase = 'paused'; this.owner = -1; }
      this.kids.forEach((p, i) => { const s = this.bench(i); this.move(p, s.x, s.y, 20, h); });
      this.roll(h, true);
      return;
    }
    if (this.phase === 'paused') this.setKickoff(this.kickTeam);
    if (this.phase === 'rest') {
      this.timer -= h;
      this.kids.forEach((p, i) => { const s = this.bench(i); this.move(p, s.x, s.y, 14, h); });
      this.roll(h, true);
      if (this.timer <= 0) { this.score = [0, 0]; this.setKickoff(this.r() < 0.5 ? 0 : 1); }
      return;
    }
    if (this.phase === 'goal') {
      this.timer -= h;
      const s = this.kids[this.scorer];
      this.kids.forEach((p, i) => {
        if (p.team === this.lastTeam) {
          if (i !== this.scorer) this.move(p, s.x - this.dir(p.team) * 3, s.y + (this.slot(i) - 1) * 2, 26, h);
          p.jump = Math.abs(Math.sin(this.t * 9 + p.ph)) * 2;
        } else { const o = this.home(i); this.move(p, o.x, o.y, 10, h); }
      });
      if (this.timer <= 0) {
        if (Math.max(...this.score) >= GAME_TO) { this.phase = 'rest'; this.timer = REST; this.games++; this.ball.x = this.cx; this.ball.y = this.F.y0 + 1; }
        else this.setKickoff(this.lastTeam === 0 ? 1 : 0);
      }
      return;
    }
    if (this.phase === 'kickoff') {
      this.timer -= h;
      this.kids.forEach((p, i) => { const s = this.kickoffSpot(i); this.move(p, s.x, s.y, 26, h); });
      const k = this.kids[this.taker()];
      if (this.timer <= 0 && Math.hypot(k.x - this.ball.x, k.y - this.ball.y) < 3) { this.phase = 'play'; this.gain(this.taker()); this.decide = 0.3; }
      return;
    }
    this.play(h);
  }

  private gain(i: number) {
    this.owner = i; this.shot = false; this.saveTried = false; this.lastTeam = this.kids[i].team; this.decide = 0.4 + this.r() * 0.7;
    const b = this.ball; b.vx = b.vy = b.vz = 0; b.z = 0;
  }
  private release(i: number, tx: number, ty: number, sp: number, vz: number) {
    const p = this.kids[i], b = this.ball, dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
    b.vx = (dx / d) * sp; b.vy = (dy / d) * sp; b.vz = vz;
    this.owner = -1; p.cd = 0.4; this.lastTeam = p.team;
  }
  shoot(i: number) {
    const F = this.F, p = this.kids[i];
    const ty = F.mouth0 + this.r() * (F.mouth1 - F.mouth0) + (this.r() - 0.5) * 3;
    this.release(i, this.goalX(p.team), ty, 60 + this.r() * 25, this.r() * 36);
    this.shot = true; this.saveTried = false;
  }
  pass(i: number) {
    const p = this.kids[i], mates = this.kids.map((_, j) => j).filter((j) => j !== i && this.kids[j].team === p.team);
    if (!mates.length) return this.shoot(i);
    const j = mates.reduce((a, b) => ((this.kids[b].x - this.kids[a].x) * this.dir(p.team) > 0 ? b : a));
    const q = this.kids[j], d = Math.hypot(q.x - p.x, q.y - p.y);
    this.release(i, q.x + this.dir(p.team) * 3, q.y, clamp(d * 1.6, 30, 60), 2);
    this.shot = false;
  }

  /** The ball rolls with friction and bounces; off the back, front and ends it rebounds (planters,
      the wall), except through a goal mouth under the bar, which is a goal. */
  private roll(h: number, still = false) {
    const F = this.F, b = this.ball, drag = still ? 4 : 1.4;
    b.x += b.vx * h; b.y += b.vy * h; b.vx *= Math.exp(-drag * h); b.vy *= Math.exp(-drag * h);
    b.vz -= 120 * h; b.z += b.vz * h;
    if (b.z < 0) { b.z = 0; b.vz = -b.vz * 0.4; if (Math.abs(b.vz) < 6) b.vz = 0; }
    if (b.y < F.y0) { b.y = Math.min(F.y1, 2 * F.y0 - b.y); b.vy = -b.vy * 0.6; }
    if (b.y > F.y1) { b.y = Math.max(F.y0, 2 * F.y1 - b.y); b.vy = -b.vy * 0.6; }
    if (b.x < F.x0 || b.x > F.x1) {
      const end = b.x > F.x1 ? 1 : 0;
      if (!still && this.phase === 'play' && b.y > F.mouth0 && b.y < F.mouth1 && b.z < BAR) return this.goal(end ? 0 : 1);
      b.x = end ? Math.max(F.x0, 2 * F.x1 - b.x) : Math.min(F.x1, 2 * F.x0 - b.x); b.vx = -b.vx * 0.5;
      this.shot = false;
    }
  }

  private goal(team: 0 | 1) {
    const F = this.F, b = this.ball;
    this.score[team]++; this.goals++; this.lastTeam = team;
    this.scorer = this.nearest(team, b.x, b.y, true);
    b.x = team === 0 ? F.x1 + NET_D : F.x0 - NET_D; b.vx = b.vy = b.vz = 0; b.z = 0;
    this.phase = 'goal'; this.timer = CELEB; this.owner = -1;
  }

  private nearest(team: number, x: number, y: number, any = false) {
    let best = -1, bd = Infinity;
    this.kids.forEach((q, j) => { if (q.team !== team || (!any && q.cd > 0)) return; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = j; } });
    return best;
  }

  private play(h: number) {
    const F = this.F, b = this.ball, pl = this.kids;
    if (this.owner >= 0) {
      // dribbling towards the other goal, weaving a little; the ball just ahead of the feet
      const p = pl[this.owner], dir = this.dir(p.team), gx = this.goalX(p.team);
      const ty = (F.mouth0 + F.mouth1) / 2 + Math.sin(this.t * 1.7 + p.ph) * (F.y1 - F.y0) * 0.35;
      this.move(p, gx - dir * 4, ty, 20, h);
      b.x = clamp(p.x + dir * 2, F.x0, F.x1); b.y = p.y; b.z = 0;
      this.decide -= h;
      const dg = Math.abs(gx - p.x);
      if (dg < 7) this.shoot(this.owner);
      else if (this.decide <= 0) {
        if (dg < 30 && this.r() < 0.6) this.shoot(this.owner);
        else if (this.r() < 0.45 || this.slot(this.owner) === 0) this.pass(this.owner);
        else this.decide = 0.4 + this.r() * 0.6;
      }
      // a defender close enough can poke it away
      const q = this.owner >= 0 ? pl[this.nearest(p.team === 0 ? 1 : 0, b.x, b.y)] : undefined;
      if (q && Math.hypot(q.x - b.x, q.y - b.y) < 3 && this.r() < 1.2 * h) {
        p.cd = 0.7; q.cd = 0.2; this.owner = -1; this.lastTeam = q.team;
        b.vx = (this.r() - 0.5) * 40 + this.dir(q.team) * 15; b.vy = (this.r() - 0.5) * 30; b.vz = 5;
      }
    } else {
      this.roll(h);
      if (this.phase !== 'play') return;
      // the back player of the defending side tries once per shot to stop it
      if (this.shot && !this.saveTried) for (const [j, q] of pl.entries()) {
        if (this.slot(j) !== 0 || q.team === this.lastTeam) continue;
        if (Math.abs(q.x - b.x) < 3 && Math.abs(q.y - b.y) < 3 && b.z < BAR + 2) {
          this.saveTried = true;
          if (this.r() < 0.45) { b.vx = -b.vx * 0.4; b.vy = (this.r() - 0.5) * 40; b.vz = 10; this.shot = false; this.lastTeam = q.team; q.cd = 0.4; }
        }
      }
      if (b.z < 3) {
        let best = -1, bd = 2.5;
        pl.forEach((q, j) => { if (q.cd > 0) return; const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < bd) { bd = d; best = j; } });
        if (best >= 0) this.gain(best);
      }
    }
    this.shape(h);
  }

  /** Everyone off the ball: the nearest of the side without it chases, back players guard their goal, the rest find space. */
  private shape(h: number) {
    const F = this.F, b = this.ball, pl = this.kids, has = this.owner >= 0 ? pl[this.owner].team : -1;
    const chase = [0, 1].map((team) => this.nearest(team, b.x, b.y));
    pl.forEach((p, i) => {
      if (i === this.owner) return;
      const dir = this.dir(p.team), own = this.ownX(p.team);
      if (has !== p.team && i === chase[p.team]) return this.move(p, b.x, b.y, has >= 0 ? 24 : 28, h);
      if (this.slot(i) === 0) {
        const danger = Math.abs(b.x - own) < 20 && has !== p.team && this.owner < 0;
        return this.move(p, danger ? b.x : own + dir * 4, clamp(b.y, F.mouth0 - 1, F.mouth1 + 1), danger ? 26 : 18, h);
      }
      const o = this.home(i), push = has === p.team ? 14 : has >= 0 ? -6 : 0;
      this.move(p, o.x + (b.x - this.cx) * 0.5 + dir * push + Math.sin(this.t * 0.6 + p.ph) * 3, o.y + (b.y - o.y) * 0.3, 18, h);
    });
  }
}

// ---------- volleyball ----------

/** The volleyball court: baselines x0 / x1, the net at x `net`, back and front lines y0 / y1. */
export interface Court { x0: number; net: number; x1: number; y0: number; y1: number }
/** Net height and contact height (px above the ground), first to SET_TO wins a set, then a break;
    a ball never lands further than OUT_MAX outside the court; gravity in px/s². */
export const NET_H = 7, CONTACT_Z = 5, SET_TO = 7, POINT_PAUSE = 2, SET_BREAK = 15, SERVE_WAIT = 1.4, OUT_MAX = 5, GRAV = 60;
export type VolleyPhase = 'serve' | 'rally' | 'point' | 'break' | 'paused';

interface Flight { sx: number; sy: number; sz: number; tx: number; ty: number; T: number; t: number; vz: number; fault: boolean }

export class VolleySim {
  /** Kids 0, 1 play on the x0 side (team 0), kids 2, 3 on the x1 side (team 1). */
  kids: Kid[] = [];
  ball: Ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  score: [number, number] = [0, 0];
  points = 0; sets = 0; rallies = 0; touchesMax = 0;
  phase: VolleyPhase = 'serve';
  timer = SERVE_WAIT;
  server = 0;
  /** Who should play the ball in flight (-1 nobody), how many touches the side has had, who touched last. */
  receiver = -1; touches = 0; lastTouch = -1;
  readonly C: Court;
  private f: Flight | null = null;
  private r: () => number; private t = 0;
  private nextServer: [number, number] = [0, 2];

  constructor(C: Court, seed: number) {
    this.C = C; this.r = rng(seed ^ 0x7011e);
    for (const team of [0, 1] as const) for (let i = 0; i < 2; i++) this.kids.push({ x: 0, y: 0, team, ph: this.r() * 6, jump: 0, cd: 0 });
    this.kids.forEach((p, i) => { const o = this.base(i); p.x = o.x; p.y = o.y; });
    this.server = this.r() < 0.5 ? 0 : 2;
    this.nextServer[this.kids[this.server].team] = this.mate(this.server);
    this.startServe(true);
  }

  private dir = (team: number) => (team === 0 ? 1 : -1); // towards the net
  /** A team's half: [xa, xb] with xa < xb. */
  half(team: number): [number, number] { return team === 0 ? [this.C.x0, this.C.net - 1] : [this.C.net + 1, this.C.x1]; }
  private move(p: Kid, tx: number, ty: number, sp: number, h: number) { const [a, b] = this.half(p.team); moveIn(p, tx, ty, sp, h, a, b, this.C.y0, this.C.y1); }
  private mate = (i: number) => i ^ 1;
  private base(i: number) {
    const p = this.kids[i], [a, b] = this.half(p.team), W = this.C.y1 - this.C.y0;
    return { x: (a + b) / 2, y: this.C.y0 + W * (i % 2 ? 0.75 : 0.25) };
  }
  private sideOf(x: number): 0 | 1 { return x < this.C.net ? 0 : 1; }

  private startServe(snap = false) {
    this.phase = 'serve'; this.timer = SERVE_WAIT; this.f = null; this.receiver = -1; this.touches = 0; this.lastTouch = -1;
    const s = this.kids[this.server];
    if (snap) { s.x = s.team === 0 ? this.C.x0 : this.C.x1; }
  }

  /** Advance the game; `paused` comes from the real weather (the scene decides). */
  step(dt: number, paused = false) {
    let left = Math.min(dt, 1);
    while (left > 1e-6) { const h = Math.min(left, STEP); this.tick(h, paused); left -= h; }
  }

  private tick(h: number, paused: boolean) {
    this.t += h;
    for (const p of this.kids) p.jump = Math.max(0, p.jump - h * 12);
    const b = this.ball;
    if (paused) {
      if (this.phase !== 'paused') { this.phase = 'paused'; this.f = null; this.receiver = -1; }
      this.kids.forEach((p, i) => { const [a, c] = this.half(p.team); this.move(p, (a + c) / 2 + (i % 2 ? 4 : -4), this.C.y0, 18, h); });
      b.z = 0; b.vx = b.vy = b.vz = 0;
      return;
    }
    if (this.phase === 'paused') return this.startServe();
    if (this.phase === 'point' || this.phase === 'break') {
      this.timer -= h;
      this.kids.forEach((p, i) => { const o = this.base(i); this.move(p, o.x, this.phase === 'break' ? this.C.y0 : o.y, 12, h); });
      if (this.timer <= 0) { if (this.phase === 'break') this.score = [0, 0]; this.startServe(); }
      return;
    }
    if (this.phase === 'serve') {
      const s = this.kids[this.server], [a, c] = this.half(s.team);
      this.move(s, s.team === 0 ? a : c, (this.C.y0 + this.C.y1) / 2 + (this.server % 2 ? 2 : -2), 18, h);
      this.kids.forEach((p, i) => { if (i !== this.server) { const o = this.base(i); this.move(p, o.x, o.y, 14, h); } });
      b.x = s.x + this.dir(s.team); b.y = s.y; b.z = 8 + Math.max(0, Math.sin(Math.min(1, 1 - this.timer / SERVE_WAIT) * Math.PI)) * 4; // the toss
      this.timer -= h;
      if (this.timer <= 0 && Math.abs(s.x - (s.team === 0 ? a : c)) < 1.5) this.serve();
      return;
    }
    this.rally(h);
  }

  private serve() {
    const s = this.kids[this.server], other = (s.team ^ 1) as 0 | 1;
    this.phase = 'rally'; this.lastTouch = this.server; this.touches = 0; s.jump = 2;
    const tgt = this.r() < 0.08 ? this.netTarget(s.team) : this.target(other, 0.1);
    this.launch(s.x + this.dir(s.team), s.y, 8, tgt.x, tgt.y, 1.3 + this.r() * 0.3, other);
  }

  /** A landing point in a team's half, sometimes (chance `out`) a little outside the court. */
  private target(team: number, out: number) {
    const [a, b] = this.half(team), C = this.C;
    let x = team === 0 ? a + this.r() * (b - a - 5) : b - this.r() * (b - a - 5), y = C.y0 + this.r() * (C.y1 - C.y0);
    if (this.r() < out) {
      const by = 1 + this.r() * (OUT_MAX - 1);
      if (this.r() < 0.6) x = team === 0 ? C.x0 - by : C.x1 + by; else y = C.y0 - by; // long, or wide behind the court
    }
    return { x, y };
  }
  /** Short, into the net: lands just on the hitter's own side. */
  private netTarget(team: number) { return { x: this.C.net - this.dir(team) * 2, y: this.C.y0 + this.r() * (this.C.y1 - this.C.y0) }; }

  /** Start a parabola that lands at (tx, ty) after T seconds; `side` is the team expected to play it. */
  private launch(sx: number, sy: number, sz: number, tx: number, ty: number, T: number, side: 0 | 1) {
    const C = this.C;
    tx = clamp(tx, C.x0 - OUT_MAX, C.x1 + OUT_MAX); ty = clamp(ty, C.y0 - OUT_MAX, C.y1);
    this.f = { sx, sy, sz, tx, ty, T, t: 0, vz: (GRAV * T * T / 2 - sz) / T, fault: false };
    // a ball crossing the net too low hits it and drops on the hitter's side
    const crosses = (sx - C.net) * (tx - C.net) < 0;
    if (crosses) {
      const tn = T * (C.net - sx) / (tx - sx), zn = sz + this.f.vz * tn - GRAV * tn * tn / 2;
      if (zn < NET_H) { const back = this.sideOf(sx); this.f = { sx, sy, sz, tx: C.net - this.dir(back) * 1.5, ty: clamp(sy, C.y0, C.y1), T: 0.5, t: 0, vz: (GRAV * 0.25 / 2 - sz) / 0.5, fault: true }; }
    }
    this.receiver = -1;
    if (this.f.fault) return;
    // who goes for it: nobody if it is clearly out (they leave it), the partner on a set, else the nearest
    const inside = tx >= C.x0 && tx <= C.x1 && ty >= C.y0 && ty <= C.y1;
    if (!inside && this.r() < 0.85) return;
    const pair = side === 0 ? [0, 1] : [2, 3];
    if (this.lastTouch >= 0 && this.kids[this.lastTouch].team === side) this.receiver = this.mate(this.lastTouch);
    else this.receiver = pair.reduce((a, c) => (Math.hypot(this.kids[c].x - tx, this.kids[c].y - ty) < Math.hypot(this.kids[a].x - tx, this.kids[a].y - ty) ? c : a));
  }

  private rally(h: number) {
    const f = this.f, b = this.ball;
    if (!f) return this.startServe();
    f.t += h;
    const u = Math.min(1, f.t / f.T);
    b.x = f.sx + (f.tx - f.sx) * u; b.y = f.sy + (f.ty - f.sy) * u; b.z = Math.max(0, f.sz + f.vz * f.t - GRAV * f.t * f.t / 2);
    // the receiver runs to where the ball comes down; the others take their places
    this.kids.forEach((p, i) => {
      if (i === this.receiver) return this.move(p, f.tx, f.ty, 30, h);
      const o = this.base(i);
      this.move(p, o.x, o.y, 16, h);
    });
    const desc = f.vz - GRAV * f.t < 0;
    if (this.receiver >= 0 && desc && b.z <= CONTACT_Z) {
      const p = this.kids[this.receiver];
      if (Math.hypot(p.x - b.x, p.y - b.y) < 3) return this.contact(this.receiver);
    }
    if (u >= 1) this.land();
  }

  /** Receive (to the partner), set (back to the receiver at the net) or send it over; sometimes it goes wrong. */
  private contact(i: number) {
    const p = this.kids[i], team = p.team, other = (team ^ 1) as 0 | 1, b = this.ball, C = this.C, dir = this.dir(team);
    const fromOther = this.lastTouch < 0 || this.kids[this.lastTouch].team !== team;
    this.touches = fromOther ? 1 : this.touches + 1;
    this.touchesMax = Math.max(this.touchesMax, this.touches);
    const hard = fromOther && this.f !== null && this.f.T < 0.9; // digging a spike is hard
    this.lastTouch = i; p.jump = 1.5;
    if (this.r() > (hard ? 0.6 : fromOther ? 0.85 : 0.92)) { // shanked: flies off somewhere it can't be saved
      const by = 1 + this.r() * (OUT_MAX - 1);
      return this.launch(b.x, b.y, b.z, team === 0 ? C.x0 - by : C.x1 + by, C.y0 - this.r() * by, 0.8, other);
    }
    if (this.touches === 1 && this.r() < 0.1) { const t = this.target(other, 0.15); return this.launch(b.x, b.y, b.z, t.x, t.y, 1.2, other); } // straight back over
    if (this.touches < 3) {
      const tx = C.net - dir * (this.touches === 1 ? 8 : 4), ty = C.y0 + 1 + this.r() * (C.y1 - C.y0 - 2);
      return this.launch(b.x, b.y, b.z, tx, ty, this.touches === 1 ? 1.0 : 0.9, team);
    }
    // third touch: a spike from up at the net, or a softer shot
    const spike = Math.abs(p.x - C.net) < 8 && this.r() < 0.6;
    if (spike) p.jump = 3;
    const t = this.r() < 0.07 ? this.netTarget(team) : this.target(other, 0.12);
    this.launch(b.x, b.y, spike ? 10 : b.z, t.x, t.y, spike ? 0.6 : 1.1, other);
  }

  /** The ball is down: a ball landing in a half loses that side the point; outside the court, the last to touch it loses. */
  private land() {
    const b = this.ball, C = this.C;
    b.z = 0;
    const inside = b.x >= C.x0 && b.x <= C.x1 && b.y >= C.y0 && b.y <= C.y1;
    const loser = inside ? this.sideOf(b.x) : this.lastTouch >= 0 ? this.kids[this.lastTouch].team : this.kids[this.server].team;
    const winner = (loser ^ 1) as 0 | 1;
    this.score[winner]++; this.points++; this.rallies++;
    this.f = null; this.receiver = -1;
    // side-out: the winners serve, alternating their two players
    if (this.kids[this.server].team !== winner) { this.server = this.nextServer[winner]; this.nextServer[winner] = this.mate(this.server); }
    if (this.score[winner] >= SET_TO) { this.phase = 'break'; this.timer = SET_BREAK; this.sets++; }
    else { this.phase = 'point'; this.timer = POINT_PAUSE; }
  }
}
