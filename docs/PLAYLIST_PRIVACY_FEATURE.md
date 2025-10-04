# Playlist Privacy Feature

## Overview
Added playlist privacy controls to allow users to make playlists either **public** (default) or **private**.

## Default Behavior
- **All playlists are PUBLIC by default**
- Users can optionally make playlists private via checkbox (dashboard) or command option (slash commands)

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- ✅ `isPublic` field defaults to `true` (public by default)
- Comment updated to reflect public default behavior

### 2. Database Methods (`src/database/server.ts`)
**Updated methods:**
- `createPlaylist()` - defaults to `isPublic = true`
- `createPlaylistWithTracks()` - defaults to `isPublic = true`
- `addTracksToPlaylist()` - creates with `isPublic: true`
- `createPlaylistAdvanced()` - defaults to `isPublic ?? true`
- `getUserPlaylists()` - filters private playlists when viewing other users' playlists
- `getPublicPlaylists()` - only returns playlists with `isPublic: true`
- `searchPlaylists()` - only searches public playlists

### 3. Dashboard API (`src/web/routes/api.ts`)
**Updated endpoints:**
- `POST /playlists` - accepts `isPublic` parameter, defaults to `true`
- `POST /playlists/import` - accepts `isPublic` parameter, defaults to `true`

**Privacy filtering:**
- Users see all their own playlists (both public and private)
- Users only see other users' public playlists
- Search only returns public playlists

### 4. Dashboard UI (`src/web/public/guild.html`)
**Create Playlist Modal:**
- Added "Make this playlist private" checkbox (unchecked by default)
- Info message explains public is the default behavior

**Import Playlist Modal:**
- Added "Make this playlist private" checkbox (unchecked by default)
- Info message explains public is the default behavior

**JavaScript Logic:**
- Inverted logic: checkbox checked = private, unchecked = public
- `isPublic = !makePrivate`

### 5. Slash Commands (`src/commands/playlist/Create.ts`)
**Updated `/create` command:**
- Added `public` boolean option (type 5)
- Defaults to `true` (public)
- Shows privacy status in response message: "Playlist **name** has been created. (public)" or "(private)"

### 6. Localization (`locales/EnglishUS.json`)
- Added description for `public` option: "Make this playlist public (default: yes)"

## How It Works

### Creating Public Playlists (Default)
**Dashboard:**
```
1. Click "Create Playlist"
2. Enter name and description
3. Leave "Make this playlist private" UNCHECKED
4. Click "Create Playlist"
✅ Playlist is public and discoverable by others
```

**Slash Command:**
```
/create name:MyPlaylist
✅ Playlist is public by default

/create name:MyPlaylist public:true
✅ Explicitly public
```

### Creating Private Playlists
**Dashboard:**
```
1. Click "Create Playlist"
2. Enter name and description
3. CHECK "Make this playlist private"
4. Click "Create Playlist"
✅ Playlist is private, only visible to you
```

**Slash Command:**
```
/create name:MyPrivatePlaylist public:false
✅ Playlist is private
```

## Privacy Rules

### What Users See
1. **Own Playlists**: Users see ALL their playlists (public + private)
2. **Other Users' Playlists**: Users only see public playlists from other users
3. **Search**: Only public playlists appear in search results
4. **Public Playlists List**: Only shows playlists marked as public

### Playlist Visibility
| Playlist Type | Owner Can See | Others Can See | In Search | Can Load |
|--------------|---------------|----------------|-----------|----------|
| Public       | ✅ Yes        | ✅ Yes         | ✅ Yes    | ✅ Yes   |
| Private      | ✅ Yes        | ❌ No          | ❌ No     | ✅ Owner Only |

## Database Migration

After deployment, run:
```bash
npx prisma migrate dev --name playlist_privacy_public_default
```

Or for production:
```bash
npx prisma migrate deploy
```

## API Changes

### POST /api/playlists
**Request Body:**
```json
{
  "name": "My Playlist",
  "description": "Optional description",
  "tracks": [],
  "isPublic": true  // Optional, defaults to true
}
```

### POST /api/playlists/import
**Request Body:**
```json
{
  "url": "https://music.youtube.com/playlist?list=...",
  "name": "Optional custom name",
  "description": "Optional description",
  "isPublic": true  // Optional, defaults to true
}
```

### GET /api/playlists
**Query Parameters:**
- `guildId` (optional): Filter by guild (not used, kept for backwards compatibility)

**Response:**
- Returns all user's own playlists (public + private)
- When viewing other users, only returns their public playlists

## Testing

### Test Scenarios
1. ✅ Create public playlist (default)
2. ✅ Create private playlist (checkbox/option)
3. ✅ View own playlists (should see all)
4. ✅ View other user's playlists (should only see public)
5. ✅ Search for playlists (should only find public)
6. ✅ Load public playlist from any user
7. ✅ Try to load someone else's private playlist (should fail)
8. ✅ Import playlist as public (default)
9. ✅ Import playlist as private (checkbox)

## User Experience

### Dashboard
- Clear checkbox with label "Make this playlist private"
- Blue info box explains default public behavior
- Privacy status shown in playlist details modal

### Slash Commands
- Simple boolean option: `public:true/false`
- Response shows privacy status: "(public)" or "(private)"
- Defaults to public for convenience

## Security Considerations
- Private playlists are filtered at the database query level
- API endpoints validate ownership before allowing access
- Search and discovery respect privacy settings
- Load endpoints check permissions before loading tracks

## Future Enhancements
- [ ] Toggle privacy setting for existing playlists
- [ ] Batch privacy updates
- [ ] Share private playlists with specific users
- [ ] Playlist collaboration features
