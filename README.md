# @refokus-agency/navigation

A TypeScript package for implementing smooth navbar animations with GSAP, featuring scroll-based show/hide behavior and customizable animation settings.

## Features

- ✨ Smooth GSAP-powered animations
- 📜 Scroll-based navbar show/hide behavior
- ⚙️ Configurable animation settings
- 🎯 Attribute-based element selection
- 📦 ES Module-only package (no CommonJS support)
- 🔧 Modern TypeScript configuration with strict mode
- 🧪 Testing setup with Vitest
- 🎨 Code formatting with Prettier
- 🔍 Linting with ESLint (flat config)
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

1. Add the `r-navbar` attribute to your navbar element(s):

```html
<nav r-navbar>
  <!-- Your navbar content -->
</nav>
```

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
- **Multiple Navbars**: Supports multiple navbar elements with the same attribute

## Development

### Available Scripts

#### Building

```bash
npm run build          # Compile TypeScript
npm run build:clean    # Clean and rebuild
npm run build:watch    # Watch mode
```

#### Testing

```bash
npm test               # Run tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
npm run test:ui        # With UI
```

#### Code Quality

```bash
npm run check-types    # Type checking
npm run lint           # Lint and fix
npm run format         # Format code
```

## Project Structure

```
src/
├── index.ts                    # Main entry point
└── nav-anim/
    ├── index.ts                # Navbar animation initialization
    ├── config.ts               # Configuration constants
    ├── initial-animation.ts    # Initial slide-in animation
    ├── scroll-behaviour.ts     # Scroll-based show/hide logic
    └── __tests__/
      ├── index.test.ts             # Initialization tests
      └── scroll-behaviour.test.ts  # Scroll behavior tests
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
    navbar: '[r-navbar]' // Attribute selector for navbar elements
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
> In order to do that, you MUST run `npm run commit` to use the Commitizen wizard and stay compliant with our versioning standards.

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

- All tests pass (`npm test`)
- Code is properly formatted (`npm run format`)
- Linting passes (`npm run lint`)
- Type checking passes (`npm run check-types`)
- Commit messages follow conventional commits format

### Release Notes

Semantic-release automatically:

- Generates changelog based on commit messages
- Creates GitHub releases with release notes
- Tags releases in Git
- Updates package version in `package.json`

## License

See [LICENSE](LICENSE) file.
