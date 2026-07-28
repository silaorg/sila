# Tools

Tools are executable actions for [agents](agents.md), such as calling an API, querying a system, or generating a file.

Use a tool when the agent needs a capability that normal files, commands, and [skills](skills.md) do not provide. Keep tools few, focused, and explicit so the agent can choose reliably.

Workspace tools are small JavaScript packages under `tools/<tool-name>/`. See [how to create tools](../packages/heswe/builtin-skills/how-to-create-tools/SKILL.md) for the package contract.
