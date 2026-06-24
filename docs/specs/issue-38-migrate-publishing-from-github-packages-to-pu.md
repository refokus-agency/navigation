---
issue_number: 38
issue_title: "feat: migrate publishing from GitHub Packages to public npm via OIDC Trusted Publishing"
repo: "refokus-agency/navigation"
labels: [enhancement]
plan_level: "full"
depth: "medium"
branch_name: "feat/migrate-publish-public-npm-oidc"
created_at: "2026-06-24T14:51:27Z"
---

# Implementation Plan: #38 — migrate publishing from GitHub Packages to public npm via OIDC Trusted Publishing

> **Key reframe from platform PR #32 (MERGED):** the public-npm path shipped **additively on `release.yml@v1`** — there is **no `@v2`**. The caller stays pinned to `@v1` and only gains `with: registry: npm` + `permissions: id-token: write`. This overrides the issue's "bump to `@v2`" and "replace `secrets: inherit` with explicit secret mapping" items (decided during cothinker discovery — see Acceptance Criteria AC-1 and AC-9).

## Files

| File | Change |
|---|---|
| `.github/workflows/main-release.yml` | Add `id-token: write` to `permissions`; **drop `packages: write`**; add `with: registry: npm` to the `release` job. Keep `@v1`, keep `secrets: inherit`. |
| `package.json` | `publishConfig` → `{ "registry": "https://registry.npmjs.org", "access": "public" }`; move `gsap` from `dependencies` → `peerDependencies`; set `author`; `repository.url` from `git+ssh://` → `git+https://`. |
| `README.md` | Rewrite Publishing sections (L127–232): remove `GH_PAT_TOKEN`/`Production`/PAT scopes, fix nonexistent `release-package-version.yml` → `main-release.yml` (workflow name "Release"), replace GitHub-Packages framing with public-npm + OIDC, note gsap peer requirement. |
| `.gitignore` | Append `.cothinker/` (cothinker session artifacts). |

## Codebase Context

**Modules / patterns to reuse:**
- **Authoritative caller template:** platform `examples/main-release-npm.yml@v1`. The current `main-release.yml` differs from it only by two added lines (`id-token: write` in `permissions`, `with: registry: npm` on the `release` job). This plan also drops `packages: write`, which the example keeps (harmless but unused on the npm path — see B3 decision).
- The reusable `release.yml@v1` (platform) already: validates the `registry` input (`github-packages` | `npm`), guarantees npm ≥ 11.5.1 on the npm path, gates the GitHub-Packages `~/.npmrc` step, and runs a separate "Semantic release (public npm via OIDC)" step that **deliberately omits `NODE_AUTH_TOKEN`** so npm performs the OIDC token exchange and sets `NPM_CONFIG_PROVENANCE`.
- Reusable inputs and their defaults — caller passes **only** `registry: npm`:
  - `provenance` default `false` → correct, repo stays private (provenance requires a public repo and would hard-fail).
  - `npm-version` default `11.6.2` → satisfies the OIDC ≥ 11.5.1 requirement.

**Patterns to respect (CLAUDE.md invariants):**
- Do not `npm publish` manually; do not bump `version` (stays `0.0.0-development`, semantic-release sets it).
- Keep `secrets: inherit` (platform CLAUDE.md invariant — the remaining secrets are not registry-specific).
- Conventional Commits via `pnpm commit`; `gsap` is an external peer per CLAUDE.md (this plan finally aligns `package.json` to that prose).
- `README.md` is in `files` → it ships in the published tarball; leaked secret strings currently ship publicly, so the rewrite is a security fix, not just docs.

**Reference implementations:**
- platform PR #32: `refokus-agency/platform#32` (the `registry` input + OIDC path).
- platform `examples/main-release-npm.yml@v1` (the caller shape to mirror).
- platform `docs/secrets.md@v1` (OIDC + Trusted Publisher setup, `publishConfig` gotcha).

## Steps

