# Markdown internal link checker

Check Markdown internal links and anchors.

## Usage

Run from this repo:

```
node packages/md-link-check/src/cli.js docs --include "**/*.md"
```

## CLI

```
md-link-check [root] --include "docs/**/*.md" --exclude "**/node_modules/**"
```

Defaults:

- `root`: current working directory
- `--include`: `**/*.md`
- `--exclude`: `**/node_modules/**,**/dist/**,**/build/**`

Exit codes:

- `0` when all links pass
- `1` when any link is broken

## API

```
import { checkMarkdownLinks } from "@sila/md-link-check";

const result = await checkMarkdownLinks({ root: "docs" });
console.log(result.issues);
```
