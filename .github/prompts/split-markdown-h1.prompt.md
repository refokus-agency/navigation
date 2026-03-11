```prompt
## Plan: Split Markdown by H1 into Workflow Files

Create one .md file per H1 section from a source Markdown file. Each output file must include the original H1 line and all content until the next H1 (or end of file). Write outputs to `milton/workflows/{workflow-name}/` and derive filenames from the H1 title using a lowercase, hyphenated slug. Avoid reading any .md under `milton/` unless the user explicitly provides the path as the input file.

**Inputs**
- Source markdown path (absolute or workspace-relative).
- Workflow name for output path (e.g., `audience-discovery`).
- Optional filename prefix (e.g., `prompt-` or `phase-`).
- Optional numbering scheme (e.g., `01`, `02`), and whether to enforce Milton prompt naming conventions.

**Steps**
1. Read the source Markdown file and locate all H1 headings (`# `). Use them as section boundaries.
2. For each H1, collect the H1 line plus all following lines until the next H1 (exclusive).
3. Build a filename slug from the H1 title (trim, lowercase, replace spaces with hyphens, remove non-alphanumeric except hyphens).
4. If numbering is requested, prefix the slug with the two-digit index (e.g., `prompt-01-<slug>.md`).
5. Ensure output directory `milton/workflows/{workflow-name}/` exists.
6. Write one file per section. If a filename already exists, append a numeric suffix to avoid overwrites.

**Checks**
- If no H1 headings are found, stop and ask for confirmation or a different strategy.
- Confirm the number of files to be created and sample filenames before writing, unless user asks to proceed immediately.

**Verification**
- List the created files and their paths.

```