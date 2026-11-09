---
name: create-scenario
description: >-
  Use when someone supplies reference photos of a place and wants a faithful,
  interactive pixel-art scene added to LofiCity (or an existing scene improved),
  integrated with the app's real clock, live weather, actors, traffic and taps.
---
# Create a LofiCity scene from reference photos

## Outcome
Turn the supplied photographs into a recognizable, code-drawn pixel-art scene that feels native to LofiCity: same palette and pixel scale, the city's real clock and live weather, existing actors, traffic rules, speech bubbles and HUD. Build a working scene, not a picture behind unrelated animation. The current repository and the requester's latest place-specific corrections are the source of truth. Read `AGENTS.md` first; its project rules apply throughout.

## Shared rules every scene must satisfy (mandatory)
Every scene, new or changed, meets all of these. `test/scene-rules.test.ts` enforces the checkable ones for every scene registered in `src/scenes/index.ts`; a failure there is blocking: fix the code, never weaken the test to pass.
1. **Weather only from the feed.** Read `S` (`S.wxKind`, `S.rain`, `S.snow`, `S.temp`, ...); never assign a weather field, never randomize or simulate weather or temperature, never fetch weather. An unknown reading changes nothing. `#wx=` is a labelled test override.
2. **Reactions only through the shared rules.** Umbrellas, hurrying and shelters via `actors/rain-rules.ts` (`opensUmbrella`, `pickUmbrella`, `umbrellaOpen`, `raining`, `shelterWait`); street traffic via `street-rules.ts`; depth traffic via `persp-rules.ts`; lights via `signal-rules.ts`. Use the shared pedestrian paths (`people.ts` `setLanes`, or the `persp-kit.ts` walkers); a scene with its own walkers must still take its umbrella decision from `rain-rules.ts`.
3. **Seeded randomness only**: `mulberry32` / `hashf` from `engine/math`. No `Math.random` in scenes, actors, effects or sky.
4. **Crowds and traffic from `sky/rhythm.ts`** through `S.busy` / `S.traffic`. A scene may scale them for a real event; it never keeps its own hour-by-hour crowd table or assigns them.
5. **No assets**: everything drawn in code; no image or sprite files or references (`AGENTS.md`).
6. **Facts only from the photos.** Wire a crossing, a one-way road or a traffic light only if photographed or confirmed by the requester. Do not invent buildings or features that are not in the reference photos; if the requester names an existing building, reuse that one. When unsure, ask; never guess, merge or invent.
7. **Shared hooks stay small**: extend a shared module only with a small optional parameter (default = old behaviour) so every other scene is unchanged, plus a DOM-free test.
8. **English only** for the branch, PR title/body, commits, code comments and docs; pt-BR only for in-app text.
9. **Registered and documented**: unique `id`, under exactly one city in `SCENES`, listed in the `#scene=` line of `docs/DEVELOPING.md`.

## 1. Verify references and scope
- Confirm the city (one of the `CityId`s in `src/sky/cities.ts`), the place, and whether this is a new scene or an enhancement of an existing one. Reuse what is already known instead of asking again.
- Check that every reference file opens. Keep them outside the repo for the duration of the task. **Never commit reference photos**; credit their source in `docs/DEVELOPING.md` instead.
- Look at the actual photos and inventory: composition, facade proportions, colours, recognizable architecture, signs, paving, road and sidewalk edges, zebra crossings, trees, poles, wires, benches and other street furniture, visible vehicles. Separate map overlays from real features.
- Keep three lists: what is directly observed, what the requester corrected, and what is unknown. A photo does not establish traffic direction, opening hours, service schedules or weather. Do not invent them. Ask only when a missing fact materially changes behaviour; otherwise pick a neutral artistic default and document it.
- Readable signs may be reproduced; leave unreadable lettering blank or use non-specific marks. Never invent phone numbers or business claims.

