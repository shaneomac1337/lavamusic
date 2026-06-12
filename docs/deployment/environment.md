# Production Environment Configuration

The container reads `/opt/lavamusic/.env` (plus inline compose env). **All secret values are
redacted here — this doc lists key names and only non-secret values.** Reference for what each
key does: `.env.example` in the repo root.

## Keys present in production `.env`

| Key | Value in prod | Secret? |
|---|---|---|
| `TOKEN` | *(redacted)* | yes — Discord bot token |
| `CLIENT_ID` | *(redacted)* | app ID (not strictly secret, redacted anyway) |
| `CLIENT_SECRET` | *(redacted)* | yes — Discord OAuth2 secret for dashboard login |
| `DASHBOARD_SECRET` | *(redacted)* | yes — JWT signing secret (also persisted at `prisma/.dashboard-secret`) |
| `TOPGG` | *(redacted)* | yes — top.gg API key |
| `GENIUS_API` | *(redacted)* | yes — lyrics API key |
| `NODES` | *(redacted — contains Lavalink password)* | yes — Lavalink node JSON (host, port 2333, auth) |
| `OWNER_IDS` | *(redacted)* | owner Discord user IDs |
| `GUILD_ID` | *(redacted)* | dev guild for command deploys |
| `LOG_CHANNEL_ID` / `LOG_COMMANDS_ID` | *(redacted)* | Discord log channel IDs |
| `DEFAULT_LANGUAGE` | `EnglishUS` | no |
| `PREFIX` | *(set)* | no |
| `BOT_STATUS` / `BOT_ACTIVITY_TYPE` / `BOT_ACTIVITY` | *(set)* | no — presence config |
| `KEEP_ALIVE` | *(set)* | no |
| `DATABASE_URL` | SQLite (default) | no |
| `AUTO_NODE` | `false` | no — static Lavalink node, no lavainfo-api auto-discovery |
| `SEARCH_ENGINE` | `YouTubeMusic` | no — default search source |
| `WEB_DASHBOARD` | `true` | no — dashboard enabled |
| `DASHBOARD_PORT` | `3001` | no |
| `DASHBOARD_BASE_URL` | `https://music.komplexaci.cz` | no — public origin for OAuth redirects |

Compose additionally injects `NODE_ENV=production`, `WEB_DASHBOARD=true`, `DASHBOARD_PORT=3001`.

## Notes

- Env validation happens at startup via zod (`src/env.ts`); a missing required key fails fast.
- The JWT secret survives container rebuilds two ways: `DASHBOARD_SECRET` env and the
  `prisma/.dashboard-secret` file inside the `lavamusic-db` volume.
