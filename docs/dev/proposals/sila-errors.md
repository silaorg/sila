# Proposal: Sila Errors

## Summary
- Introduce a `SilaError` class with consistent fields.
- Tag errors with codes and metadata so UI and logs react correctly.
- Roll out in stages to avoid breaking current flows.

## Motivation
- Today we throw plain `Error` objects in more than 100 places across core, client, and desktop code.
- Callers cannot tell user mistakes from programmer failures.
- We repeat string parsing in UI and logs to guess the error class.
- We want richer telemetry without wrapping errors ad hoc.

## Goals
- Give every operational failure a stable code.
- Preserve stack traces and `cause` data.
- Keep adoption easy for Svelte components and Node services.
- Allow graceful UI handling when we expect the error.

## Non-Goals
- Replace every `throw new Error` in one sweep.
- Wrap third-party errors unless we plan to handle them.
- Change the external API surface for now.

## Design

### SilaError class
- Extend `Error` and add required fields.
- Store `code` (string literal), `kind` (enum: `user`, `system`, `programmer`), and optional `details`.
- Expose helpers to test with `isSilaError(error)`.

```ts
type SilaErrorKind = "user" | "system" | "programmer";

export class SilaError extends Error {
  readonly code: string;
  readonly kind: SilaErrorKind;
  readonly details?: Record<string, unknown>;

  constructor(params: {
    code: string;
    kind: SilaErrorKind;
    message: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.code = params.code;
    this.kind = params.kind;
    this.details = params.details;
  }
}

export function isSilaError(error: unknown): error is SilaError {
  return error instanceof SilaError;
}
```

### Error codes
- Define codes in `packages/core/src/errors/codes.ts`.
- Each module owns a prefix, e.g. `FS_`, `SPACE_`, `CHAT_`, `UI_`.
- Codes map to default user messages stored in existing text stores.
- Document codes in a Markdown table for support.

### Construction helpers
- Provide factory functions for common cases.
- Example: `errors.createFsError("FS_PATH_NOT_EMPTY", {...})`.
- Factories set `kind` and default message from a registry.
- Allow overrides when service wants custom wording.

### Handling
- Callers check `isSilaError` before fallback logging.
- UI shows friendly message for `kind === "user"` and collects details for `kind === "system"`.
- Logging middleware includes `code`, `kind`, and `details` in structured logs.

### Interop
- When catching third-party errors, wrap only if we add insight.
- Keep original error as `cause` to preserve stack.
- Never re-wrap an existing `SilaError`.

## Rollout Plan
- Step 1: Implement `SilaError`, registry, and helper functions in `packages/core`.
- Step 2: Add unit tests for construction, `cause`, and type guards.
- Step 3: Update top-level loaders in client (`SpaceOpener`, `FreshStartWizard`, app loaders) to throw and handle `SilaError`.
- Step 4: Sweep persistence and file-system utilities to adopt factories and populate codes.
- Step 5: Update dialogs and notification surfaces to map codes to user strings.
- Step 6: Add telemetry hooks for `code` and `kind`.
- Step 7: Document developer usage in `docs/dev/for-ai/errors.md` (new file).

## Testing
- Add unit tests for helper factories and guard functions.
- Add integration tests covering a user-facing failure (e.g., opening a bad space folder) to assert UI copy.
- Verify error codes flow through logging pipeline in desktop build.

## Risks
- Partial adoption may confuse future developers; mitigate with lint rule: disallow `new Error` in certain paths.
- Overloaded code list may sprawl; mitigate with owner prefixes and review checklist.
- Wrapping errors incorrectly may hide stack traces; ensure tests cover `cause` preservation.

## Open Questions
- Do we expose codes in API responses when we build a server? (Likely yes.)
- Should we encode severity levels beyond `kind`? (Maybe add later.)
- Do we need localization now or only map to existing English copy?
- Should we auto-log each `SilaError` at throw time or leave to callers?

