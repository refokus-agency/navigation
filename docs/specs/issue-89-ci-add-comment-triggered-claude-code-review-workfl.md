---
issue_number: 89
issue_title: "ci: add comment-triggered Claude code review workflow"
repo: "refokus-agency/navigation"
labels: [enhancement]
plan_level: "full"
depth: "medium"
branch_name: "beogip/ci-add-comment-triggered-claude-code-review-work"
created_at: "2026-09-14T11:47:59Z"
updated_at: "2026-09-14T11:58:00Z"
---

# Implementation Plan: #89 — ci: add comment-triggered Claude code review workflow

## Branch

Work happens on the **existing** branch
`beogip/ci-add-comment-triggered-claude-code-review-work`, which is already checked out in
a dedicated worktree at
`/Users/beogip/orca/workspaces/navigation/ci-add-comment-triggered-claude-code-review-work`.
Do **not** create a new branch and do **not** switch branches.

## Files

| Action | Path | Purpose |
| --- | --- | --- |
| create | `.github/workflows/comment-code-review.yml` | Caller for the platform code-review reusable, triggered by a comment on a pull request. |

## Codebase Context

- `.github/workflows/pr-ci.yml` and `.github/workflows/main-release.yml` are the two
  existing callers. Style to match: 2-space indent, a top-of-file comment banner
  explaining trigger and purpose, a short human `name:`, the floating `@v1` pin,
  trailing newline.
- Both existing callers use `secrets: inherit`. This new file deliberately does **not** —
  see AC-3 and AC-6.
- `refokus-agency/platform` → `examples/comment-code-review.yml` is the reference
  template, including the comments that explain `id-token: write`, `cancel-in-progress:
  false` and why concurrency keys on `issue.number`.
- `refokus-agency/time-to-refokus-ai-v2` → `.github/workflows/pr-code-review.yml` is the
  precedent for the explicit `ANTHROPIC_API_KEY` mapping and carries the comment that
  justifies it.
