# Proposal: Docker-Hosted Server (Simple Production Setup)

## Summary

Run the Sila server in Docker on a Linux host, and terminate HTTPS with a reverse proxy (Caddy). Keep server data on a host volume.

## Goals

- Simple, production‑ready deployment flow.
- HTTPS handled outside Node (Caddy).
- Easy to update and restart.
- Persistent storage on the host.

## Non‑Goals

- Full Kubernetes or multi‑region deployment.
- Auto‑scaling.
- Managed database or object storage.

## Approach

### 1) Build a Docker image

- Use a Node 22 base image.
- Build `packages/server` with `tsc`.
- Run `node dist/index.js`.

### 2) Run the container

- Expose port 6000.
- Mount a host volume for data (future workspace storage).
- Restart policy: `unless-stopped`.

### 3) Add HTTPS with Caddy

- Caddy runs on the host and proxies to `localhost:6000`.
- Caddy manages TLS certificates (Let’s Encrypt).

## Example Files

### Dockerfile (repo root)

```Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY packages ./packages
RUN npm -w packages/server run build
EXPOSE 6000
CMD ["node", "packages/server/dist/index.js"]
```

### Caddyfile (host)

```
your-domain.com {
  reverse_proxy 127.0.0.1:6000
}
```

## Ops Notes

- Keep `PORT=6000` inside the container.
- Keep logs from Docker (`docker logs`) or a file driver.
- Use a host volume when server persistence is added.

## Next Steps

- Add `Dockerfile` and `.dockerignore` to the repo.
- Add `docker-compose.yml` with Caddy + server.
- Define server data paths for workspaces.
