# Standalone Deployment Guide - Run from Any Location

This guide is for deploying LavaMusic from **any location** without needing the full repository structure.

## What You Need

Only **3 files**:
1. `Dockerfile.standalone` (or any Dockerfile)
2. `docker-compose.standalone.yml` (or rename to `docker-compose.yml`)
3. `.env` (your environment variables)

## Setup on Your Server

### Step 1: Create Deployment Directory
```bash
mkdir -p /opt/lavamusic
cd /opt/lavamusic
```

### Step 2: Copy Files
Copy these 3 files to your server. The repo ships `Dockerfile.standalone` and
`docker-compose.standalone.yml`; you can either keep those names or rename them
to `Dockerfile` / `docker-compose.yml` as shown:
```
/opt/lavamusic/
├── Dockerfile              ← Renamed copy of Dockerfile.standalone
├── docker-compose.yml      ← Renamed copy of docker-compose.standalone.yml
└── .env                    ← Your bot configuration
```

### Step 3: Create .env File
```bash
nano .env
```

Add your configuration:
```env
# Discord Bot
TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

# Lavalink (single JSON array; id/host/port/authorization are required)
NODES=[{"id":"Local Node","host":"localhost","port":2333,"authorization":"youshallnotpass","secure":"false"}]

# Database (SQLite - no configuration needed)
DATABASE_URL=file:./lavamusic.db

# Web Dashboard
WEB_DASHBOARD=true
DASHBOARD_PORT=3001
DASHBOARD_SECRET=your_random_jwt_secret_here   # auto-generated if left empty

# Discord OAuth (for dashboard login)
CLIENT_SECRET=your_discord_client_secret
DASHBOARD_BASE_URL=http://your-server-ip:3001   # OAuth callback is <base>/auth/discord/callback
```

### Step 4: Build the Image
```bash
# Build from the shipped Dockerfile.standalone
docker build -f Dockerfile.standalone -t lavamusic:latest .

# Or, if you renamed it to Dockerfile
docker build -f Dockerfile -t lavamusic:latest .
```

### Step 5: Start the Bot
```bash
docker-compose up -d
```

## Using Portainer

### Method 1: Upload via Portainer UI

1. Go to **Portainer → Stacks → Add Stack**
2. Name it: `lavamusic`
3. **Build method**: Upload
4. Upload your `docker-compose.yml` content
5. Add environment variables or upload `.env`
6. Click **Deploy**

### Method 2: Git Repository (Recommended)

If you push to your GitHub repo:

1. **Portainer → Stacks → Add Stack**
2. **Build method**: Git Repository
3. **Repository URL**: `https://github.com/shaneomac1337/lavamusic`
4. **Compose path**: `docker-compose.standalone.yml`
5. **Environment variables**: Add or use `.env`
6. Click **Deploy**

### Method 3: Custom Image (No Build)

First build the image separately:
```bash
docker build -f Dockerfile.standalone -t lavamusic:latest .
docker push your-registry/lavamusic:latest  # Optional: push to registry
```

Then in Portainer, just use the pre-built image in your stack.

## File Structure Options

### Option A: Minimal (Recommended)
```
/opt/lavamusic/
├── docker-compose.yml
└── .env
```
Uses pre-built image: `lavamusic:latest`

### Option B: Build from Source
```
/opt/lavamusic/
├── Dockerfile          ← renamed copy of Dockerfile.standalone
├── docker-compose.yml
└── .env
```
Builds the image during deployment. Note: `Dockerfile.standalone` does **not**
use your local files — it `git clone`s the repo (`main` branch) from GitHub
inside the build, so the build always reflects the latest pushed `main`.

### Option C: Full Repo Clone
```
/opt/lavamusic/
├── (entire repository)
└── docker/
    ├── Dockerfile
    └── docker-compose.yml
```
Use original files from `docker/` folder

## docker-compose.yml Configuration

### If Using Pre-built Image:
```yaml
version: '3.8'

services:
  lavamusic:
    image: lavamusic:latest  # ← Pre-built image
    container_name: lavamusic
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    volumes:
      - lavamusic-logs:/opt/lavamusic/logs
      - lavamusic-db:/opt/lavamusic/prisma

volumes:
  lavamusic-logs:
  lavamusic-db:
```

