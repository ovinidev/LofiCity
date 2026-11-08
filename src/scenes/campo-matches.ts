/* Matches at the Campo da Rodoviária (Esperança's "Campo do América"): schedule, kits and the game itself.

   ART DIRECTION, NOT A REAL FIXTURE LIST. The duration is an artistic assumption: a match starts
   every 1h30 from 08:00 to 20:00, local Esperança time (08:00, 09:30, 11:00, 12:30, 14:00, 15:30,
   17:00, 18:30, 20:00), and each slot lasts until the next start (1h30); the last one, 20:00, ends at
   21:00 (1h). There is
   no play before 08:00 or from 21:00. (A real amateur game is shorter; here the pitch is simply never
   empty in the daytime, and one slot = one match with the same two sides.)

   Each slot has two sides of five outfield players plus a keeper, and a referee. Kits are chosen
   deterministically from the local date and the slot: the two shirts are far apart in colour (in
   both the day and the night palette), the next slot never reuses either shirt colour, and the
   keepers and the referee wear colours distinct from both sides. Colours carry their palette index
   and copied hex values so this module stays free of engine imports.

   Weather never comes from here: the scene passes the real reading (rain, storm). Heavy rain or a
   storm pauses play (the players wait on the far touchline), light rain plays on with a heavier
   ball. The game itself (MatchSim) is a small deterministic simulation seeded per slot: players hold
   a loose formation, the nearest ones chase the ball, they dribble, pass and shoot, keepers save
   some shots, and the odd goal is followed by a short celebration and a kickoff. Everyone stays
   on the turf; the ball only leaves it into a net. Pure module: no DOM, no engine imports. */

// ---------- schedule ----------

export const SLOT_STARTS = [8, 9.5, 11, 12.5, 14, 15.5, 17, 18.5, 20] as const;
export const PLAY_END = 21;
/** Slots that are played under the floodlights (18:30 and 20:00, after dusk at 7°S all year). */
export const NIGHT_SLOT0 = 7;

/** Index of the slot in progress at a local clock hour (fractional), or -1 when there is no play. */
export function slotAt(hour: number): number {
  if (!(hour >= SLOT_STARTS[0]) || hour >= PLAY_END) return -1;
  let i = 0;
  while (i + 1 < SLOT_STARTS.length && hour >= SLOT_STARTS[i + 1]) i++;
  return i;
}
export const slotWindow = (i: number) => ({ start: SLOT_STARTS[i], end: i + 1 < SLOT_STARTS.length ? SLOT_STARTS[i + 1] : PLAY_END });

// ---------- kits ----------

/** Shirt colours: [palette index, day hex, night hex], copied from engine/palette.ts (checked by the tests). */
export const COLOURS = {
  red: [48, '#c0393b', '#6a2438'], blue: [49, '#3a5fa8', '#24356a'], yellow: [53, '#e8c34a', '#6e5a2a'], white: [28, '#f4f2ec', '#f2eee6'],
  black: [0, '#2a2a33', '#07060f'], orange: [73, '#eca05a', '#46301e'], sky: [71, '#8cb6d8', '#22304a'], navy: [52, '#263254', '#141c38'],
  lilac: [74, '#b8a4d8', '#2e2a48'], pink: [70, '#e8a2ac', '#3e2c3a'], grey: [62, '#d6dde8', '#5a6488'], green: [50, '#4a7a52', '#1e3e38'],
} as const;
export type Colour = keyof typeof COLOURS;
/** Team shirts (never green: it would vanish into the turf) and the shorts that go with each. */
export const TEAM_SHIRTS: Colour[] = ['red', 'blue', 'yellow', 'white', 'black', 'orange', 'sky', 'navy', 'lilac', 'pink'];
const SHORTS: Partial<Record<Colour, Colour>> = { red: 'white', blue: 'white', yellow: 'navy', white: 'black', black: 'black', orange: 'black', sky: 'white', navy: 'white', lilac: 'navy', pink: 'black' };
/** Preferred keeper and referee shirts; any other colour is used when none of these is distinct enough. */
const KEEPER_SHIRTS: Colour[] = ['green', 'grey', 'orange', 'yellow', 'pink', 'lilac', 'sky', 'black'];
const REF_SHIRTS: Colour[] = ['black', 'navy', 'grey', 'pink', 'green'];
/** Minimum RGB distance between the two team shirts, in the day and in the night palette. */
export const MIN_DAY = 140, MIN_NIGHT = 55;
/** Minimum day-palette distance between a keeper's or the referee's shirt and any team shirt. */
export const MIN_DISTINCT = 70;

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a: string, b: string) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export const dayDist = (a: Colour, b: Colour) => dist(COLOURS[a][1], COLOURS[b][1]);
export const nightDist = (a: Colour, b: Colour) => dist(COLOURS[a][2], COLOURS[b][2]);
/** The palette index to draw a colour with. */
export const paletteIndex = (c: Colour): number => COLOURS[c][0];
export const contrasting = (a: Colour, b: Colour) => dayDist(a, b) >= MIN_DAY && nightDist(a, b) >= MIN_NIGHT;

