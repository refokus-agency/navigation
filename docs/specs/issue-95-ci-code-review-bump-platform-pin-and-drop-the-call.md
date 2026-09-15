---
issue_number: 95
issue_title: "ci(code-review): bump platform pin and drop the caller concurrency block"
repo: "refokus-agency/navigation"
labels: [bug]
plan_level: "full"
depth: "medium"
branch_name: "beogip/ci-code-review-bump-platform-pin-and-drop-the-ca"
created_at: "2026-09-15T19:03:55Z"
---

# Implementation Plan: #95 — ci(code-review): bump platform pin and drop the caller concurrency block

> **Issue premises corrected during planning.** The issue states the repo is pinned to `@v1.10.2`
> and that the concurrency block sits at lines 46-52. Neither is true as of commit `6c99f84`
> (PR #94): the repo is on `@v1.10.3`, and the block sits at `:58-60` with five comment lines
> above it at `:52-57`. All edits below anchor on **content**, never on line numbers.
> The target release is `v1.11.0` — verified as the first release containing `df02d4ff`
> (platform#97).

## Files

| # | Action | Path | Purpose |
|---|--------|------|---------|
| 1 | modify | `.github/workflows/comment-code-review.yml` | Drop the caller `concurrency:` block and its now-wrong rationale; bump the two-line platform pin `v1.10.3 → v1.11.0`; update the recorded tag SHA |

## Codebase Context

- **`comment-code-review.yml:24-38` (deviation 3)** — the pin rationale records the tag's commit
  SHA "because a tag is mutable". `v1.10.3 = a8da1da7adc68709d91bfe26fbe5afd9d35a9f8e` (verified
  via `gh api repos/refokus-agency/platform/git/ref/tags/v1.10.3`). This line is **part of the
  pin** and must move with it. The issue does not mention it — a genuine omission in the issue,
  not an optional extra.
- **The pin is two lines**, not one — `uses: ...@v1.10.3` (`:64`) and `with: platform-ref: v1.10.3`
  (`:67`). They must never drift apart.
- **Deviations 1 and 2 stay untouched** — the explicit secrets map (not blanket `inherit`) and
  `id-token: write`. Verified against `v1.11.0`: the reusable's `secrets:` interface is unchanged
  (`ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN`, both `required: false`), so the explicit map
  remains correct and complete.
- **Verified upstream facts** — platform `v1.11.0`, tag object SHA
  `7a6fe894f7f8383aed085de279a5f91e7e3c182c`, is the first release containing `df02d4ff`
  (`fix(code-review): reusable owns review serialization`, PR #97, merged 2026-09-15T17:30:40Z;
  release cut 17:33:46Z). At that ref the reusable's `review:` job carries its own job-level
  `concurrency:` group keyed on `inputs.trigger-phrase` — matching comments collapse onto a shared
  `-request` key and queue, non-matching comments fall to `github.event.comment.id` and contend
  with nothing — plus a `timeout-minutes` input (`type: number`, default `30`, interpolated via
  `fromJSON`). The anchor
  `docs/architecture.md#why-serialization-lives-in-the-reusable-not-the-caller` exists at that ref.
- **Sibling callers** — `pr-ci.yml:13-15` and `main-release.yml:21-23` keep their own `concurrency`
  blocks with `cancel-in-progress: true`. Both are out of scope: they are not comment-triggered,
  so the trigger-phrase problem does not apply to them.
- **No CI validates workflow YAML.** Biome (`pnpm lint:report`) lints `./src` only; there is no
  actionlint config and no test touches `.github/`. Verification is manual plus a post-merge smoke
  test.
- **Conventions (CLAUDE.md)** — Conventional Commits are mandatory (the release bump depends on the
  type); commit via `pnpm commit` (commitizen). Never hand-bump `version` (pinned to
  `0.0.0-development`); releases are automated by the platform reusables.

## Steps

### Step 1 — Delete the caller concurrency block and its rationale

Remove `:52-60` — the five comment lines plus the three-line `concurrency:` block — and replace
them, in the same position directly above `jobs:`, with:

```yaml
# No `concurrency:` here on purpose. Serialization is owned by the reusable's
# `review:` job, which can read `inputs.trigger-phrase` and therefore tell a
# review request from an ordinary comment. A caller-level group applies on top
# of it, takes in every issue_comment, and kills queued reviews — GitHub
# cancels a PENDING run in a group unconditionally, `cancel-in-progress: false`
# or not. See platform's
# docs/architecture.md#why-serialization-lives-in-the-reusable-not-the-caller.
```

Placement is deliberate: the comment occupies the deleted block's position rather than being
folded into the header banner, because it is a negative-space marker — it belongs exactly where
the next person would be tempted to re-add the block.

**Done when:** `rg -n '^concurrency:' .github/workflows/comment-code-review.yml` returns nothing,
and the replacement comment contains the literal string
`#why-serialization-lives-in-the-reusable-not-the-caller`.

### Step 2 — Bump the pin, both lines (depends on: Step 1)

`:64` `@v1.10.3` → `@v1.11.0`; `:67` `platform-ref: v1.10.3` → `platform-ref: v1.11.0`.

**Done when:** `rg -c 'v1\.11\.0' .github/workflows/comment-code-review.yml` returns `3` (two pin
lines plus the SHA comment from Step 3) and `rg -c 'v1\.10\.3' .github/workflows/comment-code-review.yml`
returns `0`.

### Step 3 — Update the recorded tag SHA (depends on: Step 2)

At `:27-28`, `v1.10.3 is commit a8da1da7adc68709d91bfe26fbe5afd9d35a9f8e` →
`v1.11.0 is commit 7a6fe894f7f8383aed085de279a5f91e7e3c182c`.

**Done when:** the 40-hex SHA in the header equals the output of
`gh api repos/refokus-agency/platform/git/ref/tags/v1.11.0 --jq '.object.sha'`.

### Step 4 — Validate structurally (depends on: Steps 1-3)

**Done when:** this command exits 0:

```bash
python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/comment-code-review.yml')); \
assert 'concurrency' not in d; \
assert d['jobs']['code-review']['uses'].endswith('@v1.11.0'); \
assert d['jobs']['code-review']['with']['platform-ref']=='v1.11.0'; \
assert list(d['jobs']['code-review']['secrets'])==['ANTHROPIC_API_KEY']; \
assert d['permissions']['id-token']=='write'"
```

### Step 5 — Commit as one unit (depends on: Step 4)

Single commit for both changes via `pnpm commit`, type `ci`. The issue is explicit that splitting
them creates a bad interim state: bump-alone keeps the caller group killing queued reviews;
remove-alone leaves no serialization anywhere (wasteful but harmless).

**Done when:** `git log -1 --pretty=%s` matches `^ci(\(.+\))?: ` and `git diff --stat HEAD~1`
lists exactly one file.

## Interfaces

N/A — no TypeScript or runtime data structures are touched. The only contract involved is the
reusable workflow's input/secret interface, verified at `v1.11.0`:

| Name | Kind | Type | Default | Note |
|------|------|------|---------|------|
| `platform-ref` | input | string | `main` | Must string-match the `uses:` ref |
| `timeout-minutes` | input | number | `30` | **New in v1.11.0.** Not overridden by this repo |
| `trigger-phrase` | input | string | `@claude review` | Not overridden; drives the reusable's concurrency group |
| `ANTHROPIC_API_KEY` | secret | — | `required: false` | The one credential this caller maps |
| `CLAUDE_CODE_OAUTH_TOKEN` | secret | — | `required: false` | Deliberately not mapped |

## Function Design

N/A — the change is declarative YAML with no functions or orchestration logic.

## Acceptance Criteria (EARS)

- **AC-1** — The workflow shall not declare a workflow-level `concurrency` key.
- **AC-2** — The workflow shall contain a comment, in the position the deleted block occupied,
  stating that serialization is owned by the reusable and citing
  `docs/architecture.md#why-serialization-lives-in-the-reusable-not-the-caller`.
- **AC-3** — The `code-review` job's `uses:` shall reference
  `refokus-agency/platform/.github/workflows/code-review.yml@v1.11.0`.
- **AC-4** — The `platform-ref` input shall be `v1.11.0`, string-identical to the `uses:` ref.
- **AC-5** — The header comment shall record `v1.11.0` as commit
  `7a6fe894f7f8383aed085de279a5f91e7e3c182c`.
- **AC-6** — The workflow shall map exactly one secret, `ANTHROPIC_API_KEY`, and shall retain
  `id-token: write` in `permissions`.
- **AC-7** — When the file is parsed by a YAML 1.1 loader, it shall parse without error.
- **AC-8** — When two comments containing `@claude review` land on the same pull request, the
  second shall queue behind the first rather than be cancelled.
- **AC-9** — When a comment not containing `@claude review` lands on a pull request while a review
  is queued, the queued review shall not be cancelled.
- **AC-10** — If a review exceeds 30 minutes, then the reusable shall cancel it via its own
  `timeout-minutes` default; this repo shall not override that input.
- **AC-11** — The block removal and the pin bump shall land in a single commit and a single pull
  request.

## Out of Scope

1. **`docs/specs/issue-89-ci-add-comment-triggered-claude-code-review-workfl.md`** — still says
   `v1.10.2` and documents the old concurrency rationale (its AC-4, plus lines 117/128/167). It is
   a historical plan artifact recording what was decided *then*; rewriting it would falsify the
   record. PR #94 already did not update it.
2. **The `concurrency` blocks in `pr-ci.yml` and `main-release.yml`** — different triggers; the
   trigger-phrase problem does not apply.
3. **Adding a `github-actions` ecosystem to `.github/dependabot.yml`** — the file covers `npm`
   only today, so the header's "Dependabot bumps `uses:` only" warning describes a hazard this
   repo does not currently face. Worth its own issue; not this one.
4. **Setting the `timeout-minutes` input** — no evidence this repo's reviews approach the measured
   13.1-minute ceiling across consumer repos.
5. **Any `src/` change** — zero package surface is touched, and no version bump (pinned to
   `0.0.0-development`).

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
|---|----------|--------|----------|
| 1 | Issue says the repo is on `v1.10.2`; it is actually on `v1.10.3` | [inferred] | Verified against the file and commit `6c99f84`. Plan targets the real state. No functional impact — `v1.10.3` also predates platform#97. |
| 2 | Issue's line numbers (46-52) do not match the file (52-60) | [inferred] | Anchor every edit on content (`concurrency:` key, `@v1.10.3` string), never on line numbers. |
| 3 | The recorded tag SHA at `:27-28` goes stale silently | [inferred] | Step 3 updates it; Step 4 asserts it against the live tag. Not mentioned in the issue — the largest miss to guard against. |
| 4 | Only one of the two pin lines gets bumped | [from issue] | Step 2's done-criterion counts occurrences of both version strings; Step 4 asserts the `uses:` ref and `platform-ref` string-match. |
| 5 | The reusable's secret interface changed in `v1.11.0`, breaking the explicit map | [from issue] | Verified unchanged (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, both optional). AC-6 is the regression guard. |
| 6 | Reviews in this repo legitimately exceed the new 30-minute default | [from issue] | Do not revert the bump; raise the `timeout-minutes` input. Deferred until a real timeout is observed. |
| 7 | `v1.11.0` is a mutable tag that could be re-pointed upstream | [inferred] | Mitigated by the recorded SHA (Step 3) — the existing mechanism, preserved rather than invented. |
| 8 | The replacement comment leaves a dangling block between `permissions:` and `jobs:` | [inferred] | Deliberate — it guards the position where the block would be re-added. Alternative considered and rejected: folding it into the header banner as a fourth deviation. |
| 9 | Someone re-adds a caller-level `concurrency` block later | [from issue] | The replacement comment is the only defence; no lint enforces it. Hence AC-2's explicit doc link. |
| 10 | YAML breaks after the deletion (indentation slip) | [inferred] | Step 4's parse plus structural assertions. Nothing else in CI would catch it before a live `@claude review`. |

## Done Criteria per Feature

| Feature | ACs that must all pass |
|---------|------------------------|
| Caller concurrency block removed | AC-1, AC-2, AC-9 |
| Platform pin bumped to v1.11.0 | AC-3, AC-4, AC-5 |
| Caller contract preserved (deviations 1 and 2) | AC-6, AC-7 |
| Serialization behaves correctly post-merge | AC-8, AC-9, AC-10 |
| Delivery shape | AC-11 |

## Risks

| Risk | Mitigation |
|------|------------|
| **Nothing in CI validates this file.** A typo ships and only surfaces when someone comments `@claude review`. | Step 4's YAML parse plus structural assertions run locally before the commit. |
| **AC-8 and AC-9 are only verifiable after merge** — a caller workflow's `concurrency` and the reusable's behaviour cannot be exercised from a branch. | Accept. Post-merge smoke test (see Test Strategy). Blast radius is one on-demand workflow, and the *current* state is already the bug being fixed. |
| **Issue premises are stale in two places** (version, line numbers). Following it literally would edit the wrong lines. | Corrected in this plan; every edit anchors on content. |
| **The recorded SHA is silently wrong if Step 3 is skipped** — the header would claim `v1.11.0` is `a8da1da...`, which is `v1.10.3`. A confidently wrong comment is worse than no comment. | Step 3 plus the Step 4 assertion against the live tag. |
| Runtime-generated files leaking into the commit | None are produced by this change. `.cothinker/` is already gitignored (`.gitignore:58-59`). Confirm `git status` shows exactly one modified file before committing. |

## Test Strategy

**Static (pre-commit, local):**

1. YAML parse plus structural assertions — the Step 4 command. Black-box: it asserts behavioural
   postconditions (no `concurrency` key, pin refs match each other, the secrets map is exactly one
   entry, `id-token` retained), not the presence of arbitrary strings.
2. `rg -n 'v1\.10\.3' .github/workflows/comment-code-review.yml` → must be empty.
3. `gh api repos/refokus-agency/platform/git/ref/tags/v1.11.0 --jq '.object.sha'` → must equal the
   SHA written into the header.
4. `git diff --stat` → exactly one file changed.

**Deliberately not run:** `pnpm test`, `pnpm check-types`, `pnpm build`. Zero `src/` surface is
touched, so they prove nothing about this change. `pr-ci.yml` runs them on the pull request anyway.

**Post-merge smoke test (AC-8 and AC-9 — the only way to verify them):** on a live pull request,
comment `@claude review`, then immediately a second `@claude review`, then an unrelated comment.
Expected: two review runs, the second *queued* behind the first; the unrelated comment produces no
run and cancels nothing. If the second review shows as **cancelled**, a caller-level group survived
somewhere — revert the pin rather than debugging in production.
