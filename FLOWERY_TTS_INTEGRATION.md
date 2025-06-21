# FloweryTTS Integration for Lavamusic

## 🎤 Overview

This integration adds **FloweryTTS** as a premium text-to-speech option alongside the existing DuncteBot TTS in your Lavamusic dashboard. FloweryTTS provides superior voice quality, more language options, and advanced features.

## ✨ Features

### FloweryTTS Advantages
- **850+ voices** with **English, Czech & Japanese prioritized**
- **2048 character limit** (vs 200 for DuncteBot)
- **Speed control** (0.5x to 10x playback speed)
- **Translation support** (auto-translate text to voice language)
- **Multiple audio formats** (MP3, OGG, WAV, FLAC, AAC)
- **Higher quality** natural-sounding speech
- **Free service** with generous rate limits
- **Organized voice selection** (🇺🇸 English first, 🇨🇿 Czech second, 🇯🇵 Japanese third)
- **Advanced voice browser** with search, filtering, and preview
- **Audio quality selection** (AAC, OGG Opus, FLAC)

### Dual TTS System
- **Provider selection**: Choose between FloweryTTS and DuncteBot
- **Automatic fallback**: If FloweryTTS fails, automatically retry with DuncteBot
- **User preferences**: Your TTS provider choice is saved locally
- **Seamless integration**: Both providers work with the same queue system

## 🏗️ Architecture

### Backend Components

1. **FloweryTTS Service** (`src/utils/FloweryTTS.ts`)
   - Handles API communication with FloweryTTS
   - Voice fetching and caching
   - TTS generation with error handling
   - Rate limiting compliance

2. **AudioStreamManager** (`src/utils/AudioStreamManager.ts`)
   - Creates temporary HTTP streams for audio
   - Manages stream lifecycle and cleanup
   - Provides URLs for Lavalink integration

3. **API Endpoints** (`src/web/routes/api.ts`)
   - `/api/tts/flowery/voices` - Get all available voices
   - `/api/tts/flowery/voices/popular` - Get popular voices
   - `/api/tts/flowery/voices/language/:code` - Get voices by language
   - `/api/guilds/:guildId/tts/flowery` - Generate TTS

### Frontend Components

1. **Enhanced TTS Interface** (`src/web/public/guild.html`)
   - Provider selection buttons
   - Voice dropdown with language grouping
   - Speed control slider
   - Translation toggle
   - Dynamic character limits
   - Fallback handling

## 🚀 Installation & Setup

### Prerequisites
- Lavamusic bot with dashboard enabled
- Node.js and npm/yarn
- Internet connection for FloweryTTS API

### Configuration

1. **Environment Variables** (optional)
   ```env
   # Dashboard settings (existing)
   WEB_DASHBOARD=true
   DASHBOARD_PORT=3001
   DASHBOARD_SECRET=your-secret-here
   ```

2. **No additional configuration required** - FloweryTTS works out of the box!

### Starting the Bot
```bash
# Install dependencies (if not already done)
npm install

# Start the bot with dashboard
npm start
```

## 🎯 Usage Guide

### For Users

1. **Access Dashboard**
   - Open your guild's dashboard
   - Navigate to the TTS section (under Radio Stations)

2. **Select TTS Provider**
   - **FloweryTTS** (recommended): Advanced features, more voices
   - **DuncteBot**: Simple, reliable fallback

3. **FloweryTTS Options**
   - **Voice**: Choose from 850+ voices grouped by language
   - **Speed**: Adjust playback speed (0.5x to 3x)
   - **Translation**: Auto-translate text to voice language
   - **Text**: Up to 2048 characters

4. **DuncteBot Options**
   - **Text**: Up to 200 characters
   - **Language**: Czech (configured in server)

### Keyboard Shortcuts
- **Enter**: Generate TTS
- **Shift+Enter**: New line in text area

## 🔧 API Reference

### FloweryTTS Endpoints

#### Get All Voices
```http
GET /api/tts/flowery/voices
```

#### Get Popular Voices (English + Czech)
```http
GET /api/tts/flowery/voices/popular
```

#### Get Czech Voices Only
```http
GET /api/tts/flowery/voices/czech
```

#### Get English Voices Only
```http
GET /api/tts/flowery/voices/english
```

#### Get Japanese Voices Only
```http
GET /api/tts/flowery/voices/japanese
```

**Response:**
```json
{
  "success": true,
  "count": 850,
  "default": { "id": "...", "name": "..." },
  "voices": [
    {
      "id": "voice-id",
      "name": "Voice Name",
      "gender": "male|female",
      "source": "source-name",
      "language": {
        "name": "English",
        "code": "en-US"
      }
    }
  ]
}
```

#### Generate TTS
```http
POST /api/guilds/:guildId/tts/flowery
Content-Type: application/json

{
  "text": "Text to speak",
  "voice": "voice-id",
  "speed": 1.5,
  "translate": true,
  "audio_format": "mp3"
}
```

**Response:**
```json
{
  "success": true,
  "message": "TTS added to queue",
  "text": "Text to speak",
  "voice": "voice-id",
  "speed": 1.5,
  "autoJoined": true,
  "track": {
    "title": "TTS: Text to speak",
    "author": "FloweryTTS (voice-name)",
    "duration": 5000
  }
}
```

## 🧪 Testing

### Automated Tests
```bash
# Run the test script
node test-flowery-tts.js
```

### Manual Testing Checklist
- [ ] FloweryTTS provider selection works
- [ ] Voice dropdown loads with options
- [ ] Speed control affects playback
- [ ] Translation toggle functions
- [ ] Character limits enforced (2048 vs 200)
- [ ] Fallback to DuncteBot works
- [ ] TTS appears in music queue
- [ ] Auto-join voice channel works
- [ ] Preferences saved across sessions

## 🛠️ Troubleshooting

### Common Issues

1. **"FloweryTTS service unavailable"**
   - Check internet connection
   - FloweryTTS API may be temporarily down
   - Fallback to DuncteBot should work automatically

2. **"Voice list unavailable"**
   - API rate limit may be reached
   - Default voice will be used
   - Try again in a few minutes

3. **"TTS generation failed"**
   - Text may be too long (>2048 characters)
   - Invalid characters in text
   - Try with DuncteBot for shorter text

4. **Audio not playing**
   - Check bot permissions in voice channel
   - Ensure Lavalink is running
   - Verify audio stream server is started

### Debug Information

Check console logs for:
- `Audio stream server started on http://127.0.0.1:PORT`
- `Created audio stream: URL`
- FloweryTTS API errors
- Rate limiting messages

## 🔒 Security & Privacy

- **No data storage**: Text is processed in real-time, not stored
- **Temporary streams**: Audio streams auto-expire after 5 minutes
- **Rate limiting**: Respects FloweryTTS API limits (3 req/sec)
- **Local preferences**: TTS provider choice stored in browser only

## 📈 Performance

- **Voice caching**: Popular voices cached for 5 minutes
- **Stream cleanup**: Automatic cleanup of expired audio streams
- **Rate limiting**: Built-in delays to respect API limits
- **Fallback system**: Automatic retry with DuncteBot on failures

## 🤝 Contributing

### Adding New Features
1. Update `FloweryTTS.ts` for new API features
2. Modify frontend interface in `guild.html`
3. Add corresponding API endpoints
4. Update tests and documentation

### Reporting Issues
- Include console logs
- Specify TTS provider used
- Provide text that caused the issue
- Mention browser and bot version

## 📄 License

This integration follows the same license as the main Lavamusic project.

---

**Enjoy enhanced text-to-speech with FloweryTTS! 🎉**
