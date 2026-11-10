/* Cities the app can show. Each one brings its clock, its place on the globe (for the sun,
   the moon and the live weather), its climate region (only for the calendar season label;
   it never drives the weather shown) and its own scenes. */

export type CityId = 'esperanca' | 'campina' | 'joaopessoa' | 'areia' | 'remigio' | 'tokyo';
/** Japan; the Borborema plateau (Agreste); the cooler, wetter, misty Brejo; the hot humid coast. */
export type Climate = 'japan' | 'agreste' | 'brejo' | 'litoral';

export interface City {
  id: CityId;
  /** Name shown in the HUD and the selector. */
  name: string;
  /** Fixed UTC offset in hours (neither city observes daylight saving). */
  utc: number;
  lat: number;
  lon: number;
  /** Climate region: picks the season label ("quadra chuvosa", "verão"...) in the HUD. */
  climate: Climate;
  /** Brazilian city: local traffic, people, animals and calendar. */
  br: boolean;
  /** Nearby airport METAR that can confirm rain (rain-gate.ts); none = forecast threshold only.
      Must be in the proxy's allowlist (api/metar.ts). */
  metar?: MetarStation;
}

/** Stations the /api/metar proxy serves: Campina Grande (SBKG) and João Pessoa (SBJP) airports. */
export const METAR_STATIONS = ['SBKG', 'SBJP'] as const;
export type MetarStation = (typeof METAR_STATIONS)[number];

// The first city is the default. All Paraíba cities run on Brasília time.
export const CITIES: City[] = [
  // Esperança: Agreste on the Borborema plateau (~630 m)
  // METAR: Esperança (~28 km), Remígio (~36 km) and Areia (~41 km) use Campina Grande airport, the
  // only one on the plateau; João Pessoa uses its airport in Bayeux (~17 km from Cabo Branco).
  { id: 'esperanca', name: 'Esperança · PB', utc: -3, lat: -7.02, lon: -35.86, climate: 'agreste', br: true, metar: 'SBKG' },
  { id: 'campina', name: 'Campina Grande · PB', utc: -3, lat: -7.231, lon: -35.881, climate: 'agreste', br: true, metar: 'SBKG' },
  // weather taken at Cabo Branco, where the scene is
  { id: 'joaopessoa', name: 'João Pessoa · PB', utc: -3, lat: -7.148, lon: -34.797, climate: 'litoral', br: true, metar: 'SBJP' },
  // Areia: Brejo, ~620 m, cool and often misty
  { id: 'areia', name: 'Areia · PB', utc: -3, lat: -6.963, lon: -35.692, climate: 'brejo', br: true, metar: 'SBKG' },
  { id: 'remigio', name: 'Remígio · PB', utc: -3, lat: -6.95, lon: -35.834, climate: 'agreste', br: true, metar: 'SBKG' },
  { id: 'tokyo', name: 'Tóquio', utc: 9, lat: 35.68, lon: 139.69, climate: 'japan', br: false },
];

export const cityById = (id: string | null | undefined): City => CITIES.find((c) => c.id === id) ?? CITIES[0];

/** Festa de Nossa Senhora do Bom Conselho: about 16 days from early January, procession on the last night. */
export const FESTA_PADROEIRA = { from: [0, 5] as const, to: [0, 20] as const };
