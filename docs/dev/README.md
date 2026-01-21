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
- **packages/workbench** is a SvelteKit workbench for developing and testing Sila components in isolation

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

### [Spaces](./spaces/spaces.md)
Spaces are the primary unit of user data in Sila. Learn about:
- RepTree CRDT system
- Space and App trees
- Persistence layers (IndexedDB, FileSystem)
- Secrets management
- Best practices for developers

### [Files in Spaces](./files/files-in-spaces.md)
How Sila handles binary file storage and management:
- Content-addressed storage (CAS)
- Files AppTree for logical organization
- FileStore API for desktop
- Chat attachments integration
- On-disk layout and metadata

### [Electron Custom File Protocol](./files/electron-file-protocol.md)
How Sila serves files directly from CAS using a custom protocol:
- `sila://` protocol implementation
- Space-aware file serving
- Performance optimization
- Security considerations

### [Testing](./testing.md)
How we test and how to run tests:
- Core tests (unit/integration) with Vitest in `packages/core/tests`
- UI integration tests with Playwright in the workbench (`packages/workbench`)

### [Space Management](./spaces/space-management.md)
Managing workspaces and data:
- Creating and organizing spaces
- Data persistence and sync
- Workspace configuration

## AI Development Guidelines

Everything in the `dev/for-ai` folder is addressed to AI agents—basic rules for committing, using particular tools, documenting, etc.

## Proposals

Feature proposals live in the `dev/proposals` folder and are deleted from production once completed and tested.

## Related Projects

Sila is built alongside several companion projects:
- **AI inference** - [aiwrapper](https://github.com/mitkury/aiwrapper)
- **Info about AI models** - [aimodels](https://github.com/mitkury/aimodels)
- **Tiling tabs** - [ttabs](https://github.com/mitkury/ttabs)
- **Sync** - [reptree](https://github.com/mitkury/reptree)
- **AI context** - [airul](https://github.com/mitkury/airul)

All projects are maintained by Sila's author.