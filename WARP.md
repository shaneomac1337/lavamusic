# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

LavaMusic is a Discord music bot built with TypeScript, Discord.js v14, and Lavalink for audio streaming. It's a production-ready bot with multi-language support, web dashboard, TTS capabilities, and extensive music sources (YouTube, Spotify, SoundCloud, Apple Music, etc.).

**Key Technologies:**
- Discord.js v14 with TypeScript (strict mode)
- Lavalink v4+ for audio streaming (lavalink-client library)
- Prisma ORM (SQLite default, supports MongoDB/PostgreSQL)
- Fastify web server with Discord OAuth2 authentication
- tsyringe for dependency injection
- i18n for internationalization (20+ languages)

## Development Commands

### Build & Run
```bash
npm run dev           # Development with hot reload (tsup watch + auto-restart)
npm run build         # Compile TypeScript to dist/
npm start             # Run compiled bot from dist/
```

### Code Quality
```bash
npm run lint          # Run ESLint (uses @appujet/eslint-config)
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format with Prettier
```

### Database
```bash
npm run db:push       # Push Prisma schema to database (no migrations)
npm run db:migrate    # Run Prisma migrations with name "init"
```

### Testing
Test scripts are in `tests/` directory. Run specific tests:
```bash
node tests/test-dashboard.js      # Test web dashboard
node tests/test-flowery-tts.js    # Test TTS integration
```

### Bot Commands
After starting the bot, use in Discord:
```
!deploy               # Deploy slash commands (requires OWNER_IDS in .env)
```

## Architecture Overview

### Core Structure

**Entry Point Flow:**
1. `src/index.ts` - Bootstrap, loads logo, starts sharding
2. `src/shard.ts` - Handles Discord sharding (imported by index)
3. `src/LavaClient.ts` - Creates Lavamusic instance with intents
4. `src/structures/Lavamusic.ts` - Main client class, extends Discord.js Client

**Main Client Class (`Lavamusic`):**
- Extends Discord.js `Client` with custom functionality
- Manages commands, events, database, Lavalink manager, web server
- Handles command/event loading from `dist/` folder
- Auto-generates slash command localizations for all supported languages

### Command System

Commands are in `src/commands/` organized by category:
- `music/` - Playback commands (play, pause, skip, queue, etc.)
- `filters/` - Audio filters (bassboost, nightcore, 8d, etc.)
- `config/` - Server configuration (prefix, language, DJ mode, setup)
- `dev/` - Developer commands (eval, deploy, restart, shutdown)
- `info/` - Information commands (help, ping, about)
- `playlist/` - Playlist management (create, load, add/remove songs)

**Command Base Class (`src/structures/Command.ts`):**
```typescript
class Command {
  name: string                    // Command name
  description: CommandDescription // Content, usage, examples
  aliases: string[]               // Alternative names
  category: string                // Auto-set from folder
  slashCommand: boolean          // Enable slash command
  options: APIApplicationCommandOption[] // Slash command options
  
  // Permission checks
  permissions: {
    dev: boolean                  // Owner-only
    client: PermissionResolvable[] // Bot permissions needed
    user: PermissionResolvable[]   // User permissions needed
  }
  
  // Player requirements
  player: {
    voice: boolean                // Must be in voice channel
    dj: boolean                   // Requires DJ role
    active: boolean               // Music must be playing
  }
  
  cooldown: number               // Seconds between uses
  args: boolean                  // Requires arguments
  vote: boolean                  // Requires Top.gg vote
}
```

**Command Implementation Pattern:**
```typescript
export default class PlayCommand extends Command {
  constructor(client: Lavamusic) {
    super(client, {
      name: 'play',
      description: { content: 'cmd.play.description', usage: 'play <song>', examples: [...] },
      category: 'music',
      aliases: ['p'],
      player: { voice: true, dj: false, active: false },
      slashCommand: true,
      options: [/* slash command options */]
    });
  }

  async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
    // Command logic here
    // Use ctx.locale() for translations
    // Access player via client.manager.getPlayer()
  }
  
  // Optional: autocomplete for slash commands
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    // Provide dynamic suggestions
  }
}
```

### Event System

Events are in `src/events/` split by source:
- `client/` - Discord.js events (messageCreate, interactionCreate, ready, etc.)
- `player/` - Lavalink player events (trackStart, trackEnd, queueEnd, etc.)
- `node/` - Lavalink node events (connect, disconnect, error)

