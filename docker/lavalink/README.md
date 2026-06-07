# Lavalink config & runtime (Docker)

The `lavalink` service in the root `docker-compose.yml` runs the official
`ghcr.io/lavalink-devs/lavalink` image, which executes as **uid/gid 322**.

## Files here

- `application.example.yml` — committed template. Copy it to `application.yml`
  (gitignored) and fill in your Lavalink password and source credentials.
- `application.yml` — your real config (gitignored; may contain secrets).
- `plugins/`, `logs/` — bind-mounted into the container so downloaded plugins
  and logs persist across restarts. Contents are gitignored (only `.gitkeep`
  is tracked).

## One-time permission setup

Because the image runs as uid 322, the bind-mounted dirs must be writable by
that uid, or Lavalink fails to download plugins (`Permission denied`):

```sh
sudo chown -R 322:322 docker/lavalink/plugins docker/lavalink/logs
```

Run this once after cloning (the dirs are created root-owned on checkout).
`git pull` does not change their ownership afterwards.
