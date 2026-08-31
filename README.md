# @refokus-agency/navigation

[![CI](https://github.com/refokus-agency/navigation/actions/workflows/pr-ci.yml/badge.svg)](https://github.com/refokus-agency/navigation/actions/workflows/pr-ci.yml)
[![npm version](https://img.shields.io/npm/v/@refokus-agency/navigation.svg)](https://www.npmjs.com/package/@refokus-agency/navigation)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A TypeScript package for implementing smooth navbar animations with GSAP, featuring scroll-based show/hide behavior and customizable animation settings.

## Features

- ✨ Smooth GSAP-powered animations
- 📜 Scroll-based navbar show/hide behavior
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

1. Add the `r-navbar` attribute to your navbar element(s), and tell each one
   which behaviour it should use with `r-navbar-behaviour`:

```html
<nav r-navbar r-navbar-behaviour="hide">
  <!-- Your navbar content -->
</nav>
```

> **A navbar without `r-navbar-behaviour` is left completely alone.** The
> attribute is opt-in: absent, empty, or unrecognised all mean "no animation".

2. Initialize the navbar animation system:

```typescript
import { initNavbarAnimation } from '@refokus-agency/navigation';

const handle = initNavbarAnimation({
  animationDuration: 0.3,
  animationEasing: 'power2.inOut',
});

if (handle) {
  console.log('Found a navbar');
}

// Later — removes the scroll subscription, kills in-flight tweens, and clears
// every inline property the package wrote.
if (handle) handle.destroy();
```

`initNavbarAnimation` returns a handle, or `false` when no `[r-navbar]` element
is found.

> **A truthy handle does not mean anything is animating.** It reports only that
> a `[r-navbar]` element exists — every one of them may have opted out. When
> navbars are present and none opted into a behaviour, the package warns in the
> console rather than failing silently.

### Behaviours

Each navbar picks its own behaviour, so a page can mix them freely.

| `r-navbar-behaviour` | What happens                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| *absent* or empty    | Nothing. The element is left untouched.                                   |
| `hide`               | Slides the navbar out of the viewport on scroll down, back in on scroll up. |

Further behaviours plug into the same seam without touching this module.

### Options

| Option              | Default          | Description                                            |
| ------------------- | ---------------- | ------------------------------------------------------ |
| `animationDuration` | `0.3`            | Tween duration, in seconds.                            |
| `animationEasing`   | `'power2.inOut'` | GSAP easing string.                                    |

### How It Works

- **Initial Animation**: Navbar slides in smoothly on page load
- **Scroll Down**: The navbar's behaviour triggers once scroll passes the threshold (50px)
- **Scroll Up**: The navbar returns to its resting state
- **Multiple Navbars**: Every `[r-navbar]` gets its own independent state, and they all share a single scroll listener

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
└── nav-anim/
    ├── index.ts                # Initialization, attribute resolution, handle
    ├── config.ts               # Configuration constants
    ├── types.ts                # Shared types
    ├── initial-animation.ts    # Initial slide-in animation
    ├── scroll-source.ts        # Single shared passive scroll listener
    ├── behaviours/
    │   └── hide.ts             # Slide out of the viewport
    └── __tests__/
      ├── index.test.ts             # Initialization tests
      ├── scroll-source.test.ts     # Shared listener tests
      └── behaviours/
        └── hide.test.ts            # Hide behaviour tests
```

## Configuration

The package uses the following default configuration:

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
    navbar: '[r-navbar]'                 // Navbar elements
  },
  attributes: {
    behaviour: 'r-navbar-behaviour'      // Per-element behaviour selector
  }
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
