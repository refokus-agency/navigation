---
issue_number: 130
issue_title: "feat: read all nav behavior config from root data attributes"
repo: "refokus-agency/navigation"
labels: [enhancement]
plan_level: "full"
depth: "medium"
branch_name: "FacuAraujo/data-attr"
created_at: "2026-11-02T19:11:16Z"
updated_at: "2026-11-02T20:30:00Z"
---

# Implementation Plan: #130 — feat: read all nav behavior config from root data attributes

## Files

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | create | `src/attributes.ts` | Shared parsers: `readNumberAttr`, `readEnumAttr`, `readBooleanAttr`, `resolveSetting` |
| 2 | create | `src/__tests__/attributes.test.ts` | Parser unit tests |
| 3 | modify | `src/nav-menu/config.ts` | Attribute names `attributes.{delay, skipDelay, closeDelay, orientation, dir}` |
| 4 | modify | `src/nav-menu/types.ts` | Add `closeDelay` to `NavMenuOptions` |
| 5 | modify | `src/nav-menu/index.ts` | `DEFAULT_OPTIONS.closeDelay = 150`; `resolveMenuOptions(root, options)` before renderer, controller and `setupAria` |
| 6 | modify | `src/nav-menu/controller.ts` | `startCloseTimer` reads `options.closeDelay` instead of `NAV_MENU_CONFIG.timing.closeDelay` |
| 7 | modify | `src/nav-anim/config.ts` | Attribute names `attributes.{hideOnScroll, scrollThreshold, animDuration, animEasing}` |
| 8 | modify | `src/nav-anim/index.ts` | Options gain `hideOnScroll`/`scrollThreshold`; `resolveAnimOptions(elements[0], options)`; skip `initScrollBehavior` when `hideOnScroll` is `false` |
| 9 | modify | `src/nav-anim/scroll-behaviour.ts` | Threshold from `currentOptions.scrollThreshold` |
| 10 | create | `src/nav-menu/__tests__/attributes.test.ts` | nav-menu behavior tests |
| 10b | create | `src/nav-anim/__tests__/attributes.test.ts` | nav-anim behavior tests |
| 11 | modify | `src/nav-anim/__tests__/index.test.ts` | Replace plain-object `querySelectorAll` fakes with real DOM nodes |
| 12 | modify | `README.md` | Attribute reference table, precedence note, `closeDelay`/`scrollThreshold`/`hideOnScroll` options |
| 13 | modify | `src/nav-anim/__tests__/scroll-behaviour.test.ts` | [added during implementation] Option literals gain `hideOnScroll`/`scrollThreshold`; AC-8 custom-threshold tests |

## Codebase Context

- `NAV_ROOT_SELECTOR` (`src/config.ts:2`) is the single nav root; `src/__tests__/config.test.ts` guards it.
- Option merge is `{ ...DEFAULT_OPTIONS, ...options }` in both `src/nav-menu/index.ts` and `src/nav-anim/index.ts`; attribute resolution slots in right after it.
- #77 precedent (PR #121, commit cdcedc7, not on this branch): exact-match enums, read once at init, JS value typed `unknown` because browser-bundle callers are untyped.
- #108's `readBreakpoint` (PR #120, commit 7f4b0d4) uses `/^\d+$/`, which rejects negatives — not reusable for #130's "accept `-20`" rule.
- Consumers today: `delayDuration` `controller.ts:77`; `skipDelayDuration` `controller.ts:53,58`; close delay `controller.ts:139` via `NAV_MENU_CONFIG.timing.closeDelay`; orientation written by `setupAria` in `index.ts` and read back by `keyboard.ts:65`; `dir` in `render.ts:26-28`; scroll threshold `NAVBAR_CONFIG.scroll.threshold` in `scroll-behaviour.ts`; duration/easing in `initial-animation.ts` `createNavbarAnimation`.
- nav-anim queries all roots and animates all; attributes come from `elements[0]` only (singleton stays).
- nav-anim index tests fake `querySelectorAll` with plain objects (no `getAttribute`) → need real DOM nodes.
- CLAUDE.md: never rename existing `data-nav-*` inputs; `render.ts` stays the only reactive DOM writer; `data-orientation` output keeps being written by `setupAria`.

