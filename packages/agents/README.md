# Heswe agents

This package owns the process boundary between the Heswe API and agent
execution.

`ProcessAgentRuntime` starts the agent worker with Node, sends thread messages
over standard input, and receives progress events and results over standard
output. The worker loads the selected model, instructions, workspace tools, and
shell runtime.

Development uses a normal child process and is not sandboxed. A production
sandbox driver can launch the same worker entry point inside gVisor without
changing the process protocol or `AppWorkspaceService`.
