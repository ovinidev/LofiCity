// Place info ("i" button): every Esperança scene has a sourced story; no other city shows the button.
// The scene modules need a DOM, so the scene ids are read from the sources (same approach as scenes.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLACE_INFO, placeInfoFor } from '../src/data/place-info.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const index = read('src/scenes/index.ts');
const files = new Map([...index.matchAll(/import \{ (\w+) \} from '\.\/([\w-]+)';/g)].map((m) => [m[1], m[2]]));
const table = new Map([...index.matchAll(/^\s+(\w+): \[([^\]]*)\],$/gm)].map((m) => [m[1], m[2].split(',').map((s) => s.trim()).filter(Boolean)]));
const sceneId = (name: string) => /id: '([\w-]+)'/.exec(read(`src/scenes/${files.get(name)}.ts`).split(/export const \w+: Scene = \{/)[1])![1];
const ids = (city: string) => table.get(city)!.map(sceneId);

test('every Esperança scene has a place story with at least one real source', () => {
  const esp = ids('esperanca');
  assert.equal(esp.length, 11);
  for (const id of esp) {
    const p = placeInfoFor('esperanca', id);
    assert.ok(p, `${id} has an entry`);
    assert.ok(p.title.trim(), `${id} title`);
    assert.ok(p.paragraphs.length >= 2 && p.paragraphs.length <= 3, `${id}: 2-3 paragraphs`);
    assert.ok(p.curiosities.length <= 4, `${id}: at most 4 curiosities`);
    assert.ok(p.sources.length >= 1, `${id}: at least one source`);
    for (const s of p.sources) {
      assert.match(s.url, /^https?:\/\/[\w.-]+\.\w+\//, `${id}: ${s.url} is a link`);
      assert.ok(s.label.trim(), `${id}: source label`);
    }
  }
  assert.deepEqual(Object.keys(PLACE_INFO).sort(), [...esp].sort(), 'no entries for scenes that do not exist');
});

test('the thin-source places say so instead of inventing a history', () => {
  for (const id of ['rua-faustino', 'rua-jose-bezerra', 'centro-teatro', 'avenida-campo']) {
    const p = PLACE_INFO[id];
    assert.equal(p.thin, true, `${id} marked thin`);
    assert.ok(p.paragraphs.some((t) => /Não encontramos/.test(t)), `${id} admits the missing history`);
  }
});

test('no button outside Esperança, nor for scenes without a story (the bus interior)', () => {
  for (const [city] of table) {
    if (city === 'esperanca') continue;
    for (const id of ids(city)) assert.equal(placeInfoFor(city, id), null, `${city}/${id}`);
  }
  assert.equal(placeInfoFor('campina', 'praca-matriz'), null, 'an Esperança id under another city');
  assert.equal(placeInfoFor('esperanca', 'onibus'), null);
  assert.equal(placeInfoFor('esperanca', 'toString'), null, 'no prototype keys');
});

test('the info button starts hidden and the data module imports no DOM code', () => {
  assert.match(read('index.html'), /<button id="b-info"[^>]* hidden[ >]/);
  assert.doesNotMatch(read('src/data/place-info.ts'), /^import |document\.|window\./m);
});
