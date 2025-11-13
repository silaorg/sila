## Proposal: Spaces as File Systems

### Motivation

- **Uniform access**: Treat every Sila `Space` and its app trees as a single, navigable file system to simplify mental models for users, agents, and integrations.
- **Agent ergonomics**: Enable shell-like workflows (`cd`, `ls`, `cat`, `touch`, `grep`) so agents can manipulate workspace data consistently across app kinds.
- **Interoperability**: Unify browsing, linking, and composing data across multiple trees (and even multiple spaces) as if it were one file hierarchy.
- **Keep what works**: Preserve our content-addressed binary storage (CAS) and only model metadata and structure in RepTree.

### Core Idea

Represent Sila workspaces (Spaces + app trees) as a virtual file system (VFS). Vertices act as directories and files for metadata and structure; binary payloads continue to live in our existing FileStore (CAS/mutable store). A Node.js-like FS layer—potentially backed by a library such as [ZenFS](https://github.com/zen-fs/)—exposes familiar file operations over this VFS so both humans and agents can work with the same abstractions.

### What This Enables

- **Seamless navigation** across multiple app trees and spaces via invisible mounts. Users and agents navigate a single tree even when data spans many underlying trees.
- **Shell for agents** that maps directly to workspace data (e.g., `cd /threads/public/files/`, `grep -R "TODO" /`, `cat message.md`).
- **Consistent mental model** that matches the UX in the Files app while generalizing it to all app kinds and system data.
- **Safer data handling** by keeping large binaries in CAS while using RepTree only for structure, references, and metadata.

### Principles

- **Local-first, offline-friendly**: The VFS reflects the CRDT-backed trees and works without a server.
- **Composability**: App trees and spaces compose via mounts; the boundaries are invisible during navigation but explicit in references.
- **Separation of concerns**: Structure and links live in RepTree; bytes live in FileStore. The VFS bridges them.
- **Predictable semantics**: Filesystem operations correspond to CRDT-safe operations; conflicts resolve the same way trees do.

### User and Agent Narratives

- **Human user**: Uses a Files-like interface to browse any space, open attachments, rename folders, and drag files—now extended to all app kinds with one consistent view.
- **Agent in a shell**: Runs `ls`, `cat`, `grep`, `mv` against the VFS to read/write notes, inspect messages, organize artifacts, and reference CAS-backed files by path.
- **Programmatic client**: Uses a Node-like FS API to integrate tools and scripts with workspace data without bespoke adapters per app.

### Relationship to Existing Proposals

- **Update space structure and app instances** (`docs/dev/proposals/update-space-structure.md`): The VFS sits on top of the structured spaces and app instances model, using TreeSpecs to inform layout, validation, and mounts.
- **ApplyPatch agent tooling** (`docs/dev/proposals/apply-patch.md`): The VFS provides the substrate for agent operations (List, Grep, Read, ApplyPatch) using space paths as first-class file paths.

### Scope (Conceptual)

- A unified, mountable namespace that maps Spaces and app trees to a hierarchical filesystem.
- File and directory abstractions over vertices; links from metadata to CAS binaries.
- Standard FS operations for users, agents, and integrations.

### Non‑Goals (for this proposal)

- No API signatures or storage schemas.
- No performance or concurrency design details.
- No UI specifics beyond the conceptual alignment with Files.

### Open Questions (to be addressed later)

- How do we surface permissions or visibility (public/private) at mount points?
\- How do we represent links, symlinks, and cross-space references in paths?
\- What are the conflict and merge semantics for concurrent edits via the VFS?
\- How do we prevent cyclical mounts and ensure predictable traversal?
\- What are the indexing and search guarantees for `grep`-like operations at scale?

### Success Criteria (Conceptual)

- Users and agents can navigate and manipulate workspace data using familiar filesystem semantics.
- The Files app experience generalizes to all app kinds without losing local-first and CAS benefits.
- The system remains composable: multiple trees/spaces feel like one hierarchy while preserving explicit references under the hood.


