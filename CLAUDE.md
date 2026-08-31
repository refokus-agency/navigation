# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package overview

`@refokus-agency/navigation` is an ES-module-only TypeScript library that attaches GSAP-powered show/hide animations to elements carrying the `[r-navbar]` attribute. Intended for Webflow custom-code and similar embed contexts — `gsap` is an external peer dependency and is **not** bundled into the browser build.

## Commands

```bash
pnpm install            # install (pnpm is the canonical lockfile; npm also works)
pnpm test               # vitest run (jsdom env, globals enabled)
pnpm test:watch         # vitest watch
vitest run path/to/file.test.ts   # run a single test file
pnpm check-types        # tsc --noEmit --strict
pnpm lint               # biome lint --write ./src
pnpm lint:report        # biome lint ./src (no fixes, CI-safe check)
pnpm format             # biome format --write ./src
pnpm build              # tsc (types + esm) then vite build (browser bundle)
pnpm build:clean        # rimraf dist + full rebuild
pnpm commit             # commitizen — REQUIRED for commits (see Releases below)
```

Node >= 22 is required (see `.nvmrc` / `engines`).

## Architecture

Single public entry: `initNavbarAnimation(options?)` in `src/nav-anim/index.ts`. It:

1. Queries `document` for `NAVBAR_CONFIG.selectors.navbar` (`[r-navbar]`). Returns `false` if none found.
2. Calls `performInitialAnimation` — a `gsap.set` to hidden (-100% Y) followed by a tween to visible.
3. Calls `initScrollBehavior` — installs a passive `scroll` listener that compares `window.scrollY` to `lastScrollY`, applying hide/show tweens once the delta exceeds `NAVBAR_CONFIG.scroll.threshold` (50px).

It also installs a `focusin` listener on `document` that calls `showNavbar` when focus lands inside a navbar element — a hidden navbar would otherwise take focus while off-screen. It is document-level rather than per-element on purpose: the existing tests pass plain object literals as "elements", so nothing may be called on them at init time.

The scroll module (`scroll-behaviour.ts`) holds **module-level singleton state** (`lastScrollY`, `isNavbarVisible`, `navbarElements`, `currentOptions`, `scrollHandlerBound`, `focusHandlerBound`). This means calling `initNavbarAnimation` twice overwrites the previous registration; `cleanupNavbarAnimation` exists but is not re-exported from the package root. Keep this in mind when changing lifecycle logic.

All animations go through `createNavbarAnimation` in `initial-animation.ts` with `overwrite: true`, so conflicting scroll-driven tweens cancel cleanly. `NAVBAR_CONFIG` in `config.ts` is the single source of truth for positions, threshold, and selector — default `NavbarAnimationOptions` (duration/easing) live separately in `nav-anim/index.ts`.

## Build outputs

`pnpm build` produces two artifact sets in `dist/`:

- **tsc output**: `.js` + `.d.ts` + source maps from `tsconfig.json` (extends `@total-typescript/tsconfig/bundler`, `rootDir: src`, `outDir: dist`).
- **vite lib build** (`vite.config.ts`): `navigation.browser.js`, ESM only, with `gsap` marked `external`. `emptyOutDir: false` so the vite step does not wipe the tsc output.

Any new entry point must be added to both `src/index.ts` re-exports and considered for the `exports` map in `package.json`.

## Releases & commits

Releases are **fully automated** by `refokus-agency/platform`'s reusable workflows:

- `.github/workflows/pr-ci.yml` — calls `platform/.github/workflows/ci.yml` on PRs (lint + typecheck + test + build).
- `.github/workflows/main-release.yml` — calls `ci.yml` then `release.yml` on push to `main`, which runs semantic-release and publishes to GitHub Packages under `@refokus-agency`.

Do not `npm publish` manually. Do not bump `package.json` version manually — `version` is pinned to `0.0.0-development` and semantic-release sets it at publish time.

Commits **must** follow Conventional Commits (`feat:`, `fix:`, `feat!:` / `BREAKING CHANGE:`). Use `pnpm commit` (Commitizen) to stay compliant — the version bump semantic-release picks depends entirely on commit types.

## Usage contract

Consumers add `r-navbar` to their markup and call `initNavbarAnimation({ animationDuration?, animationEasing? })`. The selector is fixed by `NAVBAR_CONFIG` — changing it is a breaking change for every consumer.
