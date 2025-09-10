# GitHub CLI (gh) quick guide for AI agents

Use `gh` to inspect and operate GitHub Actions and Releases in this repo.

## Setup
- Install (macOS): `brew install gh`
- Login: `gh auth login`
  - GitHub.com → HTTPS → paste token or follow web flow
- Verify: `gh auth status`

## See workflow runs
- List runs: `gh run list --limit 20`
- By workflow:
  - `gh run list --workflow "Release - Create Draft"`
- `gh run list --workflow "Release - Upload Win/Linux to Draft"`
- `gh run list --workflow "Release - Finalize (Publish)"`
- Watch latest run: `gh run watch --workflow "Release - Upload Win/Linux to Draft" --exit-status`
- View latest logs: `gh run view --workflow "Release - Upload Win/Linux to Draft" --latest --log`

## Trigger workflows (manual)
- Upload Win/Linux to a draft (requires existing tag):
  - `gh workflow run "Release - Upload Win/Linux to Draft" -f tag=v0.0.0-test2`
- Finalize/publish a release:
  - `gh workflow run "Release - Finalize (Publish)" -f tag=v0.0.0-test2`

## Releases
- List: `gh release list`
- View: `gh release view v0.0.0-test2`
- Upload assets (e.g., macOS DMGs):
  - `gh release upload v0.0.0-test2 packages/desktop/dist/*.dmg --clobber`
- Publish a draft:
  - `gh release edit v0.0.0-test2 --draft=false`

## Notes
- Workflows grant `contents: write`; local `gh` must be authenticated to edit releases.
- Always pass the exact tag (e.g., `vX.Y.Z`) so builds and uploads attach to the correct draft.

