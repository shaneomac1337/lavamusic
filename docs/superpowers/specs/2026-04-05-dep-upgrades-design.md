# Dependency Upgrades & Lint Tooling Consolidation — Design

**Date:** 2026-04-05
**Status:** Approved

## Goal

Bring `lavamusic` dependencies up to date and resolve the Biome vs ESLint+Prettier tooling inconsistency, while keeping every change bisectable via per-step commits.

## Context

- Project is on npm (no lockfile currently in repo — will be regenerated).
- `package.json` declares ESLint + Prettier in devDeps and `lint` / `format` scripts that use them, but `biome.json` also exists and `CLAUDE.md` claims "Biome.js for linting and formatting". The two tooling stacks are in conflict.
- No automated runtime tests exist. The `tests/` directory holds manual debug scripts that require a Discord bot token. Therefore verification per step is limited to `npm run build` + `npm run lint` (+ human smoke test after all steps).
- `package-lock.json` and `node_modules/` are absent; `npm install` needs to run before anything else.

## Scope

### In scope

- All within-semver minor/patch updates (`npm update`).
- Major upgrades deemed low-risk:
  - `dotenv` 16 → 17
  - `@fastify/jwt` 9 → 10
  - `node-system-stats` 1 → 2
- Remove Biome: delete `biome.json`, update `CLAUDE.md`.

### Out of scope

- `prisma` / `@prisma/client` 6 → 7 (migration review needed, separate future work).
- `zod` 3 → 4 (large API surface change, separate future work).
- Dockerfile consolidation (user maintains elsewhere).
- Any refactoring beyond what an upgrade breaking change forces.

## Approach

One logical commit per step. Each step either succeeds cleanly or is reverted in isolation.

| Step | Action | Commit |
|---|---|---|
| 1 | `npm install` — regenerate lockfile, run `npm audit`, capture any CVEs | no commit yet (bundled into step 2) |
| 2 | `npm update` — all within-semver bumps. Run `npm run build` + `npm run lint`. | `chore(deps): update minors/patches + regenerate lockfile` |
| 3 | Delete `biome.json`; update `CLAUDE.md` line that says "Biome.js for linting and formatting" to reflect ESLint + Prettier reality. | `chore: remove biome config, align tooling docs with eslint+prettier` |
| 4 | Bump `dotenv` 16 → 17. Review v17 changelog (quoted-value handling changed). Grep for `dotenv` / `process.env` consumers. Build + lint. | `chore(deps): bump dotenv 16 → 17` |
| 5 | Bump `@fastify/jwt` 9 → 10. Review changelog. Check JWT usage in `src/web/` (web dashboard auth). Build + lint. | `chore(deps): bump @fastify/jwt 9 → 10` |
| 6 | Bump `node-system-stats` 1 → 2. Review changelog. Check usage sites. Build + lint. | `chore(deps): bump node-system-stats 1 → 2` |

## Verification

Per step:
- `npm run build` — TypeScript compile must succeed (tsup).
- `npm run lint` — no **new** errors introduced by this step (pre-existing lint violations are out of scope to fix here).

After all steps: user smoke-tests the bot with a real token before any PR / merge.

## Rollback Strategy

Each step = one commit. If step N breaks something, `git revert <sha-of-step-N>` undoes only that step. Earlier successful steps stay in place.

## Non-Goals

- Adding automated runtime tests.
- Fixing pre-existing lint violations.
- Refactoring for style.
- Upgrading Prisma or Zod.
