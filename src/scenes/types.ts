import type { Sfx } from '../audio/sfx';
import type { Role } from '../actors/phrases';
import type { BusSkin } from './onibus-rules';

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
  /** Optional: the world x the camera centres on when the frame is narrower than the world (portrait),
      or null for the default centred view; read every frame, so it may follow what is happening. */
  focusX?(): number | null;
  /** Optional, for indoor scenes that light themselves: called after the global palette grade and
      may overwrite PAL32 (the sun and the sky do not reach an interior). Post-processing then
      treats the frame as night (bloom on lit pixels). */
  grade?(): void;
  /** With grade(): the scene still shows the real sky (e.g. through bus windows), so post-processing keeps
      the daylight bloom instead of treating the frame as night. */
  seesSky?: boolean;
  /** Optional: a tappable prop or person at world (x, y) — where to show the emote and what to play,
      or, for a person, who speaks (a silent speech bubble instead of a sound). */
  tap?(x: number, y: number): TapResult | null;
  /** Optional: where a door that works right now is (hint kind 'door') or a boardable bus (kind 'bus'),
      for the little first-seconds "tap here" animation (src/fx/hints.ts); doors that are shut are left out. */
  hintSpots?(): { x: number; y: number; kind: 'door' | 'bus' }[];
  /** Optional: a short pt-BR hint bubble shown when this scene is reached through another scene's
      door (a tap result's `goto`), e.g. how to get back out. */
  hint?(): { x: number; y: number; text: string } | null;
}

export interface TapResult {
  x: number; y: number; sfx?: Sfx; speaker?: Speaker;
  /** A fixed pt-BR line shown in a bubble at (x, y) (e.g. "Fechado, volta às 14h"). */
  say?: string;
  /** Walk through a door: switch to this scene id of the same city, at the same moment. */
  goto?: string;
  /** Board this bus (the bus interior scene, src/scenes/onibus.ts). */
  board?: BusSkin;
}
