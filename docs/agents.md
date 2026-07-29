# Agents

An agent is a configurable AI helper that can take action inside a
[workspace](workspace.md). It follows instructions, uses conversation history,
works with files, runs commands, and calls tools to complete a task.

Unlike a chat assistant that only replies with text, a Heswe agent can inspect
the workspace, create artifacts, and report progress while it works. Typical
uses include research, data analysis, document creation, code review, support
work, and checking systems.

Agents can be extended in two ways:

- [Skills](skills.md) teach a workflow or subject.
- [Tools](tools.md) add an executable action.

Skills and tools can work together. For example, a skill can teach an agent
how to review a support queue while a tool connects it to the ticket system.
Both can be built into Heswe or added to one workspace.
