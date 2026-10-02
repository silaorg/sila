#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [[ "$(git branch --show-current)" != main ]]; then
  echo 'Releases must be cut from main' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Commit tracked changes before releasing' >&2
  exit 1
fi

git fetch origin main --quiet
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo 'Local main must match origin/main before releasing' >&2
  exit 1
fi

npm version patch --workspace @sila/desktop --no-git-tag-version
version=$(node -p "require('./packages/desktop/package.json').version")
tag="desktop-v$version"
git add packages/desktop/package.json package-lock.json
git commit -m "ci: bump desktop to $version"
git tag -a "$tag" -m "Sila $version"
git push --atomic origin main "refs/tags/$tag"
