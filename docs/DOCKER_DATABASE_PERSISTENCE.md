# Docker Deployment - Database Persistence Guide

## Where Are Playlists Stored?

### Database Location
**Playlists are stored in a SQLite database file:**
```
📁 prisma/lavamusic.db
```

### What's Stored in the Database
The `lavamusic.db` file contains:
- ✅ **Playlists** - All user playlists with tracks, descriptions, privacy settings
- ✅ **User Preferences** - Preferred search sources
- ✅ **Guild Settings** - Prefix, language, text channel preferences
- ✅ **DJ Settings** - DJ mode configuration
- ✅ **24/7 Mode** - Voice channel persistence settings
- ✅ **Setup Channels** - Setup message configurations

### Database Persistence ✅
**The shipped compose files already persist the database.**

Both `docker/docker-compose.yml` and `docker-compose.standalone.yml` mount the
named `lavamusic-db` volume at `/opt/lavamusic/prisma`, so the following survive
container restarts and recreation:
- ✅ All playlists
- ✅ User preferences
- ✅ Guild settings

## How the Database Is Persisted with Docker Volumes

### Option 1: Named Volume (used by default)
The shipped `docker-compose.yml` already contains this configuration:

```yaml
version: '3.8'

services:
  lavamusic:
    build:
      context: .
      dockerfile: Dockerfile
    image: lavamusic:latest
    container_name: lavamusic
    restart: unless-stopped
    network_mode: host
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WEB_DASHBOARD=true
      - DASHBOARD_PORT=3001
    env_file:
      - .env
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - lavamusic-logs:/opt/lavamusic/logs
      - lavamusic-db:/opt/lavamusic/prisma  # ← Persists the database
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  lavamusic-logs:
    driver: local
  lavamusic-db:  # ← The named database volume
    driver: local
```

### Option 2: Bind Mount (Host Path)
If you want the database file on your host machine for easy backup:

```yaml
volumes:
  - /etc/localtime:/etc/localtime:ro
  - lavamusic-logs:/opt/lavamusic/logs
  - ./data/prisma:/opt/lavamusic/prisma  # ← Bind to host directory
```

Create the directory first:
```bash
mkdir -p ./data/prisma
```

## Database File Structure

```
lavamusic/
├── prisma/
│   ├── lavamusic.db          ← Main database file (THIS IS WHAT YOU NEED TO PERSIST!)
│   ├── lavamusic.db-shm      ← SQLite shared memory (temporary)
│   ├── lavamusic.db-wal      ← Write-ahead log (temporary)
│   └── schema.prisma         ← Schema definition
```

**Important:** The entire `prisma/` directory should be persisted to keep the database files.

## Docker Commands for Database Management

### Check Database Size
```bash
# Inside container
docker exec lavamusic du -sh /opt/lavamusic/prisma/lavamusic.db

# From host (if using bind mount)
du -sh ./data/prisma/lavamusic.db
```

### Backup Database
```bash
# Copy database from container to host
docker cp lavamusic:/opt/lavamusic/prisma/lavamusic.db ./backup-$(date +%Y%m%d).db

# Restore database
docker cp ./backup-20250104.db lavamusic:/opt/lavamusic/prisma/lavamusic.db
```

### View Database Contents
```bash
# Install sqlite3 in container (temporary)
docker exec -it lavamusic apk add --no-cache sqlite

# Query playlists
docker exec lavamusic sqlite3 /opt/lavamusic/prisma/lavamusic.db "SELECT COUNT(*) FROM Playlist;"

# View all playlists
docker exec lavamusic sqlite3 /opt/lavamusic/prisma/lavamusic.db "SELECT name, userId, isPublic FROM Playlist;"
```

### Export/Import Database
```bash
# Export to SQL dump
docker exec lavamusic sqlite3 /opt/lavamusic/prisma/lavamusic.db .dump > lavamusic-dump.sql

# Import from SQL dump
cat lavamusic-dump.sql | docker exec -i lavamusic sqlite3 /opt/lavamusic/prisma/lavamusic.db
```

## Deployment Scenarios

### Scenario 1: Fresh Deployment
```bash
# 1. Build and start
docker-compose up -d

# 2. The image entrypoint runs `npx prisma migrate deploy` then `npx prisma generate` on startup
# Playlists will be saved and persist across restarts
```

### Scenario 2: Update Code (Keep Data)
```bash
# 1. Stop container
docker-compose down

# 2. Rebuild with new code
docker-compose build --no-cache

# 3. Start with existing data
docker-compose up -d

# ✅ All playlists and settings are preserved!
```

### Scenario 3: Reset Everything (Delete All Data)
```bash
# 1. Stop and remove container
docker-compose down

# 2. Remove database volume
docker volume rm lavamusic_lavamusic-db

# 3. Start fresh
docker-compose up -d

# ⚠️ All playlists, settings, and data are DELETED!
```