- The reusable `refokus-agency/platform/.github/workflows/code-review.yml` declares job
  key `review` (the rendered check reads `code-review / review`) and **no `permissions:`
  block of its own** — the caller's grants are the ones the job runs with. All 14 inputs
  are optional; both secrets (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`) are
  `required: false`, which is what makes a single-secret mapping viable.
- **Pin (revised by maintainer during review):** the caller pins the exact version
  `@v1.10.2`, not the floating `@v1`. Both resolve to commit
  `afb47de8f546213d30186e12e540b466b28b9a68` today — verified via the GitHub API, as was
  the fact that the reusable's secret interface is unchanged at that tag (both secrets
  still `required: false`). Rationale: this is the only caller in the repo that hands a
  credential to a comment-triggered job, so upstream must not change what runs with that
  credential without a commit here. A semver tag rather than a SHA, matching
  `main-release.yml`'s `release.yml@v1.7.1`; the SHA is recorded in the file's banner
  because a tag is mutable.
- **Credential:** `ANTHROPIC_API_KEY` is configured at the `refokus-agency` org level and
  reaches this repo — confirmed by the maintainer. It is not readable from tooling here
  (`gh secret list --org refokus-agency` → HTTP 403, needs org admin), so the explicit
  mapping `${{ secrets.ANTHROPIC_API_KEY }}` resolves at run time from the org secret.
  The "skips green with no credential" path is therefore a safety net, not the expected
  outcome.
- No actionlint / yamllint config, no `.editorconfig`, no pre-commit hooks in this repo.
  Biome only touches JS/TS. Nothing in CI will lint this YAML.

## Steps

1. Create `.github/workflows/comment-code-review.yml` with the header comment banner
   documenting the three non-obvious decisions: the deliberate deviation to explicit secret
   mapping, that `id-token: write` is load-bearing rather than boilerplate, and the exact
   version pin.
   **Done when:** the file exists, ends with a newline, and `rg -c "secrets: inherit"` on
   it returns 0 matches.

2. Write `on: issue_comment: types: [created]` and the `permissions:` block with the four
   grants. → same file
   **Done when:** `yq '.on.issue_comment.types'` equals `["created"]`, there is no
   `pull_request` key under `on:`, and `.permissions` has exactly the four keys
   `contents`, `pull-requests`, `issues`, `id-token`.

3. Write the `concurrency:` block and the `code-review` job with
   `uses: refokus-agency/platform/.github/workflows/code-review.yml@v1.10.2` and the explicit
   `ANTHROPIC_API_KEY` mapping. → same file
   **Done when:** `.concurrency.group` contains `github.event.issue.number`,
   `.concurrency.cancel-in-progress` is `false`, and
   `.jobs.code-review.secrets.ANTHROPIC_API_KEY` is defined.

4. Validate syntax with `actionlint` (`npx --yes actionlint`, or the brew binary) over
   `.github/workflows/`.
   **Done when:** actionlint exits 0 with no findings.

## Interfaces

The only contract this file consumes is the reusable's `workflow_call` interface.

**`refokus-agency/platform/.github/workflows/code-review.yml@v1.10.2`**

- **inputs consumed:** none. Every input stays at its default —
  `trigger-phrase: "@claude review"`, `model: claude-sonnet-5`,
  `opus-model: claude-sonnet-5`, `plugins: code-review@claude-code-plugins`,
  `plugin-marketplaces: https://github.com/anthropics/claude-code.git`, the default
  read-only `allowed-tools` allowlist, `track-progress: false`,
  `show-full-output: false`, `platform-ref: main`, `fetch-depth: '1'`,
  `allowed-bots: ''`, `federation-rule-id: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID }}`,
  `anthropic-org-id: ${{ vars.ANTHROPIC_ORG_ID }}`, and the default review `prompt`.
- **secrets mapped:** `ANTHROPIC_API_KEY` (`required: false`) — the only one forwarded.
- **secrets deliberately not mapped:** `CLAUDE_CODE_OAUTH_TOKEN` (`required: false`).

## Function Design

The file is declarative YAML; each top-level block carries exactly one concern.

- **header comment banner** — documents the two non-obvious decisions. Configures nothing.
- **`on:`** — defines the event only. No filters: every gate (phrase, actor, fork, PR
  state, self-trigger) lives inside the reusable.
- **`permissions:`** — the job's privilege surface. Nothing else.
- **`concurrency:`** — per-pull-request serialization. Nothing else.
- **`jobs.code-review`** — dispatch plus secret mapping. No `with:` block.

## Acceptance Criteria (EARS)

- **AC-1.** The repo shall contain `.github/workflows/comment-code-review.yml` whose only
  job calls `refokus-agency/platform/.github/workflows/code-review.yml@v1.10.2`.
- **AC-2.** The workflow shall declare exactly four permissions: `contents: read`,
  `pull-requests: write`, `issues: write`, `id-token: write`.
- **AC-3.** The workflow shall map `ANTHROPIC_API_KEY` explicitly under `secrets:` and
  shall not contain `secrets: inherit`.
- **AC-4.** The workflow shall set `concurrency.group` keyed on
  `github.event.issue.number` and `cancel-in-progress: false`.
- **AC-5.** The workflow shall be triggered only by `issue_comment` of type `created`; it
  shall declare no `pull_request` trigger.
- **AC-6.** The workflow file shall carry a header comment stating the three deliberate
  deviations: that the explicit secret mapping is a deviation from the platform template,
  that `id-token: write` is conditionally load-bearing (inert while the API key is set,
  kept as insurance for credential rotation), and that the exact version pin is
  intentional (with the resolved SHA recorded).
- **AC-7.** When a user with write access comments a body containing `@claude review` on
  an open, non-fork pull request of this repo, the reusable shall run and post its review.
- **AC-8.** If no Anthropic credential is reachable at run time, then the job shall skip
  green with a `::notice::` and shall not fail the pull request.
- **AC-9.** If the pull request head comes from a fork, then the reusable shall skip the
  review green.
- **AC-10.** The workflow shall pass `actionlint` with no findings.

## Out of Scope

- Configuring or rotating the `ANTHROPIC_API_KEY` secret — it already exists at the
  `refokus-agency` org level and this change only consumes it.
- Creating or switching branches — the worktree branch is already in place (see **Branch**).
- Changing `secrets: inherit` in `pr-ci.yml` or `main-release.yml`.
- Overriding any reusable input (`model`, `prompt`, `allowed-tools`, `allowed-bots`, …).
- Pinning to a commit SHA instead of a semver tag, or bumping the pin past `v1.10.2`.
- Adding an automatic `pull_request` trigger.
- Documenting the workflow in `README.md` or `CONTRIBUTING.md`.

## Edge Cases + Error Handling

| # | Scenario | Source | Handling |
| --- | --- | --- | --- |
| 1 | The org secret is later removed, renamed or scoped away from this repo | [from issue] | `ANTHROPIC_API_KEY` is confirmed present at the org level today, so this is a regression case, not the initial state. The reusable's "Resolve auth" gate skips green with a `::notice::` rather than failing the pull request — the failure mode is a silent no-op, so check the run log, not just the check colour. **Caveat found during review:** that green skip holds only while no federation vars are set. If the org defines `ANTHROPIC_FEDERATION_RULE_ID` and `ANTHROPIC_ORG_ID`, the gate passes via the federation branch and the run proceeds to mint an OIDC token — green skip becomes a red failure unless `id-token: write` is granted, which is why AC-2 keeps it. |
| 2 | Pull request head comes from a fork (this repo is public) | [from issue] | The reusable skips: checking out a fork head while holding this repo's secrets is a pwn request. Documented in the PR description. |
| 3 | Comment authored by a bot | [from issue] | `allowed-bots` stays at `''`, so the actor gate skips green. |
| 4 | Commenter without write access | [from issue] | The `author_association` gate (`OWNER`/`MEMBER`/`COLLABORATOR`) skips green. |
| 5 | Comment posted on an issue rather than a pull request | [inferred] | The payload carries no `pull_request` object, so the reusable skips. The caller filters nothing. |
| 6 | Comment does not contain the trigger phrase | [inferred] | The reusable's job `if:` does not match, so the job skips. It still joins the concurrency group — which is precisely why `cancel-in-progress` must be `false`. |
| 7 | A second comment arrives while a review is running | [from issue] | `cancel-in-progress: false` serializes instead of cancelling the in-flight review. |
| 9 | A future workflow in this repo is also named `Code Review` | [found in review] | `concurrency.group` keys on `${{ github.workflow }}`, which is the workflow NAME, not its filename. A second workflow with that name would silently share the group. No collision today (`Pull Request`, `Release`); documented in the file's concurrency comment. |
| 8 | Upstream ships a breaking change to the reusable | [inferred] | Cannot reach this caller: it is pinned to the exact version `@v1.10.2`, the way `main-release.yml` already pins `release.yml@v1.7.1`. Bumps are deliberate; re-check the reusable's secret interface when bumping. The cost is that fixes upstream do not arrive automatically either. |

## Done Criteria per Feature

| Feature | Done when |
| --- | --- |
| Workflow file exists and is valid | AC-1, AC-6, AC-10 |
| Privilege surface | AC-2, AC-3 |
| Trigger semantics | AC-4, AC-5 |
| End-to-end behaviour | AC-7, AC-8, AC-9 |

## Risks

- **Omitting `id-token: write`** → *Corrected during review against upstream source.* The
  grant is inert while `ANTHROPIC_API_KEY` is set: `setupWorkloadIdentity()` in
  claude-code-action returns early before `core.getIDToken()`. The risk is deferred, not
  absent — the reusable's "Resolve auth" gate also passes on the federation vars alone and
  never checks whether the permission was granted, so omitting it turns Edge Case 1's
  documented green skip into a hard red failure on the next credential rotation.
  *Mitigation:* AC-2 keeps the grant; the file's banner records why it looks unused.
- **Using `github.event.pull_request.number` in `concurrency`** → that field is empty on
  `issue_comment`, collapsing every pull request into a single group. *Mitigation:* AC-4
  forces `issue.number`.
- **A skip-green run reads as a passing run** → because the reusable never fails the pull
  request, a broken credential or a tripped gate looks identical to a healthy no-op in the
  checks list. *Mitigation:* the end-to-end verification below asserts the review is
  actually posted, not merely that the run is green.
- **Style divergence from the other two callers** (`secrets: inherit`) → a future edit
  "fixes" it back to blanket inheritance. *Mitigation:* the header banner states the
  deviation is deliberate and why.
- **Runtime-generated files that should not be committed:** none. This change generates no
  local artifacts; `.cothinker/` is already in `.gitignore`.

## Test Strategy

- **Static:** run `actionlint` over `.github/workflows/` (expect exit 0). The repo has no
  actionlint or yamllint configuration, so run it one-off via `npx --yes actionlint` or
  the brew binary.
- **Structural, black-box over the parsed file:** assertions with `yq` against the parsed
  YAML — the four permissions and nothing more, no `pull_request` key under `on:`,
  `cancel-in-progress: false`, `jobs.code-review.secrets.ANTHROPIC_API_KEY` present, and
  the string `secrets: inherit` absent. These are behavioural postconditions of the
  workflow contract, not structural trivia.
- **Regression:** `pnpm test`, `pnpm check-types` and `pnpm lint:report` do not cover
  YAML, but run them to confirm no collateral change.
- **End-to-end (AC-7):** after merge, comment `@claude review` on a test pull request in
  this repo and verify (a) the 👀 reaction on the triggering comment, (b) the run appears
  in the Actions tab, and (c) the review is actually **posted** — the org credential is
  confirmed, so a green run with no review means a gate tripped and the run log names
  which one. A skip is a failure of this check, not a pass.
