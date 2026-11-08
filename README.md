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
  - `Praça da Matriz`: the square in front of the Nossa Senhora do Bom Conselho church.
  - `Rua do Comércio`: the main shopping street, with a bar that puts its tables out at night.
  - `Capelinha das Pedras`: the tiny 1925 chapel on the Lajedo do Araçá rock, beside the pool that mirrors it.
  - `Praça da Cultura`: the town's postcard square, with the "EU ♥ ESPERANÇA" letters, craft fairs and the Paixão de Cristo in Holy Week.
  - `Campo da Rodoviária`: the dirt football pitch by the bus station; pickup games, weekend matches with a crowd, buses coming and going.

Esperança's streets are busy with local life: motorcycles of every kind (mototáxi, delivery, the gas man with a botijão), Viação São José buses, the prefeitura school bus, carros-pipa, donkey carts, the carro de som, pickups carrying furniture, a Veraneio now and then; joggers, sun umbrellas and street vendors; street dogs, cats on the walls, birds on the wires, vultures on the thermals and bats around the lamps.

Everything is drawn in code, with no image assets: an indexed framebuffer whose palette is graded for day, night, sunset and overcast skies.

**Tap anything that moves**: birds fly off the wires, cats bolt along the walls, dogs bark and run, people say "oi!", and every vehicle has its own horn, from the moto's beep to the São José bus, the donkey cart's bray and the carro de som's jingle. All sounds are synthesized in the browser.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # dist/index.html, a single self-contained file
pnpm shot       # screenshots into ./shots (needs a build; NODEBUG=1 hides the debug panel)
```

## URL options

- `#city=esperanca` (also `campina`, `joaopessoa`, `areia`, `remigio`, `tokyo`)
- `#scene=praca-matriz`: pin a scene (`praca-matriz`, `rua-comercio`, `capelinha`, `praca-cultura`, `campo-rodoviaria`, `acude-velho`, `cabo-branco`, `centro-areia`, `lagoa-remigio`, `rain-corner`, `neon-alley`, `konbini`, `shrine`)
- `#at=2026-12-24T22:00`: freeze a moment in the city's time zone (for testing; the UI always uses real time)
- `#debug`: technical panel (for development)
- `#wx=rain`: force the weather (`clear`, `cloudy`, `rain`, `snow`, `storm`, `fog`)
- `#car=bus`: make most Esperança traffic one kind, for previews (`moto`, `hatch`, `sedan`, `suv`, `pickup`, `veraneio`, `kombi`, `som`, `pipa`, `carroca`, `bus`, `micro`, `escolar`)

## Keys

T city, S scene, R radio, N next track, P station, M ambient sound, C CRT, L lightning, H hide/show the panels, Enter fullscreen.

The eye button (top-right) hides the whole HUD, credit included, for a clean view; the choice is remembered. Hiding it does not pause the radio. Fullscreen is on the button and Enter only (no double-click), so quick taps on the scene never resize it.

## Layout

- `src/engine`: indexed framebuffer, palette, WebGL2 post-processing
- `src/sky`: cities, clock and astronomy, climate models (Japan and Brazil's Agreste), live weather, palette grading
- `src/fx`: rain, snow, petals and leaves, lightning, fireworks
- `src/actors`: pedestrians, cars and motorcycles, trees
- `src/scenes`: shared passes, the Esperança prop kit (`br-kit.ts`) and one file per scene
- `src/audio`: generative ambience and the radio

## Credits

- **Weather**: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). No API key; refreshes every 10 minutes and falls back to the simulated climate if the network fails.
- **Music**: streamed from the [Internet Archive](https://archive.org/), released by their labels under Creative Commons licenses. The radio shows each track's artist, album and license with a link to the original page.
  - Rádio Lo-Fi City: [Dusted Wax Kingdom](https://archive.org/search?query=identifier%3ADWK%2A) (CC BY-NC-ND).
  - Rádio Vaporwave: releases from netlabels such as Enough Records, Section 27, Internet Daemon and others (CC BY-NC-ND / BY-NC-SA / BY-SA).
  - The music is **not** part of this repository or its MIT license, and the NC licenses forbid commercial use.

## Privacy

The hosted site uses [Vercel Web Analytics](https://vercel.com/docs/analytics) and [Speed Insights](https://vercel.com/docs/speed-insights). Both are cookieless and only collect visit counts per city (`/tokyo`, `/esperanca`) and performance metrics. Nothing is sent when running locally.

## License

Code under the [MIT](LICENSE) license.