## Steps

1. [x] **Shared parsers** in `src/attributes.ts`.
   **Done when:** `src/__tests__/attributes.test.ts` passes for valid / invalid / empty / missing per parser type.
2. [x] **Attribute name constants** in `src/nav-menu/config.ts` and `src/nav-anim/config.ts`.
   **Done when:** `pnpm typecheck` passes and `config.test.ts` still passes.
3. [x] **`closeDelay` becomes an option** (`types.ts`, `index.ts`, `controller.ts`).
   **Done when:** existing pointer/hover tests pass unchanged and `closeDelay: 500` delays close by 500 ms.
4. [x] **nav-menu resolution** (delay, skip-delay, close-delay, orientation, dir) in `src/nav-menu/index.ts`.
   **Done when:** `src/nav-menu/__tests__/attributes.test.ts` passes for every attribute × {valid, invalid, empty, JS fallback}.
5. [x] **nav-anim options + resolution** (hide-on-scroll, threshold, duration, easing) in `src/nav-anim/index.ts` and `src/nav-anim/scroll-behaviour.ts`.
   **Done when:** `src/nav-anim/__tests__/attributes.test.ts` passes, including first-root-wins and `hide-on-scroll="false"` skipping scroll binding.
6. [x] **Migrate nav-anim index tests to real DOM** in `src/nav-anim/__tests__/index.test.ts`.
   **Done when:** `pnpm test` is green with no plain-object element fakes left.
7. [x] **README docs** in `README.md`.
   **Done when:** each of the 9 attributes appears in the attribute table with accepted values and default.

## Step Coverage

| # | Step | ACs | Kind |
|---|------|-----|------|
| 1 | Shared parsers | AC-3, AC-4, AC-5 | criterion-driven |
| 2 | Attribute name constants | none | no-criterion |
| 3 | `closeDelay` becomes an option | AC-7, AC-9 | criterion-driven |
| 4 | nav-menu resolution | AC-1, AC-3, AC-4, AC-5, AC-7 | criterion-driven |
| 5 | nav-anim options + resolution | AC-2, AC-3, AC-4, AC-6, AC-8 | criterion-driven |
| 6 | Migrate nav-anim index tests to real DOM | AC-9 | criterion-driven |
| 7 | README docs | none | no-criterion |

## Interfaces

```ts
// src/nav-menu/types.ts
interface NavMenuOptions {
  // ...existing fields
  closeDelay: number; // default 150
}

// src/nav-anim/index.ts
interface NavbarAnimationOptions {
  animationDuration: number;  // default 0.3
  animationEasing: string;    // default 'power2.inOut'
  hideOnScroll: boolean;      // default true
  scrollThreshold: number;    // default 50
}

// src/attributes.ts
type AttributeReader<T> = (el: Element, name: string) => T | undefined; // undefined = missing, empty or invalid

interface SettingSource<T> {
  attribute: T | undefined;
  js: unknown;
  isValid: (value: unknown) => value is T;
  fallback: T;
}
```

## Function Design

- `src/attributes.ts`: `readNumberAttr` — exact `/^-?\d+(\.\d+)?$/`, no trim, no clamping.
- `src/attributes.ts`: `readEnumAttr(allowed)` — exact, case-sensitive match.
- `src/attributes.ts`: `readBooleanAttr` — `"true"` / `"false"` exact.
- `src/attributes.ts`: `resolveSetting(src)` — `attribute ?? (isValid(js) ? js : fallback)`.
- `src/nav-menu/index.ts`: `resolveMenuOptions(root, merged)` — pure, returns `NavMenuOptions`.
- `src/nav-anim/index.ts`: `resolveAnimOptions(firstRoot, merged)` — pure; easing validated via `gsap.parseEase`.

## Acceptance Criteria (EARS)

