This is a context for AI editor/agent about the project. It's generated with a tool Airul (https://github.com/mitkury/airul) out of 10 sources. Feel free to edit .airul.json to change the sources and configure editors. Run `airul gen` to update the context after making changes to .airul.json or the sources. Remember to update TODO-AI.md after major changes in the project, keeping track of completed tasks and new developments.

# From README.md:

# Open Alternative to ChatGPT

<p align="center">
  <img src="docs/assets/icons/Square310x310Logo.png" style="width: 25%; height: auto;">
</p>

Sila is an open alternative to ChatGPT. It allows you to use the best AI models from different providers, keeps data private, and doesn't require a subscription.

![Sila screenshot](docs/assets/screenshot.png)

> 🚧 Work in progress towards v1.

## Getting Started

**Download Sila:**
- [Download for macOS](#) 
- [Download for Windows](#)

**For developers:** Want to build from source? Check out our [quick start guide](docs/dev/quick-start.md) and [development documentation](docs/dev/README.md).

## Features

### Workspaces

Organize your conversations and assistants into separate workspaces

### Local first

You can use Sila without relying on Sila servers

### Tabs like in VSCode

Create and switch between tabs, and split windows

### Any AI

From OpenAI and Anthropic to Ollama and any OpenAI-compatible API; bring your own keys

### Many themes

Use different themes for your workspaces; from colorful to boring

### Assistants

Create your own assistants with their own prompts and models

### No subscriptions

Pay as you go, either for API costs from AI providers or the actual compute if you run models yourself.

## Documentation

### Product
Learn about Sila's features and how to use them effectively. Check out our [product documentation](docs/product/README.md) for user guides, feature overviews, and troubleshooting.

### Development
For developers and contributors, we have comprehensive [development documentation](docs/dev/README.md) covering the codebase, architecture, testing, and contribution guidelines.

## Related projects
Sila is built alongside several companion projects that enable its features:

- **AI inference** - [aiwrapper](https://github.com/mitkury/aiwrapper)
- **Info about AI models** - [aimodels](https://github.com/mitkury/aimodels)
- **Tiling tabs** - [ttabs](https://github.com/mitkury/ttabs)
- **Sync** - [reptree](https://github.com/mitkury/reptree)
- **AI context** - [airul](https://github.com/mitkury/airul)

All projects are maintained by Sila's author.
---

# From docs/dev/README.md:

# Sila Development Documentation

This guide will help you understand the different features and components of Sila from a development perspective.

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
Testing infrastructure and practices in Sila:
- Vitest test suite
- File persistence testing
- Local assets for deterministic tests
- Running tests and development workflow

## Development

### [Project Structure](./project-structure.md)
Overview of the monorepo structure and packages:
- Core, client, desktop, mobile packages
- Build system and workspace setup
- Tech stack overview

### [Quick Start](./quick-start.md)
Get started with development:
- Prerequisites and setup
- Running the development environment
- Building from source

### [Space Management](./space-management.md)
Managing workspaces and data:
- Creating and organizing spaces
- Data persistence and sync
- Workspace configuration

## Platform-Specific

### [macOS Notarization Setup](./macos-notarization-setup.md)
Setting up code signing and notarization for macOS builds

## AI Development Guidelines

### [For AI Agents](./for-ai/)
Guidelines and rules for AI-assisted development:
- [Rules](./for-ai/rules.md) - Basic guidelines for AI agents
- [Svelte](./for-ai/svelte.md) - Svelte 5 runes and patterns
- [Skeleton](./for-ai/skeleton.md) - UI component system

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

# From docs/dev/project-structure.md:

# Project structure 

We have a package.json in the root of our repository that unites our packages in the npm workspace. We run `npm install`, `npm run dev` and `npm build` from the root.

This should be enough to get started after cloning the repository:
`npm install && npm run dev`

## Packages
- **packages/core** is the core functionality shared with other packages.
- **packages/client** is the client code with UI components written in Svelte.
- **packages/desktop** is a Svelte /w Vite + Electron wrapper that is using the client package. We use it for desktop builds.
- **packages/mobile** is a SvelteKit + Capacitor wrapper that is using the client package. We use it for mobile builds.
- **packages/demo** is a tool to create demo workspaces out of a JSON
- **packages/tests** is a test suit for the most important systems of Sila

## How it ties together and builds

Neither the core nor client gets their own dist/build. Rather than building - we import them to our dedicated Vite projects in the desktop and mobile packages. Each of those uses <SilaApp> Svelte component from the client with a config that has integrations for Electron and Capacitor to work with their file systems and native dialogs.

## Quick facts about our tech stack

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
    "airul": "^0.1.36"
  },
  "scripts": {
    "postinstall": "airul gen",
    "dev": "concurrently \"npm -w packages/core run watch\" \"npm -w packages/client run watch\" \"npm -w packages/desktop run dev\"",
    "build": "npm -w packages/desktop run build",
    "stop-dev": "pkill -f concurrently 2>/dev/null; lsof -ti:6969 | xargs -r kill -9 2>/dev/null; pkill -f 'tailwindcss.*watch' 2>/dev/null; echo 'Dev servers stopped'",
    "build-demo-space": "npx tsx packages/demo/src/cli.ts",
    "test": "npm -w packages/tests run test",
    "test:watch": "npm -w packages/tests run test:watch"
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