export interface Kit { shirt: Colour; shorts: Colour }
export interface Kits { teams: [Kit, Kit]; keepers: [Colour, Colour]; ref: Colour }

/** mulberry32, copied so this module has no imports. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Day { year: number; month: number; day: number }
/** A stable integer key for a local calendar date (month is 0-based, as in `Cal`). */
export const dayKey = (d: Day) => d.year * 10000 + (d.month + 1) * 100 + d.day;
export const slotSeed = (d: Day, slot: number) => (Math.imul(dayKey(d) * 16 + slot, 0x9e3779b1) ^ 0xf007ba11) >>> 0;

/** All high-contrast shirt pairs (unordered), in a fixed order. */
const PAIRS: [Colour, Colour][] = [];
for (let i = 0; i < TEAM_SHIRTS.length; i++) for (let j = i + 1; j < TEAM_SHIRTS.length; j++)
  if (contrasting(TEAM_SHIRTS[i], TEAM_SHIRTS[j])) PAIRS.push([TEAM_SHIRTS[i], TEAM_SHIRTS[j]]);

/** A colour from the pool far from the team shirts (always) and, if possible, from the other picks too. */
function pick(pool: Colour[], teams: Colour[], others: Colour[], r: () => number): Colour {
  const far = (c: Colour, list: Colour[]) => list.every((a) => a !== c && dayDist(a, c) >= MIN_DISTINCT);
  for (const p of [pool, Object.keys(COLOURS) as Colour[]]) {
    const fromTeams = p.filter((c) => far(c, teams) && !others.includes(c)), best = fromTeams.filter((c) => far(c, others));
    const list = best.length ? best : fromTeams;
    if (list.length) return list[Math.floor(r() * list.length)];
  }
  throw new Error('no distinct colour'); // unreachable: green is far from every team shirt (tested)
}

/** The kits of every slot of a local date. Slot i never shares a shirt colour with slot i-1, and no
    pairing repeats within the day. */
export function kitsForDay(d: Day): Kits[] {
  const out: Kits[] = [];
  for (let s = 0; s < SLOT_STARTS.length; s++) {
    const r = rng(slotSeed(d, s)), prev = out[s - 1]?.teams.map((t) => t.shirt) ?? [];
    const played = (x: Colour, y: Colour) => out.some((k) => k.teams.some((t) => t.shirt === x) && k.teams.some((t) => t.shirt === y));
    const next = PAIRS.filter(([a, b]) => !prev.includes(a) && !prev.includes(b));
    const unseen = next.filter(([a, b]) => !played(a, b));
    const fresh = unseen.length ? unseen : next; // in practice always unseen (tested): a new pairing all day
    const pair = fresh[Math.floor(r() * fresh.length)];
    const [a, b] = r() < 0.5 ? pair : [pair[1], pair[0]];
    const gk0 = pick(KEEPER_SHIRTS, [a, b], [], r), gk1 = pick(KEEPER_SHIRTS, [a, b], [gk0], r);
    const ref = pick(REF_SHIRTS, [a, b], [gk0, gk1], r);
    out.push({ teams: [{ shirt: a, shorts: SHORTS[a]! }, { shirt: b, shorts: SHORTS[b]! }], keepers: [gk0, gk1], ref });
  }
  return out;
}

export interface Wx { rain: number; storm: number }
/** Heavy rain or a storm (from the real reading) pauses play; lighter rain plays on. */
export const rainPause = (wx: Wx) => wx.rain > 0.4 || wx.storm > 0.2;

