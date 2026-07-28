# How workspaces works in Heswe

Workspaces as stored in directories with a stucture similar to this:
```text
workspace/
  config.json
  .env
  agents/
    default/
      instructions/
        01-base.md
        02-channel.md
  assets/
  channels/
    telegram/
      config.json
      123/
        messages.jsonl
        files/
    slack/
      config.json
      C123456/
        messages.jsonl
```

At a minimum a workspace should have its root config.json that contains a name and a version of the workspace.

For a workspace to work, it needs AI provider keys in `.env` (for example `OPENAI_API_KEY` and `EXA_API_KEY`) and a channel to communicate between a user and an agent.

To add custom agent instructions, place text files under `agents/default/instructions/` in the workspace. Each file is injected as `<instruction src="...">...</instruction>`.
When custom files exist, they replace the default base assistant text (`defaultInstructions`), while managed channel formatting and environment blocks are still appended automatically.

Channel instructions also include a managed `<environment_runtime_paths>` block with absolute paths for:

- workspace root
- current thread root
- source repo root (from `SOURCE_PATH`/`REPO_ROOT` env, otherwise auto-detected via `.git` up from workspace)

Those values are also exported to process env as `WORKSPACE_PATH`, `THREAD_PATH`, and `SOURCE_PATH` during instruction load.
`THREAD_PATH` is set when instructions are refreshed for a specific thread message.
