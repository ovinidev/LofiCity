/* LoFi City — procedural lo-fi pixel scenes that follow each city's real clock and live weather. */
import './style.css';
import { G, frameFor, setFrame } from './engine/gfx';
import { backend, initPost, layout, opts, present, toFrame } from './engine/post';
import { sfx } from './audio/sfx';
import { drawEmotes, emote } from './fx/emotes';
import { tapAnimals } from './actors/animals';
import { tapPeople } from './actors/people';
import { tapCars } from './actors/cars';
import { audio } from './audio/audio';
import { radio } from './audio/radio';
import { bells } from './audio/bells';
import { precip, updatePrecip } from './fx/precip';
import { animalsDebug } from './actors/animals';
import { brTrafficDebug } from './actors/br-traffic';
import { fireworksStats, updateSkyEvents, lightning } from './fx/sky-events';
import { gradePalette } from './sky/grade';
import { S, direct, settle } from './sky/state';
import { CITIES, type City, cityById } from './sky/cities';
import { followLive, liveNow } from './sky/live';
import { updateSky } from './scenes/common';
import { nextScene, pickScene } from './scenes';
import { inject, pageview } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.hash.slice(1));

// ---------- clock ----------
// Always the city's real time. #city=esperanca picks a city; #at=2026-12-24T22:00 (city time)
// pins a moment for previews and screenshots only: the UI has no way to move time.
let stored: string | null = null;
try { stored = localStorage.getItem('loficity:city'); } catch { /* storage unavailable */ }
let city: City = cityById(params.get('city') ?? stored);
let simOffset = 0;
function pinMoment() {
  simOffset = 0;
  const at = params.get('at');
  if (!at) return;
  const off = city.utc, t = Date.parse(`${at}${off < 0 ? '-' : '+'}${String(Math.abs(off)).padStart(2, '0')}:00`);
  if (!Number.isNaN(t)) simOffset = t - Date.now();
}
pinMoment();
const simNow = () => Date.now() + simOffset;
followLive(city);

// ---------- analytics (Vercel, Hobby plan: page views + Web Vitals, cookieless) ----------
// Page views are reported as /tokyo or /esperanca so the dashboard shows which city people watch.
const hosted = location.protocol === 'https:' && !/^(localhost|127\.)/.test(location.hostname);
if (hosted) {
  inject({ beforeSend: (e) => ({ ...e, url: `${location.origin}/${city.id}` }) });
  injectSpeedInsights();
}

// ---------- frame + scene ----------
initPost();
function resize() {
  const f = frameFor(innerWidth / innerHeight);
  if (f.W !== G.W || f.H !== G.H) setFrame(f.W, f.H);
  layout();
}
addEventListener('resize', resize);
resize();

let scene = pickScene(city.id);
settle(simNow(), city);
direct(simNow(), city, 0, scene.id);
scene.build();

// ---------- HUD ----------
const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTH = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad2 = (n: number) => String(n | 0).padStart(2, '0');

function weatherWord(): string {
  if (S.typhoon && S.storm > 0.5) return 'tufão';
  if (S.storm > 0.45) return S.snow > S.rain ? 'nevasca' : 'tempestade';
  if (S.snow > 0.6) return 'nevasca';
  if (S.snow > 0.25) return 'neve';
  if (S.snow > 0.03) return 'neve fraca';
  if (S.storm > 0.2 && S.rain > 0.3) return 'trovoadas';
  if (S.rain > 0.7) return 'chuva forte';
  if (S.rain > 0.35) return 'chuva';
  if (S.rain > 0.05) return 'garoa';
  if (S.fog > 0.5) return 'neblina';
  if (S.cloud > 0.75) return 'nublado';
  if (S.cloud > 0.35) return 'parcialmente nublado';
  return S.dayK > 0.5 ? 'céu limpo' : 'noite limpa';
}
function seasonWord(): string {
  const m = S.cal.month;
  if (city.br) {
    const tags = [city.climate === 'litoral' ? (m >= 3 && m <= 7 ? 'inverno chuvoso' : 'verão') : m >= 2 && m <= 6 ? 'quadra chuvosa' : 'estação seca'];
    if (S.festa) tags.push(S.procissao ? 'procissão' : 'festa da padroeira');
    if (S.saoJoao) tags.push('são joão');
    if (S.natal && !S.festa) tags.push('natal');
    if (S.fireworks) tags.push('fogos');
    return tags.join(' · ');
  }
  const season = m <= 1 || m === 11 ? 'inverno' : m <= 4 ? 'primavera' : m <= 7 ? 'verão' : 'outono';
  const tags: string[] = [];
  if (S.petals > 0.2 || S.tree.pink > 0.3) tags.push('sakura');
  if (S.tsuyu) tags.push('tsuyu');
  if (S.fireworks) tags.push('hanabi');
  if (S.tree.red > 0.4 && S.tree.density > 0.2) tags.push('momiji');
  if (S.snowCover > 0.3) tags.push('tudo branco');
  return [season, ...tags].join(' · ');
}
function updateHud() {
  const c = S.cal;
  $('clock').textContent = `${pad2(c.hour)}:${pad2((c.hour % 1) * 60)}`;
  $('date').textContent = `${WEEK[c.weekday]} ${c.day} ${MONTH[c.month]} · ${city.utc < 0 ? 'horário de Brasília' : 'horário de Tóquio'}`;
  const live = simOffset === 0 ? liveNow(city.id) : null;
  $('temp').textContent = `${Math.round(live ? live.temp : S.temp)}°C`;
  $('wx').textContent = live ? `${weatherWord()} · sensação ${Math.round(live.feels)}° · umidade ${Math.round(live.humidity)}%` : weatherWord();
  $('live').hidden = !live;
  $('season').textContent = seasonWord();
}

// ---------- controls ----------
// technical panel for development and screenshots only: open the page with #debug
const showDebug = params.has('debug');
$('debug').hidden = !showDebug;
const press = (id: string, on: boolean) => $(id).setAttribute('aria-pressed', on ? 'true' : 'false');
const sel = $('city') as HTMLSelectElement;
function setCity(id: string) {
  city = cityById(id);
  try { localStorage.setItem('loficity:city', city.id); } catch { /* ignore */ }
  sel.value = city.id;
  pinMoment();
  followLive(city);
  scene = pickScene(city.id);
  settle(simNow(), city); direct(simNow(), city, 0, scene.id);
  scene.build();
  syncBells();
  updateHud();
  if (hosted) pageview({ route: '/[city]', path: `/${city.id}` });
}
// Esperança's church bells strike the hours (see audio/bells.ts); re-synced on every change that matters.
const syncBells = () => bells.sync(() => ({ cityId: city.id, utc: city.utc, pinned: simOffset !== 0, near: scene.id === 'praca-matriz' }));
addEventListener('pagehide', () => bells.dispose());
addEventListener('pageshow', (e) => { if (e.persisted) syncBells(); }); // back from the bfcache
const actions: Record<string, () => void> = {
  sound: () => { press('b-sound', audio.toggle()); syncBells(); },
  crt: () => { opts.crt = !opts.crt; press('b-crt', opts.crt); },
  city: () => setCity(CITIES[(CITIES.indexOf(city) + 1) % CITIES.length].id),
  scene: () => { scene = nextScene(city.id, scene); direct(simNow(), city, 0, scene.id); scene.build(); syncBells(); },
  music: () => radio.toggle(),
  station: () => radio.nextStation(),
  skip: () => radio.skip(),
  lightning: () => lightning.strike(),
  full: () => {
    const d = document;
    if (d.fullscreenElement) void d.exitFullscreen?.().catch(() => {});
    else void d.documentElement.requestFullscreen?.().then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => {});
  },
};
const BUTTONS: [string, string][] = [
  ['b-sound', 'sound'], ['b-crt', 'crt'], ['b-scene', 'scene'], ['b-full', 'full'],
];
for (const [id, a] of BUTTONS) $(id).addEventListener('click', actions[a]);
for (const c of CITIES) sel.add(new Option(c.name, c.id));
sel.value = city.id;
sel.addEventListener('change', () => { setCity(sel.value); sel.blur(); });
radio.mount($('radio'));
// "rotate your phone" overlay (shown by CSS on upright touch screens); dismissal lasts for the session
try { if (sessionStorage.getItem('loficity:portrait-ok')) document.body.classList.add('portrait-ok'); } catch { /* ignore */ }
$('rotate-ok').addEventListener('click', () => {
  document.body.classList.add('portrait-ok');
  try { sessionStorage.setItem('loficity:portrait-ok', '1'); } catch { /* ignore */ }
});