export interface MatchInfo { slot: number; start: number; end: number; key: number; seed: number; kits: Kits; paused: boolean; night: boolean }
const cache: { key: number; kits: Kits[] } = { key: -1, kits: [] };
/** The match in progress at a local date and hour, or null when the pitch is empty. */
export function matchAt(d: Day, hour: number, wx: Wx): MatchInfo | null {
  const slot = slotAt(hour);
  if (slot < 0) return null;
  const key = dayKey(d);
  if (key !== cache.key) { cache.key = key; cache.kits = kitsForDay(d); } // the scene asks every frame
  return { slot, ...slotWindow(slot), key: key * 16 + slot, seed: slotSeed(d, slot), kits: cache.kits[slot], paused: rainPause(wx), night: slot >= NIGHT_SLOT0 };
}

// ---------- the game ----------

/** The playing area in world pixels: x along the pitch (goal lines x0, x1), y across it (touchlines). */
export interface Pitch { x0: number; x1: number; y0: number; y1: number; mouth0: number; mouth1: number }
export type PRole = 'out' | 'gk' | 'ref';
export interface SimPlayer { x: number; y: number; hx: number; hy: number; team: 0 | 1; role: PRole; ph: number; jump: number; cd: number }
export type Phase = 'kickoff' | 'play' | 'restart' | 'goal' | 'paused';

/** Formation for the five outfield players: [fraction of the length from the own goal, fraction of the width]. */
const FORM = [[0.16, 0.25], [0.16, 0.75], [0.36, 0.15], [0.36, 0.85], [0.56, 0.5]];
export const PER_SIDE = 6, CROSSBAR = 9, NET = 3, CELEBRATE = 3.5, KICKOFF = 2;
const STEP = 1 / 30;

export class MatchSim {
  players: SimPlayer[] = [];
  ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  score: [number, number] = [0, 0];
  goals = 0;
  phase: Phase = 'kickoff';
  /** The player on the ball (dribbling), -1 when loose; who takes the restart; who the pass is meant for. */
  owner = -1; taker = -1; receiver = -1; scorer = -1;
  lastTeam: 0 | 1 = 0;
  timer = KICKOFF;
  private t = 0; private decide = 0; private shot = false; private saveTried = false; private kickTeam: 0 | 1;
  private r: () => number;
  readonly P: Pitch; readonly cx: number; readonly cy: number;

  constructor(P: Pitch, seed: number) {
    this.P = P;
    this.r = rng(seed ^ 0x5eed);
    this.cx = (P.x0 + P.x1) / 2; this.cy = (P.y0 + P.y1) / 2;
    const L = P.x1 - P.x0, W = P.y1 - P.y0;
    for (const team of [0, 1] as const) {
      const own = team === 0 ? P.x0 : P.x1, dir = team === 0 ? 1 : -1;
      this.add(own + dir * 3, this.cy, team, 'gk');
      for (const [a, b] of FORM) this.add(own + dir * a * L, P.y0 + 1 + b * (W - 2), team, 'out');
    }
    this.add(this.cx, P.y1 - 1, 0, 'ref');
    this.kickTeam = this.r() < 0.5 ? 0 : 1;
    this.setKickoff(this.kickTeam, true);
  }

  private add(hx: number, hy: number, team: 0 | 1, role: PRole) {
    this.players.push({ x: hx, y: hy, hx, hy, team, role, ph: this.r() * 6, jump: 0, cd: 0 });
  }
  private dir = (team: number) => (team === 0 ? 1 : -1);
  private goalX = (team: number) => (team === 0 ? this.P.x1 : this.P.x0); // the goal a team attacks
  private ownX = (team: number) => (team === 0 ? this.P.x0 : this.P.x1);

  /** Players line up in their own half, ball on the spot, the conceding side kicks off. */
  private setKickoff(team: 0 | 1, snap = false) {
    const b = this.ball;
    b.x = this.cx; b.y = this.cy; b.z = b.vx = b.vy = b.vz = 0;
    this.phase = 'kickoff'; this.timer = KICKOFF; this.owner = -1; this.receiver = -1; this.scorer = -1; this.kickTeam = team; this.shot = false;
    this.taker = this.players.findIndex((p, i) => p.team === team && p.role === 'out' && i % PER_SIDE === 5);
    if (snap) for (const [i, p] of this.players.entries()) { const s = this.kickoffSpot(i); p.x = s.x; p.y = s.y; }
  }
  private kickoffSpot(i: number) {
    const p = this.players[i];
    if (p.role === 'ref') return { x: this.cx, y: this.P.y1 - 1 };
    if (i === this.taker) return { x: this.cx - this.dir(p.team) * 2, y: this.cy };
    const half = p.team === 0 ? Math.min(p.hx, this.cx - 12) : Math.max(p.hx, this.cx + 12);
    return { x: half, y: p.hy };
  }

