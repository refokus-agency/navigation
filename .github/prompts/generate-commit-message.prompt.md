# Generate Commit Message Prompt

Generate a Commitizen commit message. Pick type (feat|fix|docs|style|refactor|test|chore), a short imperative subject, and an optional scope. Context: [paste changes or file list]

Example:
Context: “Centralized business-insights paths in config and updated validation to use it.”
Output: “refactor(workflows): centralize business-insights paths”

Read git staged changes for this