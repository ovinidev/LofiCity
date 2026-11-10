/* Vercel edge function: same-origin, cacheable proxy for the METAR reports the rain gate reads
   (src/sky/rain-gate.ts). aviationweather.gov sends no CORS header, so the browser cannot call it
   directly. No key, an allowlist of stations (not an open proxy), a few minutes of CDN cache so
   every visitor shares one upstream request, and a short timeout. On any upstream failure it
   answers 502 and the app falls back to the forecast threshold alone. Not part of the Vite
   single-file client build; `pnpm dev` / `pnpm preview` proxy the same path (vite.config.ts). */
export const config = { runtime: 'edge' };

/** Keep in sync with METAR_STATIONS in src/sky/cities.ts (checked by test/rain-gate.test.ts). */
const STATIONS = ['SBKG', 'SBJP'];
const UPSTREAM = 'https://aviationweather.gov/api/data/metar';

const json = (body: unknown, status: number, cache: string) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method' }, 405, 'no-store');
  const q = new URL(req.url).searchParams, id = (q.get('ids') ?? '').toUpperCase();
  if (!STATIONS.includes(id)) return json({ error: 'station' }, 400, 'public, max-age=3600');
  // only the exact query the app sends, so stray parameters cannot bypass the CDN cache
  if ([...q.keys()].some((k) => !['ids', 'format', 'hours'].includes(k)) || q.get('format') !== 'json' || q.get('hours') !== '3')
    return json({ error: 'query' }, 400, 'public, max-age=3600');
  try {
    const res = await fetch(`${UPSTREAM}?ids=${id}&format=json&hours=3`, {
      headers: { accept: 'application/json', 'user-agent': 'loficity (+https://loficity-lac.vercel.app)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('upstream shape');
    // only what the client reads
    const out = data
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({ icaoId: r.icaoId, obsTime: r.obsTime, rawOb: r.rawOb }))
      .filter((r) => r.icaoId === id && typeof r.obsTime === 'number' && typeof r.rawOb === 'string');
    return json(out, 200, 'public, max-age=120, s-maxage=300, stale-while-revalidate=300');
  } catch {
    return json({ error: 'upstream' }, 502, 'public, max-age=30, s-maxage=60');
  }
}
