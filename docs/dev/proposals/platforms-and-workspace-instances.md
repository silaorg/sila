# Platforms and workspace instances

Status: proposal.

## Decision

A Heswe platform is an independent service that owns:

- its public API origin
- its user accounts and sessions
- its workspace membership and placement registry
- one or more instances that host workspace sandboxes

A desktop app can connect to multiple platforms. Users sign in to each platform
separately and switch between their workspaces from all connected platforms.

An instance is a machine or service process registered with one platform. Each
workspace is assigned to exactly one instance. The public API authenticates and
authorizes every request, looks up the assigned instance, and routes the
workspace operation there.

Workspace sandboxes follow
[the workspace sandboxing proposal](workspace-agent-sandboxing.md).

## Terms

- **Platform**: one identity and administration domain exposed at a public API
  origin
- **API node**: a process serving the platform's public API
- **Instance**: a trusted process capable of creating and running workspace
  sandboxes
- **Workspace sandbox**: the isolated runtime for one workspace

One process can act as both an API node and an instance. This is the default for
development and a single-server installation. The distinction becomes a
network boundary only when the platform expands to several machines.

## Desktop connections

The desktop app stores a list of platform connections. Each connection has:

- a stable platform ID returned by the server
- a user-facing name
- an API origin
- a separate authenticated session

Expose a small unauthenticated discovery endpoint such as:

```text
GET /.well-known/heswe-platform
```

It returns the stable platform ID, name, API version, and supported
capabilities. The desktop verifies this response before starting sign-in.

Workspace identities are always qualified by their platform:

```text
(platform_id, workspace_id)
```

The desktop must not assume that accounts or workspace IDs are shared between
platforms. The same email address on two platforms represents two independent
accounts.

The desktop talks only to public platform APIs. It never learns an instance
address or connects directly to a workspace host.

## Platform registry

The platform database is the source of truth for users, membership, and
placement. Its relevant relations are:

```text
instances(
  id,
  internal_url,
  state,
  last_seen_at
)

workspaces(
  id,
  name,
  instance_id,
  storage_key,
  state,
  created_at
)

workspace_members(
  workspace_id,
  user_id
)
```

`storage_key` is an opaque relative identifier, normally the workspace ID. Do
not store a client-provided absolute path.

The first version continues to use membership without roles. Every member
passes the same workspace authorization policy.

## Instance registration

An instance starts with:

- a stable instance ID
- its private URL
- a platform bootstrap credential
- its workspace storage root
- its sandbox driver and capacity limits

It registers with the platform and sends a small heartbeat. Only trusted
deployment credentials may register or change instances. The public workspace
API cannot supply or modify an instance URL.

The platform marks instances as available, draining, or offline. Draining
instances keep serving assigned workspaces but receive no new ones.

Do not put user authentication data on instances. They trust only
short-lived, platform-signed internal requests naming an exact workspace,
request, and user.

## Workspace placement

Workspace placement is stable:

```text
workspace_id -> instance_id
```

When creating a workspace, the platform:

1. authenticates the user
2. selects one available instance
3. records the workspace in `provisioning` state
4. asks that instance to create the workspace idempotently
5. adds the creator as the first member
6. marks the workspace `ready`

With one instance, selection is automatic. With several instances, choose the
healthy instance with the lowest configured load. Keep placement policy small;
do not add general scheduling rules in the first version.

An instance only starts sandboxes assigned to its own ID. It verifies the
assignment with the signed platform request and the workspace configuration.

Do not automatically reassign a workspace when an instance heartbeat stops.
Return a clear temporary-unavailable response. Automatic failover requires
shared storage, fencing, and a lease that prevents two instances from running
the same workspace. Add those only when the product needs automatic failover.

Manual migration can be added first:

1. drain and stop the workspace
2. copy or expose its storage on the destination
3. update the placement record
4. start and verify the destination sandbox

## Request routing

All public workspace routes keep their current shape:

```text
/api/workspaces/:workspaceId/...
```

For every request, an API node:

1. authenticates the platform user
2. verifies workspace membership
3. reads the workspace placement
4. forwards a short-lived signed request to the assigned instance
5. returns the normalized result