### If Building from Dockerfile:
(Set `dockerfile:` to whatever you named the file — `Dockerfile.standalone` as
shipped, or `Dockerfile` if you renamed it.)
```yaml
version: '3.8'

services:
  lavamusic:
    build:
      context: .
      dockerfile: Dockerfile  # ← or Dockerfile.standalone
    image: lavamusic:latest
    container_name: lavamusic
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    volumes:
      - lavamusic-logs:/opt/lavamusic/logs
      - lavamusic-db:/opt/lavamusic/prisma

volumes:
  lavamusic-logs:
  lavamusic-db:
```

## Volumes in Portainer

After deployment, you'll see in **Portainer → Volumes**:
- **`lavamusic_lavamusic-logs`** - Bot logs
- **`lavamusic_lavamusic-db`** ⭐ - **Your playlists database!**

## Common Deployment Scenarios

### Scenario 1: Fresh Install (Simplest)
```bash
# 1. Create directory
mkdir /opt/lavamusic && cd /opt/lavamusic

# 2. Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  lavamusic:
    image: lavamusic:latest
    container_name: lavamusic
    restart: unless-stopped
    network_mode: host
    env_file: [".env"]
    volumes:
      - lavamusic-logs:/opt/lavamusic/logs
      - lavamusic-db:/opt/lavamusic/prisma
volumes:
  lavamusic-logs:
  lavamusic-db:
EOF

# 3. Create .env with your settings
nano .env

# 4. Pull/build image
docker pull lavamusic:latest  # If available
# OR build it first on your dev machine and export

# 5. Start
docker-compose up -d
```

### Scenario 2: Deploy via Portainer Stack
1. Copy content of `docker-compose.standalone.yml`
2. **Portainer → Stacks → Add Stack**
3. Paste the content
4. Add environment variables
5. Deploy

### Scenario 3: Update Existing Deployment
```bash
cd /opt/lavamusic

# Stop container
docker-compose down

# Pull new image or rebuild
docker pull lavamusic:latest  # If using remote image
# OR
docker build -t lavamusic:latest .  # If building locally

# Start with new image (volumes persist!)
docker-compose up -d
```

## Building the Image Separately

If you want to build once and use everywhere:

### On Your Dev Machine:
```bash
cd /path/to/lavamusic/repo

# Build
docker build -f Dockerfile.standalone -t lavamusic:latest .

# Save to file
docker save lavamusic:latest | gzip > lavamusic-image.tar.gz

# Transfer to server
scp lavamusic-image.tar.gz user@server:/tmp/
```

### On Your Server:
```bash
# Load image
docker load < /tmp/lavamusic-image.tar.gz

# Now you can use it
cd /opt/lavamusic
docker-compose up -d
```

## No Docker Folder Structure Needed! ✅

The standalone files work from **any location**:
- ✅ `/opt/lavamusic/` (recommended)
- ✅ `/home/user/bots/lavamusic/`
- ✅ Anywhere on your server
- ✅ No need for the full repo structure
- ✅ No `docker/` folder required

## Environment Variables

Required in `.env`:
```env
TOKEN=              # Discord bot token
CLIENT_ID=          # Discord application ID
NODES=              # Lavalink nodes as a JSON array (id/host/port/authorization required)
```

Optional:
```env
GUILD_ID=           # Your server ID (for slash commands)
WEB_DASHBOARD=true  # Enable web dashboard
DASHBOARD_PORT=3001 # Dashboard port
CLIENT_SECRET=      # For OAuth login
DASHBOARD_BASE_URL= # Public base URL; OAuth callback is <base>/auth/discord/callback
DASHBOARD_SECRET=   # JWT secret (auto-generated if empty)
```

## Troubleshooting

### Image Not Found
```bash
# Make sure image is built or pulled
docker images | grep lavamusic

# Build if needed
docker build -t lavamusic:latest .
```

### Can't Find .env
```bash
# Check .env is in same directory as docker-compose.yml
ls -la .env

# Check file is readable
cat .env
```

### Volumes Not Persisting
```bash
# Check volumes exist
docker volume ls | grep lavamusic

# Inspect volume
docker volume inspect lavamusic_lavamusic-db
```

### Need to Reset Everything
```bash
docker-compose down
docker volume rm lavamusic_lavamusic-db lavamusic_lavamusic-logs
docker-compose up -d
```

## Summary

**What you need on server:**
- 1 file: `docker-compose.yml` (if using pre-built image)
- 2 files: `docker-compose.yml` + `Dockerfile` (if building)
- Always: `.env` file with your configuration

**What you DON'T need:**
- ❌ Full repository
- ❌ Source code
- ❌ `docker/` folder structure
- ❌ Git clone

**Volumes are automatically managed** and will appear in Portainer! 🎉
