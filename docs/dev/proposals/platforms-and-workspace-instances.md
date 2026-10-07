# Platforms and workspace instances

Status: proposal. The current app has one API server and local workers.

## Direction

Keep local development simple. Use small VMs for hosted agents when practical.
Choose one launcher first. Keep provider details out of the agent runtime.

A platform is one Heswe installation with its own accounts and API.
An instance is a trusted host or service that launches workspace computers.
A workspace computer runs the agent and its tools.

```text
browser, Slack, or Telegram
  -> Heswe API
    -> workspace launcher
      -> workspace computer
        -> agent, CLI tools, and granted files
```

The launcher can live in the API process until deployment requires separation.
A remote instance receives an authenticated request for one assigned workspace.
The browser never supplies a host address, image, command, or storage path.

## Local development

`npm run dev` already starts the app and launches agents locally:

```text
developer's machine
  -> SvelteKit API
    -> Node worker for each active workspace
  -> .data/workspaces
  -> SQLite accounts and workspace registry
```

These are separate processes on the same system. No VM is required.
Local workers have the developer's filesystem permissions.
Linux developers can select the existing `runsc` driver to test isolation.

Keep the local worker and remote worker on the same request/event contract.
Do not require cloud credentials or a local cluster for normal development.

## Hosting choices

| Option | What it needs | Place in the plan |
| --- | --- | --- |
| Docker with gVisor | Linux host, Docker, configured network | Current production launcher |
| Small VM or managed sandbox | Launch API, image, disk, authenticated worker connection | Preferred next direction |
| Self-hosted Firecracker | KVM hosts, guest image, networking, disk and snapshot management | Evaluate if running the hosts ourselves is worthwhile |
| Kubernetes | Cluster, sandbox runtime, storage and lifecycle controller | Use if operating a cluster is already justified |

Compare E2B or another managed sandbox with a small self-hosted VM runner.
Measure startup, CLI support, file persistence, pause/resume, and operating cost.
No provider is selected by this proposal.

[EBS is block storage for EC2](https://docs.aws.amazon.com/ebs/latest/userguide/what-is-ebs.html).
It can hold a VM's working filesystem; it does not launch or pause agents.

Kubernetes schedules pods. Choose a sandboxed
[RuntimeClass](https://kubernetes.io/docs/concepts/containers/runtime-class/)
when using it for agent code. A pod alone is not the VM boundary described here.

Use [Terraform](https://developer.hashicorp.com/terraform/intro) for the shared
infrastructure: networks, hosts or clusters, buckets, and service permissions.
Heswe's launcher uses the provider API for each computer's lifecycle.
Do not run Terraform for every chat message or idle timeout.

## Placement

Keep a registry entry with the workspace ID, access policy, storage location,
assigned computer, and current state. The provider's computer ID belongs here.
The current ownership check can remain until shared workspaces are implemented.

For a message, the API:

1. Checks the user's access to the workspace.
2. Ensures its assigned computer is running.
3. Delivers the message and relays events.

On restart, inspect the assigned computer before creating another one.
A failed health check must not start a second writer against the same files.
Manual recovery is enough for the first deployment.

With several launchers, use an externally enforced lease for each writable
workspace. The old writer must lose access before a replacement starts.
Route every workspace request through its assignment, including file access.
The API currently reads local files; remote computers need a scoped file API
or a deliberately shared filesystem.

Keep one SQLite-backed API initially. Multiple API writers need a shared
database and event delivery. Add those when scaling requires them.

## Independent platforms

A future desktop client can store several platform connections.
Each has its own origin, platform ID, and sign-in session.
Workspace identity becomes `(platform_id, workspace_id)`.
Accounts and files are not automatically shared across platforms.

This does not need to be implemented before remote agent computers.
Neither do workspace roles, automatic migration, or multi-region failover.

## Next step

Prototype one remote computer with the existing worker and ordinary CLI tools.
Prove message delivery, cancellation, file recovery, and complete removal.
Then add the idle and pause behavior in
[agent computers](agent-computer-runtime.md).

[Workspace sandboxing](workspace-agent-sandboxing.md) defines storage grants
and the isolation checks every launcher must pass.
