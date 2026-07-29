# Tools

Tools let [agents](agents.md) take actions beyond normal chat, files, and
commands. A tool can call an API, query a system, update a ticket, search a
private source, or generate a file.

Use a tool when the agent needs a capability that normal files, commands, and
[skills](skills.md) do not provide. Keep tools few, focused, and explicit so
the agent can choose reliably.

Tools belong to a workspace, so teams can give their agents only the actions
needed for that work. Workspace tools are small JavaScript packages under
`tools/<tool-name>/`. See [how to create tools](../packages/heswe/builtin-skills/how-to-create-tools/SKILL.md)
for the package contract.