## 2. Learn the existing scene contract
Before writing code, read:
- `src/scenes/types.ts`: the `Scene` interface (`id`, pt-BR `name`, `build`, `update(dt)`, `render`, `debug`, optional `tap(x, y)` returning an emote position, an `sfx` or a `speaker`).
- `src/scenes/index.ts`: the `SCENES` table per city, `pickScene` (`#scene=<id>` pin, random otherwise) and `nextScene`.
- At least two representative scenes close to what you are building (for example `praca-matriz.ts` or `rua-faustino.ts` for an Esperança street, `acude-velho.ts` for Campina Grande, `rain-corner.ts` for Tokyo).
- Shared code: `scenes/common.ts`, `scenes/br-kit.ts` (Esperança prop kit), `scenes/persp-kit.ts` (depth/perspective roads), `scenes/signs.ts`, `engine/` (indexed framebuffer, palette, post-processing), `sky/` (clock, astronomy, weather feed, grading, `rhythm.ts`), `actors/` (pedestrians, animals, vehicles, trees, `street-rules.ts`, `persp-rules.ts`, `signal-rules.ts`, `rain-rules.ts`, `speech-rules.ts`, `phrases.ts`) and `fx/`.
- `test/scenes.test.ts` and the other tests in `test/` to see how rules are checked without a DOM.

Identify what is shared and what is genuinely scene-specific. Reuse existing facilities; do not introduce a second engine, actor system or weather path.