- **AC-1.** The library shall read `data-nav-delay`, `data-nav-skip-delay`, `data-nav-close-delay`, `data-nav-orientation` and `data-nav-dir` from the nav-menu root once, at init.
- **AC-2.** The library shall read `data-nav-hide-on-scroll`, `data-nav-scroll-threshold`, `data-nav-anim-duration` and `data-nav-anim-easing` from the first `[data-nav-menu]` root, once, at init.
- **AC-3.** When an attribute holds a valid value, the library shall use it over the JS option and the default.
- **AC-4.** If an attribute is missing, empty, or invalid (e.g. `"300ms"`, `"vertcal"`), then the library shall use the JS option when it is valid, else the default, without logging or throwing.
- **AC-5.** When a numeric attribute parses as a number (including `"0"`, `"-20"`, `"99999"`), the library shall use it unclamped.
- **AC-6.** When `data-nav-hide-on-scroll` is `"false"`, nav-anim shall not bind the scroll hide/show behavior.
- **AC-7.** When `data-nav-close-delay` is set (or `closeDelay` is passed), the hover close shall wait that many milliseconds instead of 150.
- **AC-8.** When `data-nav-scroll-threshold` is set (or `scrollThreshold` is passed), nav-anim shall use it instead of 50.
- **AC-9.** The library shall behave identically to today when none of the new attributes or options are present.

## Out of Scope

