# Tools

Tools are direct executable actions for [agents](agents.md).

A tool gives an agent a straightforward thing it can run, such as calling an API, querying a system, generating a file in a standard format, or doing a land-specific action.

Tools are useful when the agent needs a direct capability that should be easy and reliable to call again.

[Agents](agents.md) use tools like this:

- they see that a tool is available
- they decide that the tool is the right next action
- they call the tool with the needed input
- they continue the task using the tool result

Tools should stay focused. Too many tools can overwhelm an agent, so it is usually better to keep the tool set small and use [skills](skills.md) for broader guidance.

As a simple rule, use a tool when the agent needs a new direct action, not just better instructions.
