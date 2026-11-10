// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
//
// Repo-wide guard: the shared rules every scene must satisfy, now and for scenes added later. Scenes are
// discovered from src/scenes/index.ts and the sources are scanned (scene modules draw into the framebuffer
// and read the URL, so they cannot be imported without a DOM). A failure lists `file:line  rule  code`.
//
// Adding a rule: write one more `test()` below that collects violations with `scan()` (or a per-scene
// check) and ends with `none(violations, 'what the rule is')`. Allowlist an exception only in the
// rule's own ALLOW map, keyed by file, with the reason as the value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { density } from '../src/sky/rhythm.ts';

const ROOT = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
const ls = (dir: string, re = /\.ts$/) => readdirSync(new URL(dir, ROOT)).filter((f) => re.test(f)).map((f) => `${dir}/${f}`);
const lsDeep = (dir: string): string[] => readdirSync(new URL(dir, ROOT)).flatMap((f) => {
  const p = `${dir}/${f}`;
  return statSync(new URL(p, ROOT)).isDirectory() ? lsDeep(p) : [p];
});

/** The source with comments blanked out (line numbers kept), so prose about a rule never trips it. */
function code(src: string): string {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') { // keep strings as they are (an asset path is a string)
      const q = c; out += c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i++]; } out += src[i++]; }
      out += src[i++] ?? ''; continue;
    }
    out += c; i++;
  }
  return out;
}
const CODE = new Map<string, string>();
const codeOf = (p: string) => { if (!CODE.has(p)) CODE.set(p, code(read(p))); return CODE.get(p)!; };

type Hit = string;
/** Every line of `files` (comments blanked) matching `re` (or the predicate), as `file:line  rule  code`. */
function scan(files: string[], re: RegExp | ((line: string) => boolean), rule: string, allow: Record<string, string> = {}): Hit[] {
  const out: Hit[] = [], hit = typeof re === 'function' ? re : (l: string) => re.test(l);
  for (const f of files) {
    if (f in allow) continue;
    codeOf(f).split('\n').forEach((line, i) => { if (hit(line)) out.push(`${f}:${i + 1}  [${rule}]  ${line.trim().slice(0, 140)}`); });
  }
  return out;
}
const none = (hits: Hit[], rule: string) => assert.deepEqual(hits, [], `${rule}\n  ${hits.join('\n  ')}`);

const SCENES_DIR = ls('src/scenes'), ACTORS = ls('src/actors'), FX = ls('src/fx');
const BEHAVIOUR = [...SCENES_DIR, ...ACTORS, ...FX];
const ALL_SRC = lsDeep('src').filter((f) => /\.(ts|css|html)$/.test(f));

