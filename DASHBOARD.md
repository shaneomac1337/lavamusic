# 🌐 Lavamusic Web Dashboard

The Lavamusic Web Dashboard provides a modern, responsive web interface to control your Discord music bot from anywhere. Built with **Fastify**, **Socket.io**, and **Tailwind CSS**.

## ✨ Features

### 🎵 **Music Control**
- **Real-time Player Controls**: Play, pause, skip, stop, and volume control
- **Queue Management**: View, add, remove, and reorder tracks
- **Live Updates**: Real-time synchronization with Discord bot
- **Search Integration**: Add tracks by search query or direct URL

### 🔧 **Server Management**
- **Guild Settings**: Configure bot prefix, language, and DJ roles
- **24/7 Mode**: Enable/disable persistent voice channel connection
- **Setup Management**: Configure music channels and permissions

### 📊 **Statistics & Monitoring**
- **Real-time Stats**: Bot uptime, guild count, active players
- **Performance Metrics**: Memory usage, ping, and system health
- **Lavalink Status**: Monitor node connections and performance

### 🔐 **Security**
- **Discord OAuth2**: Secure authentication with Discord
- **JWT Tokens**: Session management with automatic refresh
- **Permission Checks**: Admin-only access to guild controls
- **CORS Protection**: Secure cross-origin requests

## 🚀 Quick Setup

### 1. Environment Configuration

Add these variables to your `.env` file:

```env
# Web Dashboard Settings
WEB_DASHBOARD="true"                    # Enable dashboard
DASHBOARD_PORT="3001"                   # Dashboard port
DASHBOARD_SECRET="your-secret-key"      # JWT secret (auto-generated if empty)
CLIENT_SECRET="your-discord-secret"     # Discord OAuth2 client secret
```

### 2. Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your bot application
3. Navigate to **OAuth2** → **General**
4. Add redirect URI: `http://localhost:3001/auth/discord/callback`
5. Copy the **Client Secret** to your `.env` file

### 3. Docker Compose (Recommended)

The dashboard is pre-configured in `docker-compose.yml`:

```yaml
lavamusic:
  environment:
    - WEB_DASHBOARD=true
    - DASHBOARD_PORT=3001
    - CLIENT_SECRET=your-discord-client-secret
  ports:
    - "3001:3001"  # Dashboard access port
```

### 4. Manual Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start with dashboard enabled
WEB_DASHBOARD=true npm start
```

## 🌐 Access & Usage

### **Dashboard URL**
- **Local**: `http://localhost:3001`
- **Production**: `https://yourdomain.com:3001`

### **Authentication Flow**
1. Visit dashboard URL
2. Click "Login with Discord"
3. Authorize the application
4. Access your server controls

### **Navigation**
- **Home**: Bot statistics and server overview
- **Guild Dashboard**: Individual server controls
- **Music Player**: Real-time music control interface

## 🎛️ Dashboard Interface

### **Main Dashboard**
```
┌─────────────────────────────────────────┐
│  🎵 Lavamusic Dashboard                 │
├─────────────────────────────────────────┤
│  📊 Stats: Guilds | Users | Players     │
│  🎵 Your Servers                        │
│  ├─ Server 1 (🟢 Active Player)        │
│  ├─ Server 2 (⏸️ Paused)               │
│  └─ Server 3 (⚫ Offline)              │
└─────────────────────────────────────────┘
```

### **Guild Controls**
```
┌─────────────────────────────────────────┐
│  🎵 Music Player          │  📋 Queue   │
│  ┌─────────────────────┐  │  ├─ Track 1 │
│  │ 🎵 Current Track    │  │  ├─ Track 2 │
│  │ ⏮️ ⏸️ ⏭️ ⏹️         │  │  └─ Track 3 │
│  │ 🔊 ████████░░ 80%   │  │             │
│  └─────────────────────┘  │  ⚙️ Settings │
│  🔍 Add Track...          │  Prefix: !   │
│                           │  Lang: EN    │
└─────────────────────────────────────────┘
```

## 🔧 API Endpoints

