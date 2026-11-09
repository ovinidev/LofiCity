# Contributing to LofiCity

Thanks for helping. LofiCity is a small TypeScript + Vite app. Read `AGENTS.md` for the structure and project rules, and [docs/DEVELOPING.md](docs/DEVELOPING.md) for the cities, URL options and keys (`README.md` is the short pt-BR overview).

## How to contribute

1. Fork the repo and create a feature branch from `main`, one change per branch.
2. Make your change. To add a new scene, follow the [create-scenario skill](.claude/skills/create-scenario/SKILL.md). It walks through the scene API, registration, developer guide, tests and the screenshot check.
3. Run the checks (Node >= 22.18, pnpm):
   ```bash
   pnpm install
   pnpm typecheck
   pnpm test
   pnpm build
   ```
   For visual changes, run `pnpm shot` after the build and look at `./shots`. Don't commit the screenshots.
4. Open a pull request to `main` with a short description, the checks you ran and any assumptions (for example, details drawn as art direction rather than from a source).

## Ground rules

- No image assets: everything is drawn in code.
- Weather comes only from Open-Meteo. Never simulate it.
- Music is streamed from the Internet Archive. Never add audio files.
- Reference photos are for reference only and are never committed. Credit the source in `docs/DEVELOPING.md`.
- Never commit secrets, keys or `.env` files.
