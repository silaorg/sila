# Proposal: Markdown internal link checker

## Goal

Add a small CLI that checks Markdown internal links.
It must work in this repo and be reusable as an npm package.

## Non-goals

- Do not fetch external URLs.
- Do not validate images or code samples.
- Do not enforce style rules.

## CLI UX

Command:

```
md-link-check [root] --include "docs/**/*.md" --exclude "**/node_modules/**"
```

Defaults:

- `root` is the current working directory.
- `--include` is `**/*.md`.
- `--exclude` is `**/node_modules/**,**/dist/**,**/build/**`.

Exit codes:

- `0` when all links pass.
- `1` when any link is broken.

## Link rules

- Only check relative links.
- Allow `#anchor` links in the same file.
- Allow `path.md#anchor` links to other files.
- Skip links that start with `http`, `https`, `mailto`, or `tel`.

## Output

Each issue prints one line:

```
path/to/file.md:12 broken link -> ./missing.md
```

## Initial file structure

```
packages/md-link-check/
  package.json
  src/
    cli.js
    index.js
```

## Milestones

1. Parse Markdown links and scan files.
2. Resolve relative paths and check file existence.
3. Parse headings and verify anchors.
4. Add a simple CLI with exit codes.
