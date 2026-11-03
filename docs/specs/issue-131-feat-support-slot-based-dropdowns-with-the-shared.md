---
issue_number: 131
issue_title: "feat: support slot-based dropdowns with the shared viewport"
repo: "refokus-agency/navigation"
labels: [enhancement]
plan_level: "full"
depth: "medium"
branch_name: "feat/131-support-slot-based-dropdowns-with-the-shared-viewport"
created_at: "2026-11-02T19:13:12Z"
updated_at: "2026-11-02T20:40:00Z"
---

# Implementation Plan: #131 — feat: support slot-based dropdowns with the shared viewport

## Files

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | modify | `src/nav-menu/index.ts` | Add `relocatePanels` and owned-panel lookup in `discoverRefs`; push the restore onto `cleanups` |
| 2 | create | `src/nav-menu/__tests__/slots.test.ts` | Slot-markup behavior tests |
| 3 | modify | `src/nav-menu/__tests__/helpers.ts` | Add `renderSlotNavMenu(values)` (panels inside items, empty viewport) |
| 4 | modify | `README.md` | Rewrite the panel-location paragraph (L139-141), add the CSS caveat near CSS hooks (L183-214), add a breaking-change note |
| 5 | modify | `CLAUDE.md` | Add a third exception (init-time structural move) to the render.ts rule (L48-51) |
| 6 | modify | `src/nav-menu/__tests__/review.test.ts` | [added during implementation] "a panel outside the viewport" now covers the no-viewport case; the old viewport-plus-item-panel layout is the breaking change |
| 7 | modify | `src/nav-menu/pointer.ts` | [added during implementation] Comment only: panels outside the viewport now exist only when there is no viewport |

## Codebase Context

- `discoverRefs` (`src/nav-menu/index.ts:94-156`) resolves item values as `data-nav-item || item-${index}` (index counts all `[data-nav-item]`, trigger-less included) and looks content up viewport-first (`indexViewportContents`), then inside the item. Relocation reuses its `contentMap`, so the values stay identical.
- Trigger-less items are skipped at `index.ts:120`, so they never enter `contentMap` and are never moved.
- The trigger-ownership filter (`index.ts:111-119`, `closest(content) === null`) runs before any move, so a trigger inside a panel stays excluded.
- The `skipInWebflowEditor` early return (`index.ts:53-58`) comes before discovery, so the Designer no-op needs no extra code.
- `cleanups` is created after discovery (`index.ts:70`) and runs in push order (`index.ts:88-90`). Pushing the restore last puts panels back after every other teardown.
- `render.ts` (`sizeViewport`, `observeResize`), `pointer.ts` and `keyboard.ts` look panels up through `refs.contentMap`, not by DOM position. `pointer.ts:45-52` already handles panels outside the viewport. No changes are needed there.
- CLAUDE.md: every teardown goes on the shared `cleanups` array, and `render.ts` is the only module that writes reactive DOM state (exceptions: `setupAria`, `mobile.ts` `[data-nav-mode]`). The move is structural and happens once at init, so it becomes a documented third exception.
- Test style (`src/nav-menu/__tests__/index.test.ts`): `beforeEach` calls `stubResizeObserver`; `afterEach` calls `unstubAllGlobals`, clears `documentElement.className` and empties `body.innerHTML`. Tests are named "should …". Helpers `firePointer`, `fireKey` and `stubMatchMedia` live in `helpers.ts`.

## Steps

1. ✅ **Add `renderSlotNavMenu` helper** → `src/nav-menu/__tests__/helpers.ts`
   **Done when:** it returns `{root, trigger(v), content(v), viewport}` for markup where each panel is inside its item and the viewport is empty.
2. ✅ **Owned-panel lookup** → `src/nav-menu/index.ts`. An item takes the first `[data-nav-content]` whose `closest(item) === item` (viewport panel with the same value still wins).
   **Done when:** a test asserts a nested item's panel is never assigned to the outer item, and it passes.
3. ✅ **`relocatePanels(refs)`** → `src/nav-menu/index.ts`. For each `contentMap` panel not already inside `refs.viewport`, record `{panel, parent, nextSibling}` and append it to the viewport in `itemValues` order. Return a restore function that iterates in reverse and calls `parent.insertBefore(panel, nextSibling)`. No viewport means no move.
   **Done when:** the AC-1, AC-2, AC-6 and AC-8 tests pass.
