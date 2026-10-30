---
issue_number: 108
issue_title: "feat(nav-menu): make the mobile breakpoint configurable"
repo: "refokus-agency/navigation"
labels: [enhancement]
plan_level: "full"
depth: "medium"
branch_name: "FacuAraujo/mobile-breakpoint"
created_at: "2026-10-30T15:34:31Z"
updated_at: "2026-10-30T15:45:00Z"
---

# Implementation Plan: #108 — feat(nav-menu): make the mobile breakpoint configurable

## Files

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | modify | `src/nav-menu/config.ts` | Add `attributes.breakpoint: 'data-nav-breakpoint'`; replace `mobile: { query }` with `mobile: { breakpoint: 767 }` |
| 2 | modify | `src/nav-menu/mobile.ts` | Read the root's `data-nav-breakpoint`, build `(max-width: <n>px)` from it |
| 3 | modify | `src/nav-menu/__tests__/mobile.test.ts` | Tests for a custom, an invalid and a per-root breakpoint |
| 4 | modify | `README.md` | Attribute table row, reword the "Below 767px" line (L283), config dump (L412) |

## Codebase Context

- `attachMobile` (`src/nav-menu/mobile.ts:8-35`) is the only consumer of `NAV_MENU_CONFIG.mobile.query` (L18). It receives `{ root, controller, cleanups }`, falls back to desktop when `matchMedia` is unavailable (L16-19), writes `root.dataset.navMode` in `applyMode` (L21-23), and on `change` calls `applyMode()` + `controller.close()` (L26-35).
- Attribute names live in `NAV_MENU_CONFIG.attributes` (`src/nav-menu/config.ts:16-19`, currently `item`, `content`) and are read with `getAttribute` (`src/nav-menu/index.ts:122`, `:169`).
- Hover gating reads `root.dataset.navMode` (`src/nav-menu/pointer.ts:16`, `src/nav-menu/render.ts:134`), so it follows the new breakpoint with no change.
- CLAUDE.md: `mobile.ts` is the sanctioned exception allowed to write `[data-nav-mode]`; `render.ts` remains the only reactive-state writer. Never rename existing `data-nav-*` inputs.
- `NAV_MENU_CONFIG` is not exported from the package root (`src/index.ts`), so replacing `mobile.query` is not a public API break.
- `src/nav-menu/__tests__/mobile.test.ts:15-39` defines a local `stubMatchMedia` that receives the `media` string and returns `{ setMatches, listenerCount }`; root built by `renderNavMenu()` (`helpers.ts`).
- No numeric attribute parsing exists in `src/` today — the validation is new logic.

## Steps

1. ✅ **Config** — in `src/nav-menu/config.ts`, add `breakpoint: 'data-nav-breakpoint'` to `attributes` and replace `mobile: { query: '(max-width: 767px)' }` with `mobile: { breakpoint: 767 }`.
   **Done when:** `pnpm typecheck` passes once step 3 lands and `rg "query" src/nav-menu/config.ts` returns no match.
2. ✅ **RED** — add the breakpoint tests to the `'mobile mode'` describe in `src/nav-menu/__tests__/mobile.test.ts`, recording the `media` passed to the stub.
   **Done when:** the new tests fail and every pre-existing test still passes.
3. ✅ **GREEN** — in `src/nav-menu/mobile.ts`, add module-private `readBreakpoint(root)` and build the query from it in `attachMobile`.
   **Done when:** `pnpm test`, `pnpm typecheck` and `pnpm lint:report` all exit 0.
4. ✅ **Docs** — in `README.md`, add a `data-nav-breakpoint` row after `data-nav-back` (L137), reword L283 to the configurable breakpoint (767px by default), and change the config dump (L412) to `mobile: { breakpoint: 767 }`.
   **Done when:** `rg -n "Below 767px|max-width: 767px" README.md` returns no match and `rg -n "data-nav-breakpoint" README.md` matches the table row.

## Step Coverage

| # | Step | ACs | Kind |
|---|------|-----|------|
| 1 | Config | none | no-criterion |
| 2 | RED | AC-1, AC-2, AC-3, AC-4, AC-5 | criterion-driven |
| 3 | GREEN | AC-1, AC-2, AC-3, AC-4, AC-5 | criterion-driven |
| 4 | Docs | AC-6 | criterion-driven |

## Interfaces

```ts
// src/nav-menu/config.ts
mobile: {
  /** Max viewport width in px for mobile mode, used when data-nav-breakpoint is absent or invalid. */
  breakpoint: number; // 767 — replaces `query: string`
}
attributes: {
  item: 'data-nav-item';
  content: 'data-nav-content';
  breakpoint: 'data-nav-breakpoint';
}
```

## Function Design

| File | Function | Single concern |
|------|----------|----------------|
| `src/nav-menu/mobile.ts` | `readBreakpoint(root: HTMLElement): number` (module-private) | Return the root's `data-nav-breakpoint` when it is a plain positive safe-integer string (`/^\d+$/`, `> 0`, `Number.isSafeInteger`), else `NAV_MENU_CONFIG.mobile.breakpoint` |
| `src/nav-menu/mobile.ts` | `attachMobile(context)` | Unchanged orchestration; `matchMedia(\`(max-width: ${readBreakpoint(root)}px)\`)` replaces `mobile.query` |