  /** Advance the game; `paused` comes from the real weather (rainPause), `wet` slows the ball. */
  step(dt: number, paused = false, wet = 0) {
    let left = Math.min(dt, 1);
    while (left > 1e-6) { const h = Math.min(left, STEP); this.tick(h, paused, wet); left -= h; }
  }

  private tick(h: number, paused: boolean, wet: number) {
    this.t += h;
    for (const p of this.players) { p.cd = Math.max(0, p.cd - h); p.jump = 0; }
    if (paused) {
      if (this.phase !== 'paused') { this.phase = 'paused'; this.owner = -1; }
      // waiting out the rain along the far touchline, each side by its own half
      this.players.forEach((p, i) => {
        const k = i % PER_SIDE, x = p.role === 'ref' ? this.cx : this.cx - this.dir(p.team) * (14 + k * 6);
        this.move(p, x, this.P.y0, 26, h);
      });
      this.rollBall(h, wet);
      return;
    }
    if (this.phase === 'paused') this.setKickoff(this.kickTeam);
    if (this.phase === 'goal') return this.celebrate(h);
    if (this.phase === 'kickoff') {
      this.timer -= h;
      this.players.forEach((p, i) => { const s = this.kickoffSpot(i); this.move(p, s.x, s.y, 40, h); });
      const k = this.players[this.taker];
      if (this.timer <= 0 && Math.hypot(k.x - this.ball.x, k.y - this.ball.y) < 3) { this.phase = 'play'; this.gain(this.taker); this.pass(this.taker); }
      return;
    }
    if (this.phase === 'restart') {
      const k = this.players[this.taker];
      this.move(k, this.ball.x - this.dir(k.team) * 1.5, this.ball.y, 40, h);
      this.shape(h, k);
      if (Math.hypot(k.x - this.ball.x, k.y - this.ball.y) < 2.5) { this.phase = 'play'; this.gain(this.taker); this.decide = 0.3 + this.r() * 0.4; }
      return;
    }
    this.play(h, wet);
  }

  private celebrate(h: number) {
    this.timer -= h;
    const s = this.players[this.scorer];
    this.players.forEach((p, i) => {
      if (p.role === 'ref') return this.move(p, this.cx, this.P.y1 - 1, 20, h);
      if (p.team === this.lastTeam && p.role === 'out') {
        if (i !== this.scorer) this.move(p, s.x - this.dir(p.team) * (2 + (i % PER_SIDE) * 2), s.y + ((i % 3) - 1) * 2, 34, h);
        p.jump = Math.abs(Math.sin(this.t * 9 + p.ph)) * 2;
      } else this.move(p, p.hx, p.hy, 14, h);
    });
    if (this.timer <= 0) this.setKickoff(this.lastTeam === 0 ? 1 : 0);
  }

  private gain(i: number) {
    this.owner = i; this.receiver = -1; this.shot = false; this.saveTried = false;
    this.lastTeam = this.players[i].team; this.decide = 0.4 + this.r() * 0.8;
    const b = this.ball; b.vx = b.vy = b.vz = 0; b.z = 0;
  }

  private release(i: number, tx: number, ty: number, sp: number, vz: number) {
    const p = this.players[i], b = this.ball, dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
    b.vx = (dx / d) * sp; b.vy = (dy / d) * sp; b.vz = vz;
    this.owner = -1; p.cd = 0.45; this.lastTeam = p.team;
  }

  /** Pass to a teammate, preferring one further forward and not too far; keepers boot it upfield. */
  pass(i: number) {
    const p = this.players[i], dir = this.dir(p.team);
    let best = -1, bestS = -Infinity;
    this.players.forEach((q, j) => {
      if (j === i || q.team !== p.team || q.role !== 'out') return;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      const s = (q.x - p.x) * dir * 0.6 - Math.abs(d - 60) * 0.4 + this.r() * 30;
      if (d > 8 && s > bestS) { bestS = s; best = j; }
    });
    if (best < 0) return this.shoot(i);
    const q = this.players[best], d = Math.hypot(q.x - p.x, q.y - p.y);
    const lead = dir * 6, sp = Math.min(150, Math.max(70, d * 1.5)), loft = d > 110 || p.role === 'gk' ? 28 + this.r() * 12 : 3;
    this.release(i, q.x + lead, this.clampY(q.y), sp, loft);
    this.receiver = best; this.shot = false;
  }