**Custom Events:**
- `setupSystem` - Music channel system messages
- `setupButtons` - Music channel button interactions

**Event Base Class (`src/structures/Event.ts`):**
```typescript
class Event {
  name: keyof AllEvents  // Event name (typed)
  one: boolean          // Listen once vs. always
  
  async run(...args: any): Promise<void> {
    // Event handler logic
  }
}
```

The client automatically routes events based on folder:
- `client/` → Discord client events
- `player/` → Lavalink manager events  
- `node/` → Lavalink node manager events

### Context System

`src/structures/Context.ts` provides unified interface for both slash commands and text commands:

```typescript
class Context {
  ctx: CommandInteraction | Message  // Original context
  interaction: CommandInteraction | null
  message: Message | null
  author: User
  guild: Guild
  channel: TextBasedChannel
  args: any[]                       // Normalized arguments
  guildLocale: string              // Server's language
  
  // Methods
  async sendMessage(content)       // Send initial response
  async editMessage(content)       // Edit response
  async sendDeferMessage()         // Defer response
  locale(key, ...args)            // Get translation
  
  // Slash command helpers
  options.get(name, required)
  options.getRole(name)
  options.getChannel(name)
  options.getSubCommand()
}
```

**Key Pattern:** Always use `Context` for command handlers - it abstracts slash vs. text commands.

### Audio System

**Lavalink Integration:**
- Client at `src/structures/LavalinkClient.ts`
- Uses `lavalink-client` npm package
- Supports multiple nodes with auto-failover
- Player state stored per-guild

**Player Management:**
```typescript
// Get or create player
let player = client.manager.getPlayer(guildId);
if (!player) {
  player = client.manager.createPlayer({
    guildId: guild.id,
    voiceChannelId: voiceChannel.id,
    textChannelId: textChannel.id,
    selfMute: false,
    selfDeaf: true,
    vcRegion: voiceChannel.rtcRegion
  });
}

// Connect and play
await player.connect();
await player.queue.add(track);
await player.play();
```

**Search Sources:**
- Default: `YouTubeMusic` (configured in .env SEARCH_ENGINE)
- User preferences stored in database (`User.preferredSource`)
- Source mapping in autocomplete: `ytmsearch`, `spsearch`, `ytsearch`, `scsearch`

**Audio Filters:**
- 12+ filters available (bassboost, nightcore, karaoke, 8d, etc.)
- Applied via player filter system
- Commands in `src/commands/filters/`

**Radio Detection:**
- Service at `src/utils/RadioDetection.ts`
- Automatically detects live streams/radio
- Prevents inappropriate loop/replay on radio stations

**Fair Play System:**
- Queue reordering to give users equal play time
- Enabled per-guild via `!fairplay` command
- Implementation in `src/utils/functions/player.ts`

### Database System

**Prisma ORM:**
- Schema: `prisma/schema.prisma` (SQLite default)
- Alternative schemas: `example.mongodb.schema.prisma`, `example.postgresql.schema.prisma`
- Access via `client.db` (ServerData instance)

**Models:**
```typescript
// Guild settings
Guild {
  guildId: string (PK)
  prefix: string
  language: string
  textChannelId: string?
  stay: Stay?           // 24/7 mode
  dj: Dj?              // DJ mode
  roles: Role[]        // DJ roles
  setup: Setup?        // Music channel
}

// User preferences
User {
  userId: string (PK)
  preferredSource: string  // youtubemusic, spotify, youtube, soundcloud
}

// Playlists
Playlist {
  id: string (UUID)
  userId: string
  guildId: string?
  name: string
  tracks: string       // JSON encoded track array
  isPublic: boolean
  trackCount: int
  playCount: int
}

// Music channel system
Setup {
  guildId: string (PK)
  textId: string       // Text channel ID
  messageId: string    // Persistent message with controls
}

// 24/7 mode
Stay {
  guildId: string (PK)
  textId: string       // Last text channel
  voiceId: string      // Voice channel to stay in
}

// DJ mode
Dj {
  guildId: string (PK)
  mode: boolean        // DJ mode enabled
}

Role {
  guildId: string
  roleId: string
  // DJ roles
}
```

