# Lavalink Server Setup

LavaMusic uses [Lavalink](https://lavalink.dev/) as its audio server. Lavalink runs
as a Docker service defined in the repo's root `docker-compose.yml` using the
**official Lavalink image** — there is no local jar to download or manage.

## 🚀 Quick Start

### 1. Configure

Copy the example config and edit it (the real `application.yml` is gitignored):

```bash
cp docker/lavalink/application.example.yml docker/lavalink/application.yml
```

Edit `docker/lavalink/application.yml` to set the server password and any source
credentials (Spotify, Deezer, etc.). The default password is `youshallnotpass` —
change it for any non-local deployment.

### 2. Start

Bring up the whole stack (Lavalink + the bot):

```bash
docker compose up -d
```

Or start just Lavalink:

```bash
docker compose up -d lavalink
```

### Server Information

- **Image**: `ghcr.io/lavalink-devs/lavalink:4.2.2`
- **Port**: 2333 (`SERVER_PORT`)
- **Address**: 0.0.0.0 (`SERVER_ADDRESS`), uses `network_mode: host`
- **Heap**: `_JAVA_OPTIONS=-Xmx2G`
- **Password**: `youshallnotpass` (set in `application.yml`)

## ⚙️ How It Works

The `lavalink` service mounts your config read-only into the container:

- `./docker/lavalink/application.yml` → `/opt/Lavalink/application.yml:ro`

Named volumes persist logs and downloaded plugins across restarts:

- `lavalink-logs` → `/opt/Lavalink/logs`
- `lavalink-plugins` → `/opt/Lavalink/plugins`

### Plugins (auto-downloaded)

You do **not** manage plugin jars manually. The official image reads the
`lavalink.plugins:` section of `application.yml` and downloads each declared
plugin on startup. To add, remove, or upgrade a plugin, edit that section and
restart the container.

Plugins declared in `application.example.yml`:

1. **jiosaavn-plugin** (1.0.3) — JioSaavn source
2. **skybot-lavalink-plugin** / DuncteBot (1.7.0) — extra sources (getyarn, clyp.it, TikTok, Reddit, Mixcloud, etc.) and the DuncteBot TTS source
3. **lavasearch-plugin** (1.0.0) — advanced search capabilities
4. **lavasrc-plugin** (4.8.3) — Spotify, Apple Music, Deezer, Yandex Music, VK Music sources (all disabled by default in the example; enable + add credentials as needed)
5. **sponsorblock-plugin** (3.0.1) — skip sponsored segments
6. **youtube-plugin** (1.12.0) — YouTube playback (the built-in Lavalink YouTube source is disabled in favor of this plugin)

> FloweryTTS is handled by the bot directly via HTTP, not through Lavalink — the
> lavasrc `flowerytts` source is disabled in the example config.

### Sources Enabled (example config)

- ✓ YouTube (via the youtube-plugin)
- ✓ SoundCloud
- ✓ Bandcamp
- ✓ Twitch
- ✓ Vimeo
- ✓ Nico
- ✓ HTTP streams
- ✓ DuncteBot sources / TTS

Spotify, Apple Music, Deezer, Yandex Music and VK Music are present via lavasrc
but **disabled by default** — enable them and supply credentials in
`application.yml`.

## ✅ Checking Health

The compose healthcheck polls `http://localhost:2333/version` with the
`Authorization: youshallnotpass` header. Check status with:

```bash
docker compose ps          # shows the lavalink service health column
docker compose logs -f lavalink
```

Or query the version endpoint directly:

```bash
curl -H "Authorization: youshallnotpass" http://localhost:2333/version
# Response: {"version":"4.2.2", ...}
```

## 🔄 Changing the Lavalink Version

Edit the image tag in `docker-compose.yml`:

```yaml
lavalink:
  image: ghcr.io/lavalink-devs/lavalink:4.2.2   # change this tag
```

Then pull and recreate:

```bash
docker compose pull lavalink
docker compose up -d lavalink
```

## 🔧 Updating Configuration

Edit `docker/lavalink/application.yml`, then restart the service:

```bash
docker compose restart lavalink
```

(The config is mounted read-only into the container, so changes on the host take
effect on the next restart.)

## 📝 Common Issues

### Port Already in Use

Because the service uses `network_mode: host`, Lavalink binds port 2333 directly
on the host. If it's taken:

1. Change `server.port` in `application.yml` (and `SERVER_PORT` in
   `docker-compose.yml`)
2. Update the bot's `NODES` value in `.env` to match

### Plugins Not Loading

- Ensure the container has internet access (plugins download on startup)
- Check the logs: `docker compose logs lavalink`
- Plugin downloads are cached in the `lavalink-plugins` volume

### YouTube Issues

- OAuth is disabled by default in the example; enable it under `plugins.youtube.oauth`
  if needed
- On first OAuth start, check the logs for the `google.com/device` code link
- Use a burner Google account (ban risk)

## 🆘 Need Help?

- [Lavalink Documentation](https://lavalink.dev/)
- [Lavalink GitHub](https://github.com/lavalink-devs/Lavalink)
- [LavaMusic Discord](https://discord.gg/YQsGbTwPBx)

## 🔐 Security Note

⚠️ **Important**: Never expose your Lavalink server to the public internet!

- Change the default `youshallnotpass` password in `application.yml`
- Use firewall rules to restrict access to port 2333
- Consider a reverse proxy with rate limiting