1. **`main-release.yml` — workflow wiring.** Add `id-token: write` to the top-level `permissions` block, remove `packages: write`, and add `with:` / `registry: npm` under the `release` job. Keep `@v1` on both `ci` and `release`, keep `secrets: inherit`.
   **Done when:** the caller matches platform's `main-release-npm.yml@v1` (minus `packages: write`) and `actionlint` is clean.

2. **`package.json` — publishConfig.** Set `publishConfig` to `{ "registry": "https://registry.npmjs.org", "access": "public" }`.
   **Done when:** `access: public` is present (required for scoped packages or the publish fails) and the registry is `registry.npmjs.org`.

3. **`package.json` — gsap → peerDependencies.** Move `"gsap": "^3.14.2"` from `dependencies` into a new `peerDependencies` block; remove the now-empty `dependencies` object.
   **Done when:** `gsap` appears only under `peerDependencies`.

4. **`package.json` — metadata.** Set a non-empty `"author"` and change `repository.url` from `git+ssh://git@github.com/...` to `git+https://github.com/refokus-agency/navigation.git`.
   **Done when:** no `git+ssh://` remains and `author` is non-empty.

5. **README — Publishing rewrite (L127–232).** Replace the Publishing block: remove `GH_PAT_TOKEN`, the `Production` environment, and PAT scopes; fix the nonexistent `release-package-version.yml` reference to `main-release.yml` (workflow name "Release"); replace "Publishing to GitHub Packages" with public-npm + OIDC Trusted Publishing; document that consumers must provide `gsap` (peer) and that the Trusted Publisher must be configured on npmjs.org pointing at `release.yml`.
   **Done when:** grep for `GH_PAT_TOKEN`, `npm.pkg.github.com`, `release-package-version.yml`, `Production` returns zero hits, and the section describes public npm.

6. **`.gitignore` — ignore cothinker artifacts.** Append `.cothinker/`.
   **Done when:** `.cothinker/` is present in `.gitignore`.

7. **Local gates.** Run `pnpm install && pnpm check-types && pnpm lint && pnpm test && pnpm build`.
   **Done when:** all pass.

## Interfaces

No code/type interfaces change. The "interface" touched is the **CI caller contract** and the **package manifest**:

```yaml
# .github/workflows/main-release.yml (release job)
permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write          # added — lets npm mint the OIDC credential
  # packages: write        # removed — no GitHub Packages target after migration

jobs:
  release:
    needs: ci
    uses: refokus-agency/platform/.github/workflows/release.yml@v1
    with:
      registry: npm         # added — selects the public-npm OIDC path
    secrets: inherit        # kept — platform invariant
```

```jsonc
// package.json
"publishConfig": { "registry": "https://registry.npmjs.org", "access": "public" },
"peerDependencies": { "gsap": "^3.14.2" }   // moved out of dependencies
```

## Function Design

N/A — no application code changes. All edits are to configuration manifests (`package.json`, workflow YAML, `.gitignore`) and documentation (`README.md`).

## Acceptance Criteria (EARS)

