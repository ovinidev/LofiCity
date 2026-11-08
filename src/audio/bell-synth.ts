/* A church bell synthesized with Web Audio: additive partials at the classic bell ratios
   (hum, prime, minor-third tierce, quint, nominal and upper partials), each decaying at its
   own rate, plus a short filtered clapper knock. No recordings. */

// [ratio to the strike note, level, decay time constant in seconds]
const PARTIALS: [number, number, number][] = [
  [0.5, 0.5, 2.6], [1, 0.75, 1.9], [1.19, 0.4, 1.4], [1.5, 0.22, 1.1], [2, 0.5, 1.0],
  [2.52, 0.18, 0.7], [3.01, 0.14, 0.5], [4.17, 0.08, 0.35],
];
/** Strike note of the matriz bell (Hz); a slightly flat A3. */
export const BELL_HZ = 218;
/** Seconds between strikes of the hour, like a tower clock. */
export const STRIKE_GAP = 2.4;

/** Schedule one strike at `t` into `out`. `near` = full and bright; otherwise farther away (quieter, duller). Returns the oscillators, for cancelling. */
export function strike(ac: BaseAudioContext, out: AudioNode, t: number, near: boolean, noise?: AudioBuffer): AudioScheduledSourceNode[] {
  const nodes: AudioScheduledSourceNode[] = [];
  const bus = ac.createGain(); bus.gain.value = near ? 0.5 : 0.22;
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = near ? 6000 : 1600;
  bus.connect(tone).connect(out);
  for (const [r, lvl, dec] of PARTIALS) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = BELL_HZ * r * (1 + (Math.random() - 0.5) * 0.002);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl * 0.25, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, dec);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dec * 6 + 0.1);
    nodes.push(o);
  }
  if (noise) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.2;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + 0.06);
    nodes.push(s);
  }
  return nodes;
}
