# How lands works in Sila

Lands as stored in directories with a stucture similar to this:
```text
land/
  config.json
  .env
  agents/
    default/
      instructions.md
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

At a minimum a land should have its root config.json that contains a name and a version of the land.

For a land to work, it needs AI provider keys in `.env` (for example `OPENAI_API_KEY` and `EXA_API_KEY`) and a channel to communicate between a user and an agent.

To override default agent instructions, place `agents/default/instructions.md` in the land. Formatting and environment instruction blocks are still injected automatically.
