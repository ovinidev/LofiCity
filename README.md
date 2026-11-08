# LoFi City

Lo-fi pixel-art scenes that follow each city's **real clock** and **live weather**. If it's raining there, it rains on screen; if it's night there, it's night here. Comes with two radio stations playing real music released under Creative Commons.

**Live:** https://loficity-lac.vercel.app

**Cities** (pick one in the selector; Esperança is the default)

- **Campina Grande**: `Açude Velho`, with the glass drums of the Museu de Arte Popular (the "Três Pandeiros") and the high-rises mirrored in the water; fireworks most nights of its famous São João in June.
- **João Pessoa**: `Orla do Cabo Branco`, the sea where the sun rises first in the Americas, jangadas, coconut palms and the triangular lighthouse on the cliff, its beam sweeping the sky at night.
- **Areia**: `Centro Histórico`, the listed colonial town of the Brejo: casario with iron balconies, the Câmara Municipal, the Teatro Minerva (1859), a cachaça shop, cobbles and mist.
- **Remígio**: `Lagoa de Remígio`, the round lagoon with royal palms, houses up the hill, the matriz on top and ducks on the water.
- **Tokyo**: `Esquina da chuva` (rain corner), `Beco neon` (neon alley), `Rua do konbini` (konbini street), `Santuário` (shrine). Japanese seasons: sakura, tsuyu, momiji, year-end snow, hanabi.
- **Esperança, Paraíba, Brazil** (Brasília time). Local calendar: the patron saint's festival in January, Holy Week, São João in June, Christmas.
  - `Praça da Matriz`: the square in front of the ochre Nossa Senhora do Bom Conselho church, with its slender clock tower and spire.
  - `Rua do Comércio`: the main shopping street, with a bar that puts its tables out at night.
  - `Capelinha das Pedras`: the tiny 1925 chapel on the Lajedo do Araçá rock, beside the pool that mirrors it, painted the Matriz's yellow. A quiet spot: no traffic and usually nobody around. Now and then a visitor walks up to take photos, and on some days (more often on Sundays, always on 27 June and 1 January) there is one short daytime mass: the door opens on a lit interior, a priest waits at the door and a handful of people come and go. This is art direction, not the chapel's real schedule: each day's events come from a seed of the local date (so `#at=` shows the same day), all between 07:00 and 17:00, and the weather does not change them.
  - `Praça da Cultura`: the town's postcard square: blue steps up to a red plaza, the "EU ♥ ESPERANÇA" letters with their big heart, craft fairs and the Paixão de Cristo in Holy Week.
  - `Campo da Rodoviária`: the fenced artificial-turf pitch behind a wall of football murals; pickup games, weekend matches, floodlit evenings.

  The Matriz, Praça da Cultura and Campo da Rodoviária scenes were drawn using Google Maps captures as reference only (Feb 2020, Feb 2025 and Jun 2025). They may not match the places today, and none of the images are in the repo.

Esperança's streets are busy with local life: motorcycles of every kind (mototáxi, delivery, the gas man with a botijão), Viação São José buses, the prefeitura school bus, carros-pipa, donkey carts, the carro de som, pickups carrying furniture, a Veraneio now and then; joggers, sun umbrellas and street vendors; street dogs, cats on the walls, birds on the wires, vultures on the thermals and bats around the lamps.

Everything is drawn in code, with no image assets: an indexed framebuffer whose palette is graded for day, night, sunset and overcast skies.

**Tap anything that moves**: birds fly off the wires, cats bolt along the walls, dogs bark and run, people say "oi!", and every vehicle has its own horn, from the moto's beep to the São José bus, the donkey cart's bray and the carro de som's jingle. In Praça da Matriz, tap the church and its bell strikes once. All sounds are synthesized in the browser.

**Church bells (Esperança)**: with ambient sound on (M), the matriz strikes the hours on Esperança's real clock (Brasília time), from 05:00 through 00:00, counting in 12-hour style (13h = 1 strike, 00h = 12); it is silent from 01:00 to 04:00. You hear it in every Esperança scene: near in Praça da Matriz, farther away and softer elsewhere. Missed hours are never replayed (background tab, sleep, reload, turning sound on late), and nothing rings while a `#at=` moment is pinned.

**Daily rhythm**: crowds, traffic and birds follow each city's own clock, interpolated smoothly between hours (and `#at=` moments). Esperança, Campina Grande and João Pessoa all use Brasília time (UTC-3, the same as Fortaleza, no daylight saving), and so do the weekday and calendar.