- Attributes other than the 9 listed (`data-nav-interaction` and `data-nav-breakpoint` ship in #121 / #120).
- Refactoring nav-anim's module-level singleton state.
- Migrating #77 / #108's local validators onto `src/attributes.ts` (follow-up after both merge).
- Reacting to attribute changes after init.
- Trimming or case-folding values (`"Vertical"`, `" 200 "` are invalid).

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
|---|----------|--------|----------|
| 1 | `"300ms"`, `"vertcal"` | [from issue] | Invalid → JS option → default, silently |
| 2 | `data-nav-delay=""` | [from issue] | Treated as missing |
| 3 | `"0"`, `"-20"`, `"99999"` | [from issue] | Accepted as given |
| 4 | Several roots with different nav-anim attributes | [from issue] | `elements[0]` wins |
| 5 | Webflow removes a false boolean attribute instead of writing `"false"` | [from issue] | Missing → JS → default (on); see Risk 1 |
| 6 | Invalid JS option (e.g. `delayDuration: "200"`) | [inferred] | Falls to default, mirroring #77 |
| 7 | Unknown easing `"foo"` | [inferred] | `gsap.parseEase` returns undefined → invalid |
| 8 | Padded `" 200 "` | [inferred] | Invalid (precedent: no trim) |
| 9 | Two nav-menu roots with different attributes | [inferred] | Each resolves independently |
| 10 | Negative delay such as `data-nav-delay="-20"` | [discovered during implementation] | Accepted unclamped; `setTimeout` treats it as 0, so the panel opens immediately instead of falling back |
| 11 | Empty easing `data-nav-anim-easing=""` | [discovered during implementation] | Rejected before `gsap.parseEase`, which returns undefined for `""` and `"foo"` without logging |
| 12 | Defaults for `closeDelay` / `scrollThreshold` | [discovered during implementation] | Reference `NAV_MENU_CONFIG.timing.closeDelay` / `NAVBAR_CONFIG.scroll.threshold`, so each default keeps one source |

## Done Criteria per Feature

| Feature | Done when |
|---------|-----------|
| Shared parsers | AC-3, AC-4, AC-5 |
| nav-menu attributes | AC-1, AC-3, AC-4, AC-5, AC-7, AC-9 |
| nav-anim attributes | AC-2, AC-3, AC-4, AC-6, AC-8, AC-9 |

## Risks

1. Webflow may delete a false boolean attribute instead of writing `"false"` → verify in the Designer before merge; if it deletes, invert to a `data-nav-show-on-scroll` style attribute or document `"false"` via a text prop.
2. Merge conflicts with #121 / #120 / #123–#125 in nav-menu `index.ts`, `config.ts`, `types.ts` and the README → keep edits additive, rebase after they land.
3. Validating JS options could change behavior for untyped callers passing strings → covered by AC-9 tests on today's typed defaults; noted in the PR.
4. `hide-on-scroll="false"` still runs the initial slide-in → chosen so the navbar always appears; confirm at review.
5. `gsap.parseEase` as a validator depends on GSAP internals → pinned by the AC-3/AC-4 nav-anim tests (`power4.out`, `none` valid; `foo`, `""` invalid) against the installed peer version.
6. Adding required fields to `NavbarAnimationOptions` broke the option literals in `scroll-behaviour.test.ts` (typecheck) → updated in place with today's defaults. Callers of the internal `initScrollBehavior` must now pass `scrollThreshold`.

## Test Strategy

Vitest + jsdom, TDD per step.

- Parser units in `src/__tests__/attributes.test.ts`.
- nav-menu behavior tests set attributes on `renderNavMenu()` roots and assert with fake timers (open/close delays), `data-orientation`, and rtl key order.
- nav-anim tests use real `<nav data-nav-menu>` nodes and assert the options passed to the mocked `performInitialAnimation` / `initScrollBehavior`.
- Full `pnpm test`, `pnpm typecheck` and `pnpm lint:report` at close.
- Result: 179 tests passed (124 before); typecheck, `biome check src` and `pnpm build` clean. AC-8 is tested against the real `scroll-behaviour` module; AC-9 is the migrated `nav-anim/__tests__/index.test.ts` plus the unchanged `pointer.test.ts`.

## TDD Report

| AC | Test | Reds | Last state | Note |
|----|------|------|------------|------|
| AC-1 | `src/nav-menu/__tests__/attributes.test.ts` › nav-menu root attributes (AC-1) | 1 | green | |
| AC-2 | `src/nav-anim/__tests__/attributes.test.ts` › nav-anim root attributes (AC-2) | 1 | green | |
| AC-3 | `src/__tests__/attributes.test.ts` › resolveSetting precedence (AC-3); feature precedence (AC-3) in both feature suites | 1 | green | |
| AC-4 | `src/__tests__/attributes.test.ts` › invalid, empty and missing values (AC-4); invalid attributes (AC-4) in both feature suites | 1 | green | |
| AC-5 | `src/__tests__/attributes.test.ts` › numeric attributes (AC-5); numeric attributes (AC-5) in both feature suites | 1 | green | |
| AC-6 | `src/nav-anim/__tests__/attributes.test.ts` › hide on scroll (AC-6) | 1 | green | |
| AC-7 | `src/nav-menu/__tests__/attributes.test.ts` › close delay (AC-7) | 1 | green | |
| AC-8 | `src/nav-anim/__tests__/scroll-behaviour.test.ts` › custom scroll threshold (AC-8) | 1 | green | |
| AC-9 | `src/nav-anim/__tests__/index.test.ts` (migrated to real DOM) + unchanged `pointer.test.ts` | 1 | green | |

Lap observations:

- AC-1's `data-nav-close-delay` read is asserted in AC-7's lap, since the close delay only becomes configurable there.
- Some assertions inside a red lap were already green on their first run and are recorded rather than hidden: AC-3's two feature-level precedence checks (AC-1/AC-2 code already preferred the attribute), AC-4's two "neither log nor throw" checks, AC-5's `"0"`/`"99999"` cases, AC-6's `"true"` binding check, and AC-7's 150 ms default.
- AC-5's first run also failed two cases because the test helper never flushed 0 ms timers; the helper was fixed, then the lap's real red (every negative value rejected) was observed.
- `src/nav-anim/__tests__/scroll-behaviour.test.ts` was not in the Files table but had to change: its option literals now need `hideOnScroll`/`scrollThreshold`.
- `closeDelay` and `scrollThreshold` defaults reference `NAV_MENU_CONFIG.timing.closeDelay` / `NAVBAR_CONFIG.scroll.threshold`, so each default keeps one source.

Full suite: 179 passed. `pnpm typecheck`, `biome check src` and `pnpm build` clean.