The signed request includes the platform ID, workspace ID, user ID, request ID,
expiry, and allowed operation. An instance rejects requests for other
workspaces or operations.

The instance interface should express workspace operations such as files,
threads, messages, and settings. Do not expose arbitrary filesystem paths,
shell commands, or generic proxy destinations to API clients.

An instance publishes workspace changes back to the platform. In combined mode
this can be an in-process call. In clustered mode it uses the authenticated
internal interface.

## Deployment modes

Use one configuration value to select the process role:

```text
HESWE_MODE=all
HESWE_MODE=api
HESWE_MODE=instance
```

### Development

`npm run dev` uses `all` mode:

```text
one process
  -> public API
  -> local instance
  -> .data/workspaces
  -> SQLite registry
  -> in-memory events
```

The development sandbox driver may be an explicitly insecure local process
driver so development works on macOS and Windows. On Linux, developers can
select `runsc`. Production startup must reject the insecure driver.

### Single server

The first production installation also uses `all` mode:

```text
one Linux server
  -> HTTPS proxy
  -> Heswe API and instance
  -> gVisor workspace sandboxes
  -> local or mounted workspace storage
  -> SQLite platform database
```

This requires no distributed services. Back up the platform database and
workspace storage together.

### Several instances

A larger platform uses:

```text
public load balancer
  -> one or more API nodes
  -> shared PostgreSQL platform database
  -> workspace instance A
  -> workspace instance B
  -> workspace instance C
```

Instances can use their own local storage. In that configuration, workspaces
remain tied to their assigned instance until explicitly copied.

Use EFS, NFS, or another shared filesystem when easy migration or failover is
more important than local filesystem performance. Shared storage does not
change placement: only the assigned instance may run the workspace.

PostgreSQL replaces SQLite when more than one API process must write the
platform registry. Use PostgreSQL notifications for cross-node invalidation
before adding a separate pub/sub service. Keep one shared coordination system
until a concrete requirement needs another.

## Configuration

Keep deployment choices behind a few explicit settings:

```text
HESWE_MODE
HESWE_PLATFORM_ID
HESWE_PLATFORM_NAME
HESWE_PUBLIC_URL
HESWE_DATABASE_URL
HESWE_INSTANCE_ID
HESWE_INSTANCE_URL
HESWE_WORKSPACE_STORAGE_ROOT
HESWE_SANDBOX_DRIVER
```

Development supplies defaults under `.data`. Production requires stable
platform and instance IDs, public and private URLs, storage, secrets, and a
production sandbox driver.

Do not spread mode checks throughout application routes. Select implementations
at startup for:

- platform database
- workspace router
- instance client
- sandbox manager
- event publisher

The public API and workspace operation interfaces remain the same in every
mode.

## Growth path

Grow a platform without changing the workspace model:

1. Run `npm run dev` with embedded local components.
2. Deploy the same application in `all` mode on one Linux server.
3. Move the platform database to PostgreSQL.
4. Add instance machines and place new workspaces on them.
5. Add API replicas behind a load balancer.
6. Add shared workspace storage only if migration or failover needs it.
7. Add leases and automatic failover only after shared storage is proven.

Steps should be driven by measured capacity or availability needs.

## Migration from the current server

The current server already resembles combined mode: it uses one SQLite
database, one workspace root, and in-process `AppWorkspaceService` objects.

Evolve it in this order:

1. Add a stable platform ID and discovery endpoint.
2. Replace workspace ownership with membership.
3. Add `instance_id`, `storage_key`, and workspace state to the registry.
4. Register one built-in `local` instance for existing workspaces.
5. Put `AppWorkspaceService` behind a workspace-instance interface.
6. Route through the recorded instance even when it is local.
7. Move local workspace execution into gVisor sandboxes.
8. Add remote instance registration and signed internal requests.
9. Add PostgreSQL support before running multiple API nodes.

Do not add remote routing before local routing uses the same placement model.

## Out of scope for the first version

- global accounts shared between platforms
- roles within a workspace
- cross-platform workspace discovery by a server
- automatic workspace rebalancing
- automatic failover or split-brain recovery
- live workspace migration
- multi-region replication
- Kubernetes or a general-purpose scheduler