## Acceptance Criteria (EARS)

- **AC-1.** When the root has `data-nav-breakpoint="<n>"` and `<n>` is a positive integer, `attachMobile` shall evaluate the media query `(max-width: <n>px)`.
- **AC-2.** The root's `[data-nav-mode]` shall be `"mobile"` while that query matches and `"desktop"` otherwise.
- **AC-3.** When the custom-breakpoint query's match state changes while a panel is open, the menu shall close that panel.
- **AC-4.** If `data-nav-breakpoint` is absent or is not a plain positive integer string (e.g. `"abc"`, `"0"`, `"-5"`, `"991px"`, `" 991 "`, `"991.5"`), then the menu shall use the default `767` without throwing.
- **AC-5.** Each menu root shall read its own `data-nav-breakpoint`, so two roots on one page can use different breakpoints.
- **AC-6.** The README shall list `data-nav-breakpoint` in its attribute table and shall describe the mobile layer by the configurable breakpoint (767px by default) instead of "Below 767px".

## Out of Scope

- A JS option (`initNavigationMenu(root, { breakpoint })`) — deferred per the issue's notes.
- Reacting to `data-nav-breakpoint` changes after init — the attribute is read once.
- `docs/examples/local/` and README L312 — the example sets no attribute, so the 767 default still applies (cothinker D3).
- Hover-gating code in `pointer.ts` / `render.ts` — it already follows `[data-nav-mode]`.

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
|---|----------|--------|----------|
| 1 | Attribute absent | [from issue] | Use 767 |
| 2 | `"abc"`, `"0"`, `"-5"` | [from issue] | Use 767 |
| 3 | `"991px"`, `" 991 "`, `"991.5"` | [from issue] (cothinker D1) | Use 767 — only plain positive integers are valid |
| 4 | `matchMedia` unavailable | [from issue] | Desktop mode, no listener (unchanged behavior) |
| 5 | Digit string beyond `Number.MAX_SAFE_INTEGER` | [inferred] | `Number.isSafeInteger` fails → 767 |
| 6 | Two roots with different values | [from issue] | Each root reads its own attribute and builds its own query |
| 7 | Viewport width exactly equal to the breakpoint | [discovered during implementation] | `max-width` is inclusive, so the root is `mobile`; README now says "at or below" instead of "below" |

## Done Criteria per Feature

| Feature | Done when |
|---------|-----------|
| Configurable breakpoint | AC-1, AC-2, AC-3, AC-4, AC-5 |
| Documentation | AC-6 |

## Risks

| Risk | Mitigation |
|------|------------|
| Code reading `NAV_MENU_CONFIG.mobile.query` breaks | Verified: `NAV_MENU_CONFIG` is not exported from the package root, and `mobile.ts:18` is its only consumer |
| Strict validation silently rejects a value an author meant as valid (`991px`) | README row documents the format: integer px, e.g. `991` |
| Example CSS and JS breakpoint drift for consumers who set the attribute | README row notes the value should match the site's CSS breakpoint |

## Test Strategy

Black-box through `initNavigationMenu`, using the local `stubMatchMedia` in `mobile.test.ts` extended to record the `media` string it receives:

- `data-nav-breakpoint="991"` → stub receives `(max-width: 991px)`; with matches `true` the root gets `data-nav-mode="mobile"`, with `false` `"desktop"` (AC-1, AC-2).
- Open a panel, `setMatches` across the custom breakpoint → panel closed and mode flipped (AC-3).
- Table-driven: `"abc"`, `"0"`, `"-5"`, `"991px"`, `" 991 "`, `"991.5"`, absent → stub receives `(max-width: 767px)`, no throw (AC-4).
- Two roots with `991` and `1200` → two distinct queries recorded (AC-5).
- Existing `'mobile mode'` tests (including the no-`matchMedia` fallback) stay green unchanged.
- As implemented: instead of extending `stubMatchMedia` (whose `matches` ignores the query, so AC-2/AC-3 would pass with any breakpoint), a new `stubViewport(width)` evaluates `(max-width: <n>px)` against a fake width, records every query, and fires `change` only when the match flips. AC-4 also covers an unsafe-integer string. Result: 12 new tests red once, then green; full suite 136/136.
- AC-6 is checked structurally with `rg` in step 4.

## TDD Report

| AC | Test | Reds | Last state | Note |
|----|------|------|------------|------|
| AC-1 | `mobile mode > configurable breakpoint > should query the breakpoint set by data-nav-breakpoint` | 1 | green | |
| AC-2 | `mobile mode > configurable breakpoint > should switch data-nav-mode at the custom breakpoint` | 1 | green | |
| AC-3 | `mobile mode > configurable breakpoint > should close the open panel when crossing the custom breakpoint` | 1 | green | |
| AC-4 | `mobile mode > configurable breakpoint > should fall back to 767px when the value is %s` (8 cases) | 1 | green | |
| AC-5 | `mobile mode > configurable breakpoint > should read the breakpoint per root` | 1 | green | |
| AC-6 | | | skipped | Documentation content, not runtime behavior; verified structurally (`rg "Below 767px\|max-width: 767px" README.md` no match, `data-nav-breakpoint` row at README L138) |

Full suite: `pnpm test` 136/136 passed; `pnpm typecheck` and `pnpm lint:report` exit 0.
