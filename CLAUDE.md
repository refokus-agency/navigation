# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package overview

`@refokus-agency/navigation` is an ES-module-only TypeScript library with two independent features:

- **`nav-anim`** — GSAP-powered show/hide animations on elements carrying `[data-nav-menu]`.
- **`nav-menu`** — an accessible dropdown navigation menu on `[data-nav-menu]`, with hover delays, keyboard navigation, ARIA wiring, and data attributes for CSS-driven enter/exit animations. **Uses no GSAP.**

Intended for Webflow custom-code and similar embed contexts — `gsap` is an external peer dependency and is **not** bundled into the browser build.

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

Two public entries, both re-exported from `src/index.ts`.

### `initNavbarAnimation(options?)` — `src/nav-anim/index.ts`

It:

1. Queries `document` for `NAVBAR_CONFIG.selectors.navbar` (`[data-nav-menu]`). Returns `false` if none found.
2. Calls `performInitialAnimation` — a `gsap.set` to hidden (-100% Y) followed by a tween to visible.
3. Calls `initScrollBehavior` — installs a passive `scroll` listener that compares `window.scrollY` to `lastScrollY`, applying hide/show tweens once the delta exceeds `NAVBAR_CONFIG.scroll.threshold` (50px).

It also installs a `focusin` listener on `document` that calls `showNavbar` when focus lands inside a navbar element — a hidden navbar would otherwise take focus while off-screen. It is document-level rather than per-element on purpose: the existing tests pass plain object literals as "elements", so nothing may be called on them at init time.

The scroll module (`scroll-behaviour.ts`) holds **module-level singleton state** (`lastScrollY`, `isNavbarVisible`, `navbarElements`, `currentOptions`, `scrollHandlerBound`, `focusHandlerBound`). This means calling `initNavbarAnimation` twice overwrites the previous registration; `cleanupNavbarAnimation` exists but is not re-exported from the package root. Keep this in mind when changing lifecycle logic.

All animations go through `createNavbarAnimation` in `initial-animation.ts` with `overwrite: true`, so conflicting scroll-driven tweens cancel cleanly. `NAVBAR_CONFIG` in `config.ts` is the single source of truth for positions, threshold, and selector — default `NavbarAnimationOptions` (duration/easing) live separately in `nav-anim/index.ts`.

### `initNavigationMenu(rootOrSelector?, options?)` — `src/nav-menu/index.ts`

Unlike `nav-anim`, this module holds **no singleton state** — each call returns
an independent `{ open, close, destroy }` instance, so multiple menus can
coexist on a page. `destroy()` must tear down everything, which is why every
module receives the shared `cleanups: NavMenuCleanup[]` array via
`NavMenuContext` and pushes its own teardown onto it.

`index.ts` does discovery and ARIA only, then delegates:

- `controller.ts` — the open/closed state machine and **all** timers
  (`openTimer`, `closeTimer`, `skipTimer`). It never touches the DOM; it calls
  `renderer.applyState`. The per-trigger `wasClickClose` / `wasEscapeClose`
  flags are what stop a click- or Escape-closed panel from instantly
  re-opening under a stationary cursor — they reset on `pointerleave`.
- `render.ts` — the only module that writes DOM state. It **animates nothing**:
  it sets `[data-state]`, `[data-motion]`, `--nav-viewport-{width,height}` and
  inline `display`, and CSS owns the transitions. `hideAfterAnimation` keeps a
  closing element mounted until its CSS `animationend`, falling back to
  immediate cleanup when `animationName` is `none` — so exit animations are
  optional, not required. Whether a viewport mount skips the size transition is
  decided by the renderer's own `isViewportOpen` flag, **never** by reading back
  `style.display`: display only flips once the exit animation ends, so sniffing
  it made a reopen inside that window animate from the stale size — invisible to
  mouse users (hover delay) and constant for keyboard users (`Enter` is
  instant). `render.test.ts` covers both directions.
- `pointer.ts`, `keyboard.ts`, `mobile.ts` — event layers. They read state
  through the controller and never mutate the DOM directly.

`keyboard.ts` implements the WAI-ARIA **Disclosure Navigation** pattern, not
the menubar pattern: triggers are ordinary tab stops and `Tab` is the primary
traversal. Because a panel inside `[data-nav-viewport]` is not a DOM sibling of
its trigger, `handleTab` intercepts `Tab`/`Shift+Tab` and drives the logical
order (trigger → its open panel → next nav stop), falling back to native
behaviour whenever it should not interfere. Panels never open on focus alone —
that was a deliberate product decision, since auto-opening drags anyone
tabbing toward the page content through every panel. Arrow keys, `Home` and
`End` are secondary and gated on a **trigger** having focus, so keys typed
inside a panel stay native. `render.ts` sets `inert` on closed panels so a
panel mid-exit-animation cannot be tabbed into.

`sizeViewport` measures the active panel's `scrollWidth`/`scrollHeight`, which
means the panel must carry no imposed size. If consumer CSS gives it one
(`inset: 0`, `height: 100%`), the measurement is circular — the panel is
stretched to the viewport whose size came from the panel — and it both settles
on the tallest panel and makes the `ResizeObserver` chase the size transition
frame by frame. This is a CSS contract, documented in the README's "Sizing
rule"; the library cannot detect it, and a redundant-write guard does not help
(setting an identical custom property is already a no-op).

`NAV_MENU_CONFIG` in `nav-menu/config.ts` owns selectors, attribute names, the
150ms close delay, the mobile breakpoint and the `w-editor` marker. Default
`NavMenuOptions` (hover delays, orientation, dir, editor skip) live in
`nav-menu/index.ts`, mirroring the `nav-anim` split.

Attributes fall into two groups, and the distinction matters:

- **Inputs** — `data-nav-menu`, `data-nav-list`, `data-nav-item`,
  `data-nav-trigger`, `data-nav-content`, `data-nav-viewport`, `data-nav-link`,
  `data-nav-back`. Changing one is a breaking change for every consumer.
- **Outputs** — `data-state`, `data-motion`, `data-orientation`,
  `data-nav-mode`, `--nav-viewport-{width,height}`. Consumer CSS keys off these.

The nav root selector is shared, not duplicated: `NAV_ROOT_SELECTOR` in
`src/config.ts` is the single source of truth and **both** feature configs
reference it, so one `<nav data-nav-menu>` can run both features. `src/__tests__/
config.test.ts` guards that invariant — if you fork the selector per feature,
that test fails.

The `data-nav-*` names are verbatim from the Toggl and Relocity
implementations, so those sites can adopt the package without editing Webflow
markup. Do **not** rename them to an `r-` prefix.

`skipInWebflowEditor` (default `true`) makes the whole feature no-op when
`html.w-editor` is present, so panels stay editable in the Designer canvas.

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

Consumers add `data-nav-menu` to their markup and call `initNavbarAnimation({ animationDuration?, animationEasing? })`. The selector comes from `NAV_ROOT_SELECTOR` — changing it is a breaking change for every consumer.

> `nav-anim` selected `[r-navbar]` up to and including the last release. It was
> unified onto `[data-nav-menu]` so a single element drives both features; that
> was a **breaking** change and shipped as a major bump.

For the dropdown menu, consumers mark up `data-nav-menu` / `data-nav-list` /
`data-nav-item` / `data-nav-trigger` / `data-nav-content` (plus optional
`data-nav-viewport`, `data-nav-link`, `data-nav-back`) and call `initNavigationMenu()`.
The package ships **no CSS** — consumers style the `data-*` hooks themselves.
See the README's "Accessible Dropdown Menu" section for the full contract.
