// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
// The scene modules draw into the framebuffer and read the URL, so they cannot be imported here
// without a DOM; these checks read the sources instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { density } from '../src/sky/rhythm.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const index = read('src/scenes/index.ts');

/** import name -> module file, from index.ts */
const files = new Map([...index.matchAll(/import \{ (\w+) \} from '\.\/([\w-]+)';/g)].map((m) => [m[1], m[2]]));
/** city -> scene identifiers, from the SCENES table */
const table = new Map([...index.matchAll(/^\s+(\w+): \[([^\]]*)\],$/gm)].map((m) => [m[1], m[2].split(',').map((s) => s.trim()).filter(Boolean)]));
const sceneId = (name: string) => {
  const src = read(`src/scenes/${files.get(name)}.ts`);
  const m = /export const (\w+): Scene = \{\s*id: '([\w-]+)'/.exec(src);
  assert.ok(m && m[1] === name, `${name} declares its id`);
  return m![2];
};
const NEW = ['centro-teatro', 'armazem-paraiba', 'rua-faustino', 'rua-jose-bezerra'];

test('every scene id in SCENES is unique', () => {
  const ids = [...table.values()].flat().map(sceneId);
  assert.ok(ids.length >= 23);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
});

test('Esperança has the four new scenes after the existing five', () => {
  const ids = table.get('esperanca')!.map(sceneId);
  assert.deepEqual(ids.slice(0, 5), ['praca-matriz', 'rua-comercio', 'capelinha', 'praca-cultura', 'campo-rodoviaria']);
  for (const id of NEW) assert.ok(ids.includes(id), `${id} registered`);
  assert.equal(ids.length, 9);
});

test('the developer guide lists each new #scene id', () => {
  const readme = read('docs/DEVELOPING.md'), line = readme.split('\n').find((l) => l.startsWith('- `#scene='))!;
  for (const id of NEW) assert.ok(line.includes(`\`${id}\``), `${id} in the #scene list`);
});

test('the new scenes follow the town rhythm, not the praças peak', () => {
  for (const id of NEW) {
    const at = Date.parse('2026-11-09T14:30-03:00');
    assert.deepEqual(density('esperanca', id, at), density('esperanca', 'rua-comercio', at));
    assert.ok(density('esperanca', id, Date.parse('2026-11-09T22:00-03:00')).people < 0.1, 'nearly empty at night');
  }
});

test('only scenes whose photo shows a zebra wire up a crossing', () => {
  const src = (id: string) => read(`src/scenes/${id}.ts`);
  assert.match(src('centro-teatro'), /setBrCrossing\(\{/);
  assert.match(src('rua-faustino'), /crossing: \{ z0: ZEB\.z0/);
  assert.doesNotMatch(src('armazem-paraiba'), /setBrCrossing|crossing:/);
  assert.match(src('rua-jose-bezerra'), /crossing: null/);
  assert.doesNotMatch(src('rua-jose-bezerra'), /yieldLimit|setBrCrossing/);
  // no random weather anywhere in the new scenes
  for (const id of NEW) assert.doesNotMatch(src(id), /S\.(rain|snow|storm|cloud|fog|temp)\s*=[^=]/);
});

const CAMPINA_NEW = ['piramide-parque-do-povo', 'estacao-velha', 'parque-da-crianca', 'partage-shopping', 'terminal-integracao'];

test('Campina Grande has Açude Velho first, then the five new scenes', () => {
  assert.deepEqual(table.get('campina')!.map(sceneId), ['acude-velho', ...CAMPINA_NEW]);
});

test('the developer guide lists each new Campina #scene id', () => {
  const line = read('docs/DEVELOPING.md').split('\n').find((l) => l.startsWith('- `#scene='))!;
  for (const id of CAMPINA_NEW) assert.ok(line.includes(`\`${id}\``), `${id} in the #scene list`);
});

test('the new Campina scenes follow the city rhythm and never set the weather', () => {
  for (const id of CAMPINA_NEW) {
    const at = Date.parse('2026-11-09T14:30-03:00');
    assert.deepEqual(density('campina', id, at), density('campina', 'acude-velho', at));
    assert.doesNotMatch(read(`src/scenes/${id}.ts`), /S\.(rain|snow|storm|cloud|fog|temp|wind)\s*=[^=]/);
  }
});

test('Remígio has the lagoon first, then the cinema and its street front, listed in the developer guide', () => {
  assert.deepEqual(table.get('remigio')!.map(sceneId), ['lagoa-remigio', 'cinema-remigio', 'cinema-fachada-remigio']);
  const line = read('docs/DEVELOPING.md').split('\n').find((l) => l.startsWith('- `#scene='))!;
  for (const id of ['cinema-remigio', 'cinema-fachada-remigio']) assert.ok(line.includes(`\`${id}\``), `${id} in the #scene list`);
});

test('the cinema front never sets the weather and shares the room schedule; the doors point at each other', () => {
  const front = read('src/scenes/cinema-fachada-remigio.ts'), room = read('src/scenes/cinema-remigio.ts');
  assert.doesNotMatch(front, /S\.(rain|snow|storm|cloud|fog|temp|wind|wet)\s*=[^=]/);
  assert.doesNotMatch(front, /Math\.random\(/);
  assert.match(front, /from '\.\/cinema-rules'/, 'board, queue and door come from the shared schedule');
  assert.doesNotMatch(front, /\b(16\.5|21\.5|BLOCK_MIN)\b/, 'no session times copied into the scene');
  assert.match(front, /goto: 'cinema-remigio'/);
  assert.match(room, /goto: 'cinema-fachada-remigio'/);
  // the zebra is in the photo, so the crossing is wired; the road stays two-way (direction unknown)
  assert.match(front, /setBrCrossing\(\{/);
  assert.doesNotMatch(front, /setBrOneWay|setBrSignal/);
  const at = Date.parse('2026-11-09T14:30-03:00');
  assert.deepEqual(density('remigio', 'cinema-fachada-remigio', at), density('remigio', 'lagoa-remigio', at));
});

test('main.ts handles a door: same scene change as the scene button, by id within the city', () => {
  const main = read('src/main.ts');
  assert.match(main, /prop\?\.goto \? sceneById\(city\.id, prop\.goto\)/);
  assert.match(main, /scene: \(\) => enterScene\(nextScene\(city\.id, scene\)\)/);
  assert.match(main, /function enterScene\(next: Scene\) \{\s*clearBubbles\(\); clearPeople\(\);[^\n]*syncHash\(\);/);
});

test('the cinema is indoors: it never touches the weather and takes no Math.random', () => {
  const src = read('src/scenes/cinema-remigio.ts');
  assert.doesNotMatch(src, /S\.(rain|snow|storm|cloud|fog|temp|wind|wet)\s*=[^=]/);
  assert.doesNotMatch(src, /Math\.random\(/);
  assert.doesNotMatch(read('src/scenes/cinema-rules.ts'), /Math\.random\(|from '\.\.\/engine|document\.|window\./);
  assert.match(src, /grade\(\)/, 'lights itself (grade hook)');
});
