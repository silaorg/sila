# Heswe agents

This package owns the process boundary between the Heswe API and agent
execution.

`ProcessAgentRuntime` starts the agent worker with Node, sends thread messages
over standard input, and receives progress events and results over standard
output. The worker loads the selected model, instructions, workspace tools, and
shell runtime.

Development uses a normal child process and is not sandboxed. A production
sandbox driver launches the same worker inside one Docker container per
workspace with the gVisor `runsc` runtime. The container receives one writable
workspace mount, a read-only root filesystem, a private temporary filesystem,
no Linux capabilities, and CPU, memory, and process limits.

Production checks that Docker has `runsc` and the configured runtime image
before serving requests. It never falls back to the local process driver.
Provider keys must be configured in the workspace; server secrets and global
provider keys are not copied into the sandbox.
