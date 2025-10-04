# Managing LavaMusic Volumes in Portainer

## What Are Named Docker Volumes?

Named volumes are Docker-managed storage that:
- ✅ Appear in Portainer's Volume list
- ✅ Persist independently of containers
- ✅ Can be browsed, backed up, and restored via Portainer
- ✅ Are managed by Docker (not host file paths)

## Your LavaMusic Volumes

After deploying with the updated `docker-compose.yml`, you'll see **2 volumes** in Portainer:

### 1. `docker_lavamusic-logs` or `lavamusic_lavamusic-logs`
**Contains:** Bot logs
**Path in Container:** `/opt/lavamusic/logs/`
**Size:** Variable (grows over time)

### 2. `docker_lavamusic-db` or `lavamusic_lavamusic-db` ⭐
**Contains:** SQLite database (ALL PLAYLISTS!)
**Path in Container:** `/opt/lavamusic/prisma/`
**Size:** ~100KB - 10MB
**Critical:** ⚠️ DO NOT DELETE without backup!

## Viewing Volumes in Portainer

### Step 1: Navigate to Volumes
```
Portainer Dashboard
└── Volumes (left sidebar)
    └── You'll see all Docker volumes listed
```

### Step 2: Find LavaMusic Volumes
Look for volumes named:
- `docker_lavamusic-logs`
- `docker_lavamusic-db` ⭐ (This is your playlists!)

Or with prefix matching your compose project name:
- `lavamusic_lavamusic-logs`
- `lavamusic_lavamusic-db`

## Browsing Volume Contents in Portainer

### Method 1: Using Portainer's Volume Browser
1. Click on the volume name (e.g., `docker_lavamusic-db`)
2. Portainer shows:
   - Volume details
   - Mount point on host
   - Containers using it
3. Some Portainer versions allow browsing files directly

### Method 2: Using Container Console
1. Go to **Containers**
2. Click on `lavamusic` container
3. Click **Console** button
4. Select `/bin/sh` or `/bin/bash`
5. Click **Connect**
6. Navigate to volume:
   ```sh
   cd /opt/lavamusic/prisma
   ls -lh
   ```

You'll see:
```
lavamusic.db       ← Your playlists database!
lavamusic.db-shm   ← SQLite temp file
lavamusic.db-wal   ← Write-ahead log
schema.prisma      ← Schema definition
migrations/        ← Migration history
```

## Backing Up Volumes in Portainer

### Method 1: Download Volume (Easy!)
Some Portainer versions support direct download:

1. **Volumes** → Select `docker_lavamusic-db`
2. Look for **Download** or **Export** button
3. Save the backup file

### Method 2: Using Container Console
1. **Containers** → `lavamusic` → **Console**
2. Create a backup inside container:
   ```sh
   cd /opt/lavamusic/prisma
   cp lavamusic.db lavamusic-backup.db
   ```
3. Download from Portainer file browser (if available)

### Method 3: Using Portainer's Stack/Container Features
1. Add a temporary container to access the volume:
   ```yaml
   services:
     backup-helper:
       image: alpine
       command: sleep 3600
       volumes:
         - lavamusic-db:/backup
   ```
2. Access this container's console
3. Copy files from `/backup/`

### Method 4: Docker CLI (Recommended)
Even with Portainer, you can use Docker CLI:
```bash
# Backup database
docker run --rm -v docker_lavamusic-db:/source -v $(pwd):/backup alpine \
  cp /source/lavamusic.db /backup/playlist-backup.db

# Or using docker cp (simpler)
docker cp lavamusic:/opt/lavamusic/prisma/lavamusic.db ./playlist-backup.db
```

## Restoring Volume in Portainer

### Method 1: Replace Container Files
1. Stop the `lavamusic` container in Portainer
2. Start a temporary container with the volume:
   ```bash
   docker run --rm -it -v docker_lavamusic-db:/data alpine sh
   ```
3. Inside container, remove old database:
   ```sh
   rm /data/lavamusic.db
   ```
4. Copy your backup file (via host or docker cp):
   ```bash
   # From host terminal
   docker cp ./playlist-backup.db <temp-container-id>:/data/lavamusic.db
   ```
5. Exit temp container and restart `lavamusic`

### Method 2: Volume Clone/Replace
1. **Stop container** in Portainer
2. **Create new volume** from backup
3. **Update compose file** to use new volume
4. **Redeploy stack**

## Checking Volume in Portainer

### Via Container Stats
1. **Containers** → `lavamusic`
2. Click **Stats**
3. See volume usage under "Mounts"

### Via Volume Details
1. **Volumes** → `docker_lavamusic-db`
2. View:
   - Size on disk
   - Mount point
   - Containers using it
   - Created date

### Via Container Inspect
1. **Containers** → `lavamusic` → **Inspect**
2. Scroll to "Mounts" section
3. See volume configuration:
   ```json
   {
     "Type": "volume",
     "Name": "docker_lavamusic-db",
     "Source": "/var/lib/docker/volumes/docker_lavamusic-db/_data",
     "Destination": "/opt/lavamusic/prisma",
     "RW": true
   }
   ```

