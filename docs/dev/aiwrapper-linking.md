# AI source dependencies

Sila builds AIWrapper from the Git submodule at `vendor/aiwrapper`.
AIModels lives inside it at `vendor/aiwrapper/aimodels`.
Neither dependency is downloaded from npm.

## Setup

Use Node.js 22.20 or later.

```sh
git submodule update --init --recursive
npm ci
npm run dev
```

Installation builds AIWrapper and validates, tests, and bundles its AIModels catalog.
The client, core, and workbench share the same local `file:` dependency.

## Rebuild

```sh
npm run deps:build
npm run deps:status
```

Restart the desktop app after rebuilding.

## Update

Fetch AIWrapper and select a reviewed upstream commit:

```sh
git -C vendor/aiwrapper fetch origin
git -C vendor/aiwrapper checkout <commit>
git submodule update --init --recursive
npm run deps:build
```

Use npm 11 when updating the root lockfile.
Commit the submodule pointer alongside any Sila compatibility changes.
Changes inside AIModels must be committed and pushed before updating AIWrapper's pointer.
Changes inside AIWrapper must be committed and pushed before updating Sila's pointer.

## OpenRouter checks

Add `OPENROUTER_API_KEY` to the root `.env`, then run:

```sh
npm -w packages/core run test -- tests/src/ai/ai-openrouter.test.ts
```

These tests make paid API requests in temporary workspaces.
They check Auto selection, streaming, tool execution, follow-up messages, and chat titles.

As of October 2, 2026, OpenRouter Auto uses `openai/gpt-6.1-sol`.
The tests also cover `anthropic/claude-sonnet-5.5` and `google/gemini-3.8-flash`.
Use the full Sila model ID when selecting these manually:
`openrouter/anthropic/claude-sonnet-5.5`, for example.

Model IDs were checked against [OpenRouter's catalog](https://openrouter.ai/models).
Existing assistants with explicit model IDs keep their selections.
