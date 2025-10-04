# Lavalink Server Setup

This directory contains the Lavalink audio server required by LavaMusic bot.

## 🚀 Quick Start

### Starting Lavalink

**Option 1: PowerShell Script (Recommended)**
```powershell
cd Lavalink
.\start-lavalink.ps1
```

**Option 2: Manual Start**
```powershell
cd Lavalink
java -Xmx2G -jar Lavalink.jar
```

### Server Information
- **Version**: Lavalink 4.1.1
- **Port**: 2333
- **Address**: http://localhost:2333
- **Password**: `youshallnotpass`

## 📦 Installed Components

### Main Files
- `Lavalink.jar` (84.74 MB) - Main Lavalink server
- `application.yml` - Server configuration
- `plugins/` - Directory for Lavalink plugins

### Configured Plugins
These plugins will be auto-downloaded on first start:

1. **skybot-lavalink-plugin** (1.7.0)
   - TTS support with Czech language (cs-CZ)
   - TikTok, Reddit, Clyp.it, etc.

2. **youtube-plugin** (1.13.5)
   - YouTube playback with OAuth2
   - Multiple client types for reliability

3. **lavasrc-plugin** (4.8.1)
   - Spotify support
   - Apple Music, Deezer, Yandex Music
   - FloweryTTS integration

4. **lavasearch-plugin** (1.0.0)
   - Advanced search capabilities

5. **lavalyrics-plugin** (1.1.0)
   - Lyrics fetching from multiple sources

6. **sponsorblock-plugin** (3.0.1)
   - Skip sponsored segments in videos

## ⚙️ Configuration

### Current Settings

**TTS (Text-to-Speech)**
- Language: Czech (cs-CZ)
- Voice: cs-CZ-Tereza (FloweryTTS)
- Speed: 1.0x

**Spotify**
- Client ID: Configured ✓
- Client Secret: Configured ✓
- Country: CZ (Czech Republic)

**YouTube**
- Email: mpenkava1337@gmail.com
- OAuth2: Enabled
- Multiple client types for redundancy

**Sources Enabled**
- ✓ YouTube (via plugin)
- ✓ Spotify
- ✓ SoundCloud
- ✓ Bandcamp
- ✓ Twitch
- ✓ Vimeo
- ✓ HTTP streams
- ✓ TTS (DuncteBot & FloweryTTS)

## 🔧 Updating Configuration

To modify settings, edit `application.yml`:

```powershell
notepad application.yml
# or
code application.yml  # VS Code
```

After changes, restart Lavalink for them to take effect.

## 📝 Common Issues

### Port Already in Use
If port 2333 is already in use:
1. Edit `application.yml`
2. Change `server.port` to another port (e.g., 2334)
3. Update bot's `.env` file to match

### Plugins Not Loading
- Check `logs/` directory for errors
- Ensure internet connection (plugins download on first start)
- Verify `plugins/` directory permissions

### YouTube Issues
- OAuth2 login required on first start
- Check console for device code link
- Use a burner Google account (ban risk)

## 📊 Monitoring

### Logs Location
```
Lavalink/logs/
```

### Check Server Status
```bash
curl http://localhost:2333/version
# Response: {"version":"4.1.1","buildTime":...}
```

## 🔄 Updating Lavalink

1. Download new version from GitHub
2. Stop Lavalink server (Ctrl+C)
3. Replace `Lavalink.jar`
4. Start server again

## 🆘 Need Help?

- [Lavalink Documentation](https://lavalink.dev/)
- [Lavalink GitHub](https://github.com/lavalink-devs/Lavalink)
- [LavaMusic Discord](https://discord.gg/YQsGbTwPBx)

## 🔐 Security Note

⚠️ **Important**: Never expose your Lavalink server to the public internet!
- Change the default password in `application.yml`
- Use firewall rules to restrict access
- Consider using a reverse proxy with rate limiting
