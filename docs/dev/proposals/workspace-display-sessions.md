# Workspace display sessions

Status: proposal.

## Decision

Give an active workspace an optional graphical session that its agent and an
authorized user can see and control. Both attach to the same virtual display
inside the workspace sandbox.

Use a private VNC server and an embedded noVNC client for the first version.
Carry the VNC stream through an authenticated WebSocket owned by the Heswe
platform. Keep the display backend behind a small interface so WebRTC can
replace it if high-motion use cases justify the added infrastructure.

The invariant is:

```text
one workspace sandbox
  -> one optional virtual display
  -> one input controller at a time
```

Display sessions are a user-facing workspace interface. They are separate from
the narrow agent runtime protocol.

This proposal extends the
[workspace computer](agent-computer-runtime.md) and
[workspace sandboxing](workspace-agent-sandboxing.md) proposals.

## Architecture

Run a virtual X server such as TigerVNC's `Xvnc` inside the workspace sandbox.
Graphical applications and the agent's computer tools use that display. The
browser embeds noVNC and connects to the platform through a same-origin
WebSocket.

```text
user browser
  -> authenticated Heswe display gateway
    -> private workspace display server
      <- agent computer tools
```

The display server has no public address. The instance reaches it through the
sandbox network or a host-loopback port. The gateway resolves the target from
trusted workspace placement. A client cannot supply a proxy destination.

Starting a viewer session returns a short-lived capability bound to the exact
platform user, workspace, runtime lease, access mode, and expiry. The gateway
also checks normal workspace membership and the WebSocket origin. Closing the
viewer, stopping the workspace, changing its lease, or reaching the idle limit
revokes the session.

Start the display lazily and keep its resolution fixed while the agent is
using screen coordinates. The client may scale it locally.

## Control

Display access has two modes:

- **Watch** is view-only and may be granted while the agent works.
- **Take control** gives the user an exclusive input lease and pauses agent
  computer input until control is returned or the lease expires.

The agent may report that it is waiting for the user at a login, confirmation,
CAPTCHA, MFA prompt, or another intervention. The platform records control
transitions, but not keys, pointer events, or screen contents.

Do not allow the agent and user to inject input concurrently. Workspace
members share the workspace's browser state, so the first version also permits
only one human controller. Additional viewers remain view-only.

## Transport

VNC over WebSocket fits the first use case because workspace screens usually
change in small regions and RFB expects a reliable ordered stream. It provides
keyboard, pointer, and view-only behavior without signaling or TURN.

WebRTC is the preferred future backend for fluid animation, video, audio, or
consistently low latency on lossy networks. It must preserve the same
authorization, lifecycle, and exclusive-control contract so the user-facing
API does not depend on VNC.

Do not implement a custom screenshot or input protocol. Mature clients already
handle compression, keyboard details, reconnects, and backpressure.

## Security and privacy

The platform session is the security boundary, not a reusable VNC password.
Any internal display credential is random, memory-only, and inaccessible from
outside the instance. Browser traffic uses the platform's TLS connection.

Disable clipboard synchronization, file transfer, audio, and session recording
by default. Each feature crosses an additional data boundary and can be added
only with an explicit product requirement and policy.

A password typed into the remote display stays out of chat and model requests,
but it is not secret from the workspace. Code controlling the same computer
may observe input, screen contents, browser state, or resulting credentials.
Use an external credential or OAuth broker when a secret must remain
unavailable to workspace code.

Add the display server, a small window manager, fonts, and browser dependencies
to the runtime image. Keep disposable state in bounded temporary storage and
preserve the existing non-root user, read-only root, and resource limits.

Keep display lifecycle behind a small instance-owned interface for ensuring a
display, creating or revoking a session, changing the controller, and reading
status. The single-server deployment implements it in the existing process. A
multi-instance platform routes it to the assigned instance. Do not add a
separate display service until deployment or measured load requires one.

## Verification

Test that:

- a user cannot view or control another workspace
- an expired or stale capability cannot reconnect
- the display is unreachable without the platform gateway
- only one user or agent controls input at a time
- agent input pauses and resumes across human control
- workspace stop and replacement revoke every viewer
- clipboard and recording remain disabled by default
- display traffic cannot select another internal destination

## Out of scope

- hiding user-entered secrets from workspace code
- audio and webcam forwarding
- session recording
- multiple displays or independent per-thread desktops
- general RDP, SSH, or VNC access to external machines
- WebRTC signaling and TURN infrastructure before a measured need
