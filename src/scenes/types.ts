import type { Sfx } from '../audio/sfx';

export interface Scene {
  id: string;
  /** Name shown in the HUD (pt-BR). */
  name: string;
  build(): void;
  update(dt: number): void;
  render(): void;
  debug(): string;
  /** Optional: a tappable prop at world (x, y) — returns where to show the emote and what to play. */
  tap?(x: number, y: number): { x: number; y: number; sfx: Sfx } | null;
}