- Esperança's Praça da Matriz and Praça da Cultura are busiest from 14h to 15h. Around 17h the birds get busy, flying back to the trees and wires (this depends on the time only, not the temperature). From 19h the streets thin out; 21–23h and 00–05h are nearly empty, with just the odd dog or passer-by.
- Campina Grande and João Pessoa are busier by day and in the evening, but still have few people out from 00h to 05h.
- **Mass at the Matriz**: the doors open, the nave is lit and a small congregation gathers by the church on Sundays at 07, 09, 16 and 19h, and Monday to Friday at 19h. Assumptions, not an official parish timetable: each mass lasts 1 hour, and there is no Saturday mass. The rest of the praça stays quiet.
- Weather is never made up here: only real rain, storms and snow from Open-Meteo (live or stale) scale these crowd levels down; with no reading ("clima indisponível") the rhythm runs unscaled.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # dist/index.html, a single self-contained file
pnpm shot       # screenshots into ./shots (needs a build; NODEBUG=1 hides the debug panel)
pnpm test       # unit tests for the bell schedule and timer and the daily rhythm (node --test; Node >= 22.18, no extra deps)
```

## URL options

- `#city=esperanca` (also `campina`, `joaopessoa`, `areia`, `remigio`, `tokyo`)
- `#scene=praca-matriz`: pin a scene (`praca-matriz`, `rua-comercio`, `capelinha`, `praca-cultura`, `campo-rodoviaria`, `acude-velho`, `cabo-branco`, `centro-areia`, `lagoa-remigio`, `rain-corner`, `neon-alley`, `konbini`, `shrine`)
- `#at=2026-12-24T22:00`: freeze a moment in the city's time zone (for testing; the UI always uses real time)
- `#debug`: technical panel (for development)
- `#wx=rain`: test override for previews (`clear`, `cloudy`, `rain`, `snow`, `storm`, `fog`); the HUD marks it as a test, never as live
- `#car=bus`: make most Esperança traffic one kind, for previews (`moto`, `hatch`, `sedan`, `suv`, `pickup`, `veraneio`, `kombi`, `som`, `pipa`, `carroca`, `bus`, `micro`, `escolar`)

## Keys

T city, S scene, R radio, N next track, P switch station (Lo-fi / Neon), M ambient sound, C CRT, H hide/show the panels, Enter fullscreen. L triggers a lightning strike only in test mode (`#debug` or a `#wx=` override); in normal use it does nothing and lightning comes only from real storm data.

The eye button (top-right) hides the whole HUD, credit included, for a clean view; the choice is remembered. Hiding it does not pause the radio. Fullscreen is on the button and Enter only (no double-click), so quick taps on the scene never resize it.

## Layout

- `src/engine`: indexed framebuffer, palette, WebGL2 post-processing
- `src/sky`: cities, clock and astronomy, live weather (`weather-feed.ts` holds the pure live / stale / unavailable rules, unit-tested; `live.ts` the network), palette grading; `rhythm.ts` holds the pure, unit-tested daily rhythm (crowds, birds, mass times)
- `src/fx`: rain, snow, petals and leaves, lightning, fireworks
- `src/actors`: pedestrians, cars and motorcycles, trees
- `src/scenes`: shared passes, the Esperança prop kit (`br-kit.ts`) and one file per scene
- `src/audio`: generative ambience, synthesized SFX and church bells (`bells-schedule.ts` holds the pure rules and `bells-scheduler.ts` the timer, both unit-tested), and the radio
- `test`: `node --test` unit tests

## Credits

- **Weather**: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). No API key; refreshes every 10 minutes. Weather is never simulated: if a fetch fails, the last real reading for that city stays on screen marked "dados de HH:MM · sem atualização" (for up to 12 h); with no reading the HUD says "clima indisponível" over a neutral sky with no rain, snow, storm or fog. Failures are retried 3 times (15 s, 1 min, 3 min), then every 10 minutes until the API answers again.
- **Music**: streamed from the [Internet Archive](https://archive.org/), released by their labels under Creative Commons licenses. The radio shows each track's artist, album and license with a link to the original page.
  - **Lo-Fi City** (amber; lo-fi beats, instrumental hip-hop): 15 albums from the [Dusted Wax Kingdom](https://archive.org/details/dustedwaxkingdom) netlabel (CC BY-NC-ND 3.0/4.0).
  - **Neon FM** (magenta; vaporwave): Meavy Boy (*Column*, *EP 71 to 20*), Meavy Boy / アロキン (*No Sleep*) and アロキン (*Sleepless Arcade*), all from the [Spettro Records](https://archive.org/details/spettrorec) netlabel (CC BY-NC-ND 4.0), and 2003 Toyota Corolla from the hanahata netlabel (CC BY-SA 4.0).
  - The album list is in `src/audio/radio.ts`. Intros, interludes, skits, vocal features and tracks under 75 s or over 8 min are skipped. If a track or album fails, the radio skips ahead with a short pause between tries, and after 5 failures in a row it stops and says so.
  - The music is **not** part of this repository or its MIT license, and the NC licenses forbid commercial use.

## Privacy

The hosted site uses [Vercel Web Analytics](https://vercel.com/docs/analytics) and [Speed Insights](https://vercel.com/docs/speed-insights). Both are cookieless and only collect visit counts per city (`/tokyo`, `/esperanca`) and performance metrics. Nothing is sent when running locally.

## License

Code under the [MIT](LICENSE) license.