const KEYS: Record<string, string> = {
  m: 'sound', r: 'music', p: 'station', n: 'skip', c: 'crt', t: 'city', s: 'scene', l: 'lightning', enter: 'full',
};
addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'SELECT' || tag === 'INPUT' || (tag === 'BUTTON' && e.key === 'Enter')) return;
  const a = KEYS[e.key.toLowerCase()];
  if (a) actions[a]();
});
$('view').addEventListener('dblclick', actions.full);
// Tap what moves: birds fly off, cats bolt, dogs bark and run, people say hi, vehicles honk.
$('view').addEventListener('pointerdown', (e) => {
  const f = toFrame(e.clientX, e.clientY), x = f.x + G.camX, y = f.y - G.oy;
  const a = tapAnimals(x, y);
  if (a) { sfx(a.kind === 'bird' ? 'chirp' : a.kind === 'cat' ? 'meow' : 'bark'); emote(a.x, a.y, a.kind === 'bird' ? '♪' : '!'); return; }
  const p = tapPeople(x, y);
  if (p) { sfx(p.dog ? 'bark' : 'oi'); emote(p.x, p.y, Math.random() < 0.5 ? '♥' : '!'); return; }
  const c = tapCars(x, y);
  if (c) { sfx(c.sound); emote(c.x, c.y, '♪'); return; }
  const prop = scene.tap?.(x, y);
  if (prop) { sfx(prop.sfx); emote(prop.x, prop.y, '♪'); }
});

let idleTimer = 0, wakeLock: WakeLockSentinel | null = null;
function requestWake() {
  if (wakeLock || !navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
}
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (document.activeElement?.closest('.ui')) return; // keep controls up while one is focused
    document.body.classList.add('idle'); $('hint').hidden = true;
  }, 3500);
  requestWake();
}
for (const ev of ['pointermove', 'pointerdown', 'keydown']) addEventListener(ev, wake, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWake(); });

// ---------- main loop ----------
let last = performance.now(), frames = 0, fps = 0, fpsT = 0, workMs = 2, uiT = 1, audioT = 0, clock = 0;
function frame(now: number) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;
  const t0 = performance.now();
  clock += dt;
  direct(simNow(), city, dt, scene.id);
  updateSky(dt); updateSkyEvents(dt); updatePrecip(dt); scene.update(dt);
  scene.render();
  drawEmotes(dt);
  gradePalette();
  present(clock, S.shake, S.dayK);
  workMs = workMs * 0.95 + (performance.now() - t0) * 0.05;
  frames++; fpsT += dt; uiT += dt; audioT += dt;
  if (audioT > 0.5) { audioT = 0; audio.tick(); }
  if (fpsT >= 1) {
    fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    if (workMs > 9 && precip.rainCap > 200) precip.rainCap -= 40; else if (workMs < 4 && precip.rainCap < 850) precip.rainCap += 15;
  }
  if (uiT >= 0.25) {
    uiT = 0; updateHud();
    if (showDebug) $('debug').textContent =
`scene   ${scene.name}   frame ${G.W}x${G.H}
time    ${new Date(simNow()).toISOString().slice(0, 16)}Z   ${city.id}   weather ${S.live ? 'live' : 'model'}
sun     ${S.sunElev.toFixed(1)}°  day ${S.dayK.toFixed(2)}  gold ${S.golden.toFixed(2)}  moon ${S.moonPhase.toFixed(2)}
wx      rain ${S.rain.toFixed(2)} snow ${S.snow.toFixed(2)} storm ${S.storm.toFixed(2)} cloud ${S.cloud.toFixed(2)}
        fog ${S.fog.toFixed(2)} wind ${S.wind.toFixed(2)} wet ${S.wet.toFixed(2)} cover ${S.snowCover.toFixed(2)} temp ${S.temp.toFixed(1)}
busy    ${S.busy.toFixed(2)}  traffic ${S.traffic.toFixed(2)}  birds ${S.birds.toFixed(2)}   tree d${S.tree.density.toFixed(2)} p${S.tree.pink.toFixed(2)} r${S.tree.red.toFixed(2)}
${scene.debug()}
fps     ${fps}   work ${workMs.toFixed(1)} ms   ${backend()}
drops   ${precip.liveDrops}/${precip.rainCap}  flakes ${precip.liveFlakes}  leaves ${precip.liveLeaves}
fx      ${fireworksStats()}  fireworks ${S.fireworks}   radio ${radio.status()}   bells ${bells.status()}${city.br ? `
life    ${animalsDebug()}
traffic ${brTrafficDebug() || '-'}` : ''}`;
  }
  requestAnimationFrame(frame);
}
updateHud();
wake();
requestAnimationFrame(frame);
