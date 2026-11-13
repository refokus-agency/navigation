# @refokus-agency/navigation

[![CI](https://github.com/refokus-agency/navigation/actions/workflows/pr-ci.yml/badge.svg)](https://github.com/refokus-agency/navigation/actions/workflows/pr-ci.yml)
[![npm version](https://img.shields.io/npm/v/@refokus-agency/navigation.svg)](https://www.npmjs.com/package/@refokus-agency/navigation)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A TypeScript package for Webflow and custom-code navigations: GSAP-powered scroll show/hide for the navbar shell, plus a fully accessible dropdown menu with hover delays, keyboard navigation and ARIA wiring.

## Features

- ✨ Smooth GSAP-powered animations
- 📜 Scroll-based navbar show/hide behavior
- ♿ Accessible dropdown menu — full keyboard support, ARIA wiring, focus management
- ⏱️ Radix-style hover delays with an instant-switch skip window
- 🎬 CSS-driven enter/exit animations via `[data-state]` / `[data-motion]` hooks
- 📱 Mobile layer that integrates with the Webflow burger overlay
- ⚙️ Configurable animation settings
- 🎯 Attribute-based element selection
- 📦 ES Module-only package (no CommonJS support)
- 🔧 Modern TypeScript configuration with strict mode
- 🧪 Testing setup with Vitest
- 🎨 Formatting and linting with Biome
- 🏗️ Build pipeline with TypeScript compiler
- 📝 Source maps for debugging

## Requirements

- Node.js ^22.22.2 || ^24.15.0 || >=26

## Installation

```bash
npm install @refokus-agency/navigation
```

## Usage

### Basic Setup

1. Add the `data-nav-menu` attribute to your navbar element(s):

```html
<nav data-nav-menu>
  <!-- Your navbar content -->
</nav>
```

`data-nav-menu` is the **single** nav root attribute — both the scroll
animation and the dropdown menu attach to it, so one element serves both.

2. Initialize the navbar animation system:

```typescript
import { initNavbarAnimation } from '@refokus-agency/navigation';

// Initialize with custom options
const nav = initNavbarAnimation({
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
});

// Later, e.g. before a page transition swaps the DOM:
nav?.destroy();
```

`initNavbarAnimation` returns `{ destroy }` (typed `NavbarAnimationInstance`), or
`null` when no `[data-nav-menu]` is on the page. `destroy()` removes the scroll
and focus listeners, kills the navbar's `y` tweens and resets its `y` to 0,
leaving any other tween or authored transform alone. It is idempotent. Only one
instance is live at a time: calling `initNavbarAnimation` again destroys the
previous instance first, so re-initializing never stacks listeners.

| Option              | Type      | Default          | Description                                                       |
| ------------------- | --------- | ---------------- | ----------------------------------------------------------------- |
| `animationDuration` | `number`  | `0.3`            | Slide duration, in seconds                                        |
| `animationEasing`   | `string`  | `'power2.inOut'` | Any GSAP ease name                                                |
| `hideOnScroll`      | `boolean` | `true`           | When `false`, the navbar slides in once and never hides on scroll |
| `scrollThreshold`   | `number`  | `50`             | Scroll distance, in px, before the navbar hides or shows          |

### How It Works

- **Initial Animation**: Navbar slides in smoothly on page load
- **Scroll Down**: Navbar hides when scrolling down past `scrollThreshold` (50px by default)
- **Open panel / mobile menu**: The navbar never hides while a dropdown panel
  is open (root `[data-state="open"]`) or the mobile card is open
  (`[data-nav-card][data-state="open"]`). Closing it changes nothing by itself;
  the next scroll resumes the normal show/hide
- **Scroll Up**: Navbar shows when scrolling up
- **Focus**: A hidden navbar slides back in when focus moves into it, so
  tabbing back up to the nav never lands on an off-screen element
- **Multiple Navbars**: Supports multiple navbar elements with the same attribute

### Using both features together

Both features attach to the same `[data-nav-menu]` root, so one nav gets the
scroll behavior and the dropdown menu:

```typescript
import {
  initNavbarAnimation,
  initNavigationMenu,
} from '@refokus-agency/navigation';

initNavbarAnimation();
initNavigationMenu();
```

They are independent: the animation reads only the root, the menu reads only
its own `data-nav-*` descendants. Use either on its own if you prefer.

### Configuring from data attributes

Every behavior setting can also be written as an attribute on the
`[data-nav-menu]` root, so a Webflow component can expose it as a prop without
any custom code:

```html
<nav
  data-nav-menu
  data-nav-delay="100"
  data-nav-close-delay="400"
  data-nav-orientation="vertical"
  data-nav-hide-on-scroll="false"
>
```

| Attribute                   | Feature  | Accepted values                 | Option               | Default          |
| --------------------------- | -------- | ------------------------------- | -------------------- | ---------------- |
| `data-nav-delay`            | nav-menu | number, in ms                   | `delayDuration`      | `200`            |
| `data-nav-skip-delay`       | nav-menu | number, in ms                   | `skipDelayDuration`  | `300`            |
| `data-nav-close-delay`      | nav-menu | number, in ms                   | `closeDelay`         | `150`            |
| `data-nav-orientation`      | nav-menu | `horizontal` \| `vertical`      | `orientation`        | `horizontal`     |
| `data-nav-dir`              | nav-menu | `ltr` \| `rtl`                  | `dir`                | `ltr`            |
| `data-nav-interaction`      | nav-menu | `hover` \| `click`              | `interaction`        | `hover`          |
| `data-nav-hide-on-scroll`   | nav-anim | `true` \| `false`               | `hideOnScroll`       | `true`           |
| `data-nav-scroll-threshold` | nav-anim | number, in px                   | `scrollThreshold`    | `50`             |
| `data-nav-anim-duration`    | nav-anim | number, in seconds              | `animationDuration`  | `0.3`            |
| `data-nav-anim-easing`      | nav-anim | any GSAP ease name              | `animationEasing`    | `power2.inOut`   |

**Precedence:** a valid attribute wins over the JS option, and a valid JS
option wins over the default. A missing, empty or invalid value (`"300ms"`,
`"vertcal"`, `" 200 "`, `"Vertical"`) is skipped silently — nothing is logged
or thrown. The one exception is `data-nav-interaction`: an invalid value falls
back the same way but also logs a `console.warn` naming it, since a mistyped
`"Click"` would otherwise look like click mode being broken (see
[Click interaction](#click-interaction)). Values are matched exactly: no
trimming, no case folding. Numbers must be non-negative, since each is a time or a distance (`"0"`, `".5"` and
`"99999"` are valid; `"-20"`, `"5."`, `"+5"` and `"1e3"` are not). A negative
value falls back the same way, whether it comes from an attribute or a JS
option. An easing must resolve to a working GSAP ease, so
malformed arguments such as `"steps(abc)"` are skipped too.

Attributes are read **once, at init**; changing them afterwards has no effect
until the feature is initialized again. nav-menu reads the root it attaches
to, so several menus resolve independently. nav-anim animates every root but
reads its attributes from the **first** `[data-nav-menu]` only.

> **Upgrading to the teardown handle:** `initNavbarAnimation` used to return
> `boolean`. It now returns `{ destroy } | null`, so replace
> `if (initNavbarAnimation())` with a `null` check. Call `destroy()` when you
> remove the navbar from the page (for example in a page transition).

> **Upgrading from a 1.x release:** `initNavbarAnimation` used to select
> `[r-navbar]`. Rename that attribute to `data-nav-menu` on your nav element —
> it is now the single root selector for both features.

## Accessible Dropdown Menu

`initNavigationMenu` attaches an accessible dropdown navigation to your markup.
It ships **no CSS and no GSAP dependency** — it manages state, focus and ARIA,
then exposes data attributes and custom properties for your CSS to animate.

### Markup

```html
<nav data-nav-menu>
  <div data-nav-list>
    <!-- Item with a dropdown -->
    <div data-nav-item="products">
      <button type="button" data-nav-trigger>Products</button>
    </div>

    <!-- Plain link, no dropdown -->
    <div data-nav-item>
      <a data-nav-link href="/pricing">Pricing</a>
    </div>
  </div>

  <div data-nav-viewport>
    <div data-nav-content="products">
      <a href="/products/a">Product A</a>
    </div>
  </div>
</nav>
```

| Attribute              | Purpose                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-nav-menu`        | Menu root. Gets `role="navigation"` unless you set a role yourself                                                                                       |
| `data-nav-list`        | Wrapper around the items (optional, receives `[data-orientation]`)                                                                                       |
| `data-nav-item`        | One nav entry. Its value pairs the trigger with its panel; auto-filled when omitted                                                                      |
| `data-nav-trigger`     | Opens the panel. Gets `id`, `aria-expanded`, `aria-controls` when it owns a panel                                                                        |
| `data-nav-content`     | The dropdown panel. Gets `id`, `role="region"` and `aria-labelledby`                                                                                     |
| `data-nav-viewport`    | Optional shared container for all panels — enables animated size transitions                                                                             |
| `data-nav-link`        | A plain link. Inside a panel it also dismisses the menu on click                                                                                         |
| `data-nav-back`        | Mobile "back" control — closes the open panel without closing the burger overlay                                                                         |
| `data-nav-interaction` | On the root: `hover` (default) or `click` — what opens a panel with the mouse. Overrides the `interaction` option                                        |
| `data-nav-toggle`      | Mobile menu button; repeat it for a close button inside the card. Each gets `aria-expanded` and `aria-controls`; Escape and outside click close the card |
| `data-nav-card`        | Mobile menu container (inside the root). Gets `[data-state]` and `inert` while closed, in mobile mode only                                               |
| `data-nav-breakpoint`  | Mobile breakpoint in px, an integer from 1 to 4000 (`991`); invalid values warn and use the 767 default. Read once at init, later changes are ignored. Match your CSS |
| `data-nav-mobile-panels` | Root attribute. `inline` moves slot panels back into their items in mobile mode (accordion) while desktop keeps the shared viewport. Read once at init; absent keeps panels in the viewport on every breakpoint |
| `data-nav-overlay`     | Optional backdrop, inside or outside the root. Gets `[data-state]` and `aria-hidden`; a press closes the menu                                           |

Panels may be authored inside a shared `[data-nav-viewport]` or inside their
`[data-nav-item]`. The viewport is what lets one element animate between panel
sizes, so when one exists, every panel ends up in it:

- **Slot markup.** A panel authored inside its item (what a Webflow component
  with a dropdown slot renders) is moved into the viewport at init, paired with
  its item's value. `destroy()` puts it back under its original parent, before
  its original next sibling.
- An item uses its **first** owned `[data-nav-content]` (a nested item owns its
  own). A second panel in the same item is left where it is.
- A viewport panel that already carries the item's value wins; the panel inside
  the item is not moved.
- A panel left where it is (the two cases above) is **not managed**: it gets no
  `data-state`, no `inert` and no hiding, so it stays visible and tabbable.
  Treat it as an authoring error and remove it.
- Without a viewport, nothing moves and panels work in place.
- **Accordion on mobile, viewport on desktop.** Add `data-nav-mobile-panels="inline"`
  to the root and slot panels follow `[data-nav-mode]`: in the viewport on
  desktop, back under their item on mobile, re-placed on each breakpoint
  crossing (which already closes the menu). While panels are inline the
  viewport is hidden and empty, and no `--nav-viewport-*` is written. Panels
  authored in the viewport are never moved.
- Inside the Webflow Designer (`skipInWebflowEditor`), nothing moves, so the
  panel stays editable inside its item.

> **Breaking change.** Before this, a page with a viewport *and* panels inside
> items left those panels in place. They now move into the viewport. Pin the
> previous major version if a site depends on the old layout.

> **Note:** `data-nav-menu` is the same attribute the scroll animation uses, so
> a single `<nav data-nav-menu>` can run both features. The `data-nav-*` names
> match the existing Toggl and Relocity implementations, so those sites can drop
> in this package without touching their Webflow markup or CSS.

### Initialization

```typescript
import { initNavigationMenu } from '@refokus-agency/navigation';

const menu = initNavigationMenu();

menu?.open('products'); // open a panel by its data-nav-item value
menu?.close();          // close whatever is open
menu?.destroy();        // remove every listener, timer and observer
```

In mobile mode with the opt-in `[data-nav-toggle]`/`[data-nav-card]` pair,
`open()` also opens the card, since a panel inside a closed (inert) card would
be invisible. That makes it the hook for a CTA outside the nav that opens the
mobile menu:

- Focus moves into the opened panel, and `Escape` hands it back to the element
  that was focused when you called `open()` (the CTA). This is the one case
  where a programmatic `open()` moves focus; with the card already open, or on
  desktop, focus stays where it is.
- Call it from a `click` handler, not `pointerdown`: the same `pointerdown`
  bubbles to the document and dismisses the card straight away.
- An unknown value is a full no-op: the card stays as it was and the panel that
  is open stays open.

Pass a root element or selector as the first argument to run several menus on
one page:

```typescript
document.querySelectorAll<HTMLElement>('[data-nav-menu]').forEach((root) => {
  initNavigationMenu(root, { delayDuration: 100 });
});
```

Returns `null` when no root matches, or when running inside the Webflow
Designer (see `skipInWebflowEditor`).

### Options

| Option                | Type                           | Default        | Description                                                                 |
| --------------------- | ------------------------------ | -------------- | --------------------------------------------------------------------------- |
| `delayDuration`       | `number`                       | `200`          | Hover dwell time before a panel opens, in ms                                |
| `skipDelayDuration`   | `number`                       | `300`          | Window after a close during which the next hover opens instantly            |
| `closeDelay`          | `number`                       | `150`          | Grace period after the pointer leaves before the panel closes, in ms        |
| `orientation`         | `'horizontal' \| 'vertical'`   | `'horizontal'` | Drives `[data-orientation]` and which arrow keys navigate                    |
| `dir`                 | `'ltr' \| 'rtl'`               | `'ltr'`        | Mirrors the `[data-motion]` direction and swaps the `←` `→` keys. Precedence: `data-nav-dir` > `dir` option > document direction (`dir` on the root or an ancestor, read once at init) > `ltr` |
| `interaction`         | `'hover' \| 'click'`           | `'hover'`      | What opens a panel with the mouse. `data-nav-interaction` on the root wins  |
| `skipInWebflowEditor` | `boolean`                      | `true`         | No-op when `html.w-editor` is present, so panels stay editable in canvas    |
| `onValueChange`       | `(value: string \| null) => void` | —          | Called with the open item's value, or `null` when the menu closes           |

### CSS hooks

| Hook                       | Values                                                    | Set on                                |
| -------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `[data-state]`             | `open` \| `closed`                                        | root, triggers, contents, viewport    |
| `[data-motion]`            | `from-start` \| `from-end` \| `to-start` \| `to-end`       | contents (which way the panel slides) |
| `[data-position]`          | `before` \| `active` \| `after`                           | contents (side of the active panel; removed when closed, mirrored by `dir: 'rtl'`) |
| `[data-orientation]`       | `horizontal` \| `vertical`                                | root, list, viewport, contents        |
| `[data-nav-mode]`          | `mobile` \| `desktop`                                     | root                                  |
| `--nav-viewport-width`     | e.g. `480px` (`100%` on mobile)                           | viewport                              |
| `--nav-viewport-height`    | e.g. `320px`                                              | viewport                              |
| `[data-nav-align]`         | `viewport` (default) \| `trigger`                         | viewport (you set it)                 |
| `--nav-viewport-x`         | e.g. `120px` — only with `data-nav-align="trigger"`       | viewport                              |
| `--nav-trigger-x`          | e.g. `96px`, the active trigger's left edge, from the root's left | root                        |
| `--nav-trigger-width`      | e.g. `88px`                                               | root                                  |

Panels stay mounted for the duration of their CSS **animation** (not
transition), so `@keyframes` exit animations play out before the element is
hidden. Without an animation, hiding is immediate.

```css
[data-nav-viewport] {
  width: var(--nav-viewport-width);
  height: var(--nav-viewport-height);
  transition: width 0.25s ease, height 0.25s ease;
}

[data-nav-content] {
  position: absolute;
  top: 0;
  left: 0; /* top/left only — see the sizing rule below */
}

[data-nav-content][data-motion='from-end'] {
  animation: nav-enter-from-right 0.2s ease;
}
```

#### Anchoring to the trigger

Set `data-nav-align="trigger"` on the viewport and `--nav-viewport-x` follows the
active trigger's left edge, clamped so the panel never overflows the root (not
applied on mobile), relative to the viewport's positioning ancestor (the window
when the viewport is `position: fixed`).
`--nav-trigger-x` / `--nav-trigger-width` are always published, measured from the
**root's** left edge, so a pill needs no JS as long as the root is its
positioning ancestor:

```css
[data-nav-viewport] {
  position: absolute;
  top: 100%;
  left: 0;
  transform: translateX(var(--nav-viewport-x, 0px));
  transition: transform 0.25s ease, width 0.25s ease, height 0.25s ease;
}

[data-nav-menu] { position: relative; }
.nav-pill {
  position: absolute;
  left: 0;
  width: var(--nav-trigger-width);
  transform: translateX(var(--nav-trigger-x));
  transition: transform 0.25s ease, width 0.25s ease;
}
[data-nav-menu][data-state='closed'] .nav-pill { opacity: 0; }
```

Make the root `position: relative` and place the pill in it (not inside
`[data-nav-list]`): `--nav-trigger-x` is measured from the root, so the pill
stays aligned however much sits before the list, such as a logo.

> **Sizing rule — the one way to break this.** `--nav-viewport-*` is measured
> from the active panel's `scrollWidth`/`scrollHeight`, so the panel must have
> **no imposed size of its own**. Position it with `top`/`left` only. Give it
> `inset: 0`, `bottom: 0`, or `height: 100%` and the measurement becomes
> circular — the panel's box is stretched to the viewport, whose height came
> from the panel — with two visible symptoms: the viewport settles on the
> tallest panel and never shrinks, and the `ResizeObserver` re-measures on
> every frame of the size transition, so the height visibly chases itself.

> **Relocated panels and descendant selectors.** A panel moved out of its item
> no longer matches CSS that reaches it *through* the item, such as
> `.dropdown .panel`. The Designer does not move panels, so that CSS still
> looks right there and breaks only on the published site. Style panels by
> their own class or `[data-nav-content]`, and keep the sizing rule above in
> mind: inside the viewport, a panel must not impose its own size.

### Interaction model

- **Hover** a trigger for `delayDuration` to open; hovering a sibling within
  `skipDelayDuration` of a close switches instantly
- **Pointer** over the viewport keeps the menu open; leaving closes it after 150ms
- **Click** a trigger to toggle it — after a click-to-close the cursor must
  leave and re-enter before hover reopens it. Exception: the first **mouse**
  click on a panel that hover just opened is ignored (the user already opened
  it), and the next click toggles as usual. Keyboard activation
  (`Enter`/`Space`, `event.detail === 0`) and touch taps always toggle, and
  mobile mode has no hover, so it always toggles
- **Click** a trigger with `data-nav-trigger-mode="navigate"` follows its link
  instead of toggling (see "Trigger mode" below)
- **Click** a link inside a panel closes the menu; ⌘/Ctrl-click keeps it open
- **Click or focus** outside the nav closes the menu

Hover is mouse-only and disabled in mobile mode — touch devices fall through
to the click handler.

#### Click interaction

Set `data-nav-interaction="click"` on the root (or pass `interaction: 'click'`)
to drop hover entirely: a panel opens and closes only on trigger click, stays
open when the pointer leaves, and still closes on outside click, `Escape`, a
link click inside it, or focus leaving the nav. Clicking another trigger
switches panels. The keyboard behaves the same in both modes.

The mode is read once, at init, with this precedence: the attribute, when it is
exactly `hover` or `click`; else the `interaction` option, when valid; else
`hover`. Values are case-sensitive — `"Click"` is ignored, with a
`console.warn` naming the received value.

#### Trigger mode

A trigger that is also a link to the section's overview page can opt out of
click-toggling:

```html
<a href="/products" data-nav-trigger data-nav-trigger-mode="navigate">Products</a>
```

| Mode               | Click / `Enter`                         | Opens from                 |
| ------------------ | --------------------------------------- | -------------------------- |
| `toggle` (default) | Toggles the panel, navigation prevented | Click, hover, keyboard     |
| `navigate`         | Not prevented — the link navigates      | Hover, arrow keys, `Space` |

In click interaction mode there is no hover, so a `navigate` trigger's panel
opens from the keyboard only (arrow keys, `Space`); a click still navigates.

Trade-off: touch has no hover, so a `navigate` trigger on a touch device just
navigates and its panel is unreachable. Keep `toggle` (the default) wherever
touch users need the panel. ⌘/Ctrl-click on a `navigate` trigger opens the link
in a new tab and leaves the menu as it is; a ⌘/Ctrl-click on a link inside a
panel already keeps the menu open.

### Keyboard

Follows the [WAI-ARIA Disclosure Navigation][apg] pattern, where **Tab is the
primary path** — the triggers are ordinary tab stops, not a single roving one.
The menubar pattern (`role="menubar"`, arrow-only navigation) is deliberately
*not* used: the APG reserves it for application command menus, and it would
stop keyboard users tabbing through nav links the way they can everywhere else.

[apg]: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

| Key | Behavior |
| --- | --- |
| `Tab` on a trigger, panel closed | next nav stop — panels do **not** open on focus |
| `Tab` on a trigger, panel open | steps into the panel's first link |
| `Tab` on the last link in a panel | closes the panel, lands on the next nav stop |
| `Shift+Tab` on the first link in a panel | back to its trigger, panel stays open |
| `Enter` / `Space` | toggles the focused trigger's panel |
| `Escape` | closes and returns focus to the trigger |

So a full pass reads: `Products → (Enter) → Analytics → Automation → Reporting
→ Solutions → …`, and tabbing straight past the nav with everything closed
costs one stop per nav item.

Opening and closing look identical whether driven by pointer or keyboard. The
viewport only animates its size when moving *between* open panels; mounting
from closed always applies the size instantly, even when a reopen interrupts
the previous exit animation — which keyboard users hit constantly, since
`Enter` has none of hover's delay.

Because a panel in a shared `[data-nav-viewport]` is not a DOM sibling of its
trigger, natural tab order would be wrong — the library intercepts `Tab` and
drives the logical order instead. A closing panel is marked `inert` the moment
it starts its exit animation, so it can never be tabbed into while fading out.

Arrow keys are a secondary convenience and apply **only while a trigger has
focus**, so keys pressed inside a panel — arrows in a search field, say —
behave natively:

| Key | Behavior (on a trigger only) |
| --- | --- |
| `←` `→` | move between triggers, wrapping (`↑` `↓` when vertical); swapped when `dir: 'rtl'` |
| `↓` | move into the open panel (`→` when vertical, `←` when vertical and `dir: 'rtl'`) |
| `Home` / `End` | first / last trigger (reading order, not mirrored in RTL) |

### Webflow mobile integration

At or below the mobile breakpoint — 767px by default, or the root's
`[data-nav-breakpoint]` — the root is marked `[data-nav-mode="mobile"]`. If the
menu sits inside a Webflow `.w-nav`, closing the burger overlay resets the menu
so reopening it always starts on the main list, and crossing the breakpoint
closes any open panel. Add `[data-nav-back]` inside the menu for a back control
that closes the panel without dismissing the overlay.

### Mobile menu (toggle, card, accordion)

Opt in with markup alone — no project JS beyond `initNavigationMenu()`:

```html
<nav data-nav-menu>
  <button data-nav-toggle>Menu</button>
  <div data-nav-card>
    <div data-nav-list>…items…</div>
  </div>
</nav>
```

In `[data-nav-mode="mobile"]`:

- the toggle opens/closes the card (`data-state="open|closed"`, written only
  in mobile mode, so `[data-nav-card][data-state='closed']` rules cannot hide
  the desktop menu); Escape and a
  click outside close it, and Escape returns focus to the toggle. A panel's own
  Escape closes the panel first;
- triggers behave as an accordion — one panel open at a time, `data-state` on
  the item and the content, and focus moves to the first link on open;
- closing the card, or crossing the breakpoint, closes any open panel;
- while the card is open the page does not scroll (`overflow: hidden` on
  `<html>` and `<body>`, restored on close, so the scroll position is
  unchanged); panels stay scrollable. If the site uses Lenis and exposes it as
  `window.lenis`, it is stopped while the card is open and restarted after,
  and the card and panels get `data-lenis-prevent` so they keep native scroll.
  Call `lenis.stop()` yourself only after the card has closed, not while it is
  open: the library cannot tell your stop from its own, so closing the card
  would start Lenis again.
  nav-anim also never hides the navbar while the card is open.

On desktop none of this applies and existing behavior is unchanged. CSS owns
all visuals; hide `[data-nav-toggle]` above the breakpoint yourself.

### Overlay (backdrop)

Add `[data-nav-overlay]` for a backdrop or a solid overlay. It gets
`data-state="open|closed"` — open while a panel or the mobile card is open — and
`aria-hidden="true"`. A click on it closes the open panel and the card. It may
sit inside or outside the root. Outside, the first root to init owns it, and it
must not sit inside another root: init that root first if it is not a
`[data-nav-menu]`. The library writes state only; CSS decides how it looks.

Hide it **unless** it is open, not only when closed. It has no `data-state` in
the Webflow Designer (`skipInWebflowEditor`), before the script loads and after
`destroy()`, and a backdrop that only hides on `closed` would cover the page
then:

```css
[data-nav-overlay] {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.4);
  transition: opacity 0.2s, visibility 0.2s;
}
[data-nav-overlay]:not([data-state='open']) {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
```

The overlay adds no scroll lock of its own; the mobile card already freezes
page scroll (see above). `destroy()` removes the listener, `data-state` and the
`aria-hidden` it added.

## Development

### Available Scripts

#### Building

```bash
pnpm build             # Build types + ESM + browser bundle
pnpm build:clean       # Clean and rebuild
pnpm build:watch       # Watch mode
```

#### Examples

```bash
pnpm example           # Build, then open docs/examples/local/
```

`docs/examples/local/` loads the local `dist/navigation.browser.js` build and
styles it with nothing but the `[data-state]` / `[data-motion]` /
`--nav-viewport-*` hooks, so it doubles as a check that those hooks are enough
to build with. It carries a live state inspector and a checklist covering
pointer, keyboard, screen-reader, mobile and scroll behavior — resize to or
below the mobile breakpoint (767px by default, or `[data-nav-breakpoint]`) for
the mobile layer and the Webflow burger integration. Not published
(`files` in `package.json` excludes it).

#### Testing

```bash
pnpm test              # Run tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
pnpm test:ui           # With UI
```

#### Code Quality

```bash
pnpm typecheck         # Type checking
pnpm lint              # Lint with Biome (--write)
pnpm format            # Format with Biome (--write)
```

## Project Structure

```
docs/examples/
└── local/index.html            # Runnable example (pnpm example)
src/
├── index.ts                    # Main entry point
├── config.ts                   # NAV_ROOT_SELECTOR — the shared nav root
├── __tests__/
│   └── config.test.ts          # Asserts both features share the root selector
├── nav-anim/                   # GSAP scroll show/hide for the navbar shell
│   ├── index.ts                # Navbar animation initialization
│   ├── config.ts               # Configuration constants
│   ├── initial-animation.ts    # Initial slide-in animation
│   ├── scroll-behaviour.ts     # Scroll-based show/hide logic
│   └── __tests__/
│       ├── index.test.ts             # Initialization tests
│       └── scroll-behaviour.test.ts  # Scroll behavior tests
└── nav-menu/                   # Accessible dropdown menu
    ├── index.ts                # Ref discovery, ARIA wiring, public API
    ├── config.ts               # Selectors, attributes, timings
    ├── types.ts                # Shared types
    ├── controller.ts           # Open/closed state machine and hover timers
    ├── render.ts               # Data attributes, viewport sizing, ResizeObserver
    ├── pointer.ts              # Hover, outside dismiss, panel link clicks
    ├── keyboard.ts             # Arrow/Home/End/Enter/Escape handling
    ├── mobile.ts               # Breakpoint mode and Webflow burger integration
    └── __tests__/
        ├── helpers.ts          # Shared markup and event helpers
        ├── index.test.ts       # Initialization and ARIA tests
        ├── pointer.test.ts     # Hover, click, dismiss behavior
        ├── keyboard.test.ts    # Keyboard navigation
        ├── render.test.ts      # State hooks, motion, viewport sizing
        └── mobile.test.ts      # Breakpoint and burger overlay behavior
```

## Configuration

The nav root selector is shared: `NAV_ROOT_SELECTOR` in `src/config.ts` is the
single source of truth, and both feature configs reference it. Feature-specific
selectors and fixed timings live in `config.ts` next to each feature. Changing
any selector is a **breaking change** for every consumer.

`nav-anim/config.ts`:

```typescript
{
  position: {
    hidden: '-100%',   // Y position when hidden
    visible: '0%'      // Y position when visible
  },
  scroll: {
    threshold: 50      // Default for the scrollThreshold option
  },
  selectors: {
    navbar: '[data-nav-menu]' // Shared NAV_ROOT_SELECTOR from src/config.ts
  },
  attributes: {
    hideOnScroll: 'data-nav-hide-on-scroll',
    scrollThreshold: 'data-nav-scroll-threshold',
    animDuration: 'data-nav-anim-duration',
    animEasing: 'data-nav-anim-easing'
  }
}
```

`nav-menu/config.ts`:

```typescript
{
  selectors: {
    root: '[data-nav-menu]',
    list: '[data-nav-list]',
    item: '[data-nav-item]',
    trigger: '[data-nav-trigger]',
    content: '[data-nav-content]',
    link: '[data-nav-link]',
    viewport: '[data-nav-viewport]',
    back: '[data-nav-back]',
    webflowNav: '.w-nav',
    webflowBurger: '.w-nav-button'
  },
  attributes: {
    item: 'data-nav-item',
    content: 'data-nav-content',
    delay: 'data-nav-delay',
    skipDelay: 'data-nav-skip-delay',
    closeDelay: 'data-nav-close-delay',
    orientation: 'data-nav-orientation',
    dir: 'data-nav-dir',
    interaction: 'data-nav-interaction',
    breakpoint: 'data-nav-breakpoint'
  },
  timing: {
    closeDelay: 150        // Default for the closeDelay option, in ms
  },
  mobile: {
    breakpoint: 767,       // Max viewport width in px; [data-nav-breakpoint] overrides it
    maxBreakpoint: 4000    // Largest accepted [data-nav-breakpoint]; invalid values warn and use 767
  },
  editorClass: 'w-editor'  // Webflow Designer canvas marker
}
```

## Publishing

This package uses automated semantic versioning and publishing through GitHub Actions. The release process is triggered automatically on pushes to the `main` branch (or manually via the **Release** workflow's `workflow_dispatch`) and publishes to the **public npm registry** (`registry.npmjs.org`) under the `@refokus-agency` scope.

### Release Process

The publishing workflow (`.github/workflows/main-release.yml`, named **Release**) calls the `refokus-agency/platform` reusable workflows (`ci.yml` then `release.yml`) and handles:

1. **Automatic Triggering**: Release checks run on push to the `main` branch.

2. **Authentication**: Publishing to npm uses **OIDC Trusted Publishing** — there is **no `NPM_TOKEN`** secret. The caller grants `permissions: id-token: write`, which lets npm mint a short-lived credential at publish time. For this to work, a **Trusted Publisher** must be configured for `@refokus-agency/navigation` on [npmjs.com](https://docs.npmjs.com/trusted-publishers) (Package settings → Trusted Publisher), pointing at this repository (`refokus-agency/navigation`) with the **workflow filename `main-release.yml`**. Note: even though the publish step runs inside the `refokus-agency/platform` reusable workflow (`release.yml`), npm authorizes the **entry-point (caller) workflow** — the one that triggers the run and holds `id-token: write` — so enter exactly `main-release.yml` (the file in *this* repo), **not** `release.yml`.

### Semantic Versioning

> **⚠️ WARNING:**
> This repository uses automated semantic versioning and publishing.
> **Do not publish manually with `npm publish`.**
> All releases are handled by GitHub Actions via semantic-release.
>
> To trigger a release, push to the `main` branch or use the GitHub Actions workflow manually.
>
> Ensure your commits follow [Conventional Commits](https://www.conventionalcommits.org/) to enable correct versioning and changelog generation.
> In order to do that, you MUST run `pnpm commit` to use the Commitizen wizard and stay compliant with our versioning standards.

The project uses [semantic-release](https://semantic-release.gitbook.io/) for automated version management based on conventional commits:

- **Major version** (`x.0.0`): Breaking changes (commits with `BREAKING CHANGE:` or `!:`)
- **Minor version** (`0.x.0`): New features (commits with `feat:`)
- **Patch version** (`0.0.x`): Bug fixes (commits with `fix:`)

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Feature
feat: add new functionality

# Bug fix
fix: resolve issue with feature

# Breaking change
feat!: remove deprecated API
# or
feat: add new API
BREAKING CHANGE: old API has been removed

# Documentation
docs: update README

# Style changes
style: format code

# Refactoring
refactor: restructure code

# Performance
perf: improve performance

# Tests
test: add unit tests
```

### Publishing to public npm

The package is published to the **public npm registry** under the `@refokus-agency` scope, so consumers can `npm install @refokus-agency/navigation` with no auth or registry configuration. The release:

- Targets the public npm registry (`https://registry.npmjs.org`) via `publishConfig`
- Publishes as a **public** scoped package (`access: public`)
- Authenticates with **OIDC Trusted Publishing** — no `NPM_TOKEN` secret; the workflow requires `id-token: write`
- Keeps npm **provenance disabled** because the repository is currently private (provenance requires a public repo). When the repo is made public, pass `provenance: true` from the `main-release.yml` caller to enable signed provenance

> **Peer dependency:** `gsap` is a **peer dependency** and is not bundled. Consumers must install it themselves (`npm install gsap`), or provide it globally as Webflow/CDN setups already do.

### Manual Release

To trigger a release manually:

1. Go to the GitHub repository
2. Navigate to the **Actions** tab
3. Select the **Release** workflow
4. Click **Run workflow**
5. Choose the branch (usually `main`)
6. Click **Run workflow**

### Prerequisites

Before publishing, ensure:

- All tests pass (`pnpm test`)
- Code is properly formatted (`pnpm format`)
- Linting passes (`pnpm lint`)
- Type checking passes (`pnpm typecheck`)
- Commit messages follow conventional commits format

### Release Notes

Semantic-release automatically:

- Generates changelog based on commit messages
- Creates GitHub releases with release notes
- Tags releases in Git
- Updates package version in `package.json`

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md)
and [Code of Conduct](CODE_OF_CONDUCT.md) before opening an issue or pull
request.

## Security

To report a security vulnerability, please follow our
[Security Policy](SECURITY.md) — do not open a public issue.

## Changelog

Release notes are published automatically on the
[GitHub Releases](https://github.com/refokus-agency/navigation/releases) page.

## License

Licensed under the [Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).
