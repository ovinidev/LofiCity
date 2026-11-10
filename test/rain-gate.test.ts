// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
// The rain gate (src/sky/rain-gate.ts): forecast threshold, METAR confirmation and their conflicts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIGHT_RAIN, OBS_MAX_AGE, OBS_STORM, RAIN_THRESHOLD_MM, type Obs, gateRain, parseMetar, pickObs, usableObs,
} from '../src/sky/rain-gate.ts';
import { CITIES, METAR_STATIONS, cityById } from '../src/sky/cities.ts';
import { opensUmbrella, raining, shelterWait } from '../src/actors/rain-rules.ts';

const NOW = Date.parse('2026-11-10T12:14:00Z');
const OBS_AT = Date.parse('2026-11-10T12:00:00Z');
const metar = (body: string, at = OBS_AT) => parseMetar(`METAR SBKG 101200Z ${body}`, 'SBKG', at);
const DRY = metar('10009KT 9999 BKN020 28/21 Q1021');
const drizzle = { rain: 0.12, storm: 0, mm: 0.1 }; // code 51, 0.1 mm/h: the model's usual guess
const heavy = { rain: 0.6, storm: 0, mm: 2.4 }; // code 63

test('the threshold is in the documented 0.3-0.5 mm/h range and 0.1 mm does not pass it', () => {
  assert.ok(RAIN_THRESHOLD_MM >= 0.3 && RAIN_THRESHOLD_MM <= 0.5);
  assert.ok(0.1 < RAIN_THRESHOLD_MM);
});

test('forecast 0.1 mm drizzle with no observation: no rain, no storm', () => {
  assert.deepEqual(gateRain(drizzle, null), { rain: 0, storm: 0, why: 'below-threshold' });
  // a 15-minute value of 0.1 mm is 0.4 mm/h: still below
  assert.equal(gateRain({ rain: 0.12, storm: 0, mm: 0.4 }, null).rain, 0);
  // a storm code with a trace of rain is not a storm either
  assert.deepEqual(gateRain({ rain: 0.75, storm: 0.75, mm: 0.2 }, null), { rain: 0, storm: 0, why: 'below-threshold' });
});

test('forecast at or above the threshold with no observation: rain at the forecast intensity', () => {
  assert.deepEqual(gateRain({ rain: 0.35, storm: 0, mm: RAIN_THRESHOLD_MM }, null), { rain: 0.35, storm: 0, why: 'forecast' });
  assert.deepEqual(gateRain(heavy, null), { rain: 0.6, storm: 0, why: 'forecast' });
  assert.deepEqual(gateRain({ rain: 0.95, storm: 1, mm: 9 }, null), { rain: 0.95, storm: 1, why: 'forecast' });
});

test('forecast below the threshold, METAR confirms RA / DZ / SHRA / TS: light rain', () => {
  for (const w of ['RA', '-RA', '+RA', 'DZ', '-DZ', 'SHRA', '-SHRA', '+SHRA', 'TS', 'TSRA', '-TSRA', 'RADZ']) {
    const o = metar(`10009KT 6000 ${w} BKN020 24/21 Q1021`);
    assert.equal(o.wet, true, w);
    for (const f of [drizzle, { rain: 0, storm: 0, mm: 0 }]) {
      const g = gateRain(f, o);
      assert.equal(g.why, 'observed', w);
      assert.equal(g.rain, Math.max(f.rain, LIGHT_RAIN), w);
      assert.ok(g.rain > 0 && g.rain <= 0.35, `${w}: light rain`);
      assert.equal(g.storm, w.includes('TS') ? OBS_STORM : 0, `${w}: storm only for a thunderstorm at the station`);
    }
  }
});

test('showers or thunder only in the vicinity (VC) confirm only a forecast that already has some rain', () => {
  for (const w of ['VCSH', 'VCTS']) {
    const o = metar(`10009KT 9999 ${w} BKN020 28/21 Q1021`);
    assert.equal(o.wet, false); assert.equal(o.near, true);
    assert.deepEqual(gateRain(drizzle, o), { rain: LIGHT_RAIN, storm: 0, why: 'observed-near' });
    assert.equal(gateRain({ rain: 0, storm: 0, mm: 0 }, o).rain, 0, `${w} with a dry forecast is not rain`);
  }
});

test('conflict: METAR dry suppresses drizzle below the threshold but never vetoes forecast rain at or above it', () => {
  assert.equal(DRY.wet, false); assert.equal(DRY.near, false);
  assert.equal(gateRain(drizzle, DRY).rain, 0);
  assert.equal(gateRain({ rain: 0.3, storm: 0, mm: RAIN_THRESHOLD_MM - 0.01 }, DRY).rain, 0);
  assert.deepEqual(gateRain(heavy, DRY), { rain: 0.6, storm: 0, why: 'forecast' });
  assert.deepEqual(gateRain({ rain: 0.35, storm: 0, mm: RAIN_THRESHOLD_MM }, DRY).why, 'forecast');
});

