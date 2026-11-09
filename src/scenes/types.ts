import type { Sfx } from '../audio/sfx';
import type { Role } from '../actors/phrases';

/** Someone who can say a phrase when tapped (see actors/speech-rules.ts), and how to follow them. */
export interface Speaker { role: Role; track?: () => { x: number; y: number } | null }

export interface Scene {
  id: string;
  /** Name shown in the HUD (pt-BR). */
  name: string;
  build(): void;
  update(dt: number): void;
  render(): void;
  debug(): string;
  /** Optional, for indoor scenes that light themselves: called after the global palette grade and
      may overwrite PAL32 (the sun and the sky do not reach an interior). Post-processing then
      treats the frame as night (bloom on lit pixels). */
  grade?(): void;
  /** Optional: a tappable prop or person at world (x, y) — where to show the emote and what to play,
      or, for a person, who speaks (a silent speech bubble instead of a sound). */
  tap?(x: number, y: number): { x: number; y: number; sfx?: Sfx; speaker?: Speaker } | null;
}
