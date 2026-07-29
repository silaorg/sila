# Workspace agent sandboxing

Status: proposal.

## Decision

Run every active workspace in its own gVisor sandbox on Linux. Package the
workspace runtime as an OCI container and run it with gVisor's `runsc` runtime.

The first production deployment is one ordinary Linux server with Docker and
gVisor. AWS Fargate, another cloud, or a multi-server scheduler can be added
later without changing the workspace runtime or security contract.

The invariant is:

```text
one workspace
  -> one gVisor sandbox
  -> one mounted workspace directory
  -> separate processes for active agents
```

The sandbox can see its container image, disposable temporary storage, and its
own workspace mounted at `/workspace`. It cannot see the host filesystem,
another workspace, the container engine, or Heswe control-plane credentials.

Do not silently fall back to the normal `runc` runtime. If gVisor is unavailable
or fails its startup checks, production agent execution must fail closed.

## Why

The current runtime uses a working directory as its main boundary.
`execute_command` starts a normal host shell, and workspace tool packages are
imported into the server process. An absolute path, parent traversal,
subprocess, or workspace tool can reach anything available to the server user.
Path validation in individual tools cannot secure arbitrary shell and
JavaScript execution.

A normal Docker container limits filesystem visibility, but its programs still
use the host Linux kernel directly. gVisor adds a per-sandbox application kernel
which intercepts the workload's system calls. This substantially reduces the
host kernel surface exposed to untrusted agent code while retaining standard
container images and Docker-compatible operations.

gVisor's default `systrap` platform does not require hardware virtualization.
It can therefore run inside a typical rented Linux virtual server. Its KVM
platform is an optional deployment choice for suitable bare-metal servers.

gVisor is not perfect isolation and does not protect against every hardware
side channel or a compromised container launcher. It is the best first balance
of portability, isolation, operational simplicity, and density. A lightweight
VM runtime such as Kata Containers remains a future stronger option when the
host supports nested virtualization.

## Architecture

Keep two components:

- The Heswe API is the trusted control plane. It authenticates users, records
  workspace membership, manages sandbox lifecycle, routes requests, and
  publishes events. It can perform administrative operations but does not run
  agent or workspace code.
- A workspace sandbox runs a small supervisor for one fixed workspace ID. It
  owns that workspace's files, threads, tools, shells, and agent processes.

The API derives a sandbox specification from a trusted workspace registry.
Clients cannot supply an image, runtime, host path, command, network, or
credential to the sandbox launcher.

The API forwards workspace operations to the correct private supervisor. Each
request carries a short-lived credential limited to that workspace. The
supervisor has its workspace ID fixed at launch and rejects a credential or
request for any other ID.

The sandbox has no Docker or containerd socket. Agent processes receive no
Heswe database, signing, provisioning, or cross-workspace credentials.

Workspace placement and routing are defined in
[the platforms and workspace instances proposal](platforms-and-workspace-instances.md).
The same sandbox contract applies whether the instance is embedded in a local
development platform or runs on a separate server.

## Sandbox manager

Add one small internal interface owned by the Heswe API:

```text
SandboxManager
  create(workspace)
  start(workspace)
  stop(workspace)
  status(workspace)
  delete(workspace)
```

The first implementation uses Docker with `runsc`. Keep OCI image construction
and the `/workspace` mount contract independent of Docker-specific APIs so a
containerd or managed-cloud implementation can replace it later.

Every sandbox is created from a fixed template:

- reviewed Heswe workspace-runtime image
- `runsc` OCI runtime
- read-only container root filesystem
- non-root workload user
- all Linux capabilities dropped
- `no-new-privileges`
- no privileged mode, host namespaces, devices, or runtime socket
- one workspace bind mount at `/workspace`
- separate temporary filesystem at `/tmp`
- CPU, memory, process, file-size, and open-file limits
- private network namespace
- restart and health-check policy

