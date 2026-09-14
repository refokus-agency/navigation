# CLAUDE.md

## Package

`@refokus-agency/navigation` — ESM-only TypeScript, two independent features for
Webflow custom-code embeds. `gsap` is a peer dep, never bundled.

- **`nav-anim`** (`initNavbarAnimation`) — GSAP scroll show/hide. Uses GSAP.
- **`nav-menu`** (`initNavigationMenu`) — accessible dropdown. **No GSAP**, no CSS
  shipped; it writes data attributes and consumer CSS animates them.

## Commands

```bash
pnpm test           # vitest run (jsdom)
pnpm check-types    # tsc --noEmit --strict
pnpm lint:report    # biome, no writes (CI-safe)
pnpm format         # biome --write
pnpm build          # tsc, then vite browser bundle
pnpm example        # build + open docs/examples/local/
pnpm commit         # commitizen — required for commits
```

Node >= 22.

## Non-obvious invariants

**One nav root selector.** `NAV_ROOT_SELECTOR` in `src/config.ts` is the single
source of truth; both feature configs reference it so one `<nav data-nav-menu>`
drives both. `src/__tests__/config.test.ts` fails if they fork.

**Never rename the `data-nav-*` inputs** (`menu`, `list`, `item`, `trigger`,
`content`, `viewport`, `link`, `back`). They are verbatim from the Toggl and
Relocity implementations so those sites adopt the package without editing
Webflow markup. Outputs consumer CSS depends on: `data-state`, `data-motion`,
`data-orientation`, `data-nav-mode`, `--nav-viewport-{width,height}`.

**`nav-anim` holds module-level singleton state** in `scroll-behaviour.ts`, so a
second `initNavbarAnimation` call overwrites the first. `cleanupNavbarAnimation`
is not exported from the package root.

**`nav-menu` holds none** — each call returns an independent
`{ open, close, destroy }`. Every teardown goes onto the shared `cleanups`
array, the controller's included, so `destroy()` is just draining that array
and nothing can be forgotten. (`index.ts` owns a module-level instance counter,
used only to keep generated ids unique across roots.)

**`render.ts` is the only module that writes *reactive* DOM state**, and it
animates nothing. Two deliberate exceptions: `setupAria` in `index.ts` writes
the ARIA wiring once at init, and `mobile.ts` writes `[data-nav-mode]`, which
tracks the breakpoint rather than the open/closed state.

Whether a viewport mount skips the size transition comes from the renderer's
own `isViewportOpen` flag — **never** from reading back `style.display`, which only
flips when the exit animation ends (a reopen inside that window then sized from
a stale value; constant via `Enter`, invisible via hover).

**Panels must carry no imposed size.** `sizeViewport` measures the active
panel's `scrollWidth`/`scrollHeight`, so consumer `inset: 0` or `height: 100%`
makes it circular — it settles on the tallest panel and the `ResizeObserver`
chases the transition. CSS contract, documented in the README's "Sizing rule";
the library cannot detect it.

**Keyboard is WAI-ARIA Disclosure Navigation, not menubar.** `Tab` is primary
and `handleTab` drives the logical order (trigger → its open panel → next nav
stop), since a panel in the viewport is not a DOM sibling of its trigger.
Panels never open on focus alone — deliberate, or tabbing to page content drags
you through every panel. Arrows/`Home`/`End` are secondary and gated on a
**trigger** having focus. Closed panels get `inert`.

`skipInWebflowEditor` (default `true`) no-ops the menu when `html.w-editor` is
present, so panels stay editable in the Designer.

## Build & release

`pnpm build` emits two sets into `dist/`: tsc `.js`/`.d.ts`, then vite's
`navigation.browser.js` (ESM, `gsap` external, `emptyOutDir: false`). A new
entry point needs adding to `src/index.ts` and the `exports` map.

Releases are fully automated by `refokus-agency/platform` reusable workflows.
Never `npm publish` or bump `version` (pinned to `0.0.0-development`) by hand.
Commits must be Conventional Commits — the bump depends on the type.
