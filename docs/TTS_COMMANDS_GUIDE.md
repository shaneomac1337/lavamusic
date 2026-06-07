# 🎤 TTS Commands Guide

Your LavaMusic bot now has **powerful TTS commands** that work directly from Discord chat! You can choose between **FloweryTTS** (advanced) and **DuncteBot** (simple) providers.

## 🚀 **New Commands Available**

### 1. `/tts` - Advanced FloweryTTS Command
**The most powerful TTS command with full FloweryTTS features**

```bash
# Basic usage (FloweryTTS default)
/tts text:Hello world

# With specific voice
/tts text:Hello everyone voice:en-US-AriaNeural

# With speed control
/tts text:Hello world speed:1.5

# With translation (English text → Czech voice)
/tts text:Hello world voice:cs-CZ-AntoninNeural translate:true

# With high quality audio
/tts text:Hello world quality:flac

# With efficient compression
/tts text:Hello world quality:ogg_opus

# Use DuncteBot instead
/tts text:Simple TTS provider:duncte

# Prefix command examples
!tts Hello world
!tts --voice en-US-AriaNeural --speed 1.2 Hello everyone!
!tts --translate --voice cs-CZ-AntoninNeural Ahoj světe
!tts --quality flac --voice en-US-AriaNeural High quality audio
!tts --provider duncte Simple TTS
```

### 2. `/voices` - Voice Discovery Command
**Explore available TTS voices**

```bash
# Show the curated popular voices (Czech, English, Japanese, Russian, Polish, German)
/voices

# Show all English voices
/voices category:english

# Show all Czech voices
/voices category:czech

# Show all Japanese voices
/voices category:japanese

# Search for specific voices
/voices category:search query:aria

# Show voice statistics
/voices category:stats

# Prefix command examples
!voices
!voices english
!voices czech
!voices japanese
!voices search aria
!voices stats
```

### 3. `/say` - Enhanced Say Command
**Updated original command with provider selection**

```bash
# Default DuncteBot (for compatibility)
/say text:Hello world

# Use FloweryTTS instead
/say text:Hello world provider:flowery

# Prefix command examples
!say Hello world
!say --provider flowery Hello with FloweryTTS
!say --provider duncte Simple TTS
```

## 🎯 **Command Features Comparison**

| Feature | `/tts` | `/voices` | `/say` |
|---------|--------|-----------|--------|
| **FloweryTTS Support** | ✅ Full | ✅ Browse | ✅ Basic |
| **DuncteBot Support** | ✅ Via `--provider duncte` | ❌ No | ✅ Default + auto-fallback |
| **Voice Selection** | ✅ 850+ voices | ✅ Browse all | ❌ Default only |
| **Speed Control** | ✅ 0.5x-3x | ❌ No | ❌ No |
| **Audio Quality** | ✅ 3 formats | ❌ No | ❌ No |
| **Translation** | ✅ Auto-translate | ❌ No | ❌ No |
| **Character Limit** | 2048 (FloweryTTS)<br>200 (DuncteBot) | N/A | 2048 (FloweryTTS)<br>200 (DuncteBot) |

## 🌍 **Language Support**

> **Note:** The voice IDs below are illustrative examples. Voices are not hardcoded in the bot — the live list is fetched from the FloweryTTS API, so available IDs may differ. Use `/voices` to browse the current set.

### **English Voices** 🇺🇸🇬🇧
- **US English**: en-US-AriaNeural, en-US-JennyNeural, en-US-GuyNeural
- **UK English**: en-GB-SoniaNeural, en-GB-RyanNeural, en-GB-LibbyNeural
- **Australian**: en-AU-NatashaNeural, en-AU-WilliamNeural
- **And many more!**

### **Czech Voices** 🇨🇿
- **Female**: cs-CZ-VlastaNeural
- **Male**: cs-CZ-AntoninNeural, cs-CZ-JakubNeural
- **And more Czech voices!**

### **Japanese Voices** 🇯🇵
- **Female**: ja-JP-NanamiNeural, ja-JP-AoiNeural, ja-JP-MayuNeural
- **Male**: ja-JP-KeitaNeural, ja-JP-DaichiNeural
- **And many more Japanese voices!**

