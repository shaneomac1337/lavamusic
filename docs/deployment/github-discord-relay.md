# GitHub → Discord Silent Relay

Replaces the direct GitHub→Discord `/github` webhook integration for this repo. All GitHub
events now flow through a tiny relay on the production host that posts to the Discord
webhook with **`flags: 4096` (SuppressNotifications)** — messages appear in the channel,
but **nobody ever gets a notification**, regardless of their personal Discord settings.

## Topology

```
GitHub (repo webhook, events: *)
  → https://music.komplexaci.cz/github-relay/   (nginx location, same vhost as dashboard)
  → 127.0.0.1:9220  github-discord-relay container (node:22-alpine, ~30 MB, mem_limit 64m)
  → Discord webhook (standard execute endpoint, flags 4096)
```

## Pieces

- **Server**: `/opt/github-discord-relay/` on `komplexaci` — `relay.js` (zero-dependency Node
  HTTP server), `docker-compose.yml`, `.env` (`DISCORD_WEBHOOK_URL`, `GITHUB_SECRET`; chmod 600)
- **nginx**: `location /github-relay/` in `/etc/nginx/sites-enabled/music.komplexaci.cz`
  proxying to `127.0.0.1:9220` (relay binds loopback only; container uses host networking)
- **GitHub hook**: repo webhook id `553683576`, `content_type: json`, HMAC secret set,
  subscribed to `*` — the relay decides what to post

## Behavior

- Verifies `X-Hub-Signature-256` (HMAC-SHA256) — unsigned/foreign posts get 401
- Formats: pushes (commit list + compare link), releases (published), issues and PRs
  (opened/closed/reopened/merged), failed workflow runs, stars, forks, branch/tag create+delete
- Drops everything else (check suites, successful workflow runs, statuses, wiki…) with 204 —
  this is the noise filter
- Every Discord post carries `flags: 4096` → silent for all members
- Health: `GET /github-relay/health` → `ok`

## Operations

```bash
# logs
docker logs github-discord-relay --tail 20
# restart after editing relay.js
cd /opt/github-discord-relay && docker compose up -d --force-recreate
# GitHub-side delivery log
gh api repos/shaneomac1337/lavamusic/hooks/553683576/deliveries
```

Rollback: point the webhook back at the Discord `/github` endpoint
(`gh api -X PATCH repos/shaneomac1337/lavamusic/hooks/553683576 -f "config[url]=<discord /github url>"`)
and `docker compose down` the relay.
