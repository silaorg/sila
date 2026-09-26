# Sila 2 status

Verified on September 26, 2026, using Node.js 22.20 on macOS.

## Development branch

`v2` includes every commit from the former `heswe` branch through `21bcb4ad`.
The product, UI, CLI, package names, and environment settings now use Sila.
Product packages are version `2.0.0`. Workspace format version remains `1`.

`main` retains Sila 1. No merge with its unrelated history is needed.

## Source dependencies

- AIWrapper 4.0.0 is pinned at `6c0b385` in `vendor/aiwrapper`.
- Its nested AIModels submodule is pinned at `17cc252`, dated September 16.
- The bundled catalog contains 306 models, including September additions.
- AIWrapper provides live and speech APIs; Sila has no voice interface yet.
- Provider defaults and saved model selections remain unchanged.

The AIWrapper pin continues its `codex/aimodels-submodule` branch. It contains
the upstream 4.0.0 implementation plus the source-catalog build integration.
See [dependency development](dependencies.md) for updating either repository.

## Verified

- 188 Sila tests pass: launcher, agent workers, workspace runtime, and web API.
- AIWrapper passes 186 unit tests and its standalone-package check.
- AIModels passes 125 tests and catalog validation.
- Both Svelte checks report zero errors and zero warnings.
- The production web build succeeds.
- A clean source export installs with `npm ci`, including native SQLite.
- Production-only installation and dependency pruning preserve runtime imports.
- The workspace image's final file layout resolves its runtime dependencies.
- Browser signup, workspace creation, thread creation, files, and settings load.
- Chat submission without a provider key shows an actionable error and retains the draft.

These checks use deterministic provider fixtures. No live model request was
made because the test environment had no provider credentials.
The web build reports dependency circularity and bundle-size warnings.

## Try it

```sh
git submodule update --init --recursive
npm ci
npm run dev
```

Open the dashboard URL printed by the launcher, normally
`http://127.0.0.1:39901`. Create an account and workspace. Open workspace settings,
connect a model provider, then send a message. Development runs agent workers
as local processes; they are not sandboxed.

## Remaining work

1. Test a real provider response and tool execution with a workspace API key.
2. Build and test the workspace image on Linux with Docker and gVisor.
   Docker's daemon was unavailable during this macOS verification.
3. Move Slack and Telegram execution behind the sandbox worker boundary.
4. Implement the proposed inference broker and longer-lived workspace supervisor.
5. Implement workspace membership and multi-server placement when needed.
6. Implement the proposed shared graphical display and human takeover controls.

Runtime self-modification, revision rollback, and multi-platform desktop
connections also remain proposals. The current product is a testable hosted
app, with production deployment still requiring the Linux verification above.
