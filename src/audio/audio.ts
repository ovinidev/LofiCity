/* Generative ambience with Web Audio only; starts on a user gesture.
   Layers: rain hiss + body, vinyl crackle, slow lo-fi pad, wind, summer cicadas,
   autumn crickets, thunder rumble, firework booms and Esperança's church bells.
   While a radio station is on, the pad goes silent (its chords clashed with the music's key)
   and the rest of the ambience steps back so the music leads. */
import { S } from '../sky/state';
import { radio } from './radio';
import { inDoy, doyOf } from '../sky/time';
import { STRIKE_GAP, strike } from './bell-synth';

type G = GainNode;
const A: {
  ctx: AudioContext | null; on: boolean; master?: G; rain?: G; body?: G; rumble?: G; wind?: G; windF?: BiquadFilterNode;
  cicada?: G; cricket?: G; pad?: BiquadFilterNode; padGain?: G; noise?: AudioBuffer; next: number; ci: number;
} = { ctx: null, on: false, next: 0, ci: 0 };
/** Ambience level on its own, and while the radio plays. */
const LEVEL = 0.35, UNDER_RADIO = 0.2;
const level = () => (radio.isOn() ? UNDER_RADIO : LEVEL);

const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]];

function toggle(): boolean {
  if (A.ctx) {
    A.on = !A.on;
    if (A.on) void A.ctx.resume(); else cancelPeal();
    A.master!.gain.setTargetAtTime(A.on ? level() : 0, A.ctx.currentTime, 0.4);
    return A.on;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  const ac = new AC(); A.ctx = ac; A.on = true;
  const master = ac.createGain(); master.gain.value = 0; master.gain.setTargetAtTime(level(), ac.currentTime, 1.2); master.connect(ac.destination); A.master = master;
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  A.noise = nb;
  const mk = (type: BiquadFilterType, f: number, q?: number) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const src = (rate = 1) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
  const gain = (v = 0) => { const g = ac.createGain(); g.gain.value = v; return g; };

  A.rain = gain(); src().connect(mk('highpass', 400)).connect(mk('lowpass', 5200)).connect(A.rain).connect(master);
  const blp = mk('lowpass', 360); src(0.7).connect(blp);
  A.body = gain(); A.rumble = gain(); blp.connect(A.body).connect(master); blp.connect(A.rumble).connect(master);
  A.windF = mk('lowpass', 500, 2); A.wind = gain(); src(0.5).connect(A.windF).connect(A.wind).connect(master);

  // vinyl crackle
  const cb = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), cd = cb.getChannelData(0);
  for (let k = 0; k < 90; k++) { const p = (Math.random() * cd.length) | 0; cd[p] = (Math.random() - 0.5) * 1.4; if (p + 1 < cd.length) cd[p + 1] = cd[p] * -0.5; }
  const cr = ac.createBufferSource(); cr.buffer = cb; cr.loop = true; cr.connect(mk('highpass', 1200)).connect(gain(0.06)).connect(master); cr.start();

  // cicadas: band-passed noise, amplitude-modulated at ~28 Hz
  const cam = gain(0.5), clfo = ac.createOscillator(); clfo.frequency.value = 28; const cdepth = gain(0.5);
  clfo.connect(cdepth).connect(cam.gain); clfo.start();
  A.cicada = gain(); src(1.3).connect(mk('bandpass', 5200, 6)).connect(cam).connect(A.cicada).connect(master);

  // crickets: 4.4 kHz tone pulsed fast, chirped slowly
  const tone = ac.createOscillator(); tone.frequency.value = 4400; tone.start();
  const p1 = gain(0.5), l1 = ac.createOscillator(); l1.type = 'square'; l1.frequency.value = 30; l1.connect(gain(0.5)).connect(p1.gain); l1.start();
  const p2 = gain(0.5), l2 = ac.createOscillator(); l2.type = 'square'; l2.frequency.value = 1.4; l2.connect(gain(0.5)).connect(p2.gain); l2.start();
  A.cricket = gain(); tone.connect(p1).connect(p2).connect(A.cricket).connect(master);

  A.pad = mk('lowpass', 1000, 0.5); A.padGain = gain(radio.isOn() ? 0 : 0.55); A.pad.connect(A.padGain).connect(master);
  A.next = ac.currentTime + 0.6; A.ci = 0;
  return true;
}

function playChord(t: number, notes: number[]) {
  const ac = A.ctx!;
  for (const n of notes) {
    const f = 440 * Math.pow(2, (n - 69) / 12);
    for (const det of [-7, 7]) {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02, t + 2.5); g.gain.setValueAtTime(0.02, t + 6); g.gain.linearRampToValueAtTime(0, t + 9.5);
      o.connect(g).connect(A.pad!); o.start(t); o.stop(t + 9.6);
    }
  }
}

