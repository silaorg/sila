## How Agents Read and Edit Files

Agents in this environment manipulate the codebase through a set of cli-like tools. The sections below outline the key tools the agent uses to discover files, inspect their contents, and apply changes, along with notes on when shell commands enter the picture.

### Sila integration (WIP)
- We plan to expose these capabilities to Sila’s `WrapChatAgent` (`packages/core/src/agents/WrapChatAgent.ts`) so it can navigate the active Sila workspace (Space) and create or modify workspace files.
- The agent-facing tools will mirror the primitives in this document:
  - **List (LS)**, **Grep**, **Read**, **ReadLints**, and **ApplyPatch**.
- Mapping to Sila internals:
  - All operations are scoped to the current Space. Treat the Space as a virtual file system; use Space paths (for example, `/files/Notes/plan.md`) to read, list, search, create, and edit text files.
  - Agent tools accept and return Space paths for runtime operations.

### Discovering and Inspecting Files
- **`LS`** lists non-hidden files and directories. Agents prefer it to `ls` so the platform can filter entries and enforce ignore globs.
- **`Grep`** wraps `ripgrep` for searching within the workspace while respecting ignore rules. Narrowing by pattern, file glob, or path keeps results concise.
- **`Read`** is the primary way to inspect file contents. It supports reading entire files or selected line ranges and can even preview images. Because each call returns line numbers, the agent can reference exact sections when summarizing or editing.
- **`ReadLints`** surfaces IDE diagnostics so the agent can see lint or type errors associated with files it touches.

### Editing Source Files
- **`ApplyPatch`** is the default editing primitive. The agent provides a patch with explicit context, and the tool enforces a diff-like format (`*** Update File` or `*** Add File` headers, `@@` hunks, and `+/-` lines). This prevents unintended edits and makes it easy to review changes. Creating new files is as simple as supplying an `*** Add File` block.
- **`Edit`** is a structured fallback used only when `ApplyPatch` is unsuitable (for example, when editing tools struggle with a tricky diff). The agent supplies succinct instructions and focused code snippets; the helper model applies the change.
- **Guidelines**: Agents default to ASCII when editing files, avoid undoing user changes, respect prior formatting, and only modify the minimum necessary code.

### Creating Supporting Artifacts
- Agents can generate additional resources (for example, documentation or scripts) via `ApplyPatch` with an `*** Add File` section. When desired, they can also create directories using a shell command (`mkdir -p`) before adding the file contents.
- In Sila, use `ApplyPatch` to create or edit workspace text files using Space paths (for example, `/files/...`).
  - When targeting the Space, prefer Space paths (e.g., `/files/...`) rather than absolute OS paths; tools will resolve these paths through `AppTree`/`FilesTreeData`.

### When Shell Commands Are Used
- **`Shell`** gives access to a persistent terminal session. Agents use it sparingly—mainly to run commands not covered by dedicated tools (creating directories, running tests, installing dependencies). On the first use, they `cd` into the workspace to set the working directory. Long-running commands can be launched in the background via the `is_background` flag.
- Whenever a dedicated tool exists (for example, `Read` instead of `cat`, `Grep` instead of `rg`), agents must prefer the tool to keep the workflow safe and consistent.

### Typical Editing Workflow
1. **Understand the target**: use `LS`, `Grep`, and `Read` to locate relevant files and gather context.
2. **Plan the modification**: synthesize requirements, sometimes capturing them in `TodoWrite` tasks that the agent tracks during longer efforts.
3. **Apply the change**: craft an `ApplyPatch` diff (or invoke `Edit`/`EditNotebook` if appropriate) to modify or create files.
4. **Verify**: optionally run tests or linters through `Shell`, and check diagnostics with `ReadLints`.
5. **Summarize**: report back on what changed, referencing file paths and key symbols.

### Key Takeaways
- Structured tools (`Read`, `ApplyPatch`, `Edit`) are the backbone of file manipulation; they provide transparency and guardrails.
- Shell usage is intentional and limited to tasks the higher-level tools cannot perform.
- This tooling ecosystem encourages incremental, reviewable edits and keeps the agent aligned with repository conventions while it codes autonomously.

## How `ApplyPatch` Works

`ApplyPatch` is the primary editing primitive for agents in this environment. It lets the agent propose precise, reviewable diffs that the platform applies safely. This document explains the structure of an `ApplyPatch` request, shows how different editing scenarios map onto the tool, and highlights best practices.

### Core Concepts
- **Single-file focus**: each `ApplyPatch` call targets exactly one file. Multiple files require multiple invocations.
- **Diff envelope**: every request starts with `*** Begin Patch` and ends with `*** End Patch`, framing the change for auditing.
- **Operation header**: inside the envelope, the agent chooses either `*** Update File: <path>` (modify existing) or `*** Add File: <path>` (create new). Paths are absolute.
- **Hunks with context**: modifications are expressed with `@@` headers followed by context lines (` `), removals (`-`), and additions (`+`). Supplying at least three lines of surrounding context keeps the diff unambiguous.
- **Text-only**: the tool expects ASCII-friendly text. Binary assets should be handled with other mechanisms.

### Update Example
The snippet below shows a real-world pattern for appending a tip to `docs/how-agents-edit-files.md`:

```diff
*** Begin Patch
*** Update File: /workspace/docs/how-agents-edit-files.md
@@
- ### Key Takeaways
- - Structured tools (`Read`, `ApplyPatch`, `Edit`, `EditNotebook`) are the backbone of file manipulation; they provide transparency and guardrails.
- - Shell usage is intentional and limited to tasks the higher-level tools cannot perform.
- - This tooling ecosystem encourages incremental, reviewable edits and keeps the agent aligned with repository conventions while it codes autonomously.
+ ### Key Takeaways
+ - Structured tools (`Read`, `ApplyPatch`, `Edit`, `EditNotebook`) are the backbone of file manipulation; they provide transparency and guardrails.
+ - Shell usage is intentional and limited to tasks the higher-level tools cannot perform.
+ - This tooling ecosystem encourages incremental, reviewable edits and keeps the agent aligned with repository conventions while it codes autonomously.
+ - Prefer `ApplyPatch` for source edits; fall back to other tools only when necessary.
*** End Patch
```

### Creating New Files
To add new documentation or code, the agent switches to the `*** Add File` header. For example, the command that created this document looked like:

```diff
*** Begin Patch
*** Add File: /workspace/docs/how-applypatch-works.md
+## How `ApplyPatch` Works
+...
*** End Patch
```

### Best Practices
- **Preview the current file**: read relevant sections with `Read` before crafting a patch to avoid stale context.
- **Keep changes minimal**: only touch the lines that need adjustment. Unnecessary context edits can introduce merge conflicts.
- **Maintain formatting**: respect existing indentation, line endings, and character sets.
- **Validate after editing**: run tests or linters (via `Shell`) if the change warrants verification, and review `ReadLints` diagnostics when available.
- **Fallbacks**: when `ApplyPatch` cannot accurately express the desired edit (for example, due to conflicting context), agents elevate to the `Edit` tool with focused instructions.

Using `ApplyPatch` consistently ensures edits remain explicit, reviewable, and easy to reason about during collaborative development.
