/* Sound effects for things you tap, synthesized with Web Audio (no recordings): a dog's bark,
   a cat's meow, a bird's chirp, horns from a moto's beep to a bus's air horn, a donkey's
   bray, the carro de som's jingle and one strike of the church bell. People are silent: they answer
   a tap with a speech bubble (fx/bubbles.ts). */
import { strike } from './bell-synth';

let ctx: AudioContext | null = null, out: GainNode | null = null, noise: AudioBuffer | null = null;

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  void ctx.resume();
  return ctx;
}

/** One oscillator with a frequency path [time, Hz] and an attack/decay envelope, through an optional filter. */
function tone(type: OscillatorType, path: [number, number][], peak: number, dur: number, filter?: { type: BiquadFilterType; f: number; q?: number }, at = 0) {
  const c = ac(), t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(path[0][1], t);
  for (const [dt, f] of path.slice(1)) o.frequency.linearRampToValueAtTime(f, t + dt);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.01); g.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.15);
  let node: AudioNode = o;
  if (filter) { const f = c.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.f; f.Q.value = filter.q ?? 1; o.connect(f); node = f; }
  node.connect(g).connect(out!); o.start(t); o.stop(t + dur + 0.3);
}
function burst(f: number, q: number, peak: number, dur: number, at = 0) {
  const c = ac(), t = c.currentTime + at, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl).connect(g).connect(out!); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

export type Sfx = 'bark' | 'meow' | 'chirp' | 'moto' | 'car' | 'bus' | 'kombi' | 'bray' | 'som' | 'truck' | 'bell';

const play: Record<Sfx, () => void> = {
  bark: () => { for (const at of [0, 0.22]) { tone('sawtooth', [[0, 520], [0.05, 380], [0.12, 260]], 0.35, 0.13, { type: 'bandpass', f: 900, q: 2 }, at); burst(1400, 1.5, 0.15, 0.08, at); } },
  meow: () => tone('sawtooth', [[0, 520], [0.15, 900], [0.45, 600], [0.6, 450]], 0.18, 0.6, { type: 'bandpass', f: 1400, q: 3 }),
  chirp: () => { for (let i = 0; i < 4; i++) tone('sine', [[0, 3200 + i * 150], [0.05, 4600], [0.08, 3000]], 0.12, 0.09, undefined, i * 0.11); },
  moto: () => { for (const at of [0, 0.18]) tone('square', [[0, 1180]], 0.12, 0.12, { type: 'lowpass', f: 3000 }, at); },
  car: () => { tone('square', [[0, 410]], 0.12, 0.35, { type: 'lowpass', f: 2200 }); tone('square', [[0, 510]], 0.1, 0.35, { type: 'lowpass', f: 2200 }); },
  kombi: () => { for (const at of [0, 0.25]) tone('square', [[0, 330]], 0.13, 0.2, { type: 'lowpass', f: 1600 }, at); },
  bus: () => { tone('sawtooth', [[0, 155], [0.1, 165]], 0.2, 0.9, { type: 'lowpass', f: 900 }); tone('sawtooth', [[0, 196]], 0.16, 0.9, { type: 'lowpass', f: 900 }); },
  truck: () => { tone('sawtooth', [[0, 120]], 0.22, 1.1, { type: 'lowpass', f: 700 }); tone('sawtooth', [[0, 151]], 0.16, 1.1, { type: 'lowpass', f: 700 }); },
  bray: () => {
    // hee-haw: rising squeal then a low rasp, twice
    for (const at of [0, 0.8]) {
      tone('sawtooth', [[0, 700], [0.25, 1000]], 0.16, 0.3, { type: 'bandpass', f: 1300, q: 2 }, at);
      tone('sawtooth', [[0, 260], [0.3, 200]], 0.2, 0.4, { type: 'bandpass', f: 600, q: 1.5 }, at + 0.32);
    }
  },
  som: () => { [523, 659, 784, 1047, 784, 659].forEach((f, i) => tone('square', [[0, f]], 0.08, 0.14, { type: 'lowpass', f: 2500 }, i * 0.13)); },
  // the matriz bell, one strike (tap the church in Praça da Matriz)
  bell: () => { const c = ac(); strike(c, out!, c.currentTime + 0.02, true, noise ?? undefined); },
};

export const sfx = (s: Sfx) => { try { play[s](); } catch { /* audio unavailable */ } };
