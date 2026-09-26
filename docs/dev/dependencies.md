# AIWrapper and AIModels

AIWrapper lives in `vendor/aiwrapper` as a Git submodule. AIModels is a submodule inside it.

Heswe uses a local `file:` dependency to load AIWrapper. We build both from source, without publishing to npm.

## Setup

Use Node.js 22.20 or later.

```sh
git submodule update --init --recursive
npm ci
```

Installation builds AIWrapper and validates, tests, and bundles AIModels. It uses the commits recorded in Git.

Use npm 11 to update the root lockfile. npm 10 can run `npm ci`, but can fail when resolving changes to linked dependencies.

## Make changes

Edit AIWrapper in `vendor/aiwrapper`. Model data lives in `vendor/aiwrapper/aimodels/data`.

```sh
npm run deps:build
npm test
npm run check
npm run build
```

Restart the dev server after rebuilding. Run `npm run deps:status` to see the selected commits.

## Get updates

Fetch AIWrapper and choose the commit you want:

```sh
git -C vendor/aiwrapper fetch origin
git -C vendor/aiwrapper checkout <commit>
git submodule update --init --recursive
npm run deps:build
```

To update just the catalog:

```sh
npm --prefix vendor/aiwrapper run aimodels:update
npm --prefix vendor/aiwrapper run check
```

Commit and push changes from the inside out: AIModels, then AIWrapper, then Heswe. Each parent records the commit it uses. Other checkouts must be able to fetch that commit.

## Existing workspaces

The app version is `2.0.0`. Workspace format stays at `1`, so workspace files don't need a migration.

Server settings use `HESWE_`. Back up the database and workspace directory before switching builds.

The interim Sila-named build used `sila_workspaces` and `sila_workspace_selections` tables. Heswe uses `heswe_` table names. Setting `HESWE_AUTH_DB_PATH` to the old database does not migrate these tables. Workspace files remain on disk, but those ownership records need migration before they appear in Heswe.

Do not delete the old tables or recreate workspaces over existing directories. See the [review](review-2026-09-26.md#names-and-stored-data) for the migration work still needed.
