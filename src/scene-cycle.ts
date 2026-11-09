/* Pure rules for the automatic scene change (every 2 minutes). No DOM, no imports, no TS-only runtime
   syntax: `node --test` runs it by stripping the types. main.ts feeds it the elapsed time and the UI state. */

/** The scene advances on its own this often. */
export const CYCLE_MS = 120_000;

/** Scenes you are "inside" of (the bus ride, the cinema rooms, the mall): the cycle never pulls you out of them. */
export const HOLD_SCENES: readonly string[] = ['onibus', 'cinema-remigio', 'partage-interior', 'partage-alimentacao', 'cinema-partage'];

export interface CycleState {
  /** The auto-change toggle (off by default when the page was opened with #scene=, or with #cycle=off). */
  enabled: boolean;
  /** Milliseconds since the last scene change, manual or automatic, or since the city changed. */
  elapsedMs: number;
  /** Current scene id. */
  sceneId: string;
  /** A modal is open (the city map) or the share menu is. */
  dialogOpen: boolean;
}

/** Whether it is time to move on to the next scene. */
export function shouldAdvance(s: CycleState): boolean {
  if (!s.enabled || s.dialogOpen) return false;
  if (HOLD_SCENES.includes(s.sceneId)) return false;
  return s.elapsedMs >= CYCLE_MS;
}

/** Index of the scene to move to: the one after `from`, skipping the scenes you are only ever inside of
    (the bus, the cinema room, the mall's inside, which you enter yourself). Returns `from` when nothing else qualifies. */
export function nextCycleIndex(ids: readonly string[], from: number): number {
  for (let i = 1; i <= ids.length; i++) {
    const j = (from + i) % ids.length;
    if (!HOLD_SCENES.includes(ids[j])) return j;
  }
  return from;
}

/** Whether the cycle starts on: not when a scene is pinned in the URL (#scene=) or #cycle=off asks for it. */
export function cycleDefault(hash: string): boolean {
  const h = hash.replace(/^#/, '');
  if (/(^|&)scene=/.test(h)) return false;
  return !/(^|&)cycle=off(&|$)/.test(h);
}