function tick() {
  if (!A.ctx || !A.on) return;
  const now = A.ctx.currentTime, doy = S.cal.doy;
  const dryness = 1 - Math.min(1, S.rain * 2);
  A.rain!.gain.setTargetAtTime(0.02 + 0.3 * S.rain, now, 1.5);
  A.body!.gain.setTargetAtTime(0.02 + 0.14 * S.rain, now, 2);
  A.wind!.gain.setTargetAtTime(Math.min(0.3, S.wind * 0.35 + S.snow * 0.06), now, 2);
  A.windF!.frequency.setTargetAtTime(300 + 500 * Math.abs(Math.sin(now * 0.13)) + S.storm * 400, now, 1);
  const br = S.city.br;
  // Esperança: cicadas in the dry, hot months, crickets on every warm night
  const summer = (br ? inDoy(doy, doyOf(9, 1), doyOf(1, 28)) : inDoy(doy, doyOf(6, 10), doyOf(8, 8))) ? 1 : 0;
  const autumn = br ? 1.4 : inDoy(doy, doyOf(7, 20), doyOf(10, 5)) ? 1 : 0;
  A.cicada!.gain.setTargetAtTime(0.035 * summer * S.dayK * dryness, now, 3);
  A.cricket!.gain.setTargetAtTime(0.012 * autumn * (1 - S.dayK) * dryness, now, 3);
  // The radio leads: the pad fades out (chords already sounding included) and the rest ducks.
  // isOn() is true while a track is still loading too, so no chord starts in the gap and clashes.
  const radioOn = radio.isOn();
  A.padGain!.gain.setTargetAtTime(radioOn ? 0 : 0.55, now, radioOn ? 0.6 : 3);
  A.master!.gain.setTargetAtTime(level(), now, 1.5);
  if (now > A.next - 1) { if (!radioOn) playChord(A.next, CHORDS[A.ci % 4]); A.ci++; A.next += 8; }
}

function rumble(delay: number, amt: number, dur: number) {
  if (!A.ctx || !A.on) return;
  const t = A.ctx.currentTime + delay, g = A.rumble!.gain;
  g.cancelScheduledValues(t); g.setTargetAtTime(amt, t, 0.25); g.setTargetAtTime(0, t + dur * 0.4, dur * 0.3);
}

function boom(delay: number) {
  if (!A.ctx || !A.on) return;
  const ac = A.ctx, t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = A.noise!;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  s.connect(f).connect(g).connect(A.master!); s.start(t); s.stop(t + 1.7);
}

// ---------- church bells ----------
let peal: { nodes: AudioScheduledSourceNode[]; bus: G } | null = null;

/** Ring `strikes` strikes of the hour, a tower-clock gap apart. Replaces any peal still sounding. */
function ringHour(strikes: number, near: boolean) {
  if (!A.ctx || !A.on || A.ctx.state !== 'running' || strikes <= 0) return;
  cancelPeal();
  const ac = A.ctx, bus = ac.createGain(), t0 = ac.currentTime + 0.1, nodes: AudioScheduledSourceNode[] = [];
  bus.connect(A.master!);
  for (let i = 0; i < strikes; i++) nodes.push(...strike(ac, bus, t0 + i * STRIKE_GAP, near, A.noise));
  peal = { nodes, bus };
}
/** Stop a peal in progress (sound switched off, city changed, page hidden for good). */
function cancelPeal() {
  if (!peal || !A.ctx) return;
  const { nodes, bus } = peal, t = A.ctx.currentTime;
  peal = null;
  bus.gain.setTargetAtTime(0, t, 0.08);
  for (const n of nodes) { try { n.stop(t + 0.4); } catch { /* already stopped */ } }
  setTimeout(() => bus.disconnect(), 600);
}

// ---------- ambient event cues (actors/ambient.ts) ----------
/** A street vendor's call, very soft and once: the picolé / coco seller's little handbell, or the
    pipoca cart's two-note whistle. Through the ambience master, so it follows the sound toggle; it is
    skipped outright while the radio is on, never layered over the music. */
function vendorCue(kind: 'picole' | 'pipoca' | 'coco') {
  if (!A.ctx || !A.on || A.ctx.state !== 'running' || radio.isOn()) return;
  const ac = A.ctx, t0 = ac.currentTime + 0.05, bus = ac.createGain();
  bus.gain.value = 0.5; bus.connect(A.master!);
  const voice = (f0: number, f1: number, at: number, peak: number, dur: number) => {
    const o = ac.createOscillator(), g = ac.createGain(), t = t0 + at;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur * 0.8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
  };
  if (kind === 'pipoca') { voice(1850, 2350, 0, 0.035, 0.28); voice(2350, 1750, 0.34, 0.035, 0.34); }
  else for (let i = 0; i < 3; i++) for (const [m, a] of [[1, 0.035], [2.76, 0.012], [5.4, 0.006]] as const) voice(1650 * m, 1650 * m, i * 0.16, a, 0.6 - i * 0.1);
  setTimeout(() => bus.disconnect(), 2500);
}

export const audio = {
  toggle, tick, rumble, boom, ringHour, cancelPeal, vendorCue,
  isOn: () => A.on,
  /** The AudioContext exists and is running, i.e. it was unlocked by a user gesture. */
  ready: () => A.ctx?.state === 'running',
};
