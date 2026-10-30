---
issue_number: 77
issue_title: "Open nav link dropdown via click vs. hover"
repo: "refokus-agency/navigation"
labels: [enhancement]
plan_level: "standard"
depth: "medium"
branch_name: "feat/77-open-nav-link-dropdown-via-click-vs-hover"
created_at: "2026-10-30T00:00:00Z"
updated_at: "2026-10-30T13:10:00Z"
---

# Implementation Plan: #77 — Open nav link dropdown via click vs. hover

## Files

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | modify | `src/nav-menu/types.ts` | `NavMenuInteraction` type, `interaction` option, `options` on `NavMenuContext` |
| 2 | modify | `src/nav-menu/config.ts` | `attributes.interaction = 'data-nav-interaction'` |
| 3 | modify | `src/nav-menu/index.ts` | Default `'hover'`, `resolveInteraction()`, options into context, type re-export |
| 4 | modify | `src/index.ts` | Re-export `NavMenuInteraction` from the package root |
| 5 | modify | `src/nav-menu/pointer.ts` | Attach hover listeners only in `'hover'` mode |
| 6 | create | `src/nav-menu/__tests__/interaction.test.ts` | Resolution and click-mode behavior tests |
| 7 | modify | `README.md` | Attribute table, options table, interaction model |
| 8 | ~~modify (optional)~~ not needed | `src/nav-menu/__tests__/helpers.ts` | Not modified — tests set the attribute with `setAttribute` through a local `init()` helper |

## Codebase Context

- Options are resolved as `{ ...DEFAULT_OPTIONS, ...options }` (`src/nav-menu/index.ts:51`). No option is read from a data attribute today; this is the first.
- Hover: `pointerenter`/`pointerleave` on triggers plus the viewport / out-of-viewport panels, all gated by `isMouseHover` (`src/nav-menu/pointer.ts:15-72`).
- Click toggles through `controller.triggerClick` (`src/nav-menu/controller.ts:96-105`); unchanged.
- Keyboard (Enter/Space/Escape/Tab/arrows) is pointer-independent (`src/nav-menu/keyboard.ts`); untouched.
- Dismiss (outside `pointerdown`/`focusin`) and link-click close are mode-independent (`src/nav-menu/pointer.ts:75-121`).
- Mobile/touch is already click-only via `isMouseHover` (`navMode === 'mobile'` or non-mouse pointer).
- CLAUDE.md: never rename `data-nav-*` inputs; `render.ts` is the only reactive DOM writer; every teardown goes on `cleanups`.
- Tests: vitest + jsdom, `renderNavMenu()`, `firePointer`, `fireKey`, `stubResizeObserver`, `stubMatchMedia` in `src/nav-menu/__tests__/helpers.ts`; fake timers; assertions on `dataset.state`.

## Steps

1. ✅ **Type, option and config attribute** — add `NavMenuInteraction = 'hover' | 'click'`, the `interaction` option on `NavMenuOptions`, and `attributes.interaction = 'data-nav-interaction'` in `NAV_MENU_CONFIG` (`types.ts`, `config.ts`).
   **Done when:** `pnpm typecheck` passes with the new type and option. `DEFAULT_OPTIONS.interaction = 'hover'` landed here too, since the required option needs a default to typecheck.
2. ✅ **`resolveInteraction` + context** — `resolveInteraction(root, jsValue)` resolves attribute → JS option → `'hover'`, exact match only, read once at init. Write the result into `resolvedOptions.interaction`; add `options` to `NavMenuContext` (`index.ts`, `types.ts`).
   **Done when:** resolution tests for all 7 resolution cases pass.
3. ✅ **Gate hover listeners** — in `attachPointerEvents`, skip all four hover listeners (trigger enter/leave, content enter/leave) when `interaction === 'click'`; the click listener is always attached (`pointer.ts`).
   **Done when:** in click mode, a mouse `pointerenter` on a trigger leaves `data-state="closed"` after `delayDuration`. Implemented inside AC-1's lap (AC-1 is only observable through the gating): trigger hover listeners sit behind `if (hover)`, and an early `if (!hover) return;` skips the content hover targets.
