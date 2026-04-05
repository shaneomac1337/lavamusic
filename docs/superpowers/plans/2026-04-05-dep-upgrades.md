# Dependency Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring dependencies current (minors + 3 low-risk majors) and remove the Biome/ESLint tooling conflict, with one bisectable commit per step.

**Architecture:** Sequential npm upgrade steps, each gated on `npm run build` + `npm run lint`. Majors bumped individually after a changelog review and grep for affected call sites.

**Tech Stack:** npm, TypeScript (tsup), ESLint, Prettier. Node LTS. Discord.js 14, Fastify 5, Prisma 6, Zod 3.

**Spec:** `docs/superpowers/specs/2026-04-05-dep-upgrades-design.md`

**Verification limits:** No automated runtime tests exist (`tests/` is manual scripts needing a bot token). Per-step verification is `npm run build` (must succeed) + `npm run lint` (no **new** errors beyond pre-existing baseline). User smoke-tests the bot after all tasks.

---

### Task 0: Baseline install + capture pre-existing lint state

**Goal:** Regenerate `package-lock.json`, install deps, run `npm audit`, and record pre-existing lint errors as the baseline for later "no new errors" checks.

**Files:**
- Create: `package-lock.json` (generated)
- Create: `node_modules/` (generated, gitignored)

**Acceptance Criteria:**
- [ ] `npm install` completes without errors
- [ ] `package-lock.json` exists
- [ ] `npm run build` succeeds on current deps
- [ ] Baseline lint error count is recorded in the plan doc below

**Verify:** `npm run build` → exits 0; `npm run lint` → may have errors, capture count

**Steps:**

- [ ] **Step 1: Install**
```bash
cd D:/Projects/lavamusic
npm install
```
Expected: deps install, lockfile created, warnings OK but no errors.

- [ ] **Step 2: Audit for CVEs**
```bash
npm audit --json > .audit-baseline.json
npm audit
```
Expected: list of vulns (if any). Note counts; do not fix now — just capture.

- [ ] **Step 3: Verify build**
```bash
npm run build
```
Expected: tsup compiles, exits 0.

- [ ] **Step 4: Capture baseline lint state**
```bash
npm run lint 2>&1 | tee .lint-baseline.txt
```
Record the error/warning count here in a comment for later diffs. These are pre-existing and out of scope to fix.

- [ ] **Step 5: No commit yet** — lockfile gets committed with Task 1's minor bumps.

---

### Task 1: Apply within-semver minor/patch updates

**Goal:** Run `npm update` to bump all deps to latest within declared semver ranges; commit lockfile + any package.json version range bumps.