4. ✅ **Wire into init/destroy** → `src/nav-menu/index.ts`. Call `relocatePanels` right after `discoverRefs`, and push its restore as the last entry of `cleanups`.
   **Done when:** after `destroy()`, `root.innerHTML` minus the attributes written at init matches the pre-init markup (parent and sibling order), and the AC-7 test passes.
5. ✅ **Behavior parity tests** → `src/nav-menu/__tests__/slots.test.ts`. Cover open, sizing vars, Tab order, arrows, inert and mobile back on slot markup.
   **Done when:** the AC-3, AC-4 and AC-5 tests pass.
6. ✅ **Docs** → `README.md`, `CLAUDE.md`.
   **Done when:** the README states the move, the descendant-selector caveat, the Designer behavior and the breaking change, and CLAUDE.md lists the structural-move exception.

## Step Coverage

| # | Step | ACs | Kind |
|---|------|-----|------|
| 1 | Add `renderSlotNavMenu` helper | none | no-criterion |
| 2 | Owned-panel lookup | AC-1, AC-6 | criterion-driven |
| 3 | `relocatePanels(refs)` | AC-1, AC-2, AC-6, AC-8 | criterion-driven |
| 4 | Wire into init/destroy | AC-7 | criterion-driven |
| 5 | Behavior parity tests | AC-3, AC-4, AC-5 | criterion-driven |
| 6 | Docs | none | no-criterion |

## Interfaces

```ts
/** Where a relocated panel came from, so destroy() can put it back. Module-private. */
interface PanelOrigin {
  panel: HTMLElement;
  parent: Node;
  nextSibling: Node | null;
}
```

## Function Design

- `src/nav-menu/index.ts`: `relocatePanels(refs: NavMenuRefs): NavMenuCleanup` moves panels into the viewport and returns the restore. One concern: the structural move and its undo.
- `src/nav-menu/index.ts`: `findOwnedContent(item: HTMLElement): HTMLElement | null` returns the item's first owned panel. One concern: ownership.

## Acceptance Criteria (EARS)

- **AC-1.** When the menu initializes with a `[data-nav-viewport]` and a panel inside its `[data-nav-item]`, the system shall move that panel into the viewport, paired with its item's value (auto-generated `item-{index}` values included).
- **AC-2.** When a slot-based trigger is activated, the system shall open the panel bound to that trigger's item.
- **AC-3.** While a relocated panel is active, the system shall set `--nav-viewport-width` and `--nav-viewport-height` exactly as for a hand-authored viewport panel.
- **AC-4.** The system shall give relocated panels the same keyboard behavior as hand-authored viewport panels: Tab goes trigger → its open panel → next nav stop, panels never open on focus alone, arrows/Home/End act only from a trigger, and closed panels are `inert`.
- **AC-5.** While in mobile mode, when a relocated panel opens, the system shall overlay the default menu, and `data-nav-back` shall return to the menu.
- **AC-6.** When an item holds two owned panels, the system shall use and relocate only the first, and leave the second in place.
- **AC-7.** When `destroy()` is called, the system shall put each relocated panel back under its original parent, before its original next sibling.
- **AC-8.** If the Webflow editor is active with `skipInWebflowEditor` enabled, or no `[data-nav-viewport]` exists, then the system shall move no panel.

## Out of Scope

