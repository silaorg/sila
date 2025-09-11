# GitHub CLI (gh) quick guide for AI agents

Use `gh` (if already installed and authenticated) to inspect and operate GitHub Actions and Releases in this repo.

## See workflow runs
- List runs: `gh run list --limit 20`
- By workflow:
  - `gh run list --workflow "release-1-draft"`
- `gh run list --workflow "release-2-build-upload"`
- `gh run list --workflow "release-3-finalize"`
- Watch latest run: `gh run watch --workflow "release-2-build-upload" --exit-status`
- View latest logs: `gh run view --workflow "release-2-build-upload" --latest --log`

## Trigger workflows (manual)
- Upload Win/Linux to a draft (requires existing tag):
  - `gh workflow run "release-2-build-upload" -f tag=v0.0.0-test2`
- Finalize/publish a release:
  - `gh workflow run "release-3-finalize" -f tag=v0.0.0-test2`

## Releases
- List: `gh release list`
- View: `gh release view v0.0.0-test2`
- Upload assets (e.g., macOS DMGs):
  - `gh release upload v0.0.0-test2 packages/desktop/dist/*.dmg --clobber`
- Publish a draft:
  - `gh release edit v0.0.0-test2 --draft=false`

## Notes
- Workflows grant `contents: write`; local `gh` must be authenticated (already set up) to edit releases.
- Always pass the exact tag (e.g., `vX.Y.Z`) so builds and uploads attach to the correct draft.

