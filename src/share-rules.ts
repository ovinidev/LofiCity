/* Pure rules for sharing a view: the permalink hash and the story card's file name and text.
   No DOM here, so test/share-rules.test.ts can import it. Nothing is ever posted anywhere: the app only
   copies a link and saves a PNG; the person sends them themselves. */

/** Hash keys that describe the view itself; the copied link keeps only these. */
const VIEW_KEYS = ['city', 'scene', 'at'] as const;

export interface View { city: string; scene: string; at?: string | null }

/** Read a hash ("#a=1&debug") into ordered [key, value] pairs; flags get an empty value. */
export function parseHash(hash: string): [string, string][] {
  return [...new URLSearchParams(hash.replace(/^#/, ''))];
}

/** Build a readable hash: `city=x&scene=y&at=2026-12-24T22:00&debug` (':' left unescaped, flags bare). */
export function formatHash(pairs: [string, string][]): string {
  const s = pairs.map(([k, v]) => (v === '' ? k : `${k}=${encodeURIComponent(v).replace(/%3A/gi, ':')}`)).join('&');
  return s ? `#${s}` : '';
}

/**
 * The address-bar hash for the current view: city and scene first (plus #at when a moment is pinned),
 * then every other option the page was opened with (#debug, #wx=, #car=) left as it was.
 */
export function viewHash(current: string, view: View): string {
  const rest = parseHash(current).filter(([k]) => !(VIEW_KEYS as readonly string[]).includes(k));
  const head: [string, string][] = [['city', view.city], ['scene', view.scene]];
  if (view.at) head.push(['at', view.at]);
  return formatHash([...head, ...rest]);
}

/**
 * The link to share: same city, scene and pinned moment, without test and developer options
 * (#debug, #wx= weather override, #car=), so a shared link never shows a test reading.
 */
export function shareUrl(base: string, view: View): string {
  return base.replace(/#.*$/, '') + viewHash('', view);
}

/** "esperanca-praca-matriz-2130.png" */
export function cardFileName(view: View, hour: number): string {
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  const hhmm = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
  return `loficity-${view.city}-${view.scene}-${hhmm}.png`.replace(/[^\w.-]/g, '');
}