- The Webflow components themselves (Navbar Base, Nav Link, Nav Dropdown).
- Any site script or CDN loading: projects install the package with npm and initialize it in their own repo.
- Behavior config via root attributes (#130).
- Restoring the `data-nav-item` / `data-nav-content` values written at init (today's behavior, unchanged).

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
|---|----------|--------|----------|
| 1 | Nav Dropdown with no panel | [from issue] | Silent (user decision): nothing moves, no `aria-expanded`, never opens, nothing logged |
| 2 | Nav Dropdown with two panels | [from issue] | First owned panel used and relocated; second left untouched |
| 3 | Viewport already holds a panel with the same value | [inferred] | Viewport panel wins (today's precedence); the item panel does not move |
| 4 | Item with no owned trigger | [inferred] | Not in `contentMap`, so its panel does not move |
| 5 | Nested item inside an item | [inferred] | Each panel goes only to its nearest item (`closest(item) === item`) |
| 6 | Recorded `nextSibling` is another moved panel | [inferred] | Restore in reverse order, so the original order comes back |
| 7 | Multiple roots on the page | [inferred] | Each instance relocates within its own viewport and restores independently |
| 8 | No viewport | [inferred] | No move; panels work in place as today |
| 9 | Existing test expected a panel to stay in its item while a viewport exists | [discovered during implementation] | That layout is the breaking change; the test was repointed at the no-viewport case, which still exercises `pointer.ts`'s outside-viewport hover target |

## Done Criteria per Feature

| Feature | Done when |
|---------|-----------|
| Panel relocation | AC-1, AC-2, AC-6, AC-8 |
| Behavior parity | AC-3, AC-4, AC-5 |
| Teardown | AC-7 |

## Risks

- **Breaking change** for sites with a viewport AND panels inside items. Mitigation: commit as `feat!` with a `BREAKING CHANGE:` footer, add a README note, and keep those sites pinned to the current version.
- **Consumer CSS** that targets the panel as a descendant of its item (`.dropdown .panel`) stops matching on the published site; in the Designer it still matches. Mitigation: documented in the README; the library cannot detect it.
- **Imposed panel size** inside the viewport makes sizing circular. Mitigation: the existing README "Sizing rule" applies; cross-link it from the new caveat.
- **Existing tests encoding the old layout** (materialized): `review.test.ts` › a panel outside the viewport failed by design. Mitigation: repointed at the no-viewport case.
- **Runtime artifacts:** none generated; `.cothinker/` is already gitignored.

## Test Strategy

Black-box tests through `initNavigationMenu` on slot markup in jsdom (vitest), in `src/nav-menu/__tests__/slots.test.ts`:

- DOM location after init: panel in the viewport, value paired, auto-generated `item-{index}` values included.
- Open state per trigger (pointer and keyboard).
- Sizing vars with stubbed `scrollWidth` / `scrollHeight`.
- Tab, arrow and `inert` behavior, reusing `fireKey` and the `tab.test.ts` patterns.
- Mobile back, via `stubMatchMedia`.
- An exact restore of the DOM after `destroy()`.
- No-move cases: editor class, no viewport, no panel, second panel, and a viewport panel with the same value.

Run `pnpm test`, `pnpm typecheck` and `pnpm lint:report`.

**Actual results:** 130/130 tests pass, typecheck clean. Tests for AC-2, AC-3, AC-4, AC-5 and AC-8 (and the viewport-precedence case) passed on their first run, since every module resolves panels through `contentMap`; the user chose to remove them rather than keep them as regression tests. `slots.test.ts` keeps AC-1, AC-6 and AC-7 coverage. Biome reports two findings that already exist on the base (the `biome.json` schema version and the import order in `review.test.ts`), none in changed code.

## TDD Report

| AC | Test | Reds | Last state | Note |
|----|------|------|------------|------|
| AC-1 | `slots.test.ts` › panel relocation › should move each item panel into the viewport, paired with its value; should pair auto-generated item values with their moved panels | 1 | green | |
| AC-2 | | 0 | skipped | Test passed on its first run, before any code for it: panels are resolved through `contentMap`, so AC-1's relocation already satisfies it. Removed at the user's request. |
| AC-3 | | 0 | skipped | Test passed on its first run (sizing reads the panel via `contentMap`). Removed at the user's request. |
| AC-4 | | 0 | skipped | Tests passed on their first run (Tab/arrows/inert resolve panels via `contentMap`). Removed at the user's request. |
| AC-5 | | 0 | skipped | Test passed on its first run (mobile mode and `data-nav-back` are position-independent). Removed at the user's request. |
| AC-6 | `slots.test.ts` › item panel ownership › should never give a nested item panel to the outer item; should relocate only the first of two owned panels | 1 | green | The two-panel test passed on its first run after AC-1; kept because the lap had a real red. |
| AC-7 | `slots.test.ts` › destroy › should put every relocated panel back where it was authored; should restore a panel before its original next sibling | 1 | green | |
| AC-8 | | 0 | skipped | Tests passed on their first run (editor early return and no-viewport guard already in place). Removed at the user's request, together with the viewport-precedence test. |

Regression: `review.test.ts` › a panel outside the viewport encoded the old layout (viewport present, panel left in its item) and failed by design; it now covers the no-viewport case, which is the only remaining path for a panel outside the viewport. `pointer.ts` comment updated to match.
