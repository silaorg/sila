# Sila Server (starter)

Minimal Node server scaffold for the server-side workspaces proposal.

## Dev

```sh
npm -w packages/server run dev
```

## Health

```sh
curl http://localhost:6001/health
```

## Spaces (demo auth)

Use a bearer token. Try `demo-token`.

```sh
curl -H "Authorization: Bearer demo-token" http://localhost:6001/spaces
curl -H "Authorization: Bearer demo-token" http://localhost:6001/spaces/space-1
curl -X POST -H "Authorization: Bearer demo-token" http://localhost:6001/spaces/space-1/connect
```

## Socket.IO

Connect to namespace `/spaces/{spaceId}` with `auth.token`.
