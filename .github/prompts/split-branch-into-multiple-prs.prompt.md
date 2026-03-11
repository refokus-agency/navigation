---
description: Analyze current changes and propose a plan to split a large PR into smaller, reviewable branches without making any git changes.
---

The user input can be provided only as a command argument - you **MUST** consider it before proceeding with the prompt (if not empty).

The output must be in English.

User input:

$ARGUMENTS

Follow these steps to propose a split plan (do not modify the repo unless the user chooses to commit pending changes):

1. **Check Branch Context**

   - If on `main`, ask the user for the branch name they want to use and switch to it before proceeding.

2. **Check Pending Changes**

   - Use `git status -sb` to detect uncommitted changes.
   - If there are pending changes, ask the user whether to commit them or ignore them for the split plan.
   - If the user wants to commit, stage and commit with a clear message before continuing.
   - If the user wants to ignore, proceed without modifying the working tree.

3. **Analyze Current Branch Commits**

   - Use `git log --oneline --decorate -n 20` to review recent commits on the branch.
   - Use `git log --oneline --decorate origin/main..HEAD` to list commits unique to the current branch (comparing against remote main).
   - Use `git diff origin/main...HEAD --name-only` to list files that are truly unique to the current branch (excluding changes already merged to main).
   - Use `git diff origin/main...HEAD --stat` to see a summary of unique changes.
   - Review the git graph with `git log --oneline --graph --decorate -n 40 --all` to understand merge history.
   - Identify logical groupings (features, fixes, refactors, tests, config changes) based only on files unique to this branch.

4. **Interpret User Input**

   - If $ARGUMENTS includes a number, treat it as the desired number of split PRs.
   - If it includes paths or globs, prioritize those files in the grouping plan.
   - If it includes keywords like "tests" or "docs", use them as grouping hints.

5. **Propose a Split Plan**

   - Provide a list of 2-6 proposed PRs (unless user input specifies a different count).
   - For each PR, include:
     - Purpose and scope (one sentence).
     - File list or globs to include.
     - Suggested commit boundaries.
     - Suggested branch name (kebab-case, no spaces).
     - Draft PR description following `.github/pull_request_template.md` structure:
       - What was accomplished?
       - Additional Information
       - Future Considerations
   - Call out dependencies between PRs, if any.

6. **Suggested Next Steps**

   - Ask the user which PR to split first.
   - Offer to generate a per-PR commit/branch checklist once they pick one.
