# 📚 LavaMusic Documentation

Guides for configuring, deploying, and using the LavaMusic Discord bot and its web dashboard.

## 📖 Documentation

### 🎛️ Dashboard & Web Interface
- **[DASHBOARD.md](./DASHBOARD.md)** — Dashboard setup, routes, real-time events, and customization (Tailwind build)
- **[ADVANCED_DASHBOARD_FEATURES.md](./ADVANCED_DASHBOARD_FEATURES.md)** — Player/queue/settings API reference (force-play, seek, repeat, fairplay, queue move/jump/clear/shuffle, channels, settings)
- **[DASHBOARD_SECRET_EXPLAINED.md](./DASHBOARD_SECRET_EXPLAINED.md)** — `DASHBOARD_SECRET` (JWT) configuration
- **[TTS_DASHBOARD_INTEGRATION.md](./TTS_DASHBOARD_INTEGRATION.md)** — Text-to-Speech panel in the dashboard

### 🎵 Audio & TTS
- **[FLOWERY_TTS_INTEGRATION.md](./FLOWERY_TTS_INTEGRATION.md)** — FloweryTTS architecture, options, and API
- **[TTS_COMMANDS_GUIDE.md](./TTS_COMMANDS_GUIDE.md)** — `/tts`, `/voices`, and `/say` command reference

### ⚙️ Setup & Deployment
- **[LAVALINK_SETUP.md](./LAVALINK_SETUP.md)** — Lavalink server (4.2.2) setup and plugin configuration
- **[STANDALONE_DEPLOYMENT.md](./STANDALONE_DEPLOYMENT.md)** — Standalone Docker / Portainer deployment
- **[DOCKER_DATABASE_PERSISTENCE.md](./DOCKER_DATABASE_PERSISTENCE.md)** — Persisting the SQLite database and logs with named volumes
- **[PORTAINER_VOLUME_MANAGEMENT.md](./PORTAINER_VOLUME_MANAGEMENT.md)** — Managing those volumes from the Portainer UI

### 🌍 Localization
- **[Translation.md](./Translation.md)** — Translation status and how to contribute a locale

### 🔒 Security
- **[SECURITY.md](./SECURITY.md)** — Security policy, dashboard CSP, and vulnerability reporting

## 🚀 Quick Start

1. **Lavalink**: set up the audio server — [LAVALINK_SETUP.md](./LAVALINK_SETUP.md)
2. **Dashboard**: enable and configure the web dashboard — [DASHBOARD.md](./DASHBOARD.md)
3. **TTS**: configure text-to-speech — [FLOWERY_TTS_INTEGRATION.md](./FLOWERY_TTS_INTEGRATION.md)
4. **Commands**: learn the TTS commands — [TTS_COMMANDS_GUIDE.md](./TTS_COMMANDS_GUIDE.md)

## 📁 Related Folders

- **`../src/`** — Source code (`src/web/` is the dashboard)
- **`../src/web/styles/`** — Tailwind source CSS, built via `npm run build:css` to `src/web/public/css/app.css`
- **`../config/`** — Runtime config (`application.yml`, `process.json`, `replit.nix`); `tsconfig.json` and `biome.json` live at the repo root
- **`../docker/`** — Docker configuration
- **`../scripts/`** — Command-deploy and utility scripts (`deploy-commands.js`, `restart.js`)
- **`../locales/`** — Translation files
- **`../tests/`** — Manual debug scripts (require a bot token)

## 🤝 Contributing

When adding documentation: place it in the matching category above, link it here, and keep it accurate to the code with clear, runnable examples.
