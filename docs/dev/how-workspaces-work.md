# How workspaces work

A workspace is a directory with this general shape:

```text
workspace/
  config.json
  .env
  agents/
    default/
      config.json
      instructions/
        01-base.md
  assets/
  providers/
    openai/
      config.json
  skills/
  tools/
  channels/
    telegram/
      config.json
      123/
        state.json
        messages.jsonl
        files/
    slack/
      config.json
      C123456/
        state.json
        messages.jsonl
        files/
  users/
    <hashed-user-id>/
      channels/
        app/
          <thread-id>/
            state.json
            messages.jsonl
```

`config.json` contains the workspace name and format version. `.env` contains
provider and integration secrets. `agents/default/config.json` selects a
language provider and model; `auto` chooses the first configured provider with
an available key.

`heswe create <path>` scaffolds the root config, provider config, `.env`, and
one Slack or Telegram channel. `heswe run <path>` starts every recognized
channel under `channels/`.

## Threads and persistence

Slack and Telegram threads live below their channel directory. Hosted app
threads live below a hashed user ID so one user cannot access another user's
threads.

`messages.jsonl` is an append-only event log. Heswe never rewrites existing log
bytes. Old `messages.json` arrays are migrated when first read. `state.json`
contains mutable metadata and is replaced atomically.

## Agent extensions

Files under `agents/default/instructions/` replace the built-in base
instructions. Managed channel and runtime information is still appended.

Workspace [skills](../skills.md) live under `skills/`. Workspace
[tools](../tools.md) live under `tools/`. Shared artifacts belong under
`assets/`; files specific to a conversation belong in that thread's `files/`
directory.

Agent subprocesses receive these environment paths:

- `WORKSPACE_PATH`: the workspace root.
- `THREAD_PATH`: the current thread directory.
- `SOURCE_PATH`: `SOURCE_PATH` or `REPO_ROOT` from the environment, otherwise
  the nearest Git root above the workspace.

Heswe builds this environment per thread. It does not write runtime paths or
workspace `.env` values into the server's global process environment, so
concurrent workspaces cannot overwrite each other's command context.

## Runtime lifecycle

`Workspace.run()` loads configuration and starts channel runtimes.
`Workspace.stop()` stops accepting provider events, waits for current thread
work to finish, closes agent sessions, and stops provider clients.