**Files:**
- Modify: `package-lock.json`
- Modify possibly: `package.json` (if `npm update` rewrites caret ranges — it usually doesn't)

**Acceptance Criteria:**
- [ ] `npm outdated` shows only the 3 remaining majors (prisma, zod, remaining ones out-of-scope) + no in-scope minors
- [ ] `npm run build` succeeds
- [ ] `npm run lint` error count ≤ baseline (no new errors)

**Verify:** `npm run build` → exits 0; `npm outdated` → only out-of-scope entries remain

**Steps:**

- [ ] **Step 1: Update within-semver**
```bash
npm update
```
Expected: many packages updated (fastify, discord.js, lavalink-client, undici, prisma 6.x, etc).

- [ ] **Step 2: Verify nothing broke**
```bash
npm run build
npm run lint 2>&1 | tail -20
```
Expected: build exits 0, lint count ≤ baseline.

- [ ] **Step 3: Confirm outdated shrunk**
```bash
npm outdated
```
Expected: only `@prisma/client`, `prisma`, `zod`, `dotenv`, `@fastify/jwt`, `node-system-stats` remain (the out-of-scope majors + the 3 we'll do next).

- [ ] **Step 4: Commit**
```bash
git add package-lock.json package.json docs/superpowers/
git commit -m "chore(deps): update minors/patches + regenerate lockfile"
```

---

### Task 2: Remove Biome, align CLAUDE.md with actual tooling

**Goal:** Delete `biome.json` and fix the contradicting line in `CLAUDE.md`. Project already uses ESLint + Prettier per `package.json` scripts — this just makes docs match.

**Files:**
- Delete: `biome.json`
- Modify: `CLAUDE.md:97` (the line "- Biome.js for linting and formatting")

**Acceptance Criteria:**
- [ ] `biome.json` no longer exists
- [ ] `CLAUDE.md` no longer references Biome
- [ ] `npm run lint` still works unchanged

**Verify:** `ls biome.json` → "No such file"; `grep -i biome CLAUDE.md` → no matches

**Steps:**

- [ ] **Step 1: Delete biome.json**
```bash
rm biome.json
```

- [ ] **Step 2: Update CLAUDE.md line 97**

Replace the exact line:
```
- Biome.js for linting and formatting
```
with:
```
- ESLint + Prettier for linting and formatting
```

- [ ] **Step 3: Verify lint still works**
```bash
npm run lint 2>&1 | tail -5
```
Expected: error count ≤ baseline (unchanged).

- [ ] **Step 4: Commit**
```bash
git add -u biome.json CLAUDE.md
git commit -m "chore: remove biome config, align tooling docs with eslint+prettier"
```

---

### Task 3: Bump `dotenv` 16 → 17

**Goal:** Upgrade `dotenv` to v17. Only call site is `src/env.ts` with `config({ path })` — API unchanged in v17, but v17 changes how quoted values are parsed, so we verify `.env.example` + current usage.

**Files:**
- Modify: `package.json` (bump `dotenv` to `^17.4.0`)
- Modify: `package-lock.json`
- Touch-only (verify): `src/env.ts:2,5`

**Acceptance Criteria:**
- [ ] `dotenv` ^17.x in package.json
- [ ] `npm run build` succeeds
- [ ] `src/env.ts` `config({ path })` call still works at runtime (verified via build + type check)

**Verify:** `npm run build` → exits 0; `npm list dotenv` → shows 17.x

**Steps:**

- [ ] **Step 1: Install v17**
```bash
npm install dotenv@^17.4.0
```

- [ ] **Step 2: Check release notes for breakages**
Known v17 breaking changes: default-behavior change around quoted values in `.env`, and Node.js 12 support dropped. Our usage is `config({ path: path.join(__dirname, '../.env') })` — call signature unchanged. No inline-quoted multi-line secrets expected in `.env`.

- [ ] **Step 3: Build + lint**
```bash
npm run build
npm run lint 2>&1 | tail -5
```
Expected: build exits 0, lint ≤ baseline.

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore(deps): bump dotenv 16 → 17"
```

---

### Task 4: Bump `@fastify/jwt` 9 → 10

**Goal:** Upgrade `@fastify/jwt` to v10. Call site: `src/web/server.ts:4,64-65` registers plugin with `{ secret: jwtSecret }`. v10 is compatible with Fastify 5 (already in use).

**Files:**
- Modify: `package.json` (bump `@fastify/jwt` to `^10.0.0`)
- Modify: `package-lock.json`
- Touch-only (verify): `src/web/server.ts:4,64-65`

**Acceptance Criteria:**
- [ ] `@fastify/jwt` ^10.x in package.json
- [ ] `npm run build` succeeds (TypeScript types from v10 match our usage)
- [ ] Register call `app.register(jwt, { secret: jwtSecret })` still compiles

**Verify:** `npm run build` → exits 0; `npm list @fastify/jwt` → shows 10.x

**Steps:**

- [ ] **Step 1: Install v10**
```bash
npm install @fastify/jwt@^10.0.0
```

- [ ] **Step 2: Check v10 changelog**
v10 drops support for older Fastify versions (requires Fastify 5) — we're already on Fastify 5. Option shapes for `secret` are unchanged. If `sign`/`verify` helpers are called elsewhere, re-verify their signatures.

- [ ] **Step 3: Build**
```bash
npm run build
```
Expected: exits 0. If TypeScript errors mention changed `FastifyJwtOptions`, read the error and fix at the call site in `src/web/server.ts`.

- [ ] **Step 4: Lint**
```bash
npm run lint 2>&1 | tail -5
```
Expected: lint ≤ baseline.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json src/web/server.ts
git commit -m "chore(deps): bump @fastify/jwt 9 → 10"
```
(Include server.ts only if fixes were needed there.)

---

### Task 5: Bump `node-system-stats` 1 → 2

**Goal:** Upgrade `node-system-stats` to v2. Call site: `src/commands/info/Botinfo.ts:3` imports `showTotalMemory, usagePercent`. v2 may have renamed exports — verify and fix.

**Files:**
- Modify: `package.json` (bump `node-system-stats` to `^2.0.5`)
- Modify: `package-lock.json`
- Possibly modify: `src/commands/info/Botinfo.ts:3` (if exports renamed)

**Acceptance Criteria:**
- [ ] `node-system-stats` ^2.x in package.json
- [ ] `npm run build` succeeds — import resolves and return types match usage in `Botinfo.ts`
- [ ] `Botinfo` command code compiles

**Verify:** `npm run build` → exits 0; `npm list node-system-stats` → shows 2.x

**Steps:**

- [ ] **Step 1: Install v2**
```bash
npm install node-system-stats@^2.0.5
```

- [ ] **Step 2: Build and inspect errors**
```bash
npm run build
```
Expected (likely): TypeScript errors in `src/commands/info/Botinfo.ts` if `showTotalMemory` or `usagePercent` were renamed/restructured.

- [ ] **Step 3: If build fails — consult the package's exports**
```bash
cat node_modules/node-system-stats/package.json
```
Look at `"main"` / `"types"` / `"exports"` fields, then inspect the `.d.ts` to find the v2 names. Update `src/commands/info/Botinfo.ts:3` import and any usage on lines that follow.

- [ ] **Step 4: Re-build + lint**
```bash
npm run build
npm run lint 2>&1 | tail -5
```
Expected: build exits 0, lint ≤ baseline.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json src/commands/info/Botinfo.ts
git commit -m "chore(deps): bump node-system-stats 1 → 2"
```

---

## Task Map / File Responsibilities

| File | Why it's touched | Which tasks |
|---|---|---|
| `package.json` | Dep version ranges | 1, 3, 4, 5 |
| `package-lock.json` | Resolved deps | 0 (create), 1, 3, 4, 5 |
| `biome.json` | Removed | 2 |
| `CLAUDE.md` | Tooling doc fix | 2 |
| `src/env.ts` | dotenv import verification | 3 (verify only) |
| `src/web/server.ts` | @fastify/jwt call site | 4 (verify, possibly fix) |
| `src/commands/info/Botinfo.ts` | node-system-stats imports | 5 (likely fix) |

## Post-work

After Task 5, the user will smoke-test the bot locally with a real token. If runtime issues surface for any specific upgrade, `git revert <sha>` on that task's commit isolates the rollback.