**Database Helper (`src/database/server.ts`):**
```typescript
client.db.get(guildId)                    // Get guild settings
client.db.getLanguage(guildId)            // Get guild language
client.db.getUserPreferredSource(userId)   // Get user's search preference
client.db.getSetup(guildId)               // Get music channel setup
client.db.getDj(guildId)                  // Get DJ settings
client.db.getRoles(guildId)               // Get DJ roles
// ... and many more
```

### Web Dashboard

Optional Fastify-based web interface (enable with `WEB_DASHBOARD=true`).

**Structure:**
- Server: `src/web/server.ts`
- Routes in `src/web/routes/`
- Real-time updates via Socket.IO

**Authentication:**
- Discord OAuth2 flow
- JWT tokens with configurable secret
- Session management via cookies

**Features:**
- Server management (prefix, language, DJ mode)
- Music control (play, pause, queue management)
- Real-time bot statistics
- TTS voice settings

**Environment Variables:**
```bash
WEB_DASHBOARD="true"
DASHBOARD_PORT="3001"
DASHBOARD_SECRET=""           # Auto-generated if empty
DASHBOARD_BASE_URL=""         # For production (e.g., https://music.example.com)
CLIENT_SECRET=""              # Discord OAuth2 secret
```

### Internationalization

**i18n System (`src/structures/I18n.ts`):**
- 20+ languages in `locales/` (JSON files)
- Translation keys like `cmd.play.description`
- Helper function: `T(locale, key, ...args)`
- Context method: `ctx.locale(key, ...args)`

**Adding Translations:**
1. Add key to `locales/EnglishUS.json`
2. Use in commands: `ctx.locale('your.key')`
3. For slash commands: Description keys auto-localized

**Supported Languages:**
Czech, Chinese (CN/TW), Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Norwegian, Polish, Portuguese, Russian, Spanish, Thai, Turkish, Vietnamese

### Plugin System

**Location:** `src/plugin/`

**Available Plugins:**
- `antiCrash.ts` - Uncaught error handler
- `keepAlive.ts` - HTTP keep-alive for Replit
- `updateStatus.ts` - Auto-update bot status

**Loading:** Plugins auto-loaded in `src/plugin/index.ts` during startup.

## Configuration

### Environment Setup

**Required Variables:**
```bash
TOKEN=""              # Discord bot token
PREFIX="!"            # Command prefix
OWNER_IDS=["id1"]     # Owner user IDs (array)
DEFAULT_LANGUAGE="EnglishUS"
NODES=[{...}]         # Lavalink node configuration
```

**Optional:**
```bash
CLIENT_ID=""          # For invite command
GUILD_ID=""           # Single-server mode
TOPGG=""              # Top.gg API key
DATABASE_URL=""       # Database connection
SEARCH_ENGINE="YouTubeMusic"
GENIUS_API=""         # Lyrics API key
LOG_CHANNEL_ID=""     # Node status logs
LOG_COMMANDS_ID=""    # Command usage logs
AUTO_NODE="false"     # Use lavainfo-api
```

### Database Setup

**Default (SQLite):**
1. Use existing `prisma/schema.prisma`
2. Run `npm run db:push`

**MongoDB/PostgreSQL:**
1. Copy `example.<database>.schema.prisma` to `schema.prisma`
2. Set `DATABASE_URL` in `.env`
3. Run `npm run db:push`

### Lavalink Setup

**Configuration:**
1. Edit `Lavalink/application.yml`
2. Add plugins to `Lavalink/plugins/`
3. Update `NODES` in `.env` with host/port/auth

