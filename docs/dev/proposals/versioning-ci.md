## Proposal: Code-as-Source-of-Truth Versioning in CI

This defines a release model where code (package.json) is the single source of truth for app version. CI builds only from version tags created by `npm version`, guaranteeing code/build parity and preventing divergent versions.

### Goals
- **Single source of truth**: `packages/desktop/package.json` `version`
- **Deterministic builds**: artifacts and auto-updater metadata match code version
- **Guardrails in CI**: fail early on mismatches or non-monotonic versions
- **Low ceremony**: standard `npm version` + push tags

### Developer Flow

```bash
# Choose semver bump (patch|minor|major) or explicit X.Y.Z
cd packages/desktop
npm version patch   # or: npm version 1.2.3

# Push the version commit and the tag created by npm
git push && git push --tags
```

Notes:
- `npm version` updates `package.json`, creates a version commit, and creates a tag using the configured prefix. For desktop we use `desktop-vX.Y.Z` via an `.npmrc` in `packages/desktop`.
- Pushing the tag triggers CI release workflows.

### CI Workflows (Overview)
Keep the existing 3-step flow; add two validations:

1) release-1-draft (trigger: push tag `desktop-v*`)
   - Validate: tag equals `packages/desktop/package.json` version
   - Optional: validate tag is greater than latest semver tag
   - Create/ensure a draft GitHub Release

2) release-2-build-upload (manual, input the same tag)
   - Checkout the tag, build all platforms, upload artifacts to the draft release

3) release-3-finalize (manual, input the same tag)
   - Publish the draft release (draft=false)

### Validations (fail fast)
Add to `release-1-draft.yml` before creating the draft release.

Validate tag matches code version:

```yaml
- name: Validate tag matches desktop package version
  run: |
    TAG_NAME="${GITHUB_REF#refs/tags/}"
    APP_VERSION="${TAG_NAME#desktop-v}"
    PKG_VERSION="$(jq -r .version packages/desktop/package.json)"
    if [ "$PKG_VERSION" != "$APP_VERSION" ]; then
      echo "::error::packages/desktop/package.json ($PKG_VERSION) must equal tag ($APP_VERSION)"
      exit 1
    fi
```

Optional: ensure monotonic versioning (no downgrades/re-releases):

```yaml
- name: Ensure tag is greater than latest
  run: |
    TAG_NAME="${GITHUB_REF#refs/tags/}"
    APP_VERSION="${TAG_NAME#desktop-v}"
    LATEST="$(git tag -l 'desktop-v[0-9]*' --sort=-v:refname | grep -v "^${TAG_NAME}$" | head -n1 || true)"
    if [ -n "$LATEST" ]; then
      LATEST_VERSION="${LATEST#desktop-v}"
      HIGHEST="$(printf "%s\n%s\n" "$LATEST_VERSION" "$APP_VERSION" | sort -V | tail -n1)"
      if [ "$HIGHEST" != "$APP_VERSION" ]; then
        echo "::error::New tag $TAG_NAME is not greater than latest $LATEST"
        exit 1
      fi
    fi
```

### Build Behavior
- electron-builder reads version from `packages/desktop/package.json`.
- Checking out the `npm version` tag ensures the build uses the code-defined version.
- Artifact names already include `${version}` in `packages/desktop/package.json` build config.

### Operational Notes
- Trigger releases only on tags to avoid accidental releases from commits.
- For prereleases, use tags like `v1.2.3-rc.1` and replace comparison with a semver-aware check (e.g., `npx semver`).
- For multi-package releases in a monorepo, use namespaced tags (e.g., `desktop-v1.2.3`) and adjust workflow filters.

### Developer Checklist
- `npm version` bump executed in `packages/desktop`
- Commit + tag pushed
- Draft created by CI (auto)
- Build+upload run for the same tag (manual)
- Finalize/publish the same tag (manual)

This keeps versions consistent across code, produced binaries, and the published GitHub Release.
