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

	// Audio Filters API
	fastify.post('/guilds/:guildId/filters/bassboost', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { level } = request.body as { level: 'high' | 'medium' | 'low' | 'off' };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const { EQList } = await import('lavalink-client');

		switch (level) {
			case 'high':
				await player.filterManager.setEQ(EQList.BassboostHigh);
				break;
			case 'medium':
				await player.filterManager.setEQ(EQList.BassboostMedium);
				break;
			case 'low':
				await player.filterManager.setEQ(EQList.BassboostLow);
				break;
			case 'off':
				await player.filterManager.clearEQ();
				break;
		}

		return { success: true, level };
	});

	fastify.post('/guilds/:guildId/filters/toggle', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { filter } = request.body as { filter: string };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		let enabled = false;

		switch (filter) {
			case '8d':
				const rotationEnabled = player.filterManager.filters.rotation;
				if (rotationEnabled) {
					await player.filterManager.toggleRotation();
					enabled = false;
				} else {
					await player.filterManager.toggleRotation(0.2);
					enabled = true;
				}
				break;
			case 'nightcore':
				const nightcoreEnabled = player.filterManager.filters.nightcore;
				await player.filterManager.toggleNightcore();
				enabled = !nightcoreEnabled;
				break;
			case 'karaoke':
				const karaokeEnabled = player.filterManager.filters.karaoke;
				await player.filterManager.toggleKaraoke();
				enabled = !karaokeEnabled;
				break;
			case 'vibrato':
				const vibratoEnabled = player.filterManager.filters.vibrato;
				await player.filterManager.toggleVibrato();
				enabled = !vibratoEnabled;
				break;
			case 'tremolo':
				const tremoloEnabled = player.filterManager.filters.tremolo;
				await player.filterManager.toggleTremolo();
				enabled = !tremoloEnabled;
				break;
			case 'lowpass':
				const lowpassEnabled = player.filterManager.filters.lowPass;
				await player.filterManager.toggleLowPass();
				enabled = !lowpassEnabled;
				break;
			default:
				throw fastify.httpErrors.badRequest('Invalid filter type');
		}

		return { success: true, filter, enabled };
	});

	fastify.post('/guilds/:guildId/filters/pitch', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { pitch } = request.body as { pitch: number };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		if (pitch < 0.5 || pitch > 5) {
			throw fastify.httpErrors.badRequest('Pitch must be between 0.5 and 5.0');
		}

		await player.filterManager.setPitch(pitch);
		return { success: true, pitch };
	});

	fastify.post('/guilds/:guildId/filters/speed', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { speed } = request.body as { speed: number };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		if (speed < 0.5 || speed > 5) {
			throw fastify.httpErrors.badRequest('Speed must be between 0.5 and 5.0');
		}

		await player.filterManager.setSpeed(speed);
		return { success: true, speed };
	});

	fastify.post('/guilds/:guildId/filters/reset', async (request) => {
		const { guildId } = request.params as { guildId: string };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		player.filterManager.resetFilters();
		player.filterManager.clearEQ();
		return { success: true, message: 'All filters reset' };
	});

	fastify.get('/guilds/:guildId/filters/status', async (request) => {
		const { guildId } = request.params as { guildId: string };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		const filters = player.filterManager.filters;
		return {
			bassboost: filters.equalizer && filters.equalizer.length > 0 ? 'active' : 'off',
			rotation: !!filters.rotation,
			karaoke: !!filters.karaoke,
			vibrato: !!filters.vibrato,
			tremolo: !!filters.tremolo,
			lowpass: !!filters.lowPass,
			nightcore: !!filters.nightcore,
			pitch: 1, // Default pitch value
			speed: 1, // Default speed value
		};
	});

	// Advanced Settings API
	fastify.post('/guilds/:guildId/settings/247', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { enabled } = request.body as { enabled: boolean };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		// Toggle 24/7 mode
		player.set('247', enabled);

		return { success: true, enabled };
	});

	fastify.post('/guilds/:guildId/settings/autoplay', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const { enabled } = request.body as { enabled: boolean };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		// Toggle autoplay
		player.set('autoplay', enabled);

		return { success: true, enabled };
	});

	fastify.get('/guilds/:guildId/settings', async (request) => {
		const { guildId } = request.params as { guildId: string };

		const player = client.manager.getPlayer(guildId);
		if (!player) {
			return {
				'247': false,
				autoplay: false,
				volume: 50
			};
		}

		return {
			'247': player.get('247') || false,
			autoplay: player.get('autoplay') || false,
			volume: player.volume || 50
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

	// Player controls with auto-join
	fastify.post('/guilds/:guildId/player/play', {
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
		const { query } = request.body as { query: string };
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

		let player = client.manager.getPlayer(guildId);

		// Auto-join logic: If no player or not connected, try to join user's voice channel
		if (!player || !player.connected) {
			// Check if user is in a voice channel
			if (!member.voice.channel) {
				throw fastify.httpErrors.badRequest('You must be in a voice channel to play music');
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

				console.log(`🤖 Auto-created player for guild ${guildId} via dashboard play`);
			}

			// Connect to the voice channel
			if (!player.connected) {
				await player.connect();
				console.log(`🔗 Auto-connected to voice channel ${voiceChannel.name} via dashboard play`);
			}

			// If bot is in a different voice channel, move to user's channel
			if (player.voiceChannelId !== voiceChannel.id) {
				await player.disconnect();
				player.voiceChannelId = voiceChannel.id;
				await player.connect();
				console.log(`🔄 Moved bot to user's voice channel ${voiceChannel.name} via dashboard play`);
			}
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

		return {
			success: true,
			track: result.tracks[0].info,
			autoJoined: !player || !player.connected // Indicate if auto-join happened
		};
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

	// Force play - Add track to front of queue and play immediately with auto-join
	fastify.post('/guilds/:guildId/player/force-play', {
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
		const { query } = request.body as { query: string };
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

		let player = client.manager.getPlayer(guildId);

		// Auto-join logic: If no player or not connected, try to join user's voice channel
		if (!player || !player.connected) {
			// Check if user is in a voice channel
			if (!member.voice.channel) {
				throw fastify.httpErrors.badRequest('You must be in a voice channel to play music');
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

				console.log(`🤖 Auto-created player for guild ${guildId} via dashboard force-play`);
			}

			// Connect to the voice channel
			if (!player.connected) {
				await player.connect();
				console.log(`🔗 Auto-connected to voice channel ${voiceChannel.name} via dashboard force-play`);
			}

			// If bot is in a different voice channel, move to user's channel
			if (player.voiceChannelId !== voiceChannel.id) {
				await player.disconnect();
				player.voiceChannelId = voiceChannel.id;
				await player.connect();
				console.log(`🔄 Moved bot to user's voice channel ${voiceChannel.name} via dashboard force-play`);
			}
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

		return {
			success: true,
			track: track.info,
			message: 'Track added to front of queue and playing',
			autoJoined: !player || !player.connected // Indicate if auto-join happened
		};
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

	// Load playlist to queue with auto-join
	fastify.post('/guilds/:guildId/playlists/:playlistId/load', {
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
		const { guildId, playlistId } = request.params as { guildId: string; playlistId: string };
		const { shuffle } = request.body as { shuffle?: boolean };
		const user = request.user as any;

		const playlist = await client.db.getPlaylistById(playlistId);
		if (!playlist) {
			throw fastify.httpErrors.notFound('Playlist not found');
		}

		const guild = client.guilds.cache.get(guildId);
		if (!guild) {
			throw fastify.httpErrors.notFound('Guild not found');
		}

		// Find the user in the guild
		const member = guild.members.cache.get(user.userId);
		if (!member) {
			throw fastify.httpErrors.notFound('You are not a member of this guild');
		}

		let player = client.manager.getPlayer(guildId);

		// Auto-join logic: If no player or not connected, try to join user's voice channel
		if (!player || !player.connected) {
			// Check if user is in a voice channel
			if (!member.voice.channel) {
				throw fastify.httpErrors.badRequest('You must be in a voice channel to load a playlist');
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

				console.log(`🤖 Auto-created player for guild ${guildId} via dashboard playlist load`);
			}

			// Connect to the voice channel
			if (!player.connected) {
				await player.connect();
				console.log(`🔗 Auto-connected to voice channel ${voiceChannel.name} via dashboard playlist load`);
			}

			// If bot is in a different voice channel, move to user's channel
			if (player.voiceChannelId !== voiceChannel.id) {
				await player.disconnect();
				player.voiceChannelId = voiceChannel.id;
				await player.connect();
				console.log(`🔄 Moved bot to user's voice channel ${voiceChannel.name} via dashboard playlist load`);
			}
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

	// Test radio endpoint
	fastify.get('/radio/test', async () => {
		return { success: true, message: 'Radio API is working' };
	});

	// Get all available radio stations
	fastify.get('/radio/stations', async () => {
		const stations = Array.from(client.radioDetection.getAllRadioStations().entries()).map(([id, station]) => ({
			id,
			name: station.name,
			country: station.country,
			color: station.color
		}));

		return {
			success: true,
			stations
		};
	});

	// Radio station now playing API
	fastify.get('/radio/:stationId/now-playing', async (request, reply) => {
		const { stationId } = request.params as { stationId: string };

		// Define radio station APIs
		const radioAPIs: Record<string, string> = {
			'hitradio-fm-plus': 'https://radia.cz/api/v1/radio/hitradio-fm-plus/songs/now.json',
			'radio-blanik': 'https://radia.cz/api/v1/radio/radio-blanik/songs/now.json',
			'rock-radio-sumava': 'https://radia.cz/api/v1/radio/rock-radio/songs/now.json',
			'radio-golem': '', // No API available - stream metadata only
			'evropa2': 'https://rds.actve.net/v1/metadata/channel/evropa2',
			'fajn-radio': 'https://radia.cz/api/v1/radio/fajn-radio/songs/now.json',
			'radio-beat': 'https://radia.cz/api/v1/radio/radio-beat/songs/now.json',
			'kiss-proton': 'https://radia.cz/api/v1/radio/radio-kiss/songs/now.json'
			// More radio stations can be added here
		};

		const apiUrl = radioAPIs[stationId];
		if (apiUrl === undefined) {
			return reply.code(404).send({
				success: false,
				error: 'Radio station not found',
				station: stationId,
				nowPlaying: null
			});
		}

		// Handle stations without APIs
		if (apiUrl === '') {
			console.log(`Station ${stationId} has no API - returning basic info`);
			const stationNames: Record<string, string> = {
				'radio-golem': 'Radio Golem'
			};

			return reply.send({
				success: true,
				station: stationId,
				nowPlaying: {
					title: 'Live Radio Stream',
					artist: stationNames[stationId] || 'Unknown Station',
					album: null,
					duration: null,
					startTime: null,
					endTime: null,
					artwork: null,
					station: stationNames[stationId] || 'Unknown Station'
				},
				message: 'Station does not provide song information',
				lastUpdated: new Date().toISOString()
			});
		}

		try {
			console.log(`Fetching radio data for ${stationId} from: ${apiUrl}`);

			const response = await fetch(apiUrl, {
				headers: {
					'User-Agent': 'Lavamusic-Dashboard/1.0'
				}
			});

			if (!response.ok) {
				console.log(`Radio API returned ${response.status} for ${stationId}`);
				return reply.send({
					success: false,
					station: stationId,
					error: `Radio API returned ${response.status}`,
					nowPlaying: null
				});
			}

			const data = await response.json();
			console.log(`Radio API response for ${stationId}:`, data);

			// Parse the response based on the radio station format
			let nowPlaying = null;

			if (stationId === 'hitradio-fm-plus' || stationId === 'radio-blanik' || stationId === 'rock-radio-sumava' || stationId === 'fajn-radio' || stationId === 'radio-beat' || stationId === 'kiss-proton') {
				// Parse radia.cz API response (all six stations use same format)
				// Expected format: { interpret: "ARTIST", song: "TITLE", image: "URL", beginAt: "TIME", endAt: "TIME", active: true }
				const stationNames: Record<string, string> = {
					'hitradio-fm-plus': 'Hitradio FM Plus',
					'radio-blanik': 'Radio Blaník',
					'rock-radio-sumava': 'Rock Radio Šumava',
					'fajn-radio': 'Fajn Radio',
					'radio-beat': 'Radio Beat',
					'kiss-proton': 'Kiss Proton'
				};
				const stationName = stationNames[stationId];

				if (data && data.song && data.interpret && data.active) {
					nowPlaying = {
						title: data.song,
						artist: data.interpret,
						album: null,
						duration: null,
						startTime: data.beginAt || null,
						endTime: data.endAt || null,
						artwork: data.image || null,
						station: stationName
					};
				} else {
					console.log(`No valid song data found for ${stationId}:`, data);
					// Return success but no song info if data is incomplete
					return reply.send({
						success: true,
						station: stationId,
						nowPlaying: null,
						message: 'Song information not yet available',
						lastUpdated: new Date().toISOString()
					});
				}
			} else if (stationId === 'evropa2') {
				// Parse actve.net API response (Evropa 2)
				// Expected format: { status: "ok", title: "TITLE", artist: "ARTIST", album: "ALBUM", cover: "URL", songStart: "TIME" }
				if (data && data.status === 'ok' && data.title && data.artist) {
					nowPlaying = {
						title: data.title,
						artist: data.artist,
						album: data.album || null,
						duration: data.duration || null,
						startTime: data.songStart || null,
						endTime: null, // Not provided in this format
						artwork: data.cover || null,
						station: 'Evropa 2'
					};
				} else {
					console.log(`No valid song data found for ${stationId}:`, data);
					// Return success but no song info if data is incomplete
					return reply.send({
						success: true,
						station: stationId,
						nowPlaying: null,
						message: 'Song information not yet available',
						lastUpdated: new Date().toISOString()
					});
				}
			}

			return reply.send({
				success: true,
				station: stationId,
				nowPlaying,
				lastUpdated: new Date().toISOString()
			});
		} catch (error: any) {
			console.error(`Error fetching now playing for ${stationId}:`, error);
			return reply.send({
				success: false,
				station: stationId,
				error: error.message,
				nowPlaying: null
			});
		}
	});
}
