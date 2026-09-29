# Status

Heswe is on `v2`, version `2.0.0`. It includes the latest work from the `heswe` branch and the source dependency setup.

The web app runs locally. You can sign up, create workspaces and threads, browse files, and configure providers. Real responses and file-reading tool calls pass with seven providers. See the [September 28 release pass](release-review-2026-09-28.md) for fixes, provider results, and remaining gates.

## Dependencies

AIWrapper 4.0.0 is a submodule at `6c0b385`. It includes AIModels at `17cc252`, with 306 models and the September 16 catalog updates.

AIWrapper has live and speech APIs. Heswe doesn't have a voice interface yet. Existing model selections and provider defaults are unchanged.

See [dependencies](dependencies.md) for setup and updates.

## Latest release pass

On September 28, Node.js 22.20: 211 tests pass, both frontend checks pass, and the production build passes with dependency warnings. Browser checks covered mobile navigation, settings, and saved tool history. Browser reconnect recovery still needs a controlled retest.

See [the release review](release-review-2026-09-28.md) for details and decisions.

## Earlier results

Checked on September 26, 2026, with Node.js 22.20 on macOS:

- 196 app tests pass after the September review. The earlier dependency check passed 186 AIWrapper tests and 125 AIModels tests.
- Both frontend checks pass without errors or warnings.
- The production web build passes, with dependency and bundle-size warnings.
- Clean installs work, including production dependencies and native SQLite.
- The workspace image's file layout resolves its dependencies.
- Browser signup, workspace creation, threads, files, and settings work.
- A missing provider key shows an error and keeps the message for retry.

Model tests use fixtures. Docker wasn't running here, so the Linux image and gVisor still need a deployment test.

## What's left

- [x] Test real model responses and tool calls through the web API with seven providers.
- [ ] Build and run the workspace image on Linux with gVisor.
- [ ] Move Slack and Telegram agents behind the sandbox worker boundary.
- [ ] Add the inference broker and longer-lived workspace supervisor.
- [ ] Add workspace membership and placement across servers.
- [ ] Add the shared display and user takeover controls.

Runtime editing, rollback, and desktop connections to multiple platforms are also still proposals.

See the [code review](review-2026-09-26.md) for current defects and the recommended cleanup order.
