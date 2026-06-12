# Docker Stack (production)

The stack is defined by the repo's root `docker-compose.yml` and runs on the production host as-is.
Both containers use `network_mode: host` — there is no Docker network; everything binds directly
on the host's loopback/interfaces.

## Services

### lavalink

- **Image**: `ghcr.io/lavalink-devs/lavalink:4.2.2` (official)
- **Port**: 2333 (host network), `SERVER_ADDRESS=0.0.0.0`
- **Heap**: `_JAVA_OPTIONS=-Xmx2G`
- **Config**: `./docker/lavalink/application.yml` mounted read-only (gitignored; template at
  `docker/lavalink/application.example.yml`)
- **Plugins** (declared in application.yml, auto-downloaded by the image on start):
  - `dev.lavalink.youtube:youtube-plugin:1.18.1` (clients: IOS, ANDROID_MUSIC, ANDROID_VR, TVHTML5_SIMPLY, TV, MUSIC, WEB, MWEB, WEBEMBEDDED)
  - `com.github.topi314.lavasrc:lavasrc-plugin:4.8.3` (Spotify/Apple/Deezer resolution, `ytsearch` ISRC fallback)
  - `com.github.topi314.lavasearch:lavasearch-plugin:1.0.0`
  - `com.github.topi314.lavalyrics:lavalyrics-plugin:1.1.0`
  - `com.github.topi314.sponsorblock:sponsorblock-plugin:3.0.1`
  - `com.dunctebot:skybot-lavalink-plugin:1.7.0` (TTS, getyarn, clypit, pixeldrain)
- **Bind mounts**: `./docker/lavalink/plugins` and `./docker/lavalink/logs` — must be owned by
  uid/gid **322:322** (the image's runtime user). Named volumes don't work here because the
  image must write downloaded plugins (fixed in commit `2308de8`).
- **Healthcheck**: `GET /version` with the Lavalink password every 30s

### lavamusic

- **Image**: `lavamusic:latest`, built from the repo `Dockerfile`
- **Depends on**: lavalink healthy
- **Port**: 3001 — the Fastify web dashboard (`WEB_DASHBOARD=true`, `DASHBOARD_PORT=3001`),
  consumed only by host nginx (see [nginx-proxy](nginx-proxy.md))
- **Env**: `NODE_ENV=production` + `.env` file (see [environment](environment.md))
- **Named volumes**:
  - `lavamusic-db` → `/opt/lavamusic/prisma` — SQLite database **and** the persisted dashboard
    JWT secret (`prisma/.dashboard-secret`, commit `551612c`); survives rebuilds
  - `lavamusic-logs` → `/opt/lavamusic/logs`
- **Healthcheck**: `GET http://localhost:3001/health` every 30s

## Runtime state at snapshot time

Both containers **healthy**, up 5 days. Logs quiet — only health-check traffic on both
(`/health` on the bot, `/version` on Lavalink). No errors.
