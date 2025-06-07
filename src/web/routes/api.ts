import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Lavamusic } from '../../structures/index';

interface ApiOptions extends FastifyPluginOptions {
	client: Lavamusic;
	webServer?: any;
}

export async function apiRoutes(fastify: FastifyInstance, options: ApiOptions) {
	const { client, webServer } = options;

	// Authentication middleware
	fastify.addHook('preHandler', async (request, reply) => {
		if (request.url.startsWith('/api/auth')) return; // Skip auth for auth endpoints

		try {
			const token = request.cookies.token;
			if (!token) {
				throw new Error('No token provided');
			}

			const decoded = fastify.jwt.verify(token);
			request.user = decoded;
		} catch (err: any) {
			console.log('API authentication failed:', err.message);
			reply.code(401).send({ error: 'Unauthorized' });
		}
	});

	// Bot statistics
	fastify.get('/stats', async () => {
		const guilds = client.guilds.cache;
		const users = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
		const channels = client.channels.cache.size;
		const players = client.manager.players.size;

		return {
			guilds: guilds.size,
			users,
			channels,
			players,
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			ping: client.ws.ping,
		};
	});

	// Guild management
	fastify.get('/guilds', async () => {
		return client.guilds.cache.map(guild => ({
			id: guild.id,
			name: guild.name,
			icon: guild.iconURL(),
			memberCount: guild.memberCount,
			owner: guild.ownerId,
		}));
	});

	fastify.get('/guilds/:guildId', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const guild = client.guilds.cache.get(guildId);
		
		if (!guild) {
			throw fastify.httpErrors.notFound('Guild not found');
		}

		const guildData = await client.db.get(guildId);
		const player = client.manager.getPlayer(guildId);

		return {
			id: guild.id,
			name: guild.name,
			icon: guild.iconURL(),
			memberCount: guild.memberCount,
			owner: guild.ownerId,
			settings: {
				...guildData,
				textChannelName: guildData.textChannelId ? guild.channels.cache.get(guildData.textChannelId)?.name || 'Unknown Channel' : null,
			},
			player: player ? {
				connected: player.connected,
				playing: player.playing,
				paused: player.paused,
				volume: player.volume,
				position: player.position,
				queue: player.queue.tracks.length,
				voiceChannelId: player.voiceChannelId,
				voiceChannelName: player.voiceChannelId ? guild.channels.cache.get(player.voiceChannelId)?.name || 'Unknown Channel' : null,
				current: player.queue.current ? {
					title: player.queue.current.info.title,
					author: player.queue.current.info.author,
					duration: player.queue.current.info.duration,
					uri: player.queue.current.info.uri,
					thumbnail: player.queue.current.info.artworkUrl,
				} : null,
			} : null,
		};
	});

	// Search suggestions for autocomplete
	fastify.get('/search/suggestions', async (request) => {
		const { q } = request.query as { q: string };

		if (!q || q.trim().length < 2) {
			return { suggestions: [] };
		}

		try {
			// Check if manager is available
			if (!client.manager || !client.manager.nodeManager.nodes.size) {
				return { suggestions: [] };
			}

			const searchResult = await client.manager.search(q.trim(), { id: 'dashboard-search' });
			const suggestions = [];

			if (searchResult.loadType === 'search' && searchResult.tracks.length > 0) {
				// Return top 8 suggestions
				for (const track of searchResult.tracks.slice(0, 8)) {
					const name = `${track.info.title} by ${track.info.author}`;
					suggestions.push({
						title: track.info.title,
						author: track.info.author,
						duration: track.info.duration,
						uri: track.info.uri,
						thumbnail: track.info.artworkUrl,
						displayName: name.length > 80 ? `${name.substring(0, 77)}...` : name,
					});
				}
			}

			return { suggestions };
		} catch (error) {
			console.error('Search suggestions error:', error);
			return { suggestions: [] };
		}
	});

	// Player controls
	fastify.post('/guilds/:guildId/player/play', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { query } = request.body as { query: string };
		
		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const result = await player.search({ query }, { id: 'dashboard' });
		if (!result || !result.tracks.length) {
			throw fastify.httpErrors.badRequest('No tracks found');
		}

		await player.queue.add(result.tracks[0]);
		if (!player.playing) {
			await player.play();
		}

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
		}

		return { success: true, track: result.tracks[0].info };
	});

	fastify.post('/guilds/:guildId/player/pause', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);
		
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		if (player.paused) {
			await player.resume();
		} else {
			await player.pause();
		}
		return { success: true, paused: player.paused };
	});

	fastify.post('/guilds/:guildId/player/skip', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);
		
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		await player.skip();
		return { success: true };
	});

	fastify.post('/guilds/:guildId/player/stop', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);
		
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		await player.destroy();
		return { success: true };
	});

	fastify.post('/guilds/:guildId/player/volume', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { volume } = request.body as { volume: number };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		if (volume < 0 || volume > 100) {
			throw fastify.httpErrors.badRequest('Volume must be between 0 and 100');
		}

		await player.setVolume(volume);
		return { success: true, volume };
	});

	// Seek to position in current track
	fastify.post('/guilds/:guildId/player/seek', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { position } = request.body as { position: number };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		if (!player.queue.current) {
			throw fastify.httpErrors.badRequest('No track currently playing');
		}

		if (position < 0 || position > player.queue.current.info.duration) {
			throw fastify.httpErrors.badRequest('Invalid seek position');
		}

		await player.seek(position);
		return { success: true, position };
	});

	// Toggle repeat mode
	fastify.post('/guilds/:guildId/player/repeat', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { mode } = request.body as { mode: 'off' | 'track' | 'queue' };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const validModes = ['off', 'track', 'queue'];
		if (!validModes.includes(mode)) {
			throw fastify.httpErrors.badRequest('Invalid repeat mode. Must be: off, track, or queue');
		}

		player.set('repeatMode', mode);

		// Handle track repeat
		if (mode === 'track') {
			player.setRepeatMode('track');
		} else if (mode === 'queue') {
			player.setRepeatMode('queue');
		} else {
			player.setRepeatMode('off');
		}

		return { success: true, repeatMode: mode };
	});

	// Toggle fair play mode
	fastify.post('/guilds/:guildId/player/fairplay', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const currentFairPlay = player.get<boolean>('fairplay') || false;
		const newFairPlay = !currentFairPlay;

		player.set('fairplay', newFairPlay);

		if (newFairPlay) {
			// Apply fair play to current queue
			const { applyFairPlayToQueue } = await import('../../utils/functions/player');
			await applyFairPlayToQueue(player);
		}

		return { success: true, fairPlay: newFairPlay };
	});

	// Join user's voice channel
	fastify.post('/guilds/:guildId/player/join-my-channel', {
		preHandler: async (request) => {
			try {
				const token = request.cookies.token;
				if (!token) {
					throw new Error('No token');
				}

				const decoded = fastify.jwt.verify(token);
				request.user = decoded;
			} catch (err) {
				throw fastify.httpErrors.unauthorized('Authentication required');
			}
		}
	}, async (request) => {
		const { guildId } = request.params as { guildId: string };
		const user = request.user as any;

		const guild = client.guilds.cache.get(guildId);
		if (!guild) {
			throw fastify.httpErrors.notFound('Guild not found');
		}

		// Find the user in the guild
		const member = guild.members.cache.get(user.userId);
		if (!member) {
			throw fastify.httpErrors.notFound('You are not a member of this guild');
		}

		// Check if user is in a voice channel
		if (!member.voice.channel) {
			throw fastify.httpErrors.badRequest('You are not in a voice channel');
		}

		const voiceChannel = member.voice.channel;

		// Check if bot has permissions to join the channel
		const botMember = guild.members.cache.get(client.user!.id);
		if (!botMember) {
			throw fastify.httpErrors.internalServerError('Bot not found in guild');
		}

		const permissions = voiceChannel.permissionsFor(botMember);
		if (!permissions?.has(['Connect', 'Speak'])) {
			throw fastify.httpErrors.forbidden('Bot does not have permission to join your voice channel');
		}

		// Check if bot is already connected to a different channel
		let player = client.manager.getPlayer(guildId);
		if (player && player.connected && player.voiceChannelId !== voiceChannel.id) {
			// Disconnect from current channel and reconnect to new one
			await player.disconnect();
			player.voiceChannelId = voiceChannel.id;
			await player.connect();
			return {
				success: true,
				message: `Moved to your voice channel: ${voiceChannel.name}`,
				channelName: voiceChannel.name,
				channelId: voiceChannel.id
			};
		}

		// Create new player if doesn't exist
		if (!player) {
			// Get the configured text channel for this guild
			const configuredTextChannelId = await client.db.getTextChannel(guildId);
			const textChannelId = configuredTextChannelId || voiceChannel.id; // Fallback to voice channel

			player = client.manager.createPlayer({
				guildId: guild.id,
				voiceChannelId: voiceChannel.id,
				textChannelId: textChannelId,
				selfMute: false,
				selfDeaf: true,
				vcRegion: voiceChannel.rtcRegion!,
			});
		}

		// Connect to the voice channel
		if (!player.connected) {
			await player.connect();
		}

		return {
			success: true,
			message: `Joined your voice channel: ${voiceChannel.name}`,
			channelName: voiceChannel.name,
			channelId: voiceChannel.id
		};
	});

	// Queue management
	fastify.get('/guilds/:guildId/queue', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);
		
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		return {
			current: player.queue.current ? {
				title: player.queue.current.info.title,
				author: player.queue.current.info.author,
				duration: player.queue.current.info.duration,
				uri: player.queue.current.info.uri,
				thumbnail: player.queue.current.info.artworkUrl,
			} : null,
			tracks: player.queue.tracks.map((track, index) => ({
				index,
				title: track.info.title,
				author: track.info.author,
				duration: track.info.duration,
				uri: track.info.uri,
				thumbnail: track.info.artworkUrl,
			})),
		};
	});

	fastify.delete('/guilds/:guildId/queue/:index', async (request) => {
		const { guildId, index } = request.params as { guildId: string; index: string };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const trackIndex = parseInt(index);
		if (trackIndex < 0 || trackIndex >= player.queue.tracks.length) {
			throw fastify.httpErrors.badRequest('Invalid track index');
		}

		player.queue.remove(trackIndex);

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
		}

		return { success: true };
	});

	// Force play - Add track to front of queue and play immediately
	fastify.post('/guilds/:guildId/player/force-play', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { query } = request.body as { query: string };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const result = await player.search({ query }, { id: 'dashboard-force' });
		if (!result || !result.tracks.length) {
			throw fastify.httpErrors.badRequest('No tracks found');
		}

		const track = result.tracks[0];

		// Add to front of queue
		player.queue.splice(0, 0, track);

		// Skip current track to play the forced track
		if (player.playing) {
			await player.skip();
		} else {
			await player.play();
		}

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
		}

		return { success: true, track: track.info, message: 'Track added to front of queue and playing' };
	});

	// Move track in queue
	fastify.post('/guilds/:guildId/queue/move', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { from, to } = request.body as { from: number; to: number };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		if (from < 0 || from >= player.queue.tracks.length || to < 0 || to >= player.queue.tracks.length) {
			throw fastify.httpErrors.badRequest('Invalid track indices');
		}

		// Move track from one position to another
		const track = player.queue.tracks.splice(from, 1)[0];
		player.queue.tracks.splice(to, 0, track);

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
		}

		return { success: true, message: 'Track moved successfully' };
	});

	// Jump to specific track in queue
	fastify.post('/guilds/:guildId/queue/jump/:index', async (request) => {
		const { guildId, index } = request.params as { guildId: string; index: string };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const trackIndex = parseInt(index);
		if (trackIndex < 0 || trackIndex >= player.queue.tracks.length) {
			throw fastify.httpErrors.badRequest('Invalid track index');
		}

		// Remove all tracks before the target track
		player.queue.tracks.splice(0, trackIndex);

		// Skip current track to play the target track
		await player.skip();

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
		}

		return { success: true, message: 'Jumped to track successfully' };
	});

	// Clear entire queue
	fastify.post('/guilds/:guildId/queue/clear', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const clearedCount = player.queue.tracks.length;
		player.queue.tracks.splice(0, player.queue.tracks.length);

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
		}

		return { success: true, message: `Cleared ${clearedCount} tracks from queue` };
	});

	// Shuffle queue
	fastify.post('/guilds/:guildId/queue/shuffle', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		// Fisher-Yates shuffle algorithm
		const tracks = player.queue.tracks;
		for (let i = tracks.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[tracks[i], tracks[j]] = [tracks[j], tracks[i]];
		}

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
		}

		return { success: true, message: 'Queue shuffled successfully' };
	});

	// Guild settings
	fastify.put('/guilds/:guildId/settings', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const settings = request.body as any;

		const guild = client.guilds.cache.get(guildId);
		if (!guild) {
			throw fastify.httpErrors.notFound('Guild not found');
		}

		// Update guild settings in database
		if (settings.prefix) {
			await client.db.setPrefix(guildId, settings.prefix);
		}

		if (settings.language) {
			await client.db.updateLanguage(guildId, settings.language);
		}

		if (settings.textChannelId !== undefined) {
			// Validate the text channel exists and bot has access
			if (settings.textChannelId) {
				const textChannel = guild.channels.cache.get(settings.textChannelId);
				if (!textChannel || textChannel.type !== 0) { // 0 = GUILD_TEXT
					throw fastify.httpErrors.badRequest('Invalid text channel or channel not found');
				}

				// Check if bot has permission to send messages in the channel
				const botMember = guild.members.cache.get(client.user!.id);
				if (!botMember) {
					throw fastify.httpErrors.internalServerError('Bot not found in guild');
				}

				const permissions = textChannel.permissionsFor(botMember);
				if (!permissions?.has(['SendMessages', 'ViewChannel'])) {
					throw fastify.httpErrors.forbidden('Bot does not have permission to send messages in this channel');
				}
			}

			await client.db.setTextChannel(guildId, settings.textChannelId || null);
		}

		return { success: true };
	});

	// Get available text channels for guild
	fastify.get('/guilds/:guildId/channels', async (request) => {
		const { guildId } = request.params as { guildId: string };

		const guild = client.guilds.cache.get(guildId);
		if (!guild) {
			throw fastify.httpErrors.notFound('Guild not found');
		}

		const botMember = guild.members.cache.get(client.user!.id);
		if (!botMember) {
			throw fastify.httpErrors.internalServerError('Bot not found in guild');
		}

		// Get text channels where bot has permission to send messages
		const textChannels = guild.channels.cache
			.filter(channel => {
				if (channel.type !== 0) return false; // Only text channels
				const permissions = channel.permissionsFor(botMember);
				return permissions?.has(['SendMessages', 'ViewChannel']);
			})
			.map(channel => ({
				id: channel.id,
				name: channel.name,
				position: 'position' in channel ? channel.position : 0,
			}))
			.sort((a, b) => a.position - b.position);

		return { channels: textChannels };
	});

	// Lavalink nodes status
	fastify.get('/nodes', async () => {
		return client.manager.nodeManager.nodes.map(node => ({
			id: node.id,
			host: node.options.host,
			port: node.options.port,
			connected: node.connected,
			stats: node.stats,
		}));
	});

	// Playlist Management API

	// Get user's playlists
	fastify.get('/playlists', async (request) => {
		const user = request.user as any;
		const { guildId } = request.query as { guildId?: string };

		const playlists = await client.db.getUserPlaylists(user.userId, guildId);
		return { playlists };
	});

	// Get public playlists
	fastify.get('/playlists/public', async (request) => {
		const { limit } = request.query as { limit?: string };
		const playlists = await client.db.getPublicPlaylists(limit ? parseInt(limit) : 20);
		return { playlists };
	});

	// Search playlists
	fastify.get('/playlists/search', async (request) => {
		const user = request.user as any;
		const { q } = request.query as { q: string };

		if (!q) {
			throw fastify.httpErrors.badRequest('Search query is required');
		}

		const playlists = await client.db.searchPlaylists(q, user.userId);
		return { playlists };
	});

	// Get specific playlist
	fastify.get('/playlists/:playlistId', async (request) => {
		const { playlistId } = request.params as { playlistId: string };
		const playlist = await client.db.getPlaylistById(playlistId);

		if (!playlist) {
			throw fastify.httpErrors.notFound('Playlist not found');
		}

		return { playlist };
	});

	// Create new playlist
	fastify.post('/playlists', async (request) => {
		const user = request.user as any;
		const { name, description, tracks, guildId, isPublic } = request.body as {
			name: string;
			description?: string;
			tracks?: any[];
			guildId?: string;
			isPublic?: boolean;
		};

		if (!name) {
			throw fastify.httpErrors.badRequest('Playlist name is required');
		}

		const tracksJson = tracks ? JSON.stringify(tracks) : JSON.stringify([]);

		try {
			const playlist = await client.db.createPlaylistAdvanced(
				user.userId,
				name,
				tracksJson,
				{ guildId, description, isPublic }
			);

			return { success: true, playlist };
		} catch (error: any) {
			if (error.code === 'P2002') {
				throw fastify.httpErrors.conflict('Playlist with this name already exists');
			}
			throw error;
		}
	});

	// Update playlist
	fastify.put('/playlists/:playlistId', async (request) => {
		const user = request.user as any;
		const { playlistId } = request.params as { playlistId: string };
		const updates = request.body as {
			name?: string;
			description?: string;
			tracks?: any[];
			isPublic?: boolean;
		};

		// Check if user owns the playlist
		const playlist = await client.db.getPlaylistById(playlistId);
		if (!playlist || playlist.userId !== user.userId) {
			throw fastify.httpErrors.forbidden('You can only edit your own playlists');
		}

		const updateData: any = {};
		if (updates.name) updateData.name = updates.name;
		if (updates.description !== undefined) updateData.description = updates.description;
		if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic;
		if (updates.tracks) updateData.tracks = JSON.stringify(updates.tracks);

		const updatedPlaylist = await client.db.updatePlaylistAdvanced(playlistId, updateData);
		return { success: true, playlist: updatedPlaylist };
	});

	// Delete playlist
	fastify.delete('/playlists/:playlistId', async (request) => {
		const user = request.user as any;
		const { playlistId } = request.params as { playlistId: string };

		// Check if user owns the playlist
		const playlist = await client.db.getPlaylistById(playlistId);
		if (!playlist || playlist.userId !== user.userId) {
			throw fastify.httpErrors.forbidden('You can only delete your own playlists');
		}

		await client.db.deletePlaylist(user.userId, playlist.name);
		return { success: true };
	});

	// Load playlist to queue
	fastify.post('/guilds/:guildId/playlists/:playlistId/load', async (request) => {
		const { guildId, playlistId } = request.params as { guildId: string; playlistId: string };
		const { shuffle } = request.body as { shuffle?: boolean };

		const playlist = await client.db.getPlaylistById(playlistId);
		if (!playlist) {
			throw fastify.httpErrors.notFound('Playlist not found');
		}

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const tracks = playlist.tracks ? JSON.parse(playlist.tracks) : [];
		if (tracks.length === 0) {
			throw fastify.httpErrors.badRequest('Playlist is empty');
		}

		// Increment play count
		await client.db.incrementPlayCount(playlistId);

		// Add tracks to queue
		for (const trackData of tracks) {
			try {
				// Decode the track and add to queue
				const track = client.manager.utils.buildTrack(trackData, { id: 'dashboard' });
				await player.queue.add(track);
			} catch (error) {
				console.error('Error adding track to queue:', error);
			}
		}

		if (shuffle) {
			player.queue.shuffle();
		}

		if (!player.playing) {
			await player.play();
		}

		return {
			success: true,
			message: `Loaded ${tracks.length} tracks from playlist "${playlist.name}"`,
			tracksLoaded: tracks.length
		};
	});

	// Add track to playlist
	fastify.post('/playlists/:playlistId/tracks', async (request) => {
		const user = request.user as any;
		const { playlistId } = request.params as { playlistId: string };
		const { query } = request.body as { query: string };

		// Check if user owns the playlist
		const playlist = await client.db.getPlaylistById(playlistId);
		if (!playlist || playlist.userId !== user.userId) {
			throw fastify.httpErrors.forbidden('You can only edit your own playlists');
		}

		try {
			// Check if manager is available
			if (!client.manager || !client.manager.nodeManager.nodes.size) {
				throw fastify.httpErrors.serviceUnavailable('Music service is not available. Please try again later.');
			}

			// Search for the track
			const searchResult = await client.manager.search(query, { id: 'dashboard' });
			if (!searchResult.tracks.length) {
				throw fastify.httpErrors.notFound('No tracks found for this search');
			}

			const track = searchResult.tracks[0];
			const currentTracks = playlist.tracks ? JSON.parse(playlist.tracks) : [];

			// Add the new track
			currentTracks.push({
				encoded: track.encoded,
				info: track.info,
				pluginInfo: track.pluginInfo,
				userData: track.userData
			});

			// Update playlist
			await client.db.updatePlaylistAdvanced(playlistId, {
				tracks: JSON.stringify(currentTracks)
			});

			return {
				success: true,
				message: `Added "${track.info.title}" to playlist`,
				track: track.info
			};
		} catch (error: any) {
			throw fastify.httpErrors.internalServerError(`Failed to add track: ${error.message}`);
		}
	});

	// Remove track from playlist
	fastify.delete('/playlists/:playlistId/tracks/:trackIndex', async (request) => {
		const user = request.user as any;
		const { playlistId, trackIndex } = request.params as { playlistId: string; trackIndex: string };

		// Check if user owns the playlist
		const playlist = await client.db.getPlaylistById(playlistId);
		if (!playlist || playlist.userId !== user.userId) {
			throw fastify.httpErrors.forbidden('You can only edit your own playlists');
		}

		const currentTracks = playlist.tracks ? JSON.parse(playlist.tracks) : [];
		const index = parseInt(trackIndex);

		if (index < 0 || index >= currentTracks.length) {
			throw fastify.httpErrors.badRequest('Invalid track index');
		}

		const removedTrack = currentTracks.splice(index, 1)[0];

		// Update playlist
		await client.db.updatePlaylistAdvanced(playlistId, {
			tracks: JSON.stringify(currentTracks)
		});

		return {
			success: true,
			message: `Removed "${removedTrack.info.title}" from playlist`
		};
	});

	// Import playlist from URL (YouTube, Spotify, etc.)
	fastify.post('/playlists/import', async (request) => {
		const user = request.user as any;
		const { url, name, description, guildId, isPublic } = request.body as {
			url: string;
			name?: string;
			description?: string;
			guildId?: string;
			isPublic?: boolean;
		};

		if (!url) {
			throw fastify.httpErrors.badRequest('URL is required');
		}

		try {
			// Check if manager is available
			if (!client.manager || !client.manager.nodeManager.nodes.size) {
				throw fastify.httpErrors.serviceUnavailable('Music service is not available. Please try again later.');
			}

			// Search for the playlist/album
			const searchResult = await client.manager.search(url, { id: 'dashboard' });

			if (!searchResult.tracks.length) {
				throw fastify.httpErrors.notFound('No tracks found at this URL');
			}

			// Determine playlist name
			let playlistName = name;
			if (!playlistName) {
				if (searchResult.playlist?.name) {
					playlistName = searchResult.playlist.name;
				} else {
					playlistName = `Imported Playlist ${new Date().toLocaleDateString()}`;
				}
			}

			// Prepare tracks data
			const tracks = searchResult.tracks.map(track => ({
				encoded: track.encoded,
				info: track.info,
				pluginInfo: track.pluginInfo,
				userData: track.userData
			}));

			// Create playlist
			const playlist = await client.db.createPlaylistAdvanced(
				user.userId,
				playlistName,
				JSON.stringify(tracks),
				{
					guildId,
					description: description || `Imported from ${new URL(url).hostname}`,
					isPublic
				}
			);

			return {
				success: true,
				playlist,
				message: `Successfully imported ${tracks.length} tracks`,
				tracksImported: tracks.length
			};
		} catch (error: any) {
			if (error.code === 'P2002') {
				throw fastify.httpErrors.conflict('Playlist with this name already exists');
			}
			throw fastify.httpErrors.internalServerError(`Failed to import playlist: ${error.message}`);
		}
	});

	// Get playlist tracks with details
	fastify.get('/playlists/:playlistId/tracks', async (request) => {
		const { playlistId } = request.params as { playlistId: string };
		const playlist = await client.db.getPlaylistById(playlistId);

		if (!playlist) {
			throw fastify.httpErrors.notFound('Playlist not found');
		}

		const tracks = playlist.tracks ? JSON.parse(playlist.tracks) : [];
		const trackDetails = tracks.map((track: any, index: number) => ({
			index,
			title: track.info.title,
			author: track.info.author,
			duration: track.info.length,
			uri: track.info.uri,
			thumbnail: track.info.artworkUrl || track.info.thumbnail,
			encoded: track.encoded
		}));

		return {
			playlist: {
				id: playlist.id,
				name: playlist.name,
				description: (playlist as any).description,
				trackCount: tracks.length,
				isPublic: (playlist as any).isPublic,
				createdAt: (playlist as any).createdAt,
				updatedAt: (playlist as any).updatedAt
			},
			tracks: trackDetails
		};
	});
}