- **AC-1** — When a push to `main` triggers the release, the system shall call `refokus-agency/platform/.github/workflows/release.yml@v1` with `registry: npm`. *(reframed from the issue's `@v2`; no `@v2` exists — PR #32 shipped additively on v1.)*
- **AC-2** — The release caller workflow shall declare `permissions: id-token: write` so npm can mint the short-lived OIDC credential.
- **AC-3** — The release shall authenticate via OIDC Trusted Publishing, with no `NPM_TOKEN` secret present in the repo.
- **AC-4** — The `package.json` `publishConfig` shall equal `{ "registry": "https://registry.npmjs.org", "access": "public" }`.
- **AC-5** — Where a consumer runs `npm install @refokus-agency/navigation` in a clean, unauthenticated environment, the install shall succeed (package is public on registry.npmjs.org).
- **AC-6** — `gsap` shall be declared as a `peerDependency` and shall not be force-installed as a runtime dependency for consumers.
- **AC-7** — The published tarball and README shall contain no secret names, PAT scopes, or GitHub-Packages-only instructions.
- **AC-8** — While the GitHub repository is private, the release shall still succeed and npm provenance shall remain disabled.
- **AC-9** — `secrets: inherit` shall be retained in both caller workflows. *(reframed from the issue's "explicit secret mapping" — kept per platform CLAUDE.md invariant.)*

## Out of Scope

- Configuring the Trusted Publisher on **npmjs.org** (Package settings → Trusted Publisher pointing at this repo + `release.yml`) — manual, outside the repo; documented as a prerequisite.
- Any change to `pr-ci.yml` — PR CI does not publish and needs no `id-token`.
- Enabling npm provenance or making the repository public.
- Deleting old GitHub Packages versions — documented that public npm is the new source of truth.

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
|---|---|---|---|
| 1 | Trusted Publisher not yet configured on npmjs.org | [from issue] | First publish hard-fails; documented as a manual prerequisite and as a Test-Strategy gate to satisfy before merge. |
| 2 | Leftover `publishConfig.registry = npm.pkg.github.com` silently routes publish to the wrong registry | [from PR #32] | Step 2 overwrites `publishConfig` explicitly to `registry.npmjs.org` — `publishConfig.registry` wins over everything else. |
| 3 | Webflow/CDN consumers already load gsap globally | [from issue] | The `peerDependency` change matches that usage contract; documented in README. |
| 4 | Provenance accidentally enabled while repo is private | [from issue] | Caller passes no `provenance` input → reusable default `false`; AC-8 verifies provenance stays off. |
| 5 | Workflow filename mismatch vs Trusted Publisher config | [from issue] | The reusable workflow is `release.yml` (the caller is `main-release.yml`); the Trusted Publisher must point at `release.yml`. Documented in README. |
| 6 | First-ever publish vs subsequent publishes under Trusted Publishing | [from issue] | No code difference; verification happens on the first real `main` release (Test Strategy). |

## Done Criteria per Feature

| Feature | ACs that must all pass |
|---|---|
| Workflow → public-npm OIDC | AC-1, AC-2, AC-3, AC-8, AC-9 |
| package.json publish config | AC-4, AC-5 |
| gsap peer dependency | AC-6 |
| README / secret hygiene | AC-7 |

## Risks

- **First publish can't be verified locally** — the OIDC exchange only runs from a real caller with the Trusted Publisher pre-configured on npmjs.org. Mitigation: complete the manual npmjs.org setup first; treat the first push to `main` as the live verification (watch the Actions log for `registry.npmjs.org` before publish).
- **gsap peerDependency is a consumer behavior change** — consumers must now provide gsap themselves. Mitigation: ship in the same release and note it in the changelog (via the `feat` commit body); the change matches the documented Webflow/CDN usage contract.
- **Stale README shipped publicly** — until merged + released, the current tarball still leaks `GH_PAT_TOKEN`. Mitigation: land the README rewrite in the same PR so the first public-npm release carries the cleaned README.

## Test Strategy

**Local (pre-PR):**
- `pnpm install && pnpm check-types && pnpm lint && pnpm test && pnpm build` — all green.
- `actionlint` on `main-release.yml` — clean.
- Grep the repo for `GH_PAT_TOKEN`, `npm.pkg.github.com`, `release-package-version.yml`, `Production` → zero hits after edits.
- `npm pack --dry-run` → inspect the tarball file list and the bundled README for any leaked secret strings.

**Live (post-merge, manual prerequisite first):**
- Confirm the Trusted Publisher is configured on npmjs.org for `@refokus-agency/navigation` → repo `refokus-agency/navigation` + workflow `release.yml`.
- Push to `main`: the Actions log for the npm path should print `registry.npmjs.org` before publish; the release should succeed while the repo stays private with provenance off.
- From a clean, unauthenticated environment: `npm install @refokus-agency/navigation` succeeds.
