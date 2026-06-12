# Production Deployment Overview

Snapshot of the live lavamusic deployment, taken 2026-06-12. Regenerate by re-running the
deployment snapshot (SSH facts → these docs) when the production setup changes.

## Where it runs

- **Server**: `komplexaci` — Debian 12 (kernel 6.1.0-40-amd64), VPS reachable at `ssh.komplexaci.cz`
- **Deploy path**: `/opt/lavamusic` — a git clone of `https://github.com/shaneomac1337/lavamusic`
- **Public URL**: https://music.komplexaci.cz (web dashboard, behind nginx — see [nginx-proxy](nginx-proxy.md))
- **Docker**: Docker 29.1.2, Compose v5.0.0

## Deploy model

GitOps-lite, manual:

1. Push to `main` on GitHub (`shaneomac1337/lavamusic`)
2. On the server: `cd /opt/lavamusic && git pull`
3. `docker compose up -d --build` — rebuilds the `lavamusic:latest` image from the repo `Dockerfile`
   and restarts the stack (see [docker-stack](docker-stack.md))

Production tracks `main` directly; the working tree on the server is kept clean. A fuller GitOps
design exists in `docs/` (production GitOps deployment spec, commit `7949555`).

## Components

| Component | What | Where |
|---|---|---|
| Discord bot + dashboard | `lavamusic` container, built from repo | port 3001 (host network) |
| Audio server | `lavalink` container, official image 4.2.2 | port 2333 (host network) |
| Reverse proxy + TLS | host nginx, Let's Encrypt | 80/443 → 127.0.0.1:3001 |
| Database | SQLite via Prisma, in named volume `lavamusic-db` | inside container at `/opt/lavamusic/prisma` |

The server is shared with several unrelated services — see [host-context](host-context.md).
Environment configuration is described in [environment](environment.md) (key names only, no secrets).