The launcher accepts a workspace ID, not a host path. It constructs the path
from a strict opaque ID, resolves it canonically, and verifies that it is the
expected direct child of the configured workspace root. Workspace roots cannot
be symlinks. The sandbox fails startup unless its fixed ID agrees with
`/workspace/config.json`.

The production host should run only the Heswe services and sandbox runtime.
Keep the host kernel and gVisor updated. Do not place unrelated customer
services on the same server.

## Agent processes

The workspace supervisor launches one non-root process for each active agent
session. The process starts with:

- its thread directory as the working directory
- workspace-scoped environment values
- no control-plane credentials
- a bounded process group that the supervisor can terminate completely

The agent process loads instructions and workspace tools itself. Arbitrary
workspace JavaScript must never be imported by the supervisor or Heswe API.
Shell and PTY tools launch descendants in the agent's process group.

Use a small framed protocol over standard input and output between the
supervisor and agent. Messages start work, report progress, return results, and
request cancellation. Do not expose a general supervisor RPC socket to agent
processes.

Separate processes provide cancellation, crash containment, and less state
leakage between agents. They are not separate security boundaries. The gVisor
sandbox is the workspace boundary. Agents in one workspace intentionally share
that workspace.

If agents in the same workspace must become mutually hostile in the future,
give each agent its own sandbox and mount the same workspace directory. That is
not required for the first version.

## Network boundary

Filesystem isolation alone is insufficient because an agent could attack host
services over the network.

The sandbox network must:

- reject connections to the container engine and host management interfaces
- reject cloud instance metadata addresses and private infrastructure networks
- accept inbound requests only through the workspace supervisor channel
- send public internet traffic through a controlled egress path
- apply workspace-specific integration credentials only inside the sandbox

The first version may allow general public HTTPS because agents need model,
search, and integration APIs. This does not imply access to Heswe's private API
or deployment network. Later, workspaces can have explicit network policies
without changing their filesystem sandbox.

## Storage

Treat workspace storage as a host directory contract:

```text
<workspace-storage-root>/<workspace-id>/
```

The sandbox manager mounts only that directory at `/workspace`. The runtime
does not know whether the host path is backed by:

- local ext4, XFS, ZFS, or Btrfs storage
- a mounted NFS service
- Amazon EFS
- another provider's managed network filesystem

This keeps storage choice out of the agent and workspace code.

For the simplest single-server installation, use local storage with automated,
off-host backups. ZFS or Btrfs snapshots can improve operational recovery but
are not part of the sandbox boundary.

For elastic capacity, mount EFS or another managed NFS filesystem as the
workspace storage root. The trusted host can see the storage root, while gVisor
exposes only the selected workspace directory to each sandbox. When using EFS,
use encryption, AWS Backup, and access points where practical as additional
defense. EFS is an optional storage adapter, not a runtime dependency.

Network filesystems add latency to every filesystem operation. Keep the
container image, caches, temporary files, and disposable build output outside
durable workspace storage where possible. Measure Git, dependency installation,
search, and repositories with many small files before selecting EFS for all
workspace data.

## Workspace membership

The first version has membership, not roles:

```text
workspace_members(workspace_id, user_id)
```

The creator becomes the first member but is not a special owner. Every member
passes the same authorization policy and can use the workspace, its files, and
its agents. Membership and destructive workspace operations use the same
policy, although destructive actions can still require explicit confirmation.
Prevent removal of the final member so a workspace cannot become unreachable.

The Heswe API's infrastructure permissions are trusted service permissions, not
a workspace role. They are never exposed to a member or agent.

Future roles can add a policy to the membership relation. Do not add dormant
owner, administrator, or role branches in the first version.

## Lifecycle

Workspace creation is one idempotent operation:

1. Create the workspace directory with its fixed opaque ID.
2. Write and verify the initial workspace configuration.
3. Create the sandbox from the fixed template.
4. Start it and wait for sandbox and workspace identity checks.
5. Add the creator as the first member.

Stop a sandbox only after it stops accepting messages, drains current work,
terminates agent process groups, and closes PTY sessions. The mounted directory
retains the workspace after the sandbox stops.

