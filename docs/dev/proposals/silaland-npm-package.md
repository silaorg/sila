# Publish `silaland` as a Global npm CLI

## Summary

Publish `packages/land` to npm as `silaland` so users can install it globally and run the existing CLI commands directly:

```bash
npm install -g silaland
silaland create my-land
silaland run my-land
```

Part of this proposal is now implemented:

- `packages/land` is now a publishable npm package named `silaland`
- the land runtime no longer depends on `@sila/agents` in the publish path
- built-in skills now live inside `packages/land`
- the package now exposes both a CLI entrypoint and a JS entrypoint

## Current State

- The CLI already exists in `packages/land/src/cli.js`.
- The current commands are `silaland create` and `silaland run`.
- The repo root is private and is the main entrypoint during development.
- `packages/land/package.json` is now publishable as `silaland` and exposes a `bin` plus JS entrypoint.
- `packages/land` now carries the runtime code and built-in skills it needs for publishing.
- `~/repos/aiwrapper` is a useful reference package here. It is published with normal npm metadata, a tight `files` allowlist, and an explicit `npm pack` verification path.

## Problem

Right now `silaland` works as a repo-local CLI, not as a normal installed tool.

That makes the first-run experience heavier than it should be. Someone who just wants to create and run a land has to clone this repo and run the CLI from source instead of installing one package.

## Goals

- Make `npm install -g silaland` expose the `silaland` command.
- Keep the current CLI interface for `create` and `run`.
- Let a user create a land outside this monorepo.
- Keep the packaging model simple and easy to explain.
- Avoid publishing extra packages just to make the CLI work.
- Support `npx silaland@latest ...` as a first-run path in docs.
- Expose a supported JS API so other Sila packages can depend on `silaland`.
- Provide a minimal migration path from the old `silain` package name.

## Non-Goals

- Full hosted deployment or process management.
- Preserving the current `packages/land` -> `@sila/agents` split if that makes publishing harder to explain.
- Changing the land config format as part of this work.

## Proposed Design

### 1) Make `packages/land` the publishable CLI package

Update `packages/land/package.json` to include at least:

- `name: "silaland"`
- `version`
- `description`, `license`, `repository`, `homepage`, and `bugs`
- `bin: { "silaland": "./src/cli.js" }`
- `exports` for supported library entrypoints
- `files` so npm publishes only the runtime files we need

The shebang already exists in `packages/land/src/cli.js`, so the command shape stays the same.

Unlike `aiwrapper`, `silaland` is already plain JS, so we should avoid adding a build step unless we find a real packaging need for one.

### 1.1) Expose separate CLI, Node, and browser-safe entrypoints

`silaland` can be one npm package without being one runtime surface.

We should treat these as different entrypoints:

- CLI entrypoint for `silaland create` and `silaland run`
- Node library entrypoint for server-side packages that want to create or run lands programmatically
- browser-safe entrypoint for shared helpers that web and mobile apps can import

Browser support should be explicit and narrow. The current land runtime is Node-only because it depends on:

- `node:fs`, `node:path`, `node:url`, `node:stream`, and `process.cwd()`
- Slack and Telegram runtime SDKs
- local file access and local process execution
- agent tooling that depends on shell and pty behavior

So the browser-safe export should not try to run a land or channels in the browser.

Instead, browser-safe exports should be limited to things like:

- shared schemas and config validation
- land manifest or metadata helpers
- request and response types for future web or mobile clients
- client helpers for talking to a running land service, if we add that later

The full runtime and CLI stay Node-only.

### 1.2) Publish a minimal `silain` compatibility stub

Since the project used to be called `silain`, we should keep a small compatibility package for migration.

npm does not provide a true package rename or redirect, so the old name should be handled explicitly:

- publish the real package as `silaland`
- keep `silain` as a minimal stub package
- deprecate `silain` with a message pointing users to `silaland`

For simplicity, the stub does not need to preserve old runtime behavior. It only needs to make the rename visible and reduce confusion for existing users.

### 2) Keep the existing CLI commands

Do not rename the current commands in v1.

This means global install gives the same developer experience we already test locally:

- `silaland create [path]`
- `silaland run [path]`

### 3) Move agent runtime and built-in skills into `packages/land`

For simplicity, `silaland` should become self-contained.

Instead of publishing `@sila/agents` as a second npm package, move the runtime code and built-in skills that `silaland` needs into `packages/land`.

That gives us a simpler story:

- one published package: `silaland`
- one version to release
- no cross-package registry coordination
- less risk that global install breaks because an internal package was not published correctly

This also fits the product boundary better. If the main install story is "install `silaland`, create a land, run a land", the runtime pieces that make a land work should live with that package.

### 4) Verify installed-package behavior

We should explicitly test the npm-installed shape, not just repo-local execution.

At minimum add an integration test that packs the package, installs it into a temp directory, and verifies:

- `npm pack --dry-run` includes the expected files only
- `silaland create test-land`
- `silaland run test-land`

That catches missing published files, broken `bin` wiring, and dependency packaging mistakes.

### 5) Document the install path

Add short docs for:

- global install: `npm install -g silaland`
- local use without global install: `npx silaland@latest ...`
- required env vars and channel setup after `create`
- which JS exports are Node-only and which are browser-safe
- migration from `silain` to `silaland`

## Implementation Plan

1. Make `packages/land/package.json` publishable as `silaland`.
2. Move the agent runtime code and built-in skills from `@sila/agents` into `packages/land`.
3. Remove the `@sila/agents` dependency from the published CLI path.
4. Add package entrypoints for CLI, Node API, and browser-safe exports.
5. Keep Node-only runtime code out of browser exports.
6. Publish a minimal deprecated `silain` stub that points users to `silaland`.
7. Add packaging checks around `npm pack --dry-run` and a tarball install test.
8. Update docs to show global install, `npx` usage, JS API entrypoints, and the rename from `silain`.
9. Document a release flow similar to `aiwrapper`: test, version bump, tag, publish.

## Risks

- Hidden repo-local assumptions may only show up after install from tarball.
- Moving code out of `@sila/agents` may temporarily create duplication or import churn while we settle the new package boundary.
- Native or heavy dependencies in the land runtime may still make global install slower than expected.
- Browser support can become confusing if we do not clearly separate browser-safe exports from Node-only runtime APIs.
- A stale `silain` stub can become confusing if we do not clearly deprecate it and keep the message current.

## Open Questions

- After moving the runtime into `packages/land`, is there any meaningful responsibility left for a separate `@sila/agents` package?
- What is the smallest useful browser-safe API we want to support in v1?