## 🎵 **Audio Quality Options**

FloweryTTS supports 3 optimized audio formats for different use cases:

### **Quality Levels (Best to Standard)**

1. **🏆 FLAC** - Lossless compression
   - **Best quality** possible
   - **Large file size** (~10-20MB per minute)
   - **Use for**: Music servers, audiophiles, archival
   - **Command**: `quality:flac`

2. **🎧 OGG Opus** - Modern high-efficiency codec
   - **Excellent quality** at smaller sizes
   - **Medium file size** (~2-4MB per minute)
   - **Use for**: High-quality streaming, modern systems
   - **Command**: `quality:ogg_opus`

3. **🎶 AAC** - Efficient modern compression (Default)
   - **Good quality**, small size
   - **Small file size** (~1-2MB per minute)
   - **Use for**: General use, mobile devices, bandwidth-limited
   - **Command**: `quality:aac` (default)

### **Quality Selection Tips**

- **For Discord voice chat**: AAC (fast, small, efficient)
- **For music servers**: FLAC or OGG Opus (high quality)
- **For mobile users**: AAC (most efficient)
- **For audiophiles**: FLAC (lossless)
- **For modern systems**: OGG Opus (best efficiency)

## 🎨 **Advanced Examples**

### **Multilingual TTS**
```bash
# English text with Czech voice (auto-translated)
/tts text:Hello, how are you? voice:cs-CZ-VlastaNeural translate:true
# Result: Czech voice saying "Ahoj, jak se máš?"

# Czech text with English voice (auto-translated)
/tts text:Dobrý den voice:en-US-AriaNeural translate:true
# Result: English voice saying "Good day"

# English text with Japanese voice (auto-translated)
/tts text:Hello world voice:ja-JP-NanamiNeural translate:true
# Result: Japanese voice saying "こんにちは世界"
```

### **Speed Variations**
```bash
# Slow speech
/tts text:This is slow speech speed:0.7

# Fast speech
/tts text:This is fast speech speed:2.0

# Very fast
/tts text:Speed demon mode speed:3.0
```

### **Quality Variations**
```bash
# Lossless quality for music server
/tts text:Welcome to our music server quality:flac voice:en-US-AriaNeural

# High-efficiency streaming quality
/tts text:High quality stream quality:ogg_opus voice:ja-JP-NanamiNeural

# Standard efficient compression (default)
/tts text:General use quality:aac voice:cs-CZ-VlastaNeural
```

### **Voice Discovery**
```bash
# Find neural voices
/voices category:search query:neural

# Find female voices
/voices category:search query:female

# Find specific language
/voices category:search query:czech
```

## 🔧 **Smart Features**

### **Automatic Fallback** (`/say` only)
- `/say`: if FloweryTTS fails and text ≤ 200 chars → automatically falls back to DuncteBot
- `/tts`: does **not** auto-fall back. On a FloweryTTS failure it shows an error embed suggesting you retry with `--provider duncte`
- Seamless experience with error handling

### **Auto-Join Voice Channel**
- Commands automatically join your voice channel
- Creates player if needed
- Adds TTS to queue

### **Provider Selection**
- **FloweryTTS**: High quality, 850+ voices, translation, speed control
- **DuncteBot**: Simple, reliable, fast, 200 char limit

## 📝 **Usage Tips**

1. **Start with `/voices`** to explore available voices
2. **Use `/tts`** for advanced features (recommended)
3. **Use `/say`** for quick, simple TTS
4. **Try translation** for multilingual servers
5. **Experiment with speed** for different effects

## 🎵 **Integration with Music**

- TTS tracks are added to the music queue
- Works with existing music commands
- Can be skipped, paused, etc. like regular tracks
- Shows in `/queue` and `/nowplaying`

## 🚨 **Error Handling**

- **Character limits enforced** (2048 for FloweryTTS, 200 for DuncteBot)
- **Automatic fallback** to DuncteBot on FloweryTTS failure — `/say` only (for `/tts`, the error embed suggests retrying with `--provider duncte`)
- **Clear error messages** with suggestions

---

**Your TTS commands are now ready! Try `/tts text:Hello world` to get started! 🎤✨**
