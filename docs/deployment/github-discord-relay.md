# GitHub → Discord Silent Relay

Replaces the direct GitHub→Discord `/github` webhook integration for this repo. All GitHub
events flow through a relay that posts to the Discord webhook with **`flags: 4096`
(SuppressNotifications)** — messages appear in the channel, but **nobody ever gets a
notification**, regardless of their personal Discord settings.

> **Hosting note:** originally a container on the production VPS; moved to **Vercel**
> on 2026-06-13 (freed 64 MB on the RAM-tight host and removed an nginx route). The VPS
> deployment is fully decommissioned.

## Topology

```
GitHub (lavamusic repo webhook, events: *, hook id 553683576)
  → https://github-discord-relay.vercel.app/api/github   (Vercel function)
  → Discord webhook (standard execute endpoint, flags 4096)
```

## Pieces

- **Code**: private repo [`shaneomac1337/github-discord-relay`](https://github.com/shaneomac1337/github-discord-relay)
  — single zero-dependency Vercel function (`api/github.js`), git-integrated (push to `main`
  auto-deploys production)
- **Vercel project**: `github-discord-relay` (team `martin-penkavas-projects`), env vars
  `DISCORD_WEBHOOK_URL` + `GITHUB_SECRET` set for production
- **GitHub hook**: `content_type: json`, HMAC secret, subscribed to `*` — the relay decides
  what to post

## Behavior

- Verifies `X-Hub-Signature-256` (HMAC-SHA256) — unsigned/foreign posts get 401
- Formats: pushes (commit list + compare link), published releases, issues and PRs
  (opened/closed/reopened/merged), failed workflow runs, stars, forks, branch/tag create+delete
- Drops everything else (check suites, successful CI runs, statuses, wiki…) with 204 —
  this is the noise filter
- Every Discord post carries `flags: 4096` → silent for all members
- Health: `GET /api/github` → `ok`

## Operations

```bash
# function logs
vercel logs github-discord-relay.vercel.app
# GitHub-side delivery log
gh api repos/shaneomac1337/lavamusic/hooks/553683576/deliveries
# redeploy
cd github-discord-relay && vercel deploy --prod
```

Gotcha learned the hard way: PATCHing a GitHub webhook **replaces the whole `config`
object** — always re-send `url`, `content_type`, and `secret` together, or the secret is
silently wiped and deliveries start failing signature checks (401).

Rollback: point the webhook back at the Discord `/github` endpoint
(`gh api -X PATCH repos/shaneomac1337/lavamusic/hooks/553683576 -f "config[url]=<discord /github url>" -f "config[content_type]=json" -f "config[secret]=<secret>"`).