4. ✅ **Click-mode behavior tests** — toggle, stays open on pointer leave, outside click, Escape, link click, focus out, trigger switch, keyboard Enter/Space (`interaction.test.ts`).
   **Done when:** every one of AC-4 to AC-9 has a passing test.
5. ✅ **Root re-export** — re-export `NavMenuInteraction` (`src/nav-menu/index.ts`, `src/index.ts`).
   **Done when:** `import type { NavMenuInteraction } from '@refokus-agency/navigation'` typechecks.
6. ✅ **README** — document the attribute, the option, the precedence and click-mode behavior.
   **Done when:** the README attribute table, options table and Interaction model section mention `data-nav-interaction`.

## Step Coverage

| # | Step | ACs | Kind |
|---|------|-----|------|
| 1 | Type, option and config attribute | none | no-criterion |
| 2 | `resolveInteraction` + context | AC-1, AC-2, AC-3, AC-10 | criterion-driven |
| 3 | Gate hover listeners | AC-4, AC-5, AC-7 | criterion-driven |
| 4 | Click-mode behavior tests | AC-6, AC-8, AC-9 | criterion-driven |
| 5 | Root re-export | none | no-criterion |
| 6 | README | none | no-criterion |

## Interfaces

```ts
export type NavMenuInteraction = 'hover' | 'click';

export type NavMenuOptions = {
  // ...existing fields
  /** What opens a panel with the mouse. Overridden by `data-nav-interaction` on the root. */
  interaction: NavMenuInteraction; // default 'hover'
};

export type NavMenuContext = {
  root: HTMLElement;
  refs: NavMenuRefs;
  controller: NavMenuController;
  cleanups: NavMenuCleanup[];
  options: NavMenuOptions;
};
```

## Function Design

- `src/nav-menu/index.ts`: `resolveInteraction(root: HTMLElement, jsValue: unknown): NavMenuInteraction` — pure resolution only (attribute → JS option → default). Takes `unknown` because browser-bundle callers are untyped.
- `src/nav-menu/pointer.ts`: `attachPointerEvents` — unchanged concern; the hover branch is guarded by `options.interaction`.

## Acceptance Criteria (EARS)

- **AC-1.** The nav menu shall read `data-nav-interaction` from the root `[data-nav-menu]` element once, at init.
- **AC-2.** When the attribute is `"hover"` or `"click"`, the menu shall use that mode, regardless of the JS `interaction` option.
- **AC-3.** If the attribute is missing or not exactly `"hover"`/`"click"`, then the menu shall use the JS `interaction` option if it is valid, else `"hover"`.
- **AC-4.** While in hover mode, the menu shall behave as today: mouse hover opens a panel and click toggles it.
- **AC-5.** While in click mode, when a mouse hovers a trigger, the menu shall not open its panel.
- **AC-6.** While in click mode, when a trigger is clicked, the menu shall toggle its panel (open if closed, close if open; switch if another panel is open).
- **AC-7.** While in click mode, when the pointer leaves the trigger or panel, the menu shall keep the panel open.
- **AC-8.** While in click mode, the menu shall close an open panel on outside click, Escape, link click inside the panel, or focus leaving the nav.
- **AC-9.** The menu shall handle keyboard (Enter/Space/Escape/Tab/arrows) identically in both modes.
- **AC-10.** If the attribute changes after init, then the menu shall keep the mode resolved at init.

## Out of Scope

- Per-item / per-trigger mode (one mode per navbar).
- Live reaction to attribute changes after init.
- Case-insensitive or trimmed values (`"Click"` is invalid).
- A new output attribute / CSS hook exposing the active mode; `nav-anim` is untouched.

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
|---|----------|--------|----------|
| 1 | Attribute `"click"`, JS `'hover'` | [from issue] | Attribute wins → click |
| 2 | Attribute `"tap"` / `""` / `"Click"`, JS `'click'` | [from issue] | Falls through → click |
| 3 | Invalid attribute, no/invalid JS value (browser bundle) | [from issue] | → hover |
| 4 | Attribute changed post-init | [from issue] | Ignored |
| 5 | Click mode on mobile / touch | [inferred] | Unchanged — hover already off there |
| 6 | Click mode, click on another trigger while one is open | [from issue] | Switches panel |
| 7 | Two roots on one page with different attributes | [inferred] | Each resolves independently |
| 8 | Click mode, pending hover timers | [inferred] | No hover listeners → no hover timers are ever scheduled |
| 9 | `interaction: undefined` passed explicitly (spread overrides the default) | [discovered during implementation] | `resolveInteraction` validates the merged value, so `undefined` falls through to `hover` |

