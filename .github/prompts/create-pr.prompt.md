---
description: Analyze current changes, summarize them using the PR template, and create a GitHub pull request via MCP integration.
---

The user input can be provided only as a command argument - you **MUST** consider it before proceeding with the prompt (if not empty).

The PR output must be in english

User input:

$ARGUMENTS

Follow these steps to create a pull request:

1. **Analyze Current Changes**

   - If in main branch, help the user to switch to a feature branch before proceeding.
   - Use `git status` to detect all staged and unstaged changes in the repository.
   - Use `git diff` to inspect the details of the changes.
   - Parse the output to identify modified, added, and deleted files, and summarize the nature and scope of the changes (e.g., bugfix, feature, refactor).
   - Check for commits made in the current branch using `git log`. Include a summary of these commits in the PR summary.
   - After analysis, split the code in different commit with total sense of the goal and scope of the commits.
   - After, ask the user if all changes should be committed. If the user confirms, commit all changes before generating the PR summary.

2. **Generate PR Summary Using Template**

   - Use the `.github/pull_request_template.md` as the structure for the PR summary.
   - Fill in each section:
     - **What was accomplished?**: Briefly describe the changes made in this PR.
     - **Additional Information**: Add any relevant details for reviewers.
     - **Future Considerations**: Note any impacts or considerations for future updates.

3. **Push the Current Branch**

   - Push the current branch to the remote repository if it's necessary to ensure it is available for the pull request

4. **Create the Pull Request**

   - Use the MCP GitHub integration to create a new pull request:
     - Set the title based on the summary and branch naming conventions.
     - Use the completed template as the PR description.
     - Ensure the correct source and target branches are selected.
     - Attach any relevant labels or reviewers if required.
   - Create the PR as draft.

5. **Report Completion**
   - Output the PR URL, branch name, and summary for user review.
   - Indicate readiness for review or next steps.