# Fal Skill-Driven Tools

## Summary

Replace hardcoded Fal media tools with one generic `fal_run` tool in `@sila/agents`, then move endpoint-specific behavior into land skills and Fal docs kept in the land.

This keeps architecture simple:

- one executable Fal integration point in core
- many workflows described in local skills
- no core release needed for each new Fal endpoint

## Current State

- `packages/agents/src/chat-agent.js` always registers `generate_image` and `generate_video`.
- `packages/agents/src/tools/generate-image-tool.js` and `generate-video-tool.js` hardcode model ids and endpoint-specific parameter rules.
- skills are already loaded from built-in and land paths (`packages/land/src/skills.js`) and listed in instructions with file paths.
- skills currently guide behavior only, they do not add new executable capabilities.

Result: adding one more Fal workflow requires code changes in core tools, tests, and deployment.

## Goals

- Let agents call many Fal endpoints without adding a new core tool each time.
- Keep local file upload/download handling safe and deterministic.
- Keep skill-first discoverability for common workflows.
- Preserve current user experience for image and video generation during migration.

## Non-Goals

- A generic unrestricted HTTP tool for all providers.
- Automatic parsing of all Fal docs into schemas.
- Removing compatibility aliases immediately.

## Proposed Design

### 1) Add one core tool: `fal_run`

Add `packages/agents/src/tools/fal-run-tool.js` and register it in `createChatAgent`.

Tool contract:

- `endpoint` (required): Fal endpoint id, for example `fal-ai/nano-banana-pro/edit`.
- `input` (required): JSON object passed to Fal.
- `upload_files` (optional): local files to upload first and inject into `input` keys.
- `output_path` (optional): file path or base path for downloaded outputs.
- `output_paths` (optional): list of JSON paths to URL fields in result (fallback to auto-detect common url fields).
- `sync_mode` (optional): forwarded when endpoint supports it.

Behavior:

- read and validate `FAL_AI_API_KEY`
- upload requested local files through `fal.storage.upload`
- run `fal.subscribe(endpoint, { input, logs: true })`
- extract output URLs, download them, and save local files
- return normalized response with `status`, `endpoint`, `files`, and raw `result`

### 2) Keep old names as compatibility wrappers

Keep `generate_image` and `generate_video`, but rewrite them as thin wrappers that call `fal_run` with prefilled endpoint/input mapping.

This gives immediate backward compatibility while moving logic to one path.

### 3) Shift endpoint knowledge into skills and docs

Store Fal docs in land, for example:

- `docs/integrations/fal/*.md` (or a similar land-local docs path)

Keep built-in starter skills in source and add land-specific skills for workflows, for example:

- `packages/skills/fal-image-edit/SKILL.md`
- `skills/fal-image-edit/SKILL.md`
- `skills/fal-background-remove/SKILL.md`
- `skills/fal-video-edit/SKILL.md`

### 3.1) Skill sources and precedence

The skill catalog should explicitly list source scope and file path so agents always know where to read.

Skill source directories:

- Built-in skills: `<source repo root>/packages/skills/<skill-name>/SKILL.md`
- Land skills: `<land root>/skills/<skill-name>/SKILL.md`
- Agent-specific skills (future): `<land root>/agents/<agent-id>/skills/<skill-name>/SKILL.md`

Resolution order for duplicate skill names:

- built-in base
- land overrides built-in
- agent-specific overrides land and built-in

Instruction catalog format should include source and path per skill entry, for example:

- `fal-image-edit: Edit existing images with Fal endpoints. (source: land, file: skills/fal-image-edit/SKILL.md)`

This keeps activation deterministic and makes future `agents/{agent-id}/skills` support straightforward.

Each skill should include:

- when to activate
- which Fal endpoint to use
- required/optional `input` fields
- expected `fal_run` call shape
- output file naming guidance

This matches current skill loading behavior with no new land loader complexity.

### 4) Update managed instructions

In `packages/agents/src/instructions.js`, replace media guidance with:

- use `fal_run` for Fal image/video tasks
- use relevant skill when one matches

### 5) Guardrails

`fal_run` should enforce:

- endpoint allowlist pattern (start with `fal-ai/` in v1)
- max upload file count and size
- max downloaded output count and byte budget
- clear error mapping for Fal validation errors and download failures

## Rollout Plan

1. Add `fal_run` tool and tests.
2. Refactor `generate_image` and `generate_video` to wrappers over `fal_run`.
3. Add initial Fal workflow skills and docs in land templates.
4. Update instructions to prefer skills + `fal_run`.
5. After adoption, remove old wrappers or keep as aliases based on usage.

## Test Plan

- unit tests for endpoint/input validation
- unit tests for upload injection and output URL extraction
- unit tests for download path resolution and file writing
- regression tests proving wrapper parity for current image/video flows
- instruction tests to confirm `fal_run` guidance is present

## Risks And Open Questions

- A generic tool can increase invalid endpoint/input attempts.
  - Mitigation: skill recipes and strict validation errors.
- Different Fal endpoints return different output shapes.
  - Mitigation: allow explicit `output_paths` with auto-detect fallback.
- Decision: should Fal workflow docs live in repo docs, land docs, or both?
- Decision: when to fully remove `generate_image` and `generate_video` names.