### Scenario 4: Reset Code but Keep Playlists
```bash
# 1. Backup database first
docker cp lavamusic:/opt/lavamusic/prisma/lavamusic.db ./playlist-backup.db

# 2. Rebuild everything
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 3. If database was deleted, restore it
docker cp ./playlist-backup.db lavamusic:/opt/lavamusic/prisma/lavamusic.db

# 4. Restart to apply
docker-compose restart
```

## Recommended docker-compose.yml (Full)

```yaml
version: '3.8'

services:
  lavamusic:
    build:
      context: .
      dockerfile: Dockerfile
    image: lavamusic:latest
    container_name: lavamusic
    restart: unless-stopped
    network_mode: host
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WEB_DASHBOARD=true
      - DASHBOARD_PORT=3001
    env_file:
      - .env
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - lavamusic-logs:/opt/lavamusic/logs
      - lavamusic-db:/opt/lavamusic/prisma  # Persist database
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  lavamusic-logs:
    driver: local
    # Persist logs
  lavamusic-db:
    driver: local
    # Persist database (playlists, settings, etc.)
```

## Backup Strategy

### Automated Backup Script
Create `backup-database.sh`:

```bash
#!/bin/bash
# Backup LavaMusic database

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/lavamusic-$DATE.db"

mkdir -p "$BACKUP_DIR"

# Copy database from container
docker cp lavamusic:/opt/lavamusic/prisma/lavamusic.db "$BACKUP_FILE"

echo "✅ Database backed up to: $BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "lavamusic-*.db" -mtime +7 -delete
```

### Cron Job for Daily Backups
```bash
# Add to crontab (crontab -e)
0 3 * * * /path/to/backup-database.sh
```

## Schema Updates

The Docker images that the compose files build (`docker/Dockerfile` via
`docker/docker-compose.yml`, and `Dockerfile.standalone` via
`docker-compose.standalone.yml`) bake an **inline** entrypoint script into the
image. On startup it runs:

```sh
npx prisma migrate deploy
npx prisma generate
```

Note: the repo has **no `prisma/migrations/` directory**, so `prisma migrate
deploy` applies no migration files. (Separately, `docker/docker-entrypoint.sh` —
which runs `npx prisma db push --accept-data-loss --skip-generate` — is only used
by `Dockerfile.clean`, which is not referenced by either compose file.)

### When Schema Changes (New Features)
```bash
# 1. Pull new code
git pull

# 2. Rebuild container
docker-compose build

# 3. Start (the image entrypoint runs `prisma migrate deploy` + `prisma generate`)
docker-compose up -d

# ✅ The named database volume preserves all existing data (playlists) across rebuilds.
```

### Manual Schema Sync
If you need to sync the schema to the database manually inside the container:

```bash
# Enter container
docker exec -it lavamusic sh

# Sync the schema (schema-push, matches the local `npm run db:push`)
npx prisma db push
```

> Note: `npm run db:push` runs `prisma db push` and `npm run db:migrate` runs
> `prisma migrate dev --name init`; these are the local workflows. The Docker
> images use `prisma migrate deploy` as shown above.

## Troubleshooting

### Database is Locked
```bash
# Stop container
docker-compose down

# Remove lock files
docker volume rm lavamusic_lavamusic-db

# Start with backup
docker cp ./backup.db lavamusic:/opt/lavamusic/prisma/lavamusic.db
docker-compose up -d
```

### Database Corruption
```bash
# 1. Stop container
docker-compose down

# 2. Try to repair
docker run --rm -v lavamusic_lavamusic-db:/db alpine sh -c "sqlite3 /db/lavamusic.db .recover > /db/recovered.sql"

# 3. Import recovered data
docker-compose up -d
docker exec -i lavamusic sqlite3 /opt/lavamusic/prisma/lavamusic.db < recovered.sql
```

### Check Volume Usage
```bash
# List volumes
docker volume ls

# Inspect database volume
docker volume inspect lavamusic_lavamusic-db

# See where it's stored on host
docker volume inspect lavamusic_lavamusic-db | grep Mountpoint
```

## Summary

### ✅ DO:
- Persist the `prisma/` directory with Docker volumes
- Backup database regularly before updates
- Use named volumes for production
- Monitor database size

### ❌ DON'T:
- Delete volumes without backup
- Store database in container without volume
- Run `docker-compose down -v` (removes volumes)
- Forget to backup before major updates

### Quick Checklist:
- [ ] Added volume for `/opt/lavamusic/prisma`
- [ ] Tested container restart (data persists)
- [ ] Set up backup strategy
- [ ] Documented backup location
- [ ] Tested restore procedure

## File Locations Summary

| Item | Location in Container | Persist? | Size |
|------|----------------------|----------|------|
| Database | `/opt/lavamusic/prisma/lavamusic.db` | ✅ YES | ~100KB-10MB |
| Logs | `/opt/lavamusic/logs/` | ✅ YES | Variable |
| Code | `/opt/lavamusic/` | ❌ NO (rebuilt) | - |
| Node Modules | `/opt/lavamusic/node_modules/` | ❌ NO (rebuilt) | - |
| Config | `.env` | ✅ YES (env_file) | <1KB |
