/* Old scene ids that shared links may still carry, mapped to the current ids (used by pickScene and
   sceneById in ./index.ts). Pure: no DOM, no imports, unit-tested in test/scenes.test.ts. */

/** old id -> current id */
export const SCENE_ALIASES: Readonly<Record<string, string>> = {
  'cinema-fachada-remigio': 'cinema-facade-remigio',
};

/** The current id for a scene id from a link (an unknown or current id comes back unchanged). */
export const resolveSceneId = (id: string): string => (Object.hasOwn(SCENE_ALIASES, id) ? SCENE_ALIASES[id] : id);