**Recommended Plugins:**
- [youtube-source](https://github.com/lavalink-devs/youtube-source) - YouTube support
- [LavaSrc](https://github.com/topi314/LavaSrc) - Spotify, Apple Music, Deezer
- [skybot-lavalink-plugin](https://github.com/DuncteBot/skybot-lavalink-plugin) - TTS, TikTok, Reddit
- [jiosaavn-plugin](https://github.com/appujet/jiosaavn-plugin) - JioSaavn

**Docker Setup:**
- See `docker/` directory for complete stack
- `docker-compose.yml` includes bot + Lavalink + database

## Code Style

**TypeScript:**
- Strict mode with comprehensive type checking
- ES modules with CommonJS compilation  
- Decorators enabled for tsyringe DI
- Target: ESNext

**Formatting (Biome):**
- Tab indentation (width: 2)
- Line width: 120 characters
- Single quotes, semicolons required
- CRLF line endings

**Linting:**
- Biome with "all rules" enabled
- Many rules disabled via config (see `biome.json`)
- Key disabled: `noExplicitAny`, `noDefaultExport`

**File Organization:**
- PascalCase for class files (`Command.ts`, `Event.ts`)
- PascalCase for command files (`Play.ts`, `Skip.ts`)
- camelCase for utility files (`server.ts`, `index.ts`)

## Development Patterns

### Adding a New Command

1. Create file in `src/commands/<category>/<Name>.ts`
2. Extend `Command` class
3. Set properties in constructor (name, description, permissions, etc.)
4. Implement `run()` method
5. Optional: implement `autocomplete()` for slash commands
6. Use `ctx.locale()` for all user-facing text
7. Access player via `client.manager.getPlayer()`

### Adding a New Event

1. Create file in `src/events/<source>/<EventName>.ts`
2. Extend `Event` class
3. Set event name in constructor
4. Implement `run()` method with correct parameters
5. Source determines routing (client/player/node)

### Adding Translations

1. Add key to `locales/EnglishUS.json`
2. Copy to other language files
3. Use via `ctx.locale('your.key', {variable: value})`
4. For dynamic values, use placeholders: `{{variable}}`

### Working with Player State

```typescript
// Get player
const player = client.manager.getPlayer(guildId);
if (!player) return; // No active player

// Check state
if (!player.connected) await player.connect();
if (!player.playing) await player.play();

// Custom data storage on player
player.set('fairplay', true);
const fairplay = player.get<boolean>('fairplay');

// Queue operations
await player.queue.add(track);
player.queue.shuffle();
player.queue.clear();

// Playback control
await player.play();
await player.pause();
await player.skip();
await player.seek(position);
await player.setVolume(volume);

// Filters
await player.filterManager.setFilters({ /* filter config */ });
await player.filterManager.resetFilters();
```

### Database Patterns

Always use the `client.db` helper instead of direct Prisma:

```typescript
// Get guild settings (auto-creates if missing)
const guild = await client.db.get(guildId);

// Update settings
await client.db.setPrefix(guildId, newPrefix);
await client.db.setLanguage(guildId, language);

// Playlist operations
const playlist = await client.db.getPlaylist(userId, playlistName);
await client.db.createPlaylist(userId, name, tracks);

// Setup system
const setup = await client.db.getSetup(guildId);
await client.db.setSetup(guildId, textId, messageId);
```

## Important Notes

### Text-to-Speech (TTS)

This fork has enhanced Czech TTS support:
- Uses DuncteBot's skybot-lavalink-plugin
- Command: `!say <text>` or `/say text:<text>`
- Max 200 characters per message
- Integrates with music queue
- Voice selection via dashboard

### Music Channel System

Setup creates a persistent music control channel:
- Single message with playback controls (buttons)
- Auto-updates with current track
- Button handlers in `src/events/client/SetupButtons.ts`
- Setup via `!setup` command

### Sharding

Bot supports Discord sharding for large deployments:
- Configured in `src/shard.ts`
- Automatic shard count based on guild count
- Enable with sharding options in client config

### Radio Detection

Automatically detects radio/live streams:
- Prevents loop on radio stations
- Adjusts behavior for continuous streams
- Service: `client.radioDetection`

### Fair Play Mode

Queue reordering feature:
- Ensures equal play time per user
- Toggle per-guild with `!fairplay` command
- Applied automatically when enabled

## Project-Specific Context

**Original Author:** appujet (Appu)  
**Main Contributor:** LucasB25  
**Czech TTS Fork:** Martin Pěnkava (Komplexáci)  
**License:** GPL-3.0  
**Discord Support:** https://discord.gg/YQsGbTwPBx

**Related Documentation:**
- Main README: `README.md`
- Claude AI Rules: `CLAUDE.md`
- All docs: `docs/` directory
- Test examples: `tests/` directory

**Common Gotchas:**
- Commands load from `dist/`, not `src/` (must build first)
- Slash commands need manual deploy with `!deploy` after changes
- Database schema changes require `npm run db:push`
- Lavalink must be running before bot starts
- Owner IDs must be in array format in .env
- Node configuration in .env is JSON format (escaped quotes)
