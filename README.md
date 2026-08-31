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

- Node.js >= 22.0.0

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
const success = initNavbarAnimation({
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
});

if (success) {
  console.log('Navbar animation initialized');
}
```

### How It Works

- **Initial Animation**: Navbar slides in smoothly on page load
- **Scroll Down**: Navbar hides when scrolling down past threshold (50px)
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

| Attribute             | Purpose                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| `data-nav-menu`       | Menu root. Gets `role="navigation"` unless you set a role yourself                   |
| `data-nav-list`       | Wrapper around the items (optional, receives `[data-orientation]`)                  |
| `data-nav-item`       | One nav entry. Its value pairs the trigger with its panel; auto-filled when omitted |
| `data-nav-trigger`    | Opens the panel. Gets `id`, `aria-expanded`, `aria-controls` when it owns a panel    |
| `data-nav-content`    | The dropdown panel. Gets `id`, `role="region"` and `aria-labelledby`                |
| `data-nav-viewport`   | Optional shared container for all panels — enables animated size transitions        |
| `data-nav-link`       | A plain link. Inside a panel it also dismisses the menu on click                    |
| `data-nav-back`       | Mobile "back" control — closes the open panel without closing the burger overlay    |

Panels may live inside a shared `[data-nav-viewport]` or directly inside their
`[data-nav-item]`. The viewport form is preferred: it lets one element animate
between panel sizes.

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
| `orientation`         | `'horizontal' \| 'vertical'`   | `'horizontal'` | Drives `[data-orientation]` and which arrow keys navigate                    |
| `dir`                 | `'ltr' \| 'rtl'`               | `'ltr'`        | Mirrors the `[data-motion]` direction                                       |
| `skipInWebflowEditor` | `boolean`                      | `true`         | No-op when `html.w-editor` is present, so panels stay editable in canvas    |
| `onValueChange`       | `(value: string \| null) => void` | —          | Called with the open item's value, or `null` when the menu closes           |

### CSS hooks

| Hook                       | Values                                                    | Set on                                |
| -------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `[data-state]`             | `open` \| `closed`                                        | root, triggers, contents, viewport    |
| `[data-motion]`            | `from-start` \| `from-end` \| `to-start` \| `to-end`       | contents (which way the panel slides) |
| `[data-orientation]`       | `horizontal` \| `vertical`                                | root, list, viewport, contents        |
| `[data-nav-mode]`          | `mobile` \| `desktop`                                     | root                                  |
| `--nav-viewport-width`     | e.g. `480px` (`100%` on mobile)                           | viewport                              |
| `--nav-viewport-height`    | e.g. `320px`                                              | viewport                              |

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

> **Sizing rule — the one way to break this.** `--nav-viewport-*` is measured
> from the active panel's `scrollWidth`/`scrollHeight`, so the panel must have
> **no imposed size of its own**. Position it with `top`/`left` only. Give it
> `inset: 0`, `bottom: 0`, or `height: 100%` and the measurement becomes
> circular — the panel's box is stretched to the viewport, whose height came
> from the panel — with two visible symptoms: the viewport settles on the
> tallest panel and never shrinks, and the `ResizeObserver` re-measures on
> every frame of the size transition, so the height visibly chases itself.

### Interaction model

- **Hover** a trigger for `delayDuration` to open; hovering a sibling within
  `skipDelayDuration` of a close switches instantly
- **Pointer** over the viewport keeps the menu open; leaving closes it after 150ms
- **Click** a trigger to toggle it — after a click-to-close the cursor must
  leave and re-enter before hover reopens it
- **Click** a link inside a panel closes the menu; ⌘/Ctrl-click keeps it open
- **Click or focus** outside the nav closes the menu
Hover is mouse-only and disabled in mobile mode — touch devices fall through
to the click handler.

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
| `←` `→` | move between triggers, wrapping (`↑` `↓` when vertical) |
| `↓` | move into the open panel (`→` when vertical) |
| `Home` / `End` | first / last trigger |

### Webflow mobile integration

Below 767px the root is marked `[data-nav-mode="mobile"]`. If the menu sits
inside a Webflow `.w-nav`, closing the burger overlay resets the menu so
reopening it always starts on the main list, and crossing the breakpoint
closes any open panel. Add `[data-nav-back]` inside the menu for a back control
that closes the panel without dismissing the overlay.

## Development

### Available Scripts

#### Building

```bash
pnpm build             # Build types + ESM + browser bundle
pnpm build:clean       # Clean and rebuild
pnpm build:watch       # Watch mode
```

#### Testing

```bash
pnpm test              # Run tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
pnpm test:ui           # With UI
```

#### Code Quality

```bash
pnpm check-types       # Type checking
pnpm lint              # Lint with Biome (--write)
pnpm format            # Format with Biome (--write)
```

## Project Structure

```
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
    threshold: 50      // Minimum scroll distance to trigger animation
  },
  selectors: {
    navbar: '[data-nav-menu]' // Shared NAV_ROOT_SELECTOR from src/config.ts
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
  timing: {
    closeDelay: 150        // Grace period after the pointer leaves, in ms
  },
  mobile: {
    query: '(max-width: 767px)'
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
- Type checking passes (`pnpm check-types`)
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
