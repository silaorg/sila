# Workspace display sessions

Status: proposal. Build after remote agent computers and storage are reliable.

Give a workspace computer an optional graphical session.
The agent and an authorized user see the same screen.
Use one display and one input controller at a time.

## First version

Run a virtual display, browser, and small window manager inside the computer.
Use a private VNC server and an embedded noVNC viewer.
Route its WebSocket through the authenticated Heswe API.
The browser cannot choose an internal address to connect to.

```text
user browser
  -> authenticated display gateway
    -> private workspace display
      <- agent computer tools
```

Start the display when needed. Keep its resolution fixed during agent control.
The viewer can scale the image without changing screen coordinates.

## Access and control

Check workspace access when opening and reconnecting a viewer.
Bind each short-lived viewer session to the user, workspace, and computer.
Revoke it when access changes or that computer pauses, stops, or is replaced.

- **Watch:** view the screen while the agent works.
- **Take control:** pause agent input and give one user control.

Do not let the user and agent type or click at the same time.
Return control explicitly or after the user's control lease expires.
The agent can report that it is waiting for a login or confirmation.

Workspace members share browser state. Credentials entered on this screen
may be visible to code running in the same computer.
Keep secrets outside the computer when they must remain hidden from agents.

Disable clipboard sync, file transfer, audio, and recording initially.
Record control changes, not keystrokes or screen contents.

## Scope

Keep display lifecycle with the workspace launcher.
Do not add a separate service or custom screen protocol initially.
Consider WebRTC if measured video or latency needs justify it.

Test access checks, reconnects, exclusive input, and revocation after stop.
A VM snapshot must not restore an expired viewer or input grant.

See [agent computers](agent-computer-runtime.md) and
[workspace sandboxing](workspace-agent-sandboxing.md).