test('observation unavailable, stale or unparseable: threshold only, never invented rain', () => {
  const wet = metar('10009KT 4000 RA BKN010 22/21 Q1021');
  assert.equal(usableObs(null, NOW, NOW), null);
  assert.equal(usableObs(undefined, NOW, NOW), null);
  assert.equal(usableObs(wet, NOW, NOW), wet);
  // stale by the real clock
  assert.equal(usableObs(wet, NOW, OBS_AT + OBS_MAX_AGE + 1), null);
  // a pinned #at= moment far from the report
  assert.equal(usableObs(wet, OBS_AT - 3 * 3.6e6, NOW), null);
  for (const o of [null, usableObs(wet, NOW, OBS_AT + 3 * 3.6e6)]) {
    assert.equal(gateRain(drizzle, o).rain, 0);
    assert.equal(gateRain(heavy, o).rain, 0.6);
  }
  // unparseable or wrong answers yield no observation
  for (const j of [null, {}, 'METAR', [{ icaoId: 'SBKG' }], [{ icaoId: 'SBJP', obsTime: OBS_AT / 1000, rawOb: 'METAR SBJP 101200Z RA' }],
    [{ icaoId: 'SBKG', obsTime: (NOW + 3.6e6) / 1000, rawOb: 'METAR SBKG 101300Z RA' }]]) assert.equal(pickObs(j, 'SBKG', NOW), null);
  // a missing rate (reading cached before the gate) counts as dry
  assert.equal(gateRain({ rain: 0.85, storm: 0 }, null).rain, 0);
  assert.equal(gateRain({ rain: 0.85, storm: 0, mm: Number.NaN }, null).rain, 0);
});

test('METAR parsing: the latest report, only the body (no trend, remarks or recent weather)', () => {
  const j = [
    { icaoId: 'SBKG', obsTime: (OBS_AT - 3.6e6) / 1000, rawOb: 'METAR SBKG 101100Z 11010KT 5000 -RA BKN017 26/21 Q1021' },
    { icaoId: 'SBKG', obsTime: OBS_AT / 1000, rawOb: 'METAR SBKG 101200Z 10009KT 9999 BKN020 28/21 Q1021' },
  ];
  const o = pickObs(j, 'SBKG', NOW)!;
  assert.equal(o.at, OBS_AT); assert.equal(o.wet, false); assert.deepEqual(o.codes, []);
  for (const body of ['9999 BKN020 28/21 Q1021 RERA', '9999 BKN020 28/21 Q1021 TEMPO 4000 SHRA', '9999 BKN020 28/21 Q1021 RMK RA',
    '3000 BR HZ BKN008 21/20 Q1020', '9999 FEW020 VCFG 28/21 Q1021', 'CAVOK 30/20 Q1015 NOSIG', '9999 NSW SCT020 28/21 Q1021']) {
    const p = metar(`10009KT ${body}`);
    assert.equal(p.wet || p.near || p.storm, false, body);
  }
  const s = metar('VRB03KT 3000 +TSRA BR FEW015CB BKN020 23/22 Q1019');
  assert.deepEqual([s.wet, s.storm, s.codes], [true, true, ['+TSRA']]);
});

test('umbrellas and shelter follow the gated state through rain-rules.ts', () => {
  const kind = 'live';
  const gated = (f: typeof drizzle, o: Obs | null) => gateRain(f, o).rain;
  // model drizzle, METAR dry: nobody opens an umbrella or waits under an awning
  const off = gated(drizzle, DRY);
  assert.equal(raining(kind, off, 0), false);
  for (let r = 0; r < 1; r += 0.05) assert.equal(opensUmbrella(kind, off, 0, r), false);
  const ask = (wet: boolean) => ({ wet, umbrella: false, onFoot: true, waited: false, waiting: 0, cap: 3 });
  assert.equal(shelterWait(ask(raining(kind, off, 0)), 0.5), 0);
  // METAR confirms rain: umbrellas open (most rolls) as for any real rain
  const on = gated(drizzle, metar('10009KT 5000 -SHRA BKN015 24/21 Q1021'));
  assert.equal(raining(kind, on, 0), true);
  assert.ok(Array.from({ length: 20 }, (_, i) => opensUmbrella(kind, on, 0, i / 20)).some(Boolean));
  assert.ok(shelterWait(ask(raining(kind, on, 0)), 0.5) > 0);
});

test('a city without a METAR station uses the threshold only; every station is served by the proxy', () => {
  const tokyo = cityById('tokyo');
  assert.equal(tokyo.metar, undefined);
  assert.equal(usableObs(tokyo.metar ? DRY : null, NOW, NOW), null);
  assert.equal(gateRain(drizzle, null).rain, 0);
  assert.equal(gateRain(heavy, null).rain, 0.6);
  for (const id of ['esperanca', 'campina', 'remigio', 'areia']) assert.equal(cityById(id).metar, 'SBKG', id);
  assert.equal(cityById('joaopessoa').metar, 'SBJP');
  const proxy = readFileSync(new URL('../api/metar.ts', import.meta.url), 'utf8');
  const allow = /const STATIONS = \[([^\]]*)\]/.exec(proxy)?.[1] ?? '';
  for (const st of METAR_STATIONS) assert.ok(allow.includes(`'${st}'`), `${st} in the proxy allowlist`);
  for (const c of CITIES) if (c.metar) assert.ok(METAR_STATIONS.includes(c.metar));
});

test('#wx= still forces the weather: the override returns before the gate in sky/state.ts', () => {
  const st = readFileSync(new URL('../src/sky/state.ts', import.meta.url), 'utf8');
  const body = st.slice(st.indexOf('function wx('), st.indexOf('\n}', st.indexOf('function wx(')));
  assert.ok(body.indexOf("S.wxKind = 'override'") >= 0 && body.indexOf("S.wxKind = 'override'") < body.indexOf('gateRain('));
  assert.match(st, /rain: \{ precip: 0\.6, rain: 0\.6/, '#wx=rain keeps its forced rain');
  assert.match(st, /storm: \{ precip: 1, rain: 1, storm: 1/, '#wx=storm keeps its forced storm');
});