### **Authentication**
- `GET /auth/discord` - Discord OAuth2 login
- `GET /auth/discord/callback` - OAuth2 callback
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user

### **Bot Statistics**
- `GET /api/stats` - Bot performance metrics
- `GET /api/nodes` - Lavalink node status

### **Guild Management**
- `GET /api/guilds` - List accessible guilds
- `GET /api/guilds/:id` - Guild details
- `PUT /api/guilds/:id/settings` - Update guild settings

### **Music Control**
- `POST /api/guilds/:id/player/play` - Add track to queue
- `POST /api/guilds/:id/player/pause` - Toggle pause/resume
- `POST /api/guilds/:id/player/skip` - Skip current track
- `POST /api/guilds/:id/player/stop` - Stop playback
- `POST /api/guilds/:id/player/volume` - Set volume

### **Queue Management**
- `GET /api/guilds/:id/queue` - Get current queue
- `DELETE /api/guilds/:id/queue/:index` - Remove track

## 🔌 Real-time Features

### **Socket.io Events**

**Client → Server:**
```javascript
socket.emit('join-guild', guildId);     // Join guild room
socket.emit('leave-guild', guildId);    // Leave guild room
```

**Server → Client:**
```javascript
socket.on('trackStart', data);          // New track started
socket.on('trackEnd', data);            // Track ended
socket.on('playerUpdate', data);        // Player state changed
socket.on('queueEnd', data);            // Queue finished
```

## 🛡️ Security Features

### **Authentication**
- **Discord OAuth2** with secure token exchange
- **JWT tokens** with configurable expiration
- **Automatic token refresh** for seamless experience

### **Authorization**
- **Bot owner** access to all guilds
- **Administrator permission** required for guild access
- **Guild-specific** access control

### **Security Headers**
- **Helmet.js** for security headers
- **CORS** protection with configurable origins
- **Content Security Policy** for XSS prevention

## 🎨 Customization

### **Styling**
The dashboard uses **Tailwind CSS** for responsive design:
- Modify `src/web/public/*.html` for layout changes
- Update CSS classes for custom styling
- Add custom JavaScript for enhanced functionality

### **API Extensions**
Add custom endpoints in `src/web/routes/`:
- `api.ts` - API endpoints
- `auth.ts` - Authentication routes
- `dashboard.ts` - Dashboard pages

## 🐛 Troubleshooting

### **Common Issues**

**Dashboard not accessible:**
```bash
# Check if dashboard is enabled
WEB_DASHBOARD=true

# Verify port is not in use
netstat -an | grep 3001

# Check Docker port mapping
docker-compose ps
```

**Authentication fails:**
```bash
# Verify Discord OAuth2 settings
CLIENT_ID=your-bot-client-id
CLIENT_SECRET=your-oauth2-secret

# Check redirect URI matches exactly
http://localhost:3001/auth/discord/callback
```

**Real-time updates not working:**
```bash
# Check Socket.io connection
# Browser console should show: "Connected to dashboard"

# Verify WebSocket support
# Check browser network tab for WebSocket connections
```

## 📱 Mobile Support

The dashboard is fully responsive and works on:
- **Desktop** browsers (Chrome, Firefox, Safari, Edge)
- **Tablet** devices (iPad, Android tablets)
- **Mobile** phones (iOS Safari, Android Chrome)

## 🔄 Updates & Maintenance

### **Automatic Updates**
When using Docker, the dashboard updates automatically with bot updates.

### **Manual Updates**
```bash
git pull origin main
npm run build
npm start
```

### **Database Migrations**
Dashboard settings are stored in the same database as bot data:
```bash
npm run db:push    # Apply schema changes
npm run db:migrate # Run migrations
```

---

## 🎯 Next Steps

1. **Enable the dashboard** in your `.env` file
2. **Configure Discord OAuth2** in Developer Portal
3. **Access the dashboard** at `http://localhost:3001`
4. **Customize the interface** to match your needs

For support, join our [Discord Server](https://discord.gg/YQsGbTwPBx) and ask in the `#dashboard-support` channel!
