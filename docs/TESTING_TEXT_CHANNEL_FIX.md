# Testing Text Channel Configuration Fix

This guide will help you test the text channel notification fix.

## 🎯 What Was Fixed

The bot now respects the configured text channel setting (e.g., "bot-commands") for all notifications:
- ✅ "Now Playing" messages
- ✅ Track added to queue
- ✅ Queue updates
- ✅ Playback control messages

**Before**: Bot sent messages to whatever channel the command was used in
**After**: Bot sends all messages to the configured channel (or current channel as fallback)

## 🚀 Testing Steps

### Step 1: Start Lavalink Server

```powershell
cd Lavalink
.\start-lavalink.ps1
```

Wait for this message:
```
Lavalink is ready to accept connections.
```

### Step 2: Start the Bot

In a new terminal:
```powershell
npm start
```

Or for development with hot reload:
```powershell
npm run dev
```

### Step 3: Configure Text Channel (Dashboard)

1. Open the web dashboard (if enabled)
2. Navigate to your guild settings
3. Select a text channel (e.g., "bot-commands")
4. Save settings

**Note**: The dashboard setting is optional. You can also configure via:
```
Database → Guild.textChannelId field
```

### Step 4: Test with Discord Commands

#### Test A: New Player Creation
1. Go to any channel (e.g., #general)
2. Run: `!play Never Gonna Give You Up`
3. ✅ **Expected**: "Now Playing" notification appears in configured channel (bot-commands)
4. ❌ **Not**: Message appearing in #general

#### Test B: Existing Player
1. Play a song from #general
2. Go to dashboard and change the text channel setting
3. Play another song from #music channel
4. ✅ **Expected**: Notification in newly configured channel
5. Confirms: Setting applies immediately to existing players!

#### Test C: Dashboard Control
1. Use dashboard to play a song
2. ✅ **Expected**: Notification in configured channel
3. ✅ **Not**: In whatever channel you last used

#### Test D: No Configuration
1. Remove text channel configuration (set to null)
2. Run `!play song` from #test-channel
3. ✅ **Expected**: Notification in #test-channel (fallback behavior)

### Step 5: Verify Console Logs

Watch for these logs confirming the fix:
```
[TextChannel] Updated player text channel for guild 123456789 to 987654321
```

This confirms the bot dynamically updated an existing player to use the configured channel!

## 🐛 Troubleshooting

### Bot still sends to wrong channel?

**Check 1: Is Lavalink running?**
```powershell
curl http://localhost:2333/version
```

**Check 2: Is the bot using the compiled code?**
```powershell
# Rebuild
npm run build

# Restart bot
npm start
```

**Check 3: Check database setting**
Look at your database (SQLite by default):
```sql
SELECT guildId, textChannelId FROM Guild;
```

**Check 4: Verify channel ID**
- Right-click channel in Discord → Copy ID
- Make sure Developer Mode is enabled in Discord settings

### Console shows errors?

Common issues:
- **"Player not found"**: Normal if no music is playing
- **"Cannot find module"**: Run `npm install`
- **"Port 2333 unavailable"**: Lavalink not running or port conflict

## 📝 Expected Results Summary

| Scenario | Old Behavior | New Behavior |
|----------|-------------|--------------|
| Play from #general with bot-commands configured | Message in #general | ✅ Message in #bot-commands |
| Change setting while playing | No effect until bot restart | ✅ Immediate effect |
| Dashboard play | Random channel | ✅ Configured channel |
| No channel configured | Current channel | ✅ Current channel (fallback) |

## 🎉 Success Indicators

You'll know it's working when:
1. All notifications go to your configured channel
2. Console shows `[TextChannel] Updated player...` logs
3. Changing settings takes effect immediately
4. Works from both Discord commands and dashboard

## 📊 Test Commands

Quick commands to test:
```
!play <song>          # Basic play
!join                 # Join voice
!say Hello world      # TTS test
!search <song>        # Search test
!playnext <song>      # Queue test
!load <playlist>      # Playlist test
```

All should send notifications to configured channel!

## 🔍 Debugging

Enable more detailed logging:
```typescript
// In src/utils/functions/ensurePlayerTextChannel.ts
// The console.log is already there!
```

Check logs:
```powershell
# Bot logs (console output)
# Lavalink logs
Get-Content Lavalink/logs/spring.log -Tail 50
```

## ✅ Final Checklist

- [ ] Lavalink server running
- [ ] Bot compiled (`npm run build`)
- [ ] Bot running
- [ ] Text channel configured (dashboard or database)
- [ ] Tested play command from different channel
- [ ] Notifications appear in correct channel
- [ ] Console shows update logs
- [ ] Changed setting and verified immediate effect

---

**Need Help?** Check the main README.md or WARP.md for more information!
