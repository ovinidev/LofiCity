# AGENTS.md

## Purpose

LofiCity is a lo-fi pixel-art web app: scenes for several cities (Esperança, Campina Grande, João Pessoa, Areia, Remígio, Tokyo) that follow each city's real clock and live weather, plus two radio stations. See `README.md` for cities, URL options (`#city=`, `#scene=`, `#at=`, `#wx=`, `#debug`) and keys.

Stack: TypeScript (strict), Vite, `vite-plugin-singlefile` (the build is one self-contained `dist/index.html`), pnpm.

## Structure (`src/`)

- `main.ts`, `style.css`: entry point and styles (`index.html` at the root)
- `engine/`: indexed framebuffer, palette, WebGL2 post-processing
- `sky/`: cities, clock and astronomy, live weather, palette grading
- `fx/`: rain, snow, lightning, fireworks and other effects
- `actors/`: pedestrians, animals, cars/motorcycles, trees
- `scenes/`: shared passes, the Esperança prop kit (`br-kit.ts`) and one file per scene
- `audio/`: generative ambience, synthesized SFX and the radio

## Commands

```bash
pnpm install     # install dependencies
pnpm dev         # Vite dev server, http://localhost:5173
pnpm typecheck   # tsc --noEmit
pnpm build       # tsc --noEmit && vite build -> dist/index.html
pnpm shot        # Playwright screenshots into ./shots (needs a build first)
pnpm test        # node --test on test/*.test.ts (Node >= 22.18 strips types; no test deps)
```

**Before opening a PR, run `pnpm typecheck`, `pnpm build` and `pnpm test`.** The only tests are the unit tests in `test/` for pure logic (currently the bell schedule and its timer, the weather live / stale / unavailable rules, the daily rhythm in `src/sky/rhythm.ts`, the street and depth-traffic rules in `src/actors/street-rules.ts` and `persp-rules.ts` including queue spacing at crossings, the one-way road at Praça da Matriz in `src/actors/matriz-road.ts` (vehicles only go away from the viewer and yield at the zebra), the rain reactions (umbrellas, shelters) in `src/actors/rain-rules.ts`, the traffic-light phases, yellow stop/go and pedestrian phase in `src/actors/signal-rules.ts`, the speech-bubble phrase choice (place, hour, real-weather-only lines, no repeats), placement and lifetime in `src/actors/speech-rules.ts` (pool in `src/actors/phrases.ts`), and a source-level check of the scene list); test modules must import nothing from the DOM. There is no lint or CI; do not invent any.

## Project rules

- **No image assets.** Everything is drawn in code into an indexed framebuffer with a palette. Do not add images or sprite files (exception: the approved app icons and manifest in `public/`).
- **Weather** comes only from Open-Meteo (no API key). Never simulate or randomize weather: when a fetch fails, show the last real reading for that city marked stale, or "clima indisponível" over a neutral sky (rules in `src/sky/weather-feed.ts`, tested in `test/weather-feed.test.ts`). `#wx=` is a test override and must stay labelled as one.
- **Music** is streamed from the Internet Archive under Creative Commons licenses. It is not part of the repo or its MIT license; never vendor audio files.
- **Public repo:** never commit secrets, keys or `.env` files (`.env*` is gitignored). `node_modules`, `dist`, `shots` and `.vercel` are also ignored.

## Workflow

- One feature branch per change; open a PR to `main`.
- Merge only when the owner says so.
- The coding agent is Claude Code (not Cursor): Sonnet for docs and simple tasks, Opus for app code.
