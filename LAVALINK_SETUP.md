# 🎵 Lavalink 4.1.1 Setup Guide

## 📥 Downloaded Files

✅ **Lavalink-4.1.1.jar** (88.8 MB) - Latest stable release
✅ **application.yml** - Configuration file with plugins
✅ **start-lavalink.bat** - Windows startup script

## 🚀 Quick Start

### Option 1: Local Java Execution
```bash
# Make sure Java 17+ is installed
java -version

# Start Lavalink
java -jar Lavalink-4.1.1.jar

# Or use the batch file on Windows
start-lavalink.bat
```

### Option 2: Docker (Recommended)
```bash
# Updated docker-compose.yml to use Lavalink 4.1.1
docker-compose up -d lavalink
```

## 🔧 Configuration Details

### **Server Settings**
- **Port**: 2333
- **Password**: youshallnotpass
- **Host**: 0.0.0.0 (all interfaces)

### **Enabled Sources**
- ✅ YouTube
- ✅ Bandcamp  
- ✅ SoundCloud
- ✅ Twitch
- ✅ Vimeo
- ✅ HTTP streams

### **Audio Filters**
- Volume, Equalizer, Karaoke
- Timescale, Tremolo, Vibrato
- Distortion, Rotation, Channel Mix
- Low Pass filtering

### **Plugins Included**
- **LavaSrc 4.2.0**: Extended source support
- **LavaSearch 1.0.0**: Enhanced search capabilities

## 🔗 Connection Details

### **For Your Bot (.env)**
```env
NODES=[{"id":"LavaMusic","host":"localhost","port":2333,"authorization":"youshallnotpass"}]
```

### **For Docker**
```env
NODES=[{"id":"LavaMusic","host":"lavalink","port":2333,"authorization":"youshallnotpass"}]
```

## 📊 Version Information

- **Lavalink**: 4.1.1 (Latest stable)
- **Release Date**: June 5, 2025
- **Key Fix**: Voice gateway connection improvements
- **Java Requirement**: Java 17 or higher

## 🔍 Health Check

Test if Lavalink is running:
```bash
curl -H "Authorization: youshallnotpass" http://localhost:2333/version
```

Expected response:
```json
{
  "semver": "4.1.1",
  "major": 4,
  "minor": 1,
  "patch": 1,
  "preRelease": null,
  "build": null
}
```

## 🐛 Troubleshooting

### **Common Issues**

1. **Port already in use**
   ```
   Error: Address already in use: bind
   Solution: Change port in application.yml or stop other services
   ```

2. **Java version too old**
   ```
   Error: Unsupported class file major version
   Solution: Install Java 17 or higher
   ```

3. **Connection refused**
   ```
   Check: Firewall settings, correct host/port, Lavalink is running
   ```

### **Logs Location**
- Local: `./logs/` directory
- Docker: Use `docker logs lavamusic-lavalink`

## 🔄 Updating

### **Local Installation**
1. Download new JAR file
2. Replace old JAR
3. Restart Lavalink

### **Docker**
1. Update image tag in docker-compose.yml
2. Run `docker-compose pull lavalink`
3. Run `docker-compose up -d lavalink`

## 📈 Performance Tips

- **Memory**: Allocate at least 1GB RAM (`-Xmx1G`)
- **CPU**: 2+ cores recommended for multiple guilds
- **Network**: Low latency connection to Discord
- **Storage**: SSD recommended for plugin caching

## 🔐 Security Notes

- Change default password in production
- Use firewall to restrict access
- Consider using reverse proxy with SSL
- Monitor logs for suspicious activity

## 📚 Additional Resources

- **Official Docs**: https://lavalink.dev/
- **GitHub**: https://github.com/lavalink-devs/Lavalink
- **Discord**: https://discord.gg/ZW4s47Ppw4
- **Plugins**: https://lavalink.dev/plugins

---

**Status**: ✅ Ready to use with Lavamusic bot
**Compatibility**: Fully compatible with your current setup
