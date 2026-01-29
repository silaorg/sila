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

Use a bearer token. Try `demo-token`. The demo user is seeded into the SQLite DB on first run.

```sh
curl -H "Authorization: Bearer demo-token" http://localhost:6001/spaces
curl -H "Authorization: Bearer demo-token" http://localhost:6001/spaces/space-1
curl -X POST -H "Authorization: Bearer demo-token" http://localhost:6001/spaces/space-1/connect
```

## Dev-only endpoints

Use these to seed users and spaces for local testing.

```sh
curl -X POST http://localhost:6001/dev-only/users \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com"}'

curl -X POST http://localhost:6001/dev-only/spaces \
  -H "Content-Type: application/json" \
  -d '{"name":"Dev Space","ownerId":"<user-id-from-previous-call>"}'
```

## Socket.IO

Connect to namespace `/spaces/{spaceId}` with `auth.token`.
