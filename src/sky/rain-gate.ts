/* Rain gate: decides whether the rain, drizzle and storm the forecast suggests are actually
   shown. Pure: no DOM, no network, no clock of its own, so it runs under node --test.

   Open-Meteo is a model forecast, not a ground observation: in the Agreste the default model
   often reports drizzle (code 51, ~0.1 mm) on dry days. So precipitation is shown only when
   (a) the forecast rate is at least RAIN_THRESHOLD_MM mm/h, or (b) a nearby METAR (airport
   observation) reports precipitation right now. Everything else in the sky (clouds,
   temperature, wind, fog, snow) still comes straight from the forecast.

   - forecast >= threshold                    -> rain at the forecast intensity, whatever the
     METAR says (a METAR 25 km away can miss a local cell; a dry report is not a veto)
   - forecast < threshold, METAR wet           -> light rain (storm too if it reports TS)
   - forecast < threshold, METAR showers in the vicinity (VC) -> light rain only when the
     forecast has some precipitation of its own; VC alone is not rain at the station
   - forecast < threshold, METAR dry, missing, stale or unparseable -> no rain, no storm
   Nothing here invents weather: every path starts from a real forecast or a real report. */

/** Forecast precipitation (mm/h) from which rain is shown without an observation. A model's
    0.1-0.4 mm/h trace stays off; 0.5 mm/h is about where light rain becomes visible. */
export const RAIN_THRESHOLD_MM = 0.5;
/** Scene intensity for rain confirmed only by an observation (light rain). */
export const LIGHT_RAIN = 0.25;
/** Storm intensity for a thunderstorm reported at the station when the forecast has none. */
export const OBS_STORM = 0.4;
/** A METAR older than this (from the real clock), or this far from the moment shown, is not used. */
export const OBS_MAX_AGE = 90 * 60e3;

/** Present weather from one METAR. */
export interface Obs {
  station: string;
  /** Observation time (ms). */
  at: number;
  raw: string;
  /** Present-weather groups found (e.g. "-SHRA", "VCTS"). */
  codes: string[];
  /** Precipitation or a thunderstorm at the station. */
  wet: boolean;
  /** Showers, thunderstorm or precipitation only in the vicinity (VC). */
  near: boolean;
  /** Thunderstorm at the station. */
  storm: boolean;
}

// intensity/proximity, descriptor, precipitation, obscuration/other (WMO / ICAO Annex 3 order)
const WX = /^(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP)*)(BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)?$/;
const STOP = new Set(['RMK', 'TEMPO', 'BECMG', 'NOSIG']);

/** Present weather from a raw METAR/SPECI. Only the body counts: trend groups (TEMPO, BECMG),
    remarks and recent weather (RE..) are forecasts or past, not what is happening now. */
export function parseMetar(raw: string, station: string, at: number): Obs {
  const tok = raw.trim().split(/\s+/);
  const t = tok.findIndex((s) => /^\d{6}Z$/.test(s));
  const codes: string[] = [];
  let wet = false, near = false, storm = false;
  for (const s of tok.slice(t >= 0 ? t + 1 : 1)) {
    if (STOP.has(s)) break;
    const m = WX.exec(s);
    if (!m) continue;
    const [, pre = '', desc = '', precip = ''] = m;
    const ts = desc === 'TS', sh = desc === 'SH';
    if (!precip && !ts && !(sh && pre === 'VC')) continue; // mist, haze, "+" alone, bare "SH": no rain
    codes.push(s);
    if (pre === 'VC') near = true;
    else { wet = true; if (ts) storm = true; }
  }
  return { station, at, raw, codes, wet, near, storm };
}

/** Latest report for `station` from an aviationweather.gov /api/data/metar JSON answer (or the
    proxy's trimmed copy). Null when nothing usable is there (wrong shape, other station, from
    the future). */
export function pickObs(json: unknown, station: string, now: number): Obs | null {
  if (!Array.isArray(json)) return null;
  let best: { at: number; raw: string } | null = null;
  for (const r of json as Array<Record<string, unknown> | null>) {
    if (!r || r.icaoId !== station || typeof r.rawOb !== 'string' || typeof r.obsTime !== 'number' || !Number.isFinite(r.obsTime)) continue;
    const at = r.obsTime * 1000;
    if (at > now + 10 * 60e3) continue;
    if (!best || at > best.at) best = { at, raw: r.rawOb };
  }
  return best ? parseMetar(best.raw, station, best.at) : null;
}

/** The observation if it can speak for the moment `ms` shown at real time `now`; else null
    (stale report, or a pinned #at= moment far from it): the gate is then threshold-only. */
export function usableObs(o: Obs | null | undefined, ms: number, now: number): Obs | null {
  if (!o || !Number.isFinite(o.at)) return null;
  return now - o.at <= OBS_MAX_AGE && Math.abs(ms - o.at) <= OBS_MAX_AGE ? o : null;
}

export type GateWhy = 'forecast' | 'observed' | 'observed-near' | 'below-threshold';
/** Forecast at one moment: rain/storm intensities (0..1) and the precipitation rate in mm/h
    (missing = unknown, treated as 0: an old cached reading never turns rain on by itself). */
export interface GateIn { rain: number; storm: number; mm?: number }

/** Rain and storm to show for a forecast moment and a usable observation (or null). */
export function gateRain(f: GateIn, obs: Obs | null): { rain: number; storm: number; why: GateWhy } {
  const mm = typeof f.mm === 'number' && Number.isFinite(f.mm) ? f.mm : 0;
  if (mm >= RAIN_THRESHOLD_MM && f.rain > 0) return { rain: f.rain, storm: f.storm, why: 'forecast' };
  if (obs?.wet) return { rain: Math.max(f.rain, LIGHT_RAIN), storm: obs.storm ? Math.max(f.storm, OBS_STORM) : 0, why: 'observed' };
  if (obs?.near && (mm > 0 || f.rain > 0)) return { rain: LIGHT_RAIN, storm: 0, why: 'observed-near' };
  return { rain: 0, storm: 0, why: 'below-threshold' };
}
