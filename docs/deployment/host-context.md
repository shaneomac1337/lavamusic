# Host Context — shared server

lavamusic does not have the box to itself. The production host `komplexaci` runs several
unrelated stacks; this matters mostly for **RAM budgeting** and port allocation, since the
lavamusic stack uses `network_mode: host`.

## Neighbor containers (snapshot 2026-06-12)

| Container | Image | Purpose | Ports |
|---|---|---|---|
| `komplexaci-web` | `ghcr.io/shaneomac1337/komplexaci_js:latest` | main komplexaci.cz website | behind nginx |
| `trackmania-dedicated-1` | `evoesports/trackmania:latest` | Trackmania game server | 2350 tcp/udp |
| `trackmania-pyplanet-1` | `ghcr.io/shaneomac1337/pyplanet:nightly` | Trackmania server controller | 8080 |
| `trackmania-db-1` | `mariadb:latest` | Trackmania database | 3306 (internal) |
| `portainer` | `portainer/portainer-ce:latest` | Docker management UI | 8000, 9443 |
| `jackett` | `lscr.io/linuxserver/jackett:latest` | torrent indexer proxy | 9117 |

Host nginx also serves vhosts for `komplexaci.cz`, `tm-music.komplexaci.cz`, jackett and
portainer alongside `music.komplexaci.cz`.

## Resource constraints

- **RAM: 3.8 GiB total** — at snapshot time ~2.3 GiB used, ~1.5 GiB available (incl. cache).
  Lavalink alone may claim up to **2 GiB heap** (`-Xmx2G`); the JVM, Node bot, MariaDB,
  Trackmania and the website all compete for the rest. This is the tightest constraint on the
  box — adding memory-hungry services or raising the Lavalink heap risks OOM.
- **Disk: 40 GiB**, ~51% used at snapshot time.
- **Ports**: lavamusic's host networking means 2333 (Lavalink) and 3001 (dashboard) are claimed
  directly on the host — any new service must avoid them.
