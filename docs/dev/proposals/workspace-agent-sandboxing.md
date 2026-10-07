# Workspace sandboxing and storage

Status: partly implemented. The current hosted app uses Docker with gVisor.
VM launchers, scoped S3 access, and durable checkpoints remain proposed.

## Current code

Development launches a Node child process with normal host permissions.
Production launches the complete worker in a `runsc` container.
It receives one writable workspace directory at `/workspace`, a read-only
root, temporary storage, and CPU, memory, and process limits.

Production startup checks Docker, `runsc`, the image, and the network.
It rejects the local process driver. The deployment must supply network rules.
Provider keys live in workspace settings; API secrets stay outside the worker.

This is a working launch path, not a complete compute manager.
It has no idle sleep, remote placement, or persistent VM lifecycle.
Killing the Docker client is also not a reliable container-removal operation.
The launcher needs explicit container cleanup before claiming that guarantee.
See [current deployment instructions](../how-the-hosted-app-works.md).

## Proposed boundary

Use an isolated computer for each active workspace.
Prefer a VM or microVM for the next hosted launcher.
Keep the complete agent runtime and its CLI tools inside it.
The API chooses its image, resources, network access, and file grants.

All processes inside a computer can use the same grants.
Agents with different access need separate computers.
Path checks and a shell's working directory cannot enforce that separation.

The computer must not receive another user's files, the host filesystem,
container sockets, cloud provisioning keys, or the API database.
Enforce resource limits and block access to host management, private services,
and cloud metadata. Allow the public network access needed for tools.

## User files in S3

Give each user a file prefix, using an opaque ID from the API registry:

```text
users/<user-id>/files/
  projects/project-a/
  projects/project-b/
  shared/
```

S3 prefixes look like directories but are object-key prefixes.
The API may grant all of `users/<user-id>/files/` or selected subdirectories.
Default to the directories needed for the selected workspace.
Whole-user access is an explicit wider grant.

Keep platform credentials and compute checkpoints outside that file prefix.
A future shared workspace gets its own storage prefix and membership policy.
It does not inherit access to a member's personal files.

The trusted launcher receives a small mount list:

| S3 prefix | Path in the computer | Access |
| --- | --- | --- |
| `users/u1/files/projects/project-a/` | `/files/project` | Read/write |
| `users/u1/files/shared/` | `/files/shared` | Read-only |

`/workspace` holds the runtime's writable history and configuration.
`/files` exposes the chosen user files. `/tmp` holds disposable work.
These paths and the prefix layout are proposed, not current configuration.

Validate grants against the authenticated user and registry before launch.
Use canonical prefix boundaries, including the trailing slash.
Reject overlapping destinations and paths that escape the approved roots.
Only the launcher changes the mount list.

Enforce the same scope in storage permissions. A mount flag alone is not enough.
For direct S3 access, scope object actions to the exact prefix and limit
`ListBucket` with `s3:prefix`. Use read-only or read/write actions as granted.
[AWS documents prefix-based permissions](https://aws.amazon.com/blogs/security/writing-iam-policies-grant-access-to-user-specific-folders-in-an-amazon-s3-bucket/).

Use short-lived credentials or a trusted file service with the same scope.
Never give a computer bucket-wide credentials and rely on its code to behave.
Refresh credentials only while its assignment and grants remain valid.
When reducing access, discard old memory, disks, and snapshots before restarting.
Revocation cannot erase files an agent has already read or copied elsewhere.

## Working filesystem

An agent needs ordinary file operations for Git, package managers, and tools.
Heswe also appends `messages.jsonl` and replaces JSON files with atomic rename.
Keep those on a filesystem that supports these operations.

[Mountpoint for S3](https://github.com/awslabs/mountpoint-s3/blob/main/doc/SEMANTICS.md)
does not provide full filesystem behavior. General-purpose buckets lack its
append and rename support; symbolic links and file locking are unsupported.
Mountpoint can expose selected inputs, but it is not a drop-in workspace disk.

Start with a Linux filesystem on the computer's disk or persistent volume.
Restore the workspace from its last checkpoint and fetch the granted files.
Save approved output changes back to their S3 prefixes.
Keep downloads, exports, and deletes within the same grant.
A failed upload must leave the local copy available for retry.

For AWS hosting, also evaluate
[S3 Files](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files.html).
It offers an NFS filesystem backed by S3 with managed synchronization.
This is a separate option from Mountpoint. Check its access controls,
synchronization behavior, failure recovery, and cost with our workload before
choosing it. Keep these provider details in the storage implementation.

## Persistence and concurrent writes

A persistent disk can survive stopping a VM, depending on the provider.
A VM memory snapshot is separate from a durable file checkpoint.
Saved user data must survive removing the compute that produced it.

For the initial disk-and-checkpoint implementation:

1. Stop new writes and finish or cancel active work, including child processes.
2. Save a consistent workspace checkpoint under a new generation.
3. Verify the uploaded files, then publish that generation as complete.
4. Retain the previous complete checkpoint for recovery.
5. Remove the writable disk only after the new checkpoint is confirmed.

Use periodic checkpoints as well as checkpoints on orderly stop.
State the recovery point: a machine failure can lose work since the last one.
Do not promise per-write S3 durability for a local working copy.
If file uploads or checkpoint publication fail, report unsaved work and retain
the disk. A forced removal must be a separate, explicit data-loss operation.

Initially, allow only one writer per workspace and writable file prefix.
Whole-user writable grants overlap project grants and must follow that rule.
Other computers can receive read-only inputs or separate output directories.
Browser edits and uploads also go through the active writer.
Do not run independent two-way sync clients against the same files.

For imported files, record object versions and refuse to overwrite a version
changed elsewhere. Surface a conflict instead of silently picking a winner.
Use versioning and retention for recovery from overwrites and deletes.
Never treat a missing local file as permission to delete an unmounted S3 object.

## First checks

Before hosting user agents, verify that:

- Two users cannot read or write each other's markers through shell or SDK calls.
- A partial grant cannot list sibling prefixes, even with the mount bypassed.
- Read-only grants reject writes, deletes, and write-back from local caches.
- Restart restores files, history, and tools from a complete checkpoint.
- Failed uploads, process crashes, and duplicate launches preserve one writer.
- Reduced grants cannot resume an older, wider snapshot.
- Stop and removal terminate the actual computer and its child processes.
- Disk, process, network, and output limits work under load.

Build one launcher and one storage path first. Keep existing workspace file
formats until these checks pass. See
[agent computers](agent-computer-runtime.md) for lifecycle and
[platforms and instances](platforms-and-workspace-instances.md) for deployment.
