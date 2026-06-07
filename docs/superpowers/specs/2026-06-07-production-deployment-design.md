# Production Deployment (GitOps consolidation) — Design

**Date:** 2026-06-07
**Target:** `root@ssh.komplexaci.cz` — `/opt/lavalink` + `/opt/lavamusic`
**Status:** Approved (strategy confirmed via clarifying questions; autonomous loop)

## Goal

Bring the (currently stopped) LavaMusic bot back up in production using the
cleaned-up repo, as a single best-practice Docker stack, without disturbing the
other services on the host (komplexaci-web, trackmania-*, portainer, jackett).

## Confirmed decisions

1. **GitOps checkout** — `/opt/lavamusic` becomes a real `git clone` of
   `https://github.com/shaneomac1337/lavamusic` (main = the cleaned repo,
   commit 63ff435). Future updates: `git pull && docker compose up -d --build`.
2. **Consolidate** — the repo's single `docker-compose.yml` manages BOTH the
   official `lavalink:4.2.2` and the bot. A brief (~30-60s) Lavalink restart is
   acceptable.
3. **Proceed, backup first.** Remove stale `.bak/.backup` only after success.
   Other services are never touched.

## Secrets to preserve (NEVER lose / never commit)

- `/opt/lavamusic/.env` → copied into the new checkout (gitignored).
- `/opt/lavalink/application.yml` (real Lavalink config incl. YouTube
  refreshToken) → copied to `/opt/lavamusic/docker/lavalink/application.yml`
  (gitignored).

## Steps

1. **Pre-flight (safe):** snapshot `/opt/lavalink` + `/opt/lavamusic` configs to
   `/opt/_lavamusic-migration-backup-<ts>/`; record `docker ps`; check `df -h`.
2. **Stage new checkout:** `git clone` repo to `/opt/lavamusic.new`; copy `.env`
   in; copy the real Lavalink `application.yml` to
   `docker/lavalink/application.yml`.
3. **Stop old stacks:** `docker compose down` in `/opt/lavalink`; remove the old
   exited `lavamusic` container (free the container names `lavalink`/`lavamusic`).
4. **Swap:** `mv /opt/lavamusic /opt/lavamusic.old` ; `mv /opt/lavamusic.new
   /opt/lavamusic`.
5. **Deploy:** `cd /opt/lavamusic && docker compose up -d --build`.
6. **Verify (parallel agents, read-only):** Lavalink healthy (`/version`), bot
   healthy (`/health` 200, Discord connected in logs), the 5 other containers
   still Up, no container-name/port conflicts.
7. **On success:** remove stale `.bak/.backup`; leave `/opt/lavamusic.old` and
   `/opt/lavalink` as rollback for now.

## Rollback

If the new stack fails to become healthy: `docker compose down` in the new
`/opt/lavamusic`; restore `/opt/lavamusic.old`; `cd /opt/lavalink && docker
compose up -d` to bring the original Lavalink back. Configs are in the backup dir.

## Success criteria (loop stops only when ALL true)

- `lavalink` container Up + healthy.
- `lavamusic` container Up + healthy; `GET http://localhost:3001/health` = 200.
- Bot shows connected to Discord + Lavalink node in logs.
- All 5 unrelated containers still Up.
- `/opt/lavamusic` is a clean git checkout; secrets present + gitignored.
