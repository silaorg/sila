# Source dependencies

Sila 2 uses AIWrapper from `vendor/aiwrapper`, a pinned Git submodule.
AIWrapper contains its own pinned `aimodels` submodule.
The Sila runtime links AIWrapper with a local `file:` dependency.
It does not download AIWrapper from npm.

## Install

Use Node.js 22.20 or later.

```sh
git clone --branch v2 --recurse-submodules https://github.com/silaorg/sila.git
cd sila
npm ci
```

For an existing checkout:

```sh
git submodule update --init --recursive
npm ci
```

The root prepare script installs AIWrapper's locked build dependencies and
builds its source. That build validates, tests, and bundles AIModels.
Submodule revisions only change through Git, never during installation.
Use npm 11 when regenerating the root lockfile. npm 10 can install it with
`npm ci`, but its resolver can fail while updating the linked dependency graph.

## Edit and rebuild

Edit AIWrapper inside `vendor/aiwrapper`. Edit model data inside
`vendor/aiwrapper/aimodels/data`. Follow each repository's own development rules.

```sh
npm run deps:build
npm test
npm run check
npm run build
```

Restart the development server after rebuilding AIWrapper.
`npm run deps:status` shows both pinned revisions.

## Update upstream

Fetch and review upstream commits before selecting a revision:

```sh
git -C vendor/aiwrapper fetch origin
git -C vendor/aiwrapper checkout <reviewed-commit>
git submodule update --init --recursive
npm run deps:build
```

To update only the model catalog, use AIWrapper's updater:

```sh
npm --prefix vendor/aiwrapper run aimodels:update
npm --prefix vendor/aiwrapper run check
```

Commit catalog pointers in AIWrapper before committing the AIWrapper pointer
in Sila. Push inner commits before outer commits so fresh clones can fetch them.
Do not publish a parent pointer to a commit that exists only locally.

## Product and storage versions

The product and Sila packages use version `2.0.0`.
Workspace `config.json` retains format version `1`; no storage migration is needed.
Environment settings now use the `SILA_` prefix.
For an existing Heswe installation, set `SILA_AUTH_DB_PATH` to its existing
database and keep `WORKSPACES_PATH` unchanged. Back up both before switching.