## 3. Write a compact scene plan
State: the scene `id` (kebab-case, unique, stable) and pt-BR display name; foreground / midground / background layers; pedestrian-safe areas; actual road geometry; vehicle directions; crossing positions; light sources; actor density (the city's rhythm in `src/sky/rhythm.ts`); tappable props and people; integration points. Fit the place into the app's camera and pixel scale, keeping landmarks and road relationships before decorative detail. Prefer scene-local settings or small shared primitives over copied systems or broad rewrites.

## 4. Draw and integrate
- Draw architecture and props in code with the framebuffer primitives and the palette. **No image or sprite files** (see `AGENTS.md`). Keep pixel edges and scale consistent with the other scenes.
- Export `export const <name>: Scene = { id: '<id>', ... }` from `src/scenes/<id>.ts` (the scene test parses this exact shape), import it in `src/scenes/index.ts` and add it to the right city in `SCENES`, after the existing ones unless asked otherwise.
- Make sure `#scene=<id>`, scene cycling and cleanup on scene change work.
- Compose for both landscape and portrait. Landmarks, roads, crossings and tap targets must stay visible around the HUD and safe areas.
- Do not change other scenes or global behaviour unless that was requested.

## 5. Give the scene coherent life
### Time and light
Use the city's real clock and the existing day / dusk / night grading (`#at=` lets you preview any time). Honour local corrections. Night must stay night: readable exposure from actual lamps, lit windows and pools of light, not a global wash. Keep shadows and lighting consistent across layers.

### Weather
Weather comes only from Open-Meteo through `src/sky/weather-feed.ts`, with its live / stale / unavailable semantics. Never set or randomize weather or temperature in a scene, and never trigger rain on your own. Umbrellas, shelters, wet surfaces and weather lines in speech must react only to real conditions (`actors/rain-rules.ts`, `actors/speech-rules.ts`). An unknown temperature must not become a made-up value. `#wx=` is a test override and stays labelled as one. Where the drawing has an awning or a bus shelter, pass it as `shelters` (`setLanes(..., { shelters })` side-on, `WalkCfg.shelters` in depth scenes) so people without an umbrella can wait out real rain; never add a shelter the drawing does not show.

### People and animals
Use the city's rhythm and bounded actor counts. Keep quiet or pedestrian-only places quiet; not every scene needs a crowd. People stay on sidewalks and valid crossings, never walking through buildings or traffic. Include supported animals where they fit. Special visits or events are documented artistic choices unless a real schedule is known.

### Roads, traffic and signals
Encode the real road edges and the confirmed direction of each road; a wide road is not automatically two-way (see `actors/matriz-road.ts` for a one-way example). Moving vehicles never enter sidewalks or plazas. Scale and orient vehicles for perspective. Keep safe headway and queues, motorcycles included, with no overlapping stopped vehicles. At zebras, vehicles stop before the line, pedestrians wait for a gap, and vehicles resume when clear. Only wire a crossing if the photo shows one. If a traffic light is requested or visible, implement real green / yellow / red phases with stop-line compliance and a pedestrian phase via `actors/signal-rules.ts`. A painted light with no effect is not done.

### Interactions and sound
Reuse the existing `tap` behaviours: emotes, synthesized SFX and pt-BR speech bubbles. Add phrases to `actors/phrases.ts` that fit the place, the hour and genuinely known weather; `speech-rules.ts` handles choice, placement and lifetime (brief, clamped to the viewport, cleared on scene change, not stealing unrelated taps). Do not introduce double-tap zoom / fullscreen regressions, autoplay, or interference with the radio. Ambient events are rare, bounded and never tied to invented weather.

## 6. Verify the real artifact
- Run `node --test test/scene-rules.test.ts` first: it discovers the new scene by itself and must pass (blocking). Then `pnpm typecheck`, `pnpm test` and `pnpm build`.
- Extend `test/scenes.test.ts` only for scene-specific facts (crossing only if photographed, one-way, schedules). Add focused tests in `test/` for any new pure rule (traffic direction, yielding, signal phases, schedules). Test modules must import nothing from the DOM.
- **Look at the screenshots yourself** before opening the PR. After the build, run `node scripts/shot.mjs <cases.json>` (env `WAIT=9000` or more so actors spawn) with at least: day, night, rain via the labelled `#wx=rain` override, and no override (live or unknown weather). Open every PNG and check: umbrellas only in the rain shot, no change with unknown weather, composition, clipping, road placement, actor paths, lighting, HUD overlap, and the references. Also check desktop and phone-portrait sizes. Do not commit screenshots.
- Watch any new crossing or signal for several cycles: stopping, pedestrians crossing, queues, resumption. Confirm every spawn respects one-way rules and no vehicle appears in a pedestrian-only scene.
- If weather reactions changed, check live weather, unavailable weather (`clima indisponível`) and a labelled `#wx=` precipitation override.
- Browser emulation is not a real-device test; say so if no real device was used.
- Do a scoped self-review and fix concrete problems without drifting into unrelated redesigns.

## 7. Document and deliver
- Update `docs/DEVELOPING.md` (the long reference; `README.md` stays a short pt-BR overview): the city's scene list, the `#scene=` id list, and credit for the reference photos. Note any artistic assumptions.
- Open a focused pull request to `main` from a feature branch (English only; never merge it yourself, never force push), with a short description, the checks you ran, the assumptions and known gaps, and a **Shared rules** list: each of the nine rules above, how you checked it (guard test, unit test, which screenshot) or why it does not apply.
- A teaser, logo or screenshot gallery is a separate deliverable unless it was part of the request.

## Extending the guard test
When a change introduces a rule every scene must follow (a new shared reaction, a new weather field, a new asset type), add it to `test/scene-rules.test.ts` in the same PR: one `test()` that collects violations with `scan(files, regex | predicate, 'rule name')` or a per-scene loop over the discovered `sceneModules`, ending with `none(violations, 'what the rule is')`, so a failure prints `file:line  [rule]  code`. Weather fields are derived from `src/sky/state.ts`, so a new field filled there is guarded without editing the test. Allowlist an exception only in that rule's `ALLOW` map, keyed by file, with the reason. Mention the new rule in the skill checklist above and in the `AGENTS.md` test list.

## Completion checklist
- References verified; recognizable layout preserved; no photos committed.
- Scene registered, reachable via `#scene=<id>` and cycling, on mobile and desktop.
- Real clock, night lighting, real-weather semantics and city rhythm integrated.
- Pedestrian areas, road directions, crossing safety and any signals behave correctly.
- Taps, bubbles and sound work without audio or input regressions.
- `test/scene-rules.test.ts`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass; day, night, `#wx=rain` and unknown-weather screenshots looked at.
- `docs/DEVELOPING.md` updated; assumptions, remaining gaps and the Shared rules list stated in the PR.
