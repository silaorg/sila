# Workspace sandboxing and storage

Status: partly implemented. The current hosted app uses Docker with gVisor.
VM launchers, scoped S3 Files mounts, and durable checkpoints remain proposed.

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

Use [S3 Files](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files.html)
for shared user files in the AWS deployment. It provides a shared NFS filesystem
with managed synchronization to S3. The
[hosted infrastructure proposal](hosted-infrastructure.md) chooses this storage
path; it is not implemented by the current launcher.

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

Enforce grants with access-point roots, enforced POSIX identities, mount
permissions, and network controls. Mount on the trusted host and bind only the
granted directories into the sandbox. Read-only grants require both read-only
storage authorization and a read-only bind mount.

Access points alone do not restrict who can mount them. Use scoped mounting
credentials and explicit policy denies for unapproved access points and direct
root mounts by workload sessions. Keep a separate operator recovery identity.
Terraform owns the shared policy baseline; the launcher creates grant access
points, records their IDs, and issues constrained mounting sessions.
Keep per-grant restrictions in those sessions; the launcher must not rewrite
the Terraform-managed filesystem policy when users or workspaces change.
See [AWS access-point isolation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-access-point-policy-examples.html).

Keep mounting and infrastructure credentials on the trusted host. Agents must
not reach NFS endpoints directly or receive bucket-wide credentials. Host-side
mounting is separate from the sandbox's blocked private-network egress.
Refresh grants only while the computer's assignment remains valid.
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

Keep `/workspace` on a persistent Linux filesystem with one active writer and
restore it from a complete checkpoint after recovery. Mount granted S3 Files
directories under `/files`; shared computers must use the same filesystem.
Keep builds, dependency caches, and disposable checkouts on local scratch.
S3 Files has no hard-link support, so verify tools against its
[filesystem limits](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-quotas.html).

Route browser uploads, downloads, edits, and deletes through the same mounted
filesystem and grant checks. Import external objects into a separate staging
prefix before publishing through the filesystem. Do not run an independent
two-way sync client or write directly to active objects through the S3 API.

S3 Files requires bucket versioning and starts exporting after 60 seconds of
write inactivity; export completion is asynchronous. Writes committed to the
filesystem can be durable before their S3 object version appears. The bucket
is not a synchronous checkpoint of the filesystem.
On conflicting direct S3 writes, the bucket version wins and the filesystem
copy goes to a lost-and-found directory. Monitor sync errors and conflicts;
recovery must include that directory, which scoped mounts may not expose.
See [synchronization behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-synchronization.html).

## Persistence and concurrent writes

A persistent disk can survive stopping a VM, depending on the provider.
A VM memory snapshot is separate from a durable file checkpoint.
Saved user data must survive removing the compute that produced it.

For `/workspace` and other local durable state:

1. Stop new writes and finish or cancel active work, including child processes.
2. Save a consistent workspace checkpoint under a new generation.
3. Verify the uploaded files, then publish that generation as complete.
4. Retain the previous complete checkpoint for recovery.
5. Remove the writable disk only after the new checkpoint is confirmed.

The API database stays outside workspace mounts. It uses Litestream replication
to private S3 storage and SQLite-native snapshots paired with these checkpoints.
Independent database and workspace uploads are not a complete platform recovery
set. The [hosted infrastructure proposal](hosted-infrastructure.md) defines the
storage inventory and matching recovery generations. Do not back up SQLite by
copying only its live database file while WAL writes continue.

Use periodic checkpoints as well as checkpoints on orderly stop.
State the recovery point: a machine failure can lose work since the last one.
Do not promise per-write S3 durability for a local working copy.
If file uploads or checkpoint publication fail, report unsaved work and retain
the disk. A forced removal must be a separate, explicit data-loss operation.

Removing a workspace computer must leave the shared S3 Files filesystem intact.
Flush and confirm filesystem writes before stopping. Do not delete shared
storage as part of compute cleanup or treat delayed object export as data loss.
Destruction or migration of the filesystem itself needs verified synchronization
and a tested recovery path for pending changes and POSIX metadata.

Keep one active writer for each `/workspace`. Several computers can read the
same `/files` project and write disjoint run-output directories. Start with
read-only shared inputs and one publisher for shared project mutations,
including browser edits. Whole-user writable grants overlap narrower project
grants and must follow the same coordination rule.

NFS locks are advisory and do not merge changes or serialize an entire Git
operation. Publishing and replacement writers need externally enforced fencing
when several launchers exist. Confirm termination and unmounting, or isolate
the old host's network access before replacement. A missed heartbeat or an IAM
policy change alone does not prove an existing mount has stopped writing.
Surface stale publication conflicts instead of overwriting a changed file.
Use versioning and retention for recovery.

## First checks

Before hosting user agents, verify that:

- Two users cannot read or write each other's markers through shell or SDK calls.
- A partial grant cannot list sibling prefixes, mount another access point, or
  bypass its root through shell or SDK calls.
- Read-only grants reject writes and deletes through every available path.
- Computers on different hosts share reads and disjoint output writes through
  the same filesystem; conflicting publications are rejected or serialized.
- Restart restores files, history, and tools from a complete checkpoint.
- Failed uploads, process crashes, and duplicate launches preserve one writer.
- Reduced grants cannot resume an older, wider snapshot.
- NFS interruption, delayed exports, and sync conflicts preserve recoverable
  data and become visible to operators.
- Stop and removal terminate the actual computer and its child processes.
- Disk, process, network, and output limits work under load.

Build one launcher and one storage path first. Keep existing workspace file
formats until these checks pass. See
[agent computers](agent-computer-runtime.md) for lifecycle and
[platforms and instances](platforms-and-workspace-instances.md) for deployment.