// ---------- the scene registry, auto-discovered ----------
const index = read('src/scenes/index.ts');
/** import name -> module file (src/scenes/<file>.ts) */
const imports = new Map([...index.matchAll(/import \{ (\w+) \} from '\.\/([\w-]+)';/g)].map((m) => [m[1], `src/scenes/${m[2]}.ts`]));
/** city -> scene import names, from the SCENES table */
const table = new Map([...index.matchAll(/^\s+(\w+): \[([^\]]*)\],$/gm)].map((m) => [m[1], m[2].split(',').map((s) => s.trim()).filter(Boolean)]));
const SCENE_DECL = /export const (\w+): Scene = \{\s*id: '([\w-]+)'/;
/** Every scene module on disk (a file declaring `export const x: Scene = { id: ... }`). */
const sceneModules = SCENES_DIR.map((f) => ({ f, m: SCENE_DECL.exec(read(f)) })).filter((s) => s.m).map((s) => ({ file: s.f, name: s.m![1], id: s.m![2] }));
const registered = [...table.values()].flat();
const devLine = read('docs/DEVELOPING.md').split('\n').find((l) => l.startsWith('- `#scene=')) ?? '';

test('the registry parses: cities and scenes were found in src/scenes/index.ts', () => {
  assert.ok(table.size >= 6, `cities in SCENES: ${[...table.keys()]}`);
  assert.ok(registered.length >= 20, `scenes in SCENES: ${registered}`);
  assert.ok(devLine, 'docs/DEVELOPING.md has the `#scene=` line');
});

test('every scene module is registered in SCENES under exactly one city', () => {
  const bad: string[] = [];
  for (const s of sceneModules) {
    if (imports.get(s.name) !== s.file) { bad.push(`${s.file}  not imported in src/scenes/index.ts`); continue; }
    const cities = [...table].filter(([, names]) => names.includes(s.name)).map(([c]) => c);
    if (cities.length !== 1) bad.push(`${s.file}  registered under ${cities.length} cities (${cities.join(', ') || 'none'})`);
  }
  for (const name of registered) if (!sceneModules.some((s) => s.name === name)) bad.push(`src/scenes/index.ts  ${name} in SCENES has no scene module declaring it`);
  none(bad, 'scene registration');
});

test('scene ids are unique', () => {
  const ids = sceneModules.map((s) => s.id), dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  none(dup.map((id) => `${sceneModules.find((s) => s.id === id)!.file}  duplicate id '${id}'`), 'unique scene ids');
});

test('every registered scene id is listed in the `#scene=` line of docs/DEVELOPING.md', () => {
  none(sceneModules.filter((s) => !devLine.includes(`\`${s.id}\``)).map((s) => `${s.file}  '${s.id}' missing from docs/DEVELOPING.md #scene= line`), 'scene ids documented');
});

// ---------- weather comes only from the feed ----------
/** The fields of S filled from the weather (sky/state.ts): every `S.x =` in wx() / integrate() / settle()
    and the lines of direct() that use the reading `w` or the weather factor `wxK`. Derived, so a new
    weather field is guarded as soon as state.ts fills it. */
function weatherFields(): string[] {
  const st = codeOf('src/sky/state.ts'), fields = new Set<string>();
  const body = (name: string) => { const i = st.indexOf(`function ${name}(`); assert.ok(i >= 0, `state.ts has ${name}()`); return st.slice(i, st.indexOf('\n}', i)); };
  for (const fn of ['wx', 'integrate', 'settle']) for (const m of body(fn).matchAll(/\bS\.(\w+)\s*=(?!=)/g)) fields.add(m[1]);
  for (const line of body('direct').split('\n')) if (/\bw\.|\bwxK\b/.test(line)) for (const m of line.matchAll(/\bS\.(\w+)\s*=(?!=)/g)) fields.add(m[1]);
  return [...fields].sort();
}
const WX = weatherFields();

test('the weather fields of S are derived from sky/state.ts', () => {
  for (const f of ['wxKind', 'temp', 'rain', 'snow', 'storm', 'cloud', 'fog', 'wind', 'wet', 'snowCover', 'busy', 'traffic']) assert.ok(WX.includes(f), `${f} in ${WX}`);
});

test('nothing outside sky/state.ts assigns weather state (S.rain, S.temp, S.wxKind, S.busy, ...)', () => {
  const f = WX.join('|');
  const assign = new RegExp(`\\bS\\.(${f})\\s*(?:[-+*/]?=(?!=)|\\+\\+|--)|(?:\\+\\+|--)\\s*S\\.(${f})\\b|Object\\.assign\\(\\s*S\\b`);
  none(scan(ALL_SRC.filter((p) => p.endsWith('.ts') && p !== 'src/sky/state.ts'), assign, 'weather state assigned'), 'Weather state is set only by sky/state.ts from the Open-Meteo feed (or the labelled #wx= test)');
});

test('only sky/ and main.ts reach the weather feed; no scene, actor or effect fetches weather', () => {
  const others = ALL_SRC.filter((p) => p.endsWith('.ts') && !p.startsWith('src/sky/') && p !== 'src/main.ts');
  none([
    ...scan(others, /from '[./]*(sky\/)?(live|weather-feed|rain-gate)'/, 'weather feed imported'),
    ...scan(others, /open-meteo|api\.open-meteo|aviationweather|api\/metar/i, 'weather API outside sky/'),
  ], 'Scenes read the weather from S only');
});

test('rain and storm reach S only through the rain gate, after the #wx= override', () => {
  const st = codeOf('src/sky/state.ts'), i = st.indexOf('function wx('), body = st.slice(i, st.indexOf('\n}', i));
  const over = body.indexOf('if (wxOverride)'), gate = body.indexOf('gateRain(');
  assert.ok(over >= 0 && gate > over, 'wx(): the labelled #wx= test returns first, then the reading goes through gateRain()');
  assert.match(body, /rain: g\.rain\b/, 'wx(): rain comes from the gate');
  assert.match(body, /storm: g\.storm\b/, 'wx(): storm comes from the gate');
  assert.doesNotMatch(body, /\brain: l\.rain|storm: l\.storm/, 'wx(): the ungated forecast never reaches S');
});

/** Allowed Math.random calls, with the reason. Weather and behaviour must use seeded mulberry32/hashf. */
const RANDOM_ALLOW: Record<string, string> = {
  'src/scenes/index.ts': 'pickScene: which scene opens on load (never the previous one); not weather, not behaviour',
};
test('no Math.random in scenes, actors, effects or sky (seeded mulberry32 / hashf only)', () => {
  none(scan([...BEHAVIOUR, ...ls('src/sky')], /Math\.random\s*\(|crypto\.getRandomValues/, 'unseeded randomness', RANDOM_ALLOW), 'Randomness must be seeded (engine/math mulberry32 / hashf)');
});

// ---------- people react to real rain only through rain-rules.ts ----------
test('umbrella / shelter decisions are not made from raw precipitation outside rain-rules.ts', () => {
  const files = BEHAVIOUR.filter((p) => p !== 'src/actors/rain-rules.ts');
  none([
    // a line that touches an umbrella or shelter and reads raw precipitation decides the reaction itself;
    // passing the real weather state on to a rain-rules function, `f(S.wxKind, S.rain, S.snow, ...)`, is the way
    ...scan(files, (line) => {
      const rest = line.replace(/\b(raining|opensUmbrella|umbrellaOpen|pickUmbrella)\(([\w.]+, )?S\.wxKind, S\.rain, S\.snow/g, '');
      return /\b(umb|umbrella|shelter\w*|sombrinha)\b/i.test(rest) && /\bS\.(rain|snow|wet)\b/.test(rest);
    }, 'raw precipitation for umbrella/shelter'),
    // private copies of the thresholds
    ...scan(files, /\bconst\s+\w*(WET_MIN|WET_KEEP|UMBRELLA_SHARE)\w*\s*=/, 'rain threshold redefined'),
  ], 'Use raining / opensUmbrella / umbrellaOpen / shelterWait from src/actors/rain-rules.ts');
});

/** A walking person actor: an interface with a speed and a heading, and a person's look (skin / hair)
    or a person's name (vehicles have speeds and headings too). */
const WALKER_DECL = /interface (\w+) \{[^}]*\bsp: number[^}]*\b(dir|dz|vy): number[^}]*\}|interface (\w+) \{[^}]*\b(dir|dz|vy): number[^}]*\bsp: number[^}]*\}/g;
const LOOKS = /\b(skin|hair): number|^interface \w*(cross|walk|person|ped|fiel|student|passer|visitor)/i;
/** Vehicles (a rider's skin and hair, but a helmet, a cruise speed and a length) are not walkers. */
const VEHICLE = /\b(helmet|cruise|len): /;
/** Walking actors that need no rain reaction, with the reason. */
const WALKER_ALLOW: Record<string, string> = {};
/** Each interface of a file as one declaration text with the fields of the interfaces it extends in the
    same file folded in (`interface Visitor extends Fig { sp ... }` walks with Fig's dir, skin and hair). */
