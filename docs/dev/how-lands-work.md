# How lands works in Sila

Lands as stored in a directory with a stucture similar to this:
```text
land/
  config.json
  providers/
    openai.json
  agents/
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

For a land to work, it needs to have at least one AI provider configured under `providers` and a channel to communicate between a user and an agent.