# Anonymous Volumes vs Named Volumes - LavaMusic Setup

## Current Setup: Named Volumes ⭐

LavaMusic ships with **named volumes** declared in `docker/docker-compose.yml`. There is
**no `VOLUME` directive** in `docker/Dockerfile` or `Dockerfile.standalone` — persistence
is configured explicitly in compose, which is the recommended approach.

### docker-compose.yml
```yaml
services:
  lavamusic:
    # ... other config ...
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - lavamusic-logs:/opt/lavamusic/logs
      - lavamusic-db:/opt/lavamusic/prisma

volumes:
  lavamusic-logs:
  lavamusic-db:
```

### In Portainer You'll See (clear, named):
```
Volumes:
├── docker_lavamusic-db   ← Your database (playlists, guild settings)
│   Mount: /opt/lavamusic/prisma
└── docker_lavamusic-logs ← Your logs
    Mount: /opt/lavamusic/logs
```
(The `docker_` / `lavamusic_` prefix depends on the Compose project name.)

## Comparison

### Option A: Named Volumes (used by LavaMusic) ⭐
```yaml
volumes:
  - lavamusic-logs:/opt/lavamusic/logs
  - lavamusic-db:/opt/lavamusic/prisma

volumes:
  lavamusic-logs:
  lavamusic-db:
```
**Pros:**
- ✅ Easy to identify in Portainer
- ✅ Easy to back up a specific volume
- ✅ Can reference by name
- ✅ Survives rebuilds with a stable name

**Cons:**
- Requires explicit mounts in docker-compose

### Option B: Anonymous Volumes (NOT used here)
An alternative is a `VOLUME` directive in the Dockerfile:
```dockerfile
VOLUME ["/opt/lavamusic/prisma", "/opt/lavamusic/logs"]
```
**Pros:**
- ✅ No mount configuration needed in docker-compose
- ✅ Created automatically

**Cons:**
- ❌ Random hash names — hard to tell which is which
- ❌ A new anonymous volume can appear on rebuilds
- ❌ Harder to back up/reference

> LavaMusic intentionally does **not** use this approach. The Dockerfiles contain no
> `VOLUME` directive.

## Finding Your Volumes in Portainer

1. Go to **Portainer → Volumes**
2. Look for `…_lavamusic-db` and `…_lavamusic-logs`
3. The one mounted at `/opt/lavamusic/prisma` holds the database (`lavamusic.db`)

Or use Container Inspect:
1. **Containers** → `lavamusic` → **Inspect**
2. Scroll to the "Mounts" section
3. Confirm the named volumes and their mount points

## Backup

### Back up the database file directly:
```bash
docker cp lavamusic:/opt/lavamusic/prisma/lavamusic.db ./backup.db
```

### Back up the whole named volume:
```bash
docker run --rm -v docker_lavamusic-db:/source -v "$(pwd)":/backup alpine \
  tar czf /backup/database-backup.tar.gz -C /source .
```
(Use the actual prefixed volume name from `docker volume ls`.)

## Why Named Volumes

1. ✅ Much easier to manage in Portainer
2. ✅ Clear which volume contains what
3. ✅ Easier to back up specific volumes
4. ✅ Better for long-term maintenance

The "extra" configuration of specifying mounts is a **good** thing — it makes persistence
explicit and stable. See `docs/DOCKER_DATABASE_PERSISTENCE.md` and
`docs/PORTAINER_VOLUME_MANAGEMENT.md` for the full setup.
