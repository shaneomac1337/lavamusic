# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build & Development:**
- `npm run dev` - Development mode with hot reload (uses tsup watch + node)
- `npm run build` - Build TypeScript to JavaScript in dist/
- `npm start` - Start the compiled bot from dist/

**Code Quality:**
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier

**Database:**
- `npm run db:push` - Push Prisma schema to database
- `npm run db:migrate` - Run Prisma migrations

**Testing:**
- Use scripts in `tests/` directory for debugging specific features
- `node tests/test-dashboard.js` - Test dashboard functionality
- `node tests/test-flowery-tts.js` - Test TTS integration

## Code Architecture

### Core Structure
This is a Discord music bot built with TypeScript, Discord.js v14, and Lavalink for audio streaming.

**Main Entry Points:**
- `src/index.ts` - Application bootstrap with sharding support
- `src/LavaClient.ts` - Client configuration and initialization
- `src/structures/Lavamusic.ts` - Main bot class extending Discord.js Client

**Key Architecture Patterns:**
- **Command System**: Commands in `src/commands/` organized by category (music, filters, config, etc.)
- **Event System**: Events in `src/events/` split by source (client, player, node)
- **Plugin System**: `src/plugin/` for modular functionality (anti-crash, keep-alive, status updates)
- **Database**: Prisma ORM with SQLite default, supports MongoDB/PostgreSQL
- **Web Dashboard**: Optional Fastify-based web interface with OAuth2 authentication

### Command Structure
Commands extend the base `Command` class from `src/structures/Command.ts`:
- Support both slash commands and text commands
- Localization support via i18n
- Permission and cooldown systems
- Player state validation (voice channel, DJ permissions, etc.)

### Audio System
- **Lavalink Integration**: Uses lavalink-client library for audio streaming
- **Multi-Source Support**: YouTube, Spotify, SoundCloud, Apple Music, Deezer, etc.
- **TTS Features**: Built-in text-to-speech with FloweryTTS integration
- **Audio Filters**: 12+ audio filters (bassboost, nightcore, karaoke, etc.)

### Database Models
Key Prisma models:
- `Guild` - Server settings (prefix, language, DJ mode, etc.)
- `Playlist` - User playlists with public/private support
- `Setup` - Music channel system configuration
- `User` - User preferences and settings

### Web Dashboard
Optional web interface built with:
- **Fastify** - Web server framework
- **Socket.IO** - Real-time communication
- **Discord OAuth2** - Authentication
- **JWT** - Session management

## Configuration Files

**Environment Setup:**
- Copy `.env.example` to `.env` and configure required values
- `TOKEN` - Discord bot token (required)
- `DATABASE_URL` - Database connection (SQLite default)
- `NODES` - Lavalink server configuration
- `WEB_DASHBOARD` - Enable/disable web dashboard

**Database Setup:**
- Default: SQLite (`prisma/schema.prisma`)
- Optional: Copy `example.mongodb.schema.prisma` or `example.postgresql.schema.prisma`
- Run `npm run db:push` after schema changes

**Lavalink Setup:**
- Configure `Lavalink/application.yml`
- Place plugins in `Lavalink/plugins/`
- Use provided Docker setup for easy deployment

## Code Style & Standards

**TypeScript Configuration:**
- Strict mode enabled with comprehensive type checking
- ES modules with CommonJS compilation
- Decorators enabled for dependency injection (tsyringe)

**Code Formatting:**
- Biome.js for linting and formatting
- Tab indentation (2 spaces width)
- Single quotes, semicolons required
- Line width: 120 characters

**Architecture Principles:**
- Dependency injection with tsyringe
- Event-driven architecture
- Modular plugin system
- Separation of concerns (commands, events, utils)

## Development Notes

**Multi-language Support:**
- Translation files in `locales/` directory
- Commands support localization via i18n system
- Default language: EnglishUS

**Audio Features:**
- 24/7 playback support
- Queue management with shuffle, loop modes
- Radio detection and handling
- Playlist management (create, load, share)

**Security:**
- Helmet.js for web security headers
- CORS configuration for dashboard
- JWT-based authentication
- Input validation and sanitization

**Docker Support:**
- Complete Docker setup in `docker/` directory
- Docker Compose for full stack deployment
- Includes Lavalink server configuration