This is a context for AI editor/agent about the project. It's generated with a tool Airul (https://github.com/mitkury/airul) out of 12 sources. Edit .airul.json to change sources or enabled outputs. After any change to sources or .airul.json, run `airul gen` to regenerate the context.

# From README.md:

<h1 align="center">
  <img src="docs/assets/icons/Square310x310Logo.png" alt="Sila Logo" width="100">
  <br />
Sila
</h1>
<p align="center">
  Own your AI chats and data
  <br />
  <a href="https://silain.com/download">Download</a>
  ·
  <a href="https://silain.com/v1/features">Features</a>
  ·
  <a href="https://silain.com/v1/how-to/use-ai">How to use AI</a>
</p>
<br/>

Sila works like ChatGPT, but in Sila you own your assistants, chats, and all generated data. As you use AI more, as it learns more about you and your preferences - that data becomes more valuable over time - so it makes sense to own it!

![Sila screenshot](docs/assets/screenshot.png)

Unlike most similar projects, you don't need to host a server or register an account to use Sila. Even though your data is stored locally as plain files, it can be synced effectively across multiple devices. Later, you can even host your workspace on a server and invite team members. We combine the power of local-first with collaborative capabilities.

## Features

### Workspaces

Organize your chats and assistants into separate workspaces. Each workspace can have its own assistants, folders, theme, and language. Create multiple workspaces for different purposes and switch quickly.

### Local-first & syncs well

Workspaces are stored locally. You can sync them with iCloud, Dropbox, etc., to use across devices. Your assistants, chats, and generated data remain under your control.
No accounts required. Sila works offline if the AI model runs on your device.

### Any AI models

From OpenAI, Google, and Anthropic to Ollama — plus any OpenAI-compatible APIs. Bring your own keys.

### Assistants

Create your own assistants with their instructions, AI models, and tools. Assistants can support different workflows. For example, one assistant can always search a specific source, reference a document, and create conversations into a chosen folder in your workspace.

### Tabs like in VSCode

Create and switch between tabs, and split windows. It works almost like VSCode. You can have multiple conversations open across tabs, chat with different assistants at the same time, and quickly reference or switch from one chat to another.

### Many themes

Use different themes for your workspaces — from colorful to boring. It's a simple way to set a mood or tell your workspaces apart.

### No subscriptions

Pay as you go, either for API costs from AI providers or the actual compute if you run models yourself.

## Download the app

**Download Sila:**