function interfaces(src: string): { name: string; line: number; decl: string }[] {
  const raw = [...src.matchAll(/interface (\w+)(?: extends ([\w, ]+))? \{([^}]*)\}/g)].map((m) => ({ name: m[1], ext: (m[2] ?? '').split(',').map((s) => s.trim()).filter(Boolean), body: m[3], index: m.index }));
  const byName = new Map(raw.map((i) => [i.name, i]));
  const fields = (name: string, seen = new Set<string>()): string => {
    const i = byName.get(name);
    if (!i || seen.has(name)) return '';
    seen.add(name);
    return [i.body, ...i.ext.map((e) => fields(e, seen))].join(';');
  };
  return raw.map((i) => ({ name: i.name, line: src.slice(0, i.index).split('\n').length, decl: `interface ${i.name} {${fields(i.name)}}` }));
}

test('every scene or actor with its own walking people goes through rain-rules.ts (shop-front customers too)', () => {
  const bad: string[] = [];
  for (const f of [...SCENES_DIR, ...ACTORS]) {
    if (f in WALKER_ALLOW || f === 'src/actors/rain-rules.ts') continue;
    const src = codeOf(f);
    for (const i of interfaces(src)) {
      WALKER_DECL.lastIndex = 0;
      if (!WALKER_DECL.test(i.decl) || !LOOKS.test(i.decl) || VEHICLE.test(i.decl)) continue;
      if (!/from '(\.\.\/actors|\.)\/rain-rules'/.test(src)) bad.push(`${f}:${i.line}  [walker without rain reaction]  interface ${i.name}`);
    }
  }
  none(bad, 'Walking people must take umbrellas / shelter from src/actors/rain-rules.ts (or be allowlisted with a reason)');
});

test('the walker guard sees inherited fields: a shop-front style customer is a walker', () => {
  const src = 'interface Fig { x: number; dir: number; skin: number; hair: number }\ninterface Visitor extends Fig { on: boolean; sp: number; ph: number }';
  const v = interfaces(src).find((i) => i.name === 'Visitor')!;
  WALKER_DECL.lastIndex = 0;
  assert.ok(WALKER_DECL.test(v.decl) && LOOKS.test(v.decl) && !VEHICLE.test(v.decl), v.decl);
  // and shopfront.ts, which walks such customers, is among the files the guard covers
  assert.ok(ACTORS.includes('src/actors/shopfront.ts'));
  assert.ok(interfaces(codeOf('src/actors/shopfront.ts')).some((i) => { WALKER_DECL.lastIndex = 0; return WALKER_DECL.test(i.decl) && LOOKS.test(i.decl); }), 'shopfront.ts Visitor detected as a walker');
});

test('the shared pedestrian paths are rain-aware: side-on (people.ts setLanes) and depth (persp-kit walkers)', () => {
  const people = codeOf('src/actors/people.ts'), persp = codeOf('src/scenes/persp-kit.ts');
  assert.match(people, /opensUmbrella\(S\.wxKind, S\.rain, S\.snow/, 'people.ts: umbrellas from the real weather state');
  assert.match(people, /shelterWait\(/, 'people.ts: shelters through rain-rules');
  assert.match(persp, /pickUmbrella\(S\.wxKind, S\.rain, S\.snow/, 'persp-kit.ts: umbrellas from the real weather state');
  assert.match(persp, /umbrellaOpen\(w\.sun, S\.wxKind, S\.rain, S\.snow\)/, 'persp-kit.ts: umbrella shown only while it rains (or a sun umbrella)');
  assert.match(persp, /shelterWait\(/, 'persp-kit.ts: shelters through rain-rules');
  assert.match(people, /parasolWeather\(S\.temp, S\.dayK, S\.cloud\)/, 'people.ts: sun umbrellas from the shared hot-clear-day rule');
  const bad: string[] = [];
  // one sun-umbrella rule for side-on and depth scenes: no private copy of the hot clear day threshold
  bad.push(...scan(BEHAVIOUR.filter((p) => p !== 'src/actors/rain-rules.ts'), /\bS\.temp\s*>\s*26\b/, 'private sun-umbrella condition'));
  for (const s of sceneModules) {
    const src = codeOf(s.file);
    if (/\bsetLanes\(/.test(src) && !/from '\.\.\/actors\/people'/.test(src)) bad.push(`${s.file}  calls setLanes without the shared people.ts`);
    if (/\b(makeWalkers|updateWalkers)\(/.test(src) && !/from '\.\/persp-kit'/.test(src)) bad.push(`${s.file}  depth walkers not from persp-kit.ts`);
    if (/\bmakeWalkers\(/.test(src) && !/\bupdateWalkers\(/.test(src)) bad.push(`${s.file}  makes depth walkers but never runs updateWalkers (the rain-aware step)`);
  }
  none(bad, 'Scenes with pedestrians use the shared rain-aware paths');
});

// ---------- crowds follow rhythm.ts ----------
test('every registered scene has a rhythm (rhythm.ts density) at every hour, and no scene keeps its own crowd table', () => {
  const bad: string[] = [];
  const day = Date.parse('2026-11-09T00:30:00Z');
  for (const [city, names] of table) for (const name of names) {
    const s = sceneModules.find((x) => x.name === name);
    if (!s) continue;
    for (let h = 0; h < 24; h++) {
      const d = density(city as Parameters<typeof density>[0], s.id, day + h * 3.6e6);
      if (!(d.people >= 0 && d.people <= 1 && d.traffic >= 0 && d.traffic <= 1)) bad.push(`${s.file}  density(${city}, ${s.id}) at +${h}h = ${JSON.stringify(d)}`);
    }
  }
  bad.push(...scan(SCENES_DIR, /import \{[^}]*\b(density)\b[^}]*\} from '\.\.\/sky\/rhythm'/, 'density read directly (S.busy / S.traffic already carry it)'));
  // an hour-by-hour crowd table: a crowd-ish name bound to 12 or more numbers
  bad.push(...scan(SCENES_DIR, /\b\w*(crowd|busy|people|density|movimento|traffic)\w*\s*[:=]\s*\[\s*(?:[\d.]+\s*,\s*){11,}/i, 'private crowd table'));
  none(bad, 'Crowds and traffic come from src/sky/rhythm.ts via S.busy / S.traffic (scenes may scale them, not replace them)');
});

// ---------- no image assets ----------
/** Files in public/ that are allowed (AGENTS.md: the approved icons and manifest, README screenshots). */
const PUBLIC_OK = /^public\/((apple-touch-icon|favicon|icon|logo-master|maskable)[\w.-]*\.(png|ico)|site\.webmanifest|screens\/[\w-]+\.png)$/;
/** Image references allowed in src/, with the reason. */
const ASSET_ALLOW: Record<string, string> = {
  'src/share-rules.ts': 'the file name of the story card PNG the user saves locally (an output, not an asset)',
};
test('no image or sprite assets: nothing in src/ references one, and public/ holds only the approved files', () => {
  none([
    ...ALL_SRC.filter((p) => /\.(png|jpe?g|gif|svg|webp|bmp|ico|aseprite|psd)$/i.test(p)).map((p) => `${p}  image file in src/`),
    ...scan(ALL_SRC, /['"`][^'"`]*\.(png|jpe?g|gif|svg|webp|bmp)(\?[^'"`]*)?['"`]|new Image\(|createImageBitmap\(|url\(\s*['"]?[^)]*\.(png|jpe?g|gif|svg|webp)/i, 'image reference', ASSET_ALLOW),
    ...lsDeep('public').filter((p) => !PUBLIC_OK.test(p)).map((p) => `${p}  not an approved public file (icons, manifest, README screenshots)`),
  ], 'No image assets: everything is drawn in code (AGENTS.md)');
});

// ---------- strong wind only through wind-rules.ts ----------
test('wind thresholds live in sky/wind-rules.ts and debris is gated by debrisOn()', () => {
  const files = ALL_SRC.filter((p) => p.endsWith('.ts') && p !== 'src/sky/wind-rules.ts');
  none([
    ...scan(files, /\bconst\s+\w*(STRONG_KMH|FULL_KMH|STRONG_DELTA|WIND_CALM)\w*\s*=/, 'wind threshold redefined'),
    // km/h back from S.wind by hand (the 55 / 0.9 of live.ts) instead of windKmh / windStrength / strongWind
    ...scan(files, /S\.wind[^;\n]*\*\s*55\b|S\.wind[^;\n]*\/\s*0\.9\b/, 'private wind conversion'),
    ...scan(files, (l) => /\bupdateDebris\(/.test(l) && !/export function updateDebris/.test(l) && !/debrisOn\(/.test(l), 'debris without debrisOn()'),
  ], 'Strong wind, its strength and the debris gate come from src/sky/wind-rules.ts');
  assert.match(codeOf('src/sky/state.ts'), /parseWindOverride\(location\.hash\)/, 'state.ts: the #wind= test is read in sky/state.ts only');
});
