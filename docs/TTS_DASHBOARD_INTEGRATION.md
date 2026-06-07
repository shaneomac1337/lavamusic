# 🎤 TTS Dashboard Integration

This document describes the Text-to-Speech (TTS) feature integration into the Lavamusic web dashboard.

## 📋 Overview

The TTS feature allows users to convert text to speech directly from the web dashboard. The dashboard is dual-provider: a provider selector lets you choose between **FloweryTTS** (the default) and **DuncteBot** (a secondary/fallback option). The generated speech is added to the music queue and plays through the bot's voice connection.

## ✨ Features

### 🎯 Core Functionality
- **Text Input**: Multi-line textarea with a dynamic character limit (2048 for FloweryTTS, 200 for DuncteBot). The textarea has no fixed `maxlength` attribute; the displayed limit updates with the selected provider.
- **Real-time Character Counter**: Visual feedback with percentage-based color coding
- **One-Click Speech**: Generate TTS with a single button click
- **Keyboard Shortcuts**: Enter to speak, Shift+Enter for new lines
- **Auto-join**: Automatically joins user's voice channel if needed

### 🎨 User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Mode**: Consistent with dashboard theme
- **Visual Feedback**: Loading states, success/error messages
- **Character Limit Indicator**: Color changes as a percentage of the current (dynamic) limit
  - Gray: up to 75% of the limit
  - Yellow: above 75% of the limit
  - Red: above 90% of the limit

### 🔧 Technical Features
- **Queue Integration**: TTS tracks appear in music queue
- **Real-time Updates**: Socket.IO integration for live queue updates
- **Error Handling**: Comprehensive validation and user feedback
- **Security**: Authentication and permission validation

## 🏗️ Implementation Details

### Backend API Endpoint

**Endpoint**: `POST /api/guilds/:guildId/tts/speak`

**Request Body**:
```json
{
  "text": "Hello world!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "TTS added to queue: \"Hello world!\"",
  "text": "Hello world!",
  "textLength": 12,
  "track": {
    "title": "TTS: Hello world!",
    "author": "Text-to-Speech",
    "duration": 2500
  },
  "autoJoined": false
}
```

### Frontend Components

The TTS panel **markup** lives in `src/web/public/guild.html`; its **JavaScript**
lives in `src/web/public/js/guild.js` (extracted from the page's former inline script).

**HTML Structure**:
```html
<div class="border-t pt-4 mt-4">
    <h3 class="text-md font-medium text-gray-900 mb-3">
        <i class="fas fa-microphone mr-2"></i>
        Text-to-Speech
    </h3>
    <div class="space-y-3">
        <!-- Text input with character counter (no maxlength; limit shown is dynamic) -->
        <div class="relative">
            <textarea id="tts-text" rows="3"></textarea>
            <div class="absolute bottom-2 right-2">
                <span id="tts-char-count">0</span>/<span id="tts-char-limit">2048</span>
            </div>
        </div>
        
        <!-- Control buttons -->
        <div class="flex space-x-2">
            <button onclick="speakText()" id="tts-speak-btn">
                <i class="fas fa-microphone mr-2"></i>
                <span id="tts-btn-text">Speak</span>
            </button>
            <button onclick="clearTTSText()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <!-- Info text -->
        <div id="tts-info" class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <i class="fas fa-info-circle mr-1"></i>
            <span id="tts-info-text">FloweryTTS • 850+ voices • Multiple languages • Auto-joins voice channel</span>
        </div>
    </div>
</div>
```

**JavaScript Functions** (defined in `src/web/public/js/guild.js`):
- `speakText()`: Main TTS function
- `clearTTSText()`: Clear text input
- `updateTTSCharCount()`: Update character counter

## 🔒 Security & Validation

### Authentication
- Requires valid JWT token (Discord OAuth2)
- Guild membership validation
- Voice channel permission checks

### Input Validation
- Text length: 1-200 characters
- HTML/script injection prevention
- Rate limiting (inherited from API middleware)

### Permission Checks
- User must be in a voice channel
- Bot must have Connect and Speak permissions
- User must have access to the guild

## 🎵 Integration with Music System

### Queue Behavior
- TTS tracks are added to the music queue
- Plays in order with other music tracks
- Supports all queue operations (skip, remove, etc.)
- Real-time updates via Socket.IO

### Player Integration
- Uses existing player auto-join logic
- Inherits volume and filter settings
- Compatible with all audio effects
- Supports 24/7 mode and autoplay

## 🚀 Usage Instructions

### For Users
1. Navigate to the guild dashboard
2. Scroll to the "Text-to-Speech" section
3. Enter your text (max 2048 characters with FloweryTTS, 200 with DuncteBot)
4. Click "Speak" or press Enter
5. The TTS will be added to the queue and play

### For Developers
1. Ensure DuncteBot plugin is configured in Lavalink
2. Set `tts: true` in plugin sources
3. Configure language in `application.yml`
4. Deploy the updated dashboard code

## ⚙️ Configuration

### Lavalink Configuration
```yaml
plugins:
  dunctebot:
    ttsLanguage: 'cs-CZ'  # Czech language
    sources:
      tts: true  # Enable TTS
```

### Environment Variables
- `DASHBOARD_PORT`: Dashboard port (default: 3001)
- `DASHBOARD_SECRET`: JWT secret for authentication
- `CLIENT_ID`: Discord application client ID
- `CLIENT_SECRET`: Discord application client secret

## 🐛 Troubleshooting

### Common Issues

**TTS Not Working**:
- Check if DuncteBot plugin is installed and enabled
- Verify `tts: true` in Lavalink configuration
- Ensure bot has voice permissions

**Authentication Errors**:
- Check if user is logged in to dashboard
- Verify guild membership and permissions
- Check JWT token validity

**Voice Channel Issues**:
- User must be in a voice channel
- Bot needs Connect and Speak permissions
- Check voice channel region compatibility

### Error Messages
- "Text is required for TTS" - Empty input
- "Text must be 200 characters or less" - Exceeds limit
- "You must be in a voice channel to use TTS" - No voice connection
- "TTS generation failed" - Lavalink/plugin issue

## 📊 Monitoring & Logs

### Server Logs
```
🤖 Auto-created player for guild 123456789 via dashboard TTS
🔗 Auto-connected to voice channel General via dashboard TTS
🔄 Moved bot to user's voice channel Music via dashboard TTS
```

### Client Logs
```javascript
console.log('TTS request successful:', result);
console.log('Queue updated with TTS track');
```

## 🔄 Future Enhancements

### Potential Features
- Multiple language support
- Voice selection (male/female)
- Speed and pitch adjustment for TTS
- TTS history/favorites
- Bulk TTS from text files
- Integration with playlist system

### Technical Improvements
- Caching for repeated TTS requests
- Advanced rate limiting
- TTS quality settings
- Custom voice models
- Text preprocessing (emoji to text, etc.)
