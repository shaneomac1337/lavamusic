# Folder Structure Cleanup — Design

**Date:** 2026-06-07
**Status:** Approved (autonomous loop; choices confirmed via clarifying questions)

## Goal

De-bloat the repository folder structure, remove duplicated/dead Docker config,
and align the repo with how the project is *actually* deployed in production
(`/opt/lavalink` and `/opt/lavamusic` on `root@ssh.komplexaci.cz`).

## Production reality (verified over SSH, read-only)

- **Lavalink** runs from the official image `ghcr.io/lavalink-devs/lavalink:4.2.2`
  via a server-maintained `/opt/lavalink/docker-compose.yml` mounting
  `/opt/lavalink/application.yml`. **No jar, no custom Dockerfile.**
- **Bot** is built by a server-maintained `/opt/lavamusic/Dockerfile` — a clean
  multi-stage `node:24-alpine` build that clones the GitHub repo and uses the
  repo's `docker/docker-entrypoint.sh` (`prisma db push`), `locales/`, `prisma/`,
  `src/web/public/`, `src/utils/LavaLogo.txt`.
- Nothing in production uses the repo's `Dockerfile.clean/.fixed/.standalone`,
  `docker-compose.standalone.yml`, `config/`, Replit, PM2, or local jars.

## Decisions (confirmed)

1. Remove all alternative deployment methods (Replit, PM2, standalone Docker).
2. One canonical multi-stage Dockerfile that **builds from local context**
   (keeps prod's proven shape: multi-stage node:24-alpine, non-root uid 322,
   dumb-init, prune prod deps, `db push` entrypoint).
3. Repo only — do not modify the live production server.
4. Local Lavalink dev uses the official Docker image (remove jar + launch scripts).
5. Docker file placement: `Dockerfile` + `docker-compose.yml` + `.dockerignore`
   at repo root (conventional; mirrors how prod co-locates them).

## Security finding (action required outside repo)

`Lavalink/application.yml` was tracked with live secrets (Spotify client secret;
Google account email + plaintext password; Lavalink password). The file is
removed from tracking and gitignored. **History still contains the secrets —
rotate the Google password and Spotify client secret.**

## Target structure

```
lavamusic/
├── .github/ docs/ locales/ prisma/ src/
├── scripts/                deploy-commands.js, restart.js
├── docker/
│   ├── docker-entrypoint.sh
│   └── lavalink/application.example.yml   (template, no secrets)
├── Dockerfile              (canonical multi-stage, local context)
├── docker-compose.yml      (bot built locally + official lavalink:4.2.2)
├── .dockerignore  .env.example  .gitignore  .editorconfig
├── biome.json  tsconfig.json  tsup.config.ts  tailwind.config.js
├── package.json  package-lock.json  LICENSE
└── README.md  CLAUDE.md  WARP.md
```

## Delete

- `Dockerfile.clean`, `Dockerfile.fixed`, `Dockerfile.standalone`,
  `docker-compose.standalone.yml`
- `config/` (legacy `application.yml`, PM2 `process.json`, `replit.nix`, `README.md`)
- `.replit`, `.hintrc`
- `scripts/run.bat`, `scripts/start-lavalink.bat`, `Lavalink/start-lavalink.ps1`
- Untracked local artifacts: `Lavalink/*.jar`, `*.jar.bak`, `bot.log`,
  `Lavalink/*-local.log`
- Stop tracking `Lavalink/application.yml` (gitignore it)
- `docs/STANDALONE_DEPLOYMENT.md`

## Verify before done

- `npm run build` (exit 0)
- `npm run lint` (Biome)
- `docker build -t lavamusic:verify .` (exit 0)
- `docker compose config` valid
- Docs updated (no Replit/PM2/standalone/jar references); doc-verification clean.