  /** Shoot at the mouth, not always on target; some fly over the bar. */
  shoot(i: number) {
    const P = this.P, p = this.players[i];
    const ty = P.mouth0 + this.r() * (P.mouth1 - P.mouth0) + (this.r() - 0.5) * 6;
    this.release(i, this.goalX(p.team), ty, 135 + this.r() * 40, 8 + this.r() * 30);
    this.receiver = -1; this.shot = true; this.saveTried = false;
  }

  private clampY = (y: number) => Math.min(this.P.y1 - 1, Math.max(this.P.y0 + 1, y));

  private rollBall(h: number, wet: number) {
    const b = this.ball, drag = 0.9 + wet * 1.1;
    b.x += b.vx * h; b.y += b.vy * h; b.vx *= Math.exp(-drag * h); b.vy *= Math.exp(-drag * h);
    b.vz -= 160 * h; b.z += b.vz * h;
    if (b.z < 0) { b.z = 0; b.vz = -b.vz * 0.45; if (Math.abs(b.vz) < 8) b.vz = 0; }
    if (this.phase === 'paused') { b.x = Math.min(this.P.x1 - 4, Math.max(this.P.x0 + 4, b.x)); b.y = this.clampY(b.y); }
  }

  private play(h: number, wet: number) {
    const P = this.P, b = this.ball, pl = this.players;
    if (this.owner >= 0) {
      // dribbling: the ball runs just ahead of the carrier towards the goal, weaving across the pitch
      const p = pl[this.owner], dir = this.dir(p.team), gx = this.goalX(p.team);
      const near = Math.abs(gx - p.x) < 110;
      const ty = near ? (P.mouth0 + P.mouth1) / 2 + Math.sin(this.t * 1.3 + p.ph) * 3 : this.cy + Math.sin(this.t * 0.8 + p.ph) * (P.y1 - P.y0) * 0.35;
      this.move(p, gx - dir * 6, ty, p.role === 'gk' ? 0 : 33, h);
      b.x = p.x + dir * 2.5; b.y = p.y; b.z = 0;
      this.decide -= h;
      if (this.decide <= 0) {
        const dg = Math.abs(gx - p.x);
        if (p.role !== 'gk' && dg < 120 && this.r() < 0.55) this.shoot(this.owner);
        else if (p.role === 'gk' || this.r() < 0.5) this.pass(this.owner);
        else this.decide = 0.5 + this.r() * 0.8;
      }
      // a defender close enough can win it: the ball squirts loose
      const pi = this.owner >= 0 ? this.nearest(p.team === 0 ? 1 : 0, b.x, b.y) : -1;
      if (pi >= 0) {
        const q = pl[pi];
        if (q.cd <= 0 && Math.hypot(q.x - b.x, q.y - b.y) < 3.5 && this.r() < 0.8 * h) {
          p.cd = 0.8; this.owner = -1; this.lastTeam = q.team;
          b.vx = (this.r() - 0.5) * 60 + this.dir(q.team) * 25; b.vy = (this.r() - 0.5) * 40; b.vz = 6;
          q.cd = 0.25;
        }
      }
    } else {
      this.rollBall(h, wet);
      if (this.checkOut()) return;
      // keepers try once per shot to stop it
      if (this.shot && !this.saveTried) for (const q of pl) {
        if (q.role !== 'gk' || q.team === this.lastTeam) continue;
        if (Math.abs(q.x - b.x) < 4 && Math.abs(q.y - b.y) < 4 && b.z < CROSSBAR + 2) {
          this.saveTried = true;
          if (this.r() < 0.6) { b.vx = -b.vx * 0.3; b.vy = (this.r() - 0.5) * 70; b.vz = 18; this.shot = false; this.lastTeam = q.team; q.cd = 0.5; }
        }
      }
      // the first player to reach a low ball takes it
      if (b.z < 4) {
        let best = -1, bd = 3;
        pl.forEach((q, j) => { if (q.role === 'ref' || q.cd > 0 || (this.shot && q.role === 'gk')) return; const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < bd) { bd = d; best = j; } });
        if (best >= 0) this.gain(best);
      }
    }
    this.shape(h, null);
  }

  /** Goal, goal kick or throw-in. Returns true when play stopped. */
  private checkOut(): boolean {
    const P = this.P, b = this.ball;
    if (b.x < P.x0 || b.x > P.x1) {
      const side = b.x > P.x1 ? 1 : 0, scorerTeam = (side === 1 ? 0 : 1) as 0 | 1;
      if (b.y > P.mouth0 && b.y < P.mouth1 && b.z < CROSSBAR) {
        this.score[scorerTeam]++; this.goals++; this.lastTeam = scorerTeam;
        this.scorer = this.nearest(scorerTeam, b.x, b.y);
        b.x = side ? P.x1 + NET : P.x0 - NET; b.vx = b.vy = b.vz = 0; b.z = 0;
        this.phase = 'goal'; this.timer = CELEBRATE; this.owner = -1;
        return true;
      }
      // wide or over: goal kick from the keeper of that end
      const keeperTeam = side === 1 ? 1 : 0;
      b.x = side ? P.x1 - 5 : P.x0 + 5; b.y = (P.mouth0 + P.mouth1) / 2; b.vx = b.vy = b.vz = 0; b.z = 0;
      this.restart(this.players.findIndex((p) => p.team === keeperTeam && p.role === 'gk'));
      return true;
    }
    if (b.y < P.y0 || b.y > P.y1) {
      b.y = this.clampY(b.y); b.vx = b.vy = b.vz = 0; b.z = 0;
      b.x = Math.min(P.x1 - 8, Math.max(P.x0 + 8, b.x));
      this.restart(this.nearest(this.lastTeam === 0 ? 1 : 0, b.x, b.y));
      return true;
    }
    return false;
  }
  private restart(i: number) { this.phase = 'restart'; this.taker = i; this.owner = -1; this.receiver = -1; this.shot = false; }

  private nearest(team: number, x: number, y: number) {
    let best = -1, bd = Infinity;
    this.players.forEach((q, j) => { if (q.team !== team || q.role !== 'out') return; const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = j; } });
    return best;
  }

  /** Everyone else: keepers on their line, the nearest of each side goes for the ball, the rest keep shape. */
  private shape(h: number, skip: SimPlayer | null) {
    const P = this.P, b = this.ball, pl = this.players;
    const has = this.owner >= 0 ? pl[this.owner].team : -1;
    const chase = [0, 1].map((team) => (this.receiver >= 0 && pl[this.receiver].team === team ? this.receiver : this.nearest(team, b.x, b.y)));
    pl.forEach((p, i) => {
      if (p === skip || i === this.owner) return;
      if (p.role === 'ref') return this.move(p, Math.min(P.x1 - 20, Math.max(P.x0 + 20, b.x - 22)), P.y1 - 1, 28, h);
      const dir = this.dir(p.team);
      if (p.role === 'gk') {
        const danger = Math.abs(b.x - this.ownX(p.team)) < 70;
        return this.move(p, this.ownX(p.team) + dir * (danger ? 5 : 3), Math.min(P.mouth1 + 1, Math.max(P.mouth0 - 1, b.y)), 26, h);
      }
      if (this.phase === 'play' && i === chase[p.team] && has !== p.team) return this.move(p, b.x, b.y, has >= 0 ? 30 : 38, h);
      const push = has === p.team ? 30 : has >= 0 ? -14 : 0, follow = has === p.team ? 0.6 : 0.4;
      const tx = p.hx + (b.x - this.cx) * follow + dir * push + Math.sin(this.t * 0.5 + p.ph) * 5;
      const ty = p.hy + (b.y - p.hy) * 0.3 + Math.cos(this.t * 0.4 + p.ph) * 1.5;
      this.move(p, tx, ty, 26, h);
    });
  }

  /** Walk or run towards a target, never off the turf. */
  private move(p: SimPlayer, tx: number, ty: number, sp: number, h: number) {
    const P = this.P;
    tx = Math.min(P.x1 - 1, Math.max(P.x0 + 1, tx)); ty = Math.min(P.y1, Math.max(P.y0, ty));
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > 0.8 && sp > 0) { const k = Math.min(1, (sp * h) / d); p.x += dx * k; p.y += dy * k; p.ph += d * k * 0.45; }
    p.x = Math.min(P.x1 - 1, Math.max(P.x0 + 1, p.x)); p.y = Math.min(P.y1, Math.max(P.y0, p.y));
  }
}
