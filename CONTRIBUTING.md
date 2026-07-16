# Contributing to @refokus-agency/navigation

Thanks for your interest in contributing! This document explains how to set up
the project and submit changes.

By participating, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

1. Fork the repository.
2. Create a branch from `main`.
3. Make your changes (include tests for new behavior).
4. Open a Pull Request against `main`.

We follow [Conventional Commits](https://www.conventionalcommits.org/) — the
commit type drives the automated version bump, so it matters.

## Development Setup

Requirements:

- **Node.js >= 22** (see `.nvmrc`)
- **pnpm** (canonical package manager; `npm` also works)

```bash
pnpm install          # install dependencies
pnpm test             # run the test suite (Vitest, jsdom)
pnpm test:watch       # tests in watch mode
pnpm check-types      # strict type checking (tsc --noEmit)
pnpm lint             # Biome lint (with --write)
pnpm format           # Biome format (with --write)
pnpm build            # types + ESM + browser bundle
```

`gsap` is a **peer dependency** and is not bundled — it is already installed as
a dev dependency for local development.

## Submitting Issues

Please use the [issue templates](https://github.com/refokus-agency/navigation/issues/new/choose).
Include the package version, your environment (Node.js and GSAP versions,
browser), and clear steps to reproduce.

## Submitting Pull Requests

- CI must pass (lint + type check + tests + build).
- Add or update tests for any behavior change.
- Keep the PR focused and describe the problem it solves.
- Use Conventional Commits. The easiest way to stay compliant is:

```bash
pnpm commit           # Commitizen wizard
```

Do **not** bump the version in `package.json` (it is pinned to
`0.0.0-development`) and do **not** run `npm publish` — releases are fully
automated by semantic-release on merge to `main`.

## Code Style

- **TypeScript** in strict mode.
- **Biome** for linting and formatting.

Run `pnpm lint && pnpm format` before opening your PR.

## Response Time

This project is maintained alongside client work. We aim to respond to issues
and PRs within roughly one to two weeks. Thanks for your patience.