- [Download for macOS](https://silain.com/download#platforms)
- [Download for Windows](https://silain.com/download#platforms)
- [Download for Linux](https://silain.com/download#platforms)

## Documentation

### Product

Learn more about Sila's features in the [product documentation](https://silain.com/v1/features/).

### Development

Want to build from source? Check out the [quick start guide](https://silain.com/v1/dev/quick-start) and [development documentation](https://silain.com/v1/dev/) covering the architecture, codebase, testing, and contribution guidelines.

## Related projects

Sila is built alongside several companion projects that enable its features:

- **AI inference** - [AIWrapper](https://github.com/mitkury/aiwrapper)
- **Info about AI models** - [AIModels](https://github.com/mitkury/aimodels)
- **Tiling tabs** - [TTabs](https://github.com/mitkury/ttabs)
- **Sync** - [RepTree](https://github.com/mitkury/reptree)
- **AI context** - [Airul](https://github.com/mitkury/airul)

All projects are maintained by Sila's author.
---

# From docs/features/README.md:

# Features of Sila

## Workspaces

Organize your chats and assistants into separate workspaces. Each workspace can have its own assistants, folders, theme, and language. Create multiple workspaces for different purposes and switch quickly.

## Local-first but syncs

Workspaces are stored locally. You can sync them with iCloud, Dropbox, etc., to use across devices. Your assistants, chats, and generated data remain under your control. Sync conflicts will get resolved automatically.
No accounts required. Sila works offline if the AI model runs on your device.

## Any AI models

From OpenAI, Google, and Anthropic to Ollama — plus any OpenAI-compatible APIs. Bring your own keys.

## Assistants

Create your own assistants with their instructions, AI models, and tools. Assistants can support different workflows. For example, one assistant can always search a specific source, reference a document, and create conversations into a chosen folder in your workspace.

## Chats

When you chat - you can switch between assistants, branch conversations and edit messages created both by you and the AI.

## Tabs like in VSCode

Switch between tabs, and split windows. It works almost like VSCode. You can have multiple conversations open across tabs, chat with different assistants at the same time, and quickly reference or switch from one chat to another.

## Many themes

Use different themes for your workspaces — from colorful to boring. It's a simple way to set a mood or tell your workspaces apart.

## No subscriptions

Pay as you go, either for API costs from AI providers or the actual compute if you run models yourself.

## Development

For developers and contributors, explore the [development section](dev/README.md) covering architecture, codebase, testing, and contribution guidelines.
---

# From docs/dev/README.md:

# Sila Development Documentation

## Project structure 

We have a package.json in the root of the repository that unites all the packages (from the /packages dir) in the npm workspace. We run `npm install`, `npm run dev` and `npm build` from the root directory.

This should be enough to get started after cloning the repository:
`npm install && npm run dev`

See [Quick Start](./quick-start.md) for the instructions on running, debugging, and building.

### Packages
- **packages/core** is the core functionality shared with other packages.
- **packages/client** is the client code with UI components written in Svelte.
- **packages/desktop** is a Svelte /w Vite + Electron wrapper that is using the client package. We use it for desktop builds.
- **packages/mobile** is a SvelteKit + Capacitor wrapper that is using the client package. We use it for mobile builds.
- **packages/demo** is a tool to create demo workspaces out of a JSON
- **packages/gallery** is a SvelteKit site for developing and testing Sila components in isolation

### Quick facts about the tech stack

- Standalone application (desktop + mobile)
- Desktop app runs on Electron  
- Mobile app runs on Capacitor
- Built with TypeScript
- Frontend uses Svelte 5 + SvelteKit
- Everything runs locally (no server yet) plus external APIs
- Styling via Tailwind CSS
- Components from Skeleton design system
- Inference with AI is done through AIWrapper
- Sync handled by RepTree
- Tiling tabs like in VSCode are built with TTabs
- Context for AI agent generated with Airul

### How it ties together and builds

Neither the core nor client gets their own dist/build. Rather than building - we import them to our dedicated Vite projects in the desktop and mobile packages. Desktop and mobile packages import <SilaApp> Svelte component from the client. They init <SilaApp> with a config that has integrations for Electron and Capacitor to work with their file systems and native dialogs.

## Core Features

### [Spaces](./spaces.md)
Spaces are the primary unit of user data in Sila. Learn about:
- RepTree CRDT system
- Space and App trees
- Persistence layers (IndexedDB, FileSystem)
- Secrets management
- Best practices for developers

### [Files in Spaces](./files-in-spaces.md)
How Sila handles binary file storage and management:
- Content-addressed storage (CAS)
- Files AppTree for logical organization
- FileStore API for desktop
- Chat attachments integration
- On-disk layout and metadata

### [Electron Custom File Protocol](./electron-file-protocol.md)
How Sila serves files directly from CAS using a custom protocol:
- `sila://` protocol implementation
- Space-aware file serving
- Performance optimization
- Security considerations

### [Testing](./testing.md)
How we test and how to run tests:
- Core tests (unit/integration) with Vitest in `packages/core/tests`
- UI integration tests with Playwright in `packages/gallery`

### [Space Management](./space-management.md)
Managing workspaces and data:
- Creating and organizing spaces
- Data persistence and sync
- Workspace configuration

## AI Development Guidelines

Everything in [For AI Agents](./for-ai/) is addressed to AI agents - basic rules for commiting, using particular tools, documenting, etc.

## Proposals

See [proposals](./proposals/) for feature proposals. We delete proposals when we complete them  (in production and tested).

## Related Projects

Sila is built alongside several companion projects:
- **AI inference** - [aiwrapper](https://github.com/mitkury/aiwrapper)
- **Info about AI models** - [aimodels](https://github.com/mitkury/aimodels)
- **Tiling tabs** - [ttabs](https://github.com/mitkury/ttabs)
- **Sync** - [reptree](https://github.com/mitkury/reptree)
- **AI context** - [airul](https://github.com/mitkury/airul)

All projects are maintained by Sila's author.
---

# From docs/dev/releases.md:

# How we build and release

We use GitHub Actions workflows to automate the entire release process.

Main idea: code is the source of truth. We bump `packages/desktop/package.json` with `npm version`, which creates a `desktop-vX.Y.Z` tag. CI triggers on that tag and validates the tag equals the code version before building.

We release in three steps:
1) Create a draft release on Github
2) Build and upload those builds to the draft release
3) Publish the draft as the latest release

## Create a draft
- Trigger: push a tag `desktop-vX.Y.Z`
- Workflow: "release-1-draft"
- Result: a draft GitHub Release with autogenerated notes (no binaries yet)
- Validates that the tag version matches `packages/desktop/package.json` version

## Build and upload builds (All platforms on CI)
- Workflow: "release-2-build-upload" (manual, input the tag)
- Builds and uploads macOS (signed + notarized), Windows, and Linux artifacts to the same draft release
- Uses Git LFS for asset handling (provider images, icons, etc.)

## Publish the draft
- Workflow: "release-3-finalize" (manual, input the tag)
- Sets `draft=false` so users and auto-updaters see the new version

## Github actions
See `.github/workflows/` in the root
Use `gh` cli tool to inspect workflows if needed

## Notes
- All platforms are built on CI. macOS artifacts are code-signed and notarized automatically.
- We produce a single universal macOS DMG (Intel + Apple Silicon).
- The latest public release is available on the download page: [silain.com/download](https://www.silain.com/download).
---

# From package.json:

{
  "name": "sila",
  "description": "Root package for Sila monorepo - coordinates development workflow across client, core, and server packages",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "devDependencies": {
    "airul": "^0.1.37"
  },
  "scripts": {
    "postinstall": "airul gen",
    "dev": "concurrently \"npm -w packages/core run watch\" \"npm -w packages/client run watch\" \"npm -w packages/desktop run dev\"",
    "gallery": "npm -w packages/gallery run dev",
    "stop-dev": "pkill -f concurrently 2>/dev/null; lsof -ti:6969 | xargs -r kill -9 2>/dev/null; pkill -f 'tailwindcss.*watch' 2>/dev/null; echo 'Dev servers stopped'",
    "build-demo-space": "npx tsx packages/demo/src/cli.ts",
    "test": "npm run test:core && npm run test:gallery",
    "test:gallery": "npm -w packages/gallery run test",
    "test:core": "npm -w packages/core run test",
    "release:desktop:patch": "bash -lc 'set -euo pipefail; BRANCH=$(git rev-parse --abbrev-ref HEAD); if [ \"$BRANCH\" != \"main\" ]; then echo \"Releases must be cut from main (current: $BRANCH)\"; exit 1; fi; git fetch origin main --quiet; if ! git merge-base --is-ancestor HEAD origin/main; then echo \"Local main is behind origin/main; please pull\"; exit 1; fi; cd packages/desktop; npm version patch; git push --follow-tags'"
  },
  "dependencies": {
    "markpage": "^0.4.0"
  }
}
---

# From tsconfig.json:

{
  "compilerOptions": {
    "target": "es2021",
    "module": "esnext",
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": true,
    "checkJs": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "allowImportingTsExtensions": true,
    "baseUrl": ".",
    "moduleResolution": "bundler",
    "paths": {
      "@sila/core":   ["packages/core/src/*"],
      "@sila/client": ["packages/client/src/lib/index.ts"],
      "@sila/client/*": ["packages/client/src/lib/*"]
    }
  },
  "exclude": [
    "node_modules",
    "**/node_modules",
    "**/dist",
    "**/build", 
    "**/.svelte-kit",
    "**/coverage",
    "packages/mobile/ios"
  ]
}
---

# From docs/dev/for-ai/gh-cli.md:

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
---

# From docs/dev/for-ai/how-to-write-docs.md:

# How to write docs

Write them simply.

## Rule for the agent

* Lead with the key action or fact.
* Use plain words. Avoid jargon; if a term is required, define it once.
* Write short sentences (aim ≤ 15 words).
* Use active voice: “Do X,” not “X should be done.”
* One idea per sentence. One task per paragraph.
* Prefer lists and steps over long paragraphs.
* State defaults, constraints, and examples near the instruction.
* Delete filler, hedging, and marketing language.
* Use consistent terms and formatting.

## Do / Don’t

**Do**

* Show a minimal example right after the instruction.
* Name buttons, flags, files, and paths exactly.
* Call out prerequisites and errors up front.

**Don’t**

* Start with history or philosophy.
* Use acronyms without expanding them once.
* Stack multiple clauses or metaphors.

## Tiny example

**Before:** “In order to facilitate initialization, the system should be configured accordingly.”
**After:** “Configure the system. Then run `init`.”
---

# From docs/dev/for-ai/proposals.md:

# Proposals for development

When a developer asks to create a proposal for a feature or major change - write the proposal as a Markdown file in /docs/dev/proposals. Before writing a proposal explore all relevant systems and documents.

Give the developer some time to review the proposal. Expect feedback and questions.
---

# From docs/dev/for-ai/rules.md:

# Basics for AI agents

## Icons
Use lucide-svelte icons, like this: 
import { Check } from "lucide-svelte";
and <Check size={14} />

# Git commits
Use imperative mood and use a prefix for the type of change.
Examples:
feat(auth): add user login
fix(payment): resolve gateway timeout
ci: update release workflow
docs: update README
dev: add the core and the client as aliases to the sveltkit config

## Commit types
Any product-related feature - "feature(name): description"
Any product-related fix - "fix(name): description"
Anything related to building and releasing (including fixes of CI) - "ci: description"
Anything related to testing - "tests: description"
Anything related to documentation - "docs: description"
Anything related to the build pipelines and dev convinience - "dev: description"
---

# From docs/dev/for-ai/skeleton.md:

# Skeleton Documentation for LLMs

> Skeleton provides a uniform design language and structured framework for controlling the look and feel of your product and user experience. It serves as an opinionated design system that aims to greatly reduce the amount of time spent managing design elements and patterns, allowing you to more quickly build and manage your frontend interfaces at scale.


## Documentation Sets

- [React package documentation](https://skeleton.dev/llms-react.txt): documentation with React specific examples.
- [Svelte package documentation](https://skeleton.dev/llms-svelte.txt): documentation with Svelte specific examples.

## Notes
- The content is automatically generated from the official documentation
- Skeleton's core features are framework agnostic, only requiring the use of [Tailwind CSS](https://tailwindcss.com/). This provides full access to all design system features, while enabling you to standardize the design process for your framework of choice.
---

# From docs/dev/for-ai/svelte.md:

New in SvelteKit 5:

# Runes

## Reactivity

Reactivity with `let x = "hello"` at component top-level is replaced with:

```js
let x: string = $state("hello")
```

This makes x reactive in the component, and also in any js functions that operate on it.

Don't use `$state<T>()` to pass the type. Always use `let x: Type =`. Variables declared with `let x = "hello"` are no longer reactive.

## Derived values

Old style:
```js
$: b = a + 1
```

New style:
```js
let b = $derived(a + 1)
```

Or for more complex use cases:
```js
let b = $derived.by(() => {
    // ... more complex logic
    return a + 1;
})
```

`$derived()` takes an expression. `$derived.by()` takes a function.

## Effect

```js
let a = $state(1);
let b = $state(2);
let c;

// This will run when the component is mounted, and for every updates to a and b.
$effect(() => {
    c = a + b;
});
```

Note: 
- Values read asynchronously (promises, setTimeout) inside `$effect` are not tracked.
- Values inside objects are not tracked directly inside `$effect`:

```js
// This will run once, because `state` is never reassigned (only mutated)
$effect(() => {
    state;
});

// This will run whenever `state.value` changes
$effect(() => {
    state.value;
});
```

An effect only depends on the values that it read the last time it ran.

```js
$effect(() => {
    if (a || b) {
        // ...
    }
});
```

If `a` was true, `b` was not read, and the effect won't run when `b` changes.

## Props

Old way to pass props to a component:
```js
export let a = "hello";
export let b;
```

New way:
```js
let {a = "hello", b, ...everythingElse} = $props()
```

`a` and `b` are reactive.

Types:
```js
let {a = "hello", b}: {a: string, b: number} = $props()
```

Note: Do NOT use this syntax for types:
```js
let { x = 42 } = $props<{ x?: string }>();  // ❌ Incorrect
```

# Slots and snippets

Instead of using `<slot />` in a component, you should now do:

```js
let { children } = $props()
// ...
{@render children()}  // This replaces <slot />
```

# Event Handling

In Svelte 5 the events do not use `on:event` syntax, they use `onevent` syntax.

In Svelte 5 `on:click` syntax is not allowed. Event handlers have been given a facelift in Svelte 5. Whereas in Svelte 4 we use the `on:` directive to attach an event listener to an element, in Svelte 5 they are properties like any other (in other words - remove the colon):

```svelte
<button onclick={() => count++}>
  clicks: {count}
</button>
```

`preventDefault` and `once` are removed in Svelte 5. Normal HTML event management is advised:

```svelte
<script>
  function once(fn) {
    return function(event) {
      if (fn) fn.call(this, event);
      fn = null;
    };
  }

  function preventDefault(fn) {
    return function(event) {
      event.preventDefault();
      fn.call(this, event);
    };
  }
</script>

<button onclick={once(preventDefault(handler))}>...</button>
```