## Database Operations in Portainer Console

### Count Playlists
```sh
# In Portainer console for lavamusic container
apk add --no-cache sqlite
sqlite3 /opt/lavamusic/prisma/lavamusic.db "SELECT COUNT(*) FROM Playlist;"
```

### List All Playlists
```sh
sqlite3 /opt/lavamusic/prisma/lavamusic.db "SELECT name, userId, isPublic, trackCount FROM Playlist;"
```

### Check Database Size
```sh
du -sh /opt/lavamusic/prisma/lavamusic.db
```

### Export Database to SQL
```sh
sqlite3 /opt/lavamusic/prisma/lavamusic.db .dump > /opt/lavamusic/logs/database-export.sql
# Then download from logs volume via Portainer
```

## Volume Lifecycle in Portainer

### When You Redeploy Stack
1. **Volumes persist** automatically
2. Container is recreated
3. Volume is reattached
4. ✅ All playlists remain intact

### When You Delete Stack
**In Portainer Stack interface:**
- **Delete stack** → Volumes remain! ✅
- Need to manually delete volumes separately

**In terminal with `docker-compose down -v`:**
- Volumes are deleted! ⚠️ (don't use `-v` flag)

### When You Delete Container
- Volume persists
- Can be attached to new container
- Data is safe

### When You Delete Volume
- ⚠️ **PERMANENT DATA LOSS!**
- All playlists are deleted
- Cannot be recovered (unless you have backup)

## Portainer Stack Configuration

Your current `docker-compose.yml` in Portainer should show:

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
      - lavamusic-db:/opt/lavamusic/prisma  # ← Database volume!
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  lavamusic-logs:
    driver: local
  lavamusic-db:  # ← This creates the named volume
    driver: local
```

## Quick Actions in Portainer

### Check if Volume Exists
**Volumes** → Search for `lavamusic-db`

### See Which Containers Use Volume
**Volumes** → Click volume → "Used by" section

### Update Stack with Volume Preservation
1. **Stacks** → `lavamusic` (or your stack name)
2. Click **Editor**
3. Make changes (keep volumes section!)
4. Click **Update the stack**
5. ✅ Volumes automatically persist

### Create Manual Backup
1. **Containers** → `lavamusic` → **Console**
2. Run:
   ```sh
   cp /opt/lavamusic/prisma/lavamusic.db /opt/lavamusic/logs/backup-$(date +%Y%m%d).db
   ```
3. Backup is now in logs volume (accessible via Portainer)

## Volume Location on Host

You can find where Docker stores the volume:

1. **Volumes** → `docker_lavamusic-db` → **Inspect**
2. Look for "Mountpoint":
   ```json
   "Mountpoint": "/var/lib/docker/volumes/docker_lavamusic-db/_data"
   ```

On Linux host, you can directly access:
```bash
sudo ls -lh /var/lib/docker/volumes/docker_lavamusic-db/_data/
```

On Windows with Docker Desktop:
- Volumes are in WSL2 filesystem
- Accessible via: `\\wsl$\docker-desktop-data\version-pack-data\community\docker\volumes\`

## Automated Backup via Portainer

You can create a backup schedule using Portainer:

### Method 1: Webhook + Cron
1. Create a backup container in your stack:
   ```yaml
   backup:
     image: alpine
     volumes:
       - lavamusic-db:/source:ro
       - lavamusic-logs:/backup
     command: sh -c "while true; do cp /source/lavamusic.db /backup/backup-$(date +%Y%m%d-%H%M%S).db && sleep 86400; done"
   ```

### Method 2: Portainer Custom Template
Create a custom container that runs daily backups

## Troubleshooting in Portainer

### Volume Shows 0 Bytes
- Volume is newly created and empty
- Deploy/start container to initialize

### Can't See Volume Contents
- Use container console instead
- Or use temporary alpine container to mount volume

### Volume Not Mounting
1. Check container logs in Portainer
2. Verify volume exists: **Volumes** list
3. Check stack file syntax
4. Redeploy stack

### Accidentally Deleted Volume
- ❌ Data is lost permanently
- Restore from backup if available
- Recreate volume (will be empty)

## Best Practices with Portainer

### ✅ DO:
- Name volumes descriptively
- Add labels to volumes for organization
- Keep volumes when deleting stacks
- Regularly check volume sizes
- Export database backups to logs volume

### ❌ DON'T:
- Delete volumes without checking contents
- Use `docker-compose down -v` in Portainer terminal
- Store volumes on network shares (performance)
- Forget to backup before major updates

## Summary: Portainer + LavaMusic Volumes

| Volume Name | Contains | Visible in Portainer | Backup Priority |
|-------------|----------|---------------------|-----------------|
| `docker_lavamusic-logs` | Bot logs | ✅ Yes | Medium |
| `docker_lavamusic-db` | Playlists & Settings | ✅ Yes | ⚠️ **CRITICAL** |

**In Portainer, you'll see:**
- 📊 Volume size and usage
- 🔍 Containers using each volume
- 📁 Mount points and paths
- ⚡ Quick access to container console

Everything is already configured to work perfectly with Portainer! 🎉