Note: `[from issue]` rows were decided in the discovery session on top of the issue body.

## Done Criteria per Feature

| Feature | Done when |
|---------|-----------|
| Mode resolution | AC-1, AC-2, AC-3, AC-10 |
| Click mode | AC-5, AC-6, AC-7, AC-8, AC-9 |
| Hover-mode backwards compatibility | AC-4 (existing pointer/keyboard tests stay green, unchanged) |

## Risks

- `NavMenuContext` gains `options` → existing tests that build a context break → update those fixtures in the same step. *Did not materialize: no test builds a `NavMenuContext` directly.*
- Browser-bundle users pass arbitrary JS values → `resolveInteraction` takes `unknown` and validates.
- Webflow authors type `"Click"` → exact values documented in the README.
- No runtime-generated files are introduced; no `.gitignore` change needed.
- Most ACs describe preserved or derived behavior, so their tests pass on first run (Reds = 0) → the user accepted them as regression tests; a mutation check (hover listeners forced on) turns 9 of 28 interaction tests red, proving the click-mode tests are not vacuous. [discovered during implementation]
- `biome check src` reports a pre-existing import-order error in `src/nav-menu/__tests__/review.test.ts` and a biome schema version mismatch; both untouched by this change. `pnpm lint:report` exits 0. [discovered during implementation]

## Test Strategy

- vitest + jsdom, black-box through `initNavigationMenu()` using `renderNavMenu()` and `root.setAttribute('data-nav-interaction', …)` before init.
- `firePointer` / `fireKey` helpers; fake timers advanced past `delayDuration` + `closeDelay`; assertions on `dataset.state`.
- RED first per AC. Existing `pointer.test.ts` and `keyboard.test.ts` act as the hover-mode regression suite.
- Close with `pnpm test && pnpm typecheck && pnpm lint:report`.
- Actual: `src/nav-menu/__tests__/interaction.test.ts` holds 28 tests (resolution tables via `it.each`, keyboard via `describe.each` over both modes). Full suite 152/152 passed, typecheck clean, `lint:report` exit 0.

## TDD Report

| AC | Test | Reds | Last state | Note |
|----|------|------|------------|------|
| AC-1 | `interaction mode resolution > should read data-nav-interaction from the root at init` | 1 | green | |
| AC-2 | `interaction mode resolution > should let attribute "%s" override the JS option "%s"` | 0 | green | Passed on first run: AC-1's minimal resolver already ignored the JS option. Accepted as regression by the user. |
| AC-3 | `interaction mode resolution > should fall back from attribute %j to the JS option %j` | 1 | green | |
| AC-4 | `hover mode > should open on hover and toggle on click, as before` | 0 | green | Existing behavior; regression test, accepted by the user. Existing `pointer.test.ts` / `keyboard.test.ts` stay green and unchanged. |
| AC-5 | `click mode > should not open a panel on mouse hover` | 0 | green | Covered by the AC-1 gating; accepted by the user. Mutation (hover listeners forced on) turns it red. |
| AC-6 | `click mode > should toggle a panel on trigger click`, `should switch panels when another trigger is clicked` | 0 | green | Existing click behavior; accepted by the user. |
| AC-7 | `click mode > should keep the panel open when the pointer leaves` | 0 | green | Covered by the AC-1 gating; accepted by the user. Mutation turns it red. |
| AC-8 | `click mode > should close on an outside click / on Escape / on a link click inside the panel / when focus leaves the nav` | 0 | green | Mode-independent dismiss; accepted by the user. |
| AC-9 | `keyboard in %s mode > Enter/Space, Escape, Tab, arrows` | 0 | green | Keyboard is pointer-independent; accepted by the user. |
| AC-10 | `read once at init > should keep "%s" after the attribute changes to "%s"` | 0 | green | Read-once falls out of init-time resolution; accepted by the user. Mutation turns the click case red. |