Initially, keep workspaces with active Slack or Telegram integrations running.
Add scale-to-zero only after message wake-up and queueing exist.

Workspace deletion first stops and removes the sandbox. Data deletion is a
separate recoverable operation governed by the backup retention policy.

## Migration

Move the execution boundary before changing the workspace file format:

1. Replace the ownership registry with membership and migrate every current
   owner into the membership relation.
2. Add an agent-worker process entry point around the existing agent runtime.
3. Add the workspace supervisor and its worker process protocol.
4. Add the sandbox manager with a Docker and `runsc` implementation.
5. Route filesystem, thread, and message operations through the supervisor.
6. Ensure workspace tools load only inside agent worker processes.
7. Run the two-workspace escape test suite.
8. Remove direct workspace mounts and in-process agent execution from the API.

An explicitly named insecure development mode may run without gVisor for local
debugging. It must never be the production default, and production startup must
reject it.

## Verification

Create two workspaces with unique marker files. From each workspace, verify that
an agent cannot discover or modify the other marker through:

- absolute paths and `..`
- symlinks, hard links, renamed directories, and mount paths
- `/proc`, `/sys`, devices, process inspection, and inherited descriptors
- stateless shells and PTY shells
- workspace JavaScript tools, native programs, and subprocesses
- the Docker or containerd API
- Heswe API credentials, database access, and provisioning operations
- host and private-network services
- crashes, restarts, concurrent threads, and sandbox replacement

Also test resource exhaustion, fork bombs, output floods, disk filling, and
network connection floods.

Continuously check that every production workspace uses `runsc`, has exactly one
workspace mount, has no host namespaces or runtime socket, and has the expected
resource and network policy. Run the escape suite on every runtime image,
gVisor, kernel, and sandbox-template change.

## Rejected approaches

### Application path checks

Path checks remain useful for API correctness, but they cannot constrain a
shell, native program, or arbitrary workspace tool. A missed call site becomes
a sandbox escape.

### Linux user per workspace

Linux users and filesystem permissions are useful defense in depth. Alone,
they leave untrusted agents directly exposed to the shared host kernel and make
every privileged daemon and permission part of the boundary.

### Normal Docker containers

One container per workspace gives the desired mount shape but leaves agent
system calls handled directly by the shared host kernel. Use gVisor rather than
plain `runc` for production agent code.

### One container containing all workspaces

This isolates Heswe from the host, not workspaces from each other. All
workspace paths remain available inside one container.

### Kata Containers or custom microVMs

Kata provides lightweight virtual machines and a stronger hardware boundary,
but it requires bare metal or nested virtualization and adds guest kernels and
hypervisor operations. Keep the OCI contract compatible so Kata can become a
deployment option if the threat model or customer requirements justify it.

### AWS Fargate as the required runtime

Fargate provides a strong managed task boundary and remains a valid hosting
adapter. Requiring it would prevent a simple installation on an ordinary rented
Linux server and tie the core architecture to AWS.

### EBS volume per workspace

EBS provides a storage attachment boundary but brings capacity planning,
resizing, attachment lifecycle, and availability-zone placement. It is not a
portable workspace storage contract.

## References

- [Introduction to gVisor security](https://gvisor.dev/docs/architecture_guide/intro/)
- [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/)
- [Running gVisor with Docker](https://gvisor.dev/docs/user_guide/quick_start/docker/)
- [Installing gVisor](https://gvisor.dev/docs/user_guide/install/)
- [gVisor platforms](https://gvisor.dev/docs/architecture_guide/platforms/)
- [Kata Containers architecture and requirements](https://katacontainers.io/software/)
- [EFS Access Points](https://docs.aws.amazon.com/efs/latest/ug/efs-access-points.html)
- [Backing up EFS with AWS Backup](https://docs.aws.amazon.com/efs/latest/ug/awsbackup.html)
- [EFS performance tips](https://docs.aws.amazon.com/efs/latest/ug/performance-tips.html)
