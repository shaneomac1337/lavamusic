import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Lavamusic } from '../../structures/index';
import { FloweryTTS } from '../../utils/FloweryTTS';
import { AudioStreamManager } from '../../utils/AudioStreamManager';

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

	// Get available search sources
	fastify.get('/search/sources', async (request) => {
		const user = request.user as any;
		const userPreferredSource = (user && user.id) ? await client.db.getUserPreferredSource(user.id) : 'youtubemusic';

		return {
			sources: [
				{ id: 'youtubemusic', name: 'YouTube Music', icon: 'fab fa-youtube' },
				{ id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify' },
				{ id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube' },
				{ id: 'soundcloud', name: 'SoundCloud', icon: 'fab fa-soundcloud' }
			],
			default: userPreferredSource
		};
	});

	// Update user's preferred search source
	fastify.post('/search/source', async (request) => {
		const user = request.user as any;
		const { source } = request.body as { source: string };

		if (!user) {
			return { success: false, error: 'Not authenticated' };
		}

		const validSources = ['youtubemusic', 'spotify', 'youtube', 'soundcloud'];
		if (!validSources.includes(source)) {
			return { success: false, error: 'Invalid source' };
		}

		await client.db.setUserPreferredSource(user.id, source);
		return { success: true, source };
	});

	// Search suggestions for autocomplete
	fastify.get('/search/suggestions', async (request) => {
		const { q, source } = request.query as { q: string; source?: string };

		if (!q || q.trim().length < 2) {
			return { suggestions: [] };
		}

		try {
			// Check if manager is available
			if (!client.manager || !client.manager.nodeManager.nodes.size) {
				return { suggestions: [] };
			}

			// Map dashboard source names to search engine formats
			const sourceMap: Record<string, string> = {
				'youtubemusic': 'ytmsearch',
				'spotify': 'spsearch',
				'youtube': 'ytsearch',
				'soundcloud': 'scsearch'
			};

			const searchSource = sourceMap[source || 'youtubemusic'] || 'ytmsearch';
			const searchQuery = `${searchSource}:${q.trim()}`;
			const searchResult = await client.manager.search(searchQuery, { id: 'dashboard-search' });
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
						source: searchSource,
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
		const { query, source } = request.body as { query: string; source?: string };
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

		// Map dashboard source names to search engine formats
		const sourceMap: Record<string, string> = {
			'youtubemusic': 'ytmsearch',
			'spotify': 'spsearch',
			'youtube': 'ytsearch',
			'soundcloud': 'scsearch'
		};

		const searchSource = sourceMap[source || 'youtubemusic'] || 'ytmsearch';
		const searchQuery = `${searchSource}:${query}`;
		const result = await player.search({ query: searchQuery }, { id: 'dashboard' });
		if (!result || !result.tracks.length) {
			throw fastify.httpErrors.badRequest('No tracks found');
		}

		const track = result.tracks[0];

		// Add requester information for dashboard tracking
		track.requester = {
			id: user.userId,
			username: user.username,
			discriminator: user.discriminator || '0',
			avatar: user.avatar
		};

		await player.queue.add(track);
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

			// Emit queue update since queue was reordered
			if (webServer) {
				webServer.emitQueueUpdateForGuild(guildId);
			}
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

	// Text-to-Speech (TTS) with auto-join
	fastify.post('/guilds/:guildId/tts/speak', {
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
		const { text } = request.body as { text: string };
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

		// Validate text input
		if (!text || text.trim().length === 0) {
			throw fastify.httpErrors.badRequest('Text is required for TTS');
		}

		if (text.length > 200) {
			throw fastify.httpErrors.badRequest('Text must be 200 characters or less');
		}

		let player = client.manager.getPlayer(guildId);

		// Auto-join logic: If no player or not connected, try to join user's voice channel
		if (!player || !player.connected) {
			// Check if user is in a voice channel
			if (!member.voice.channel) {
				throw fastify.httpErrors.badRequest('You must be in a voice channel to use TTS');
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

				console.log(`🤖 Auto-created player for guild ${guildId} via dashboard TTS`);
			}

			// Connect to the voice channel
			if (!player.connected) {
				await player.connect();
				console.log(`🔗 Auto-connected to voice channel ${voiceChannel.name} via dashboard TTS`);
			}

			// If bot is in a different voice channel, move to user's channel
			if (player.voiceChannelId !== voiceChannel.id) {
				await player.disconnect();
				player.voiceChannelId = voiceChannel.id;
				await player.connect();
				console.log(`🔄 Moved bot to user's voice channel ${voiceChannel.name} via dashboard TTS`);
			}
		}

		try {
			// Use DuncteBot TTS (simple format without language prefix)
			// Language is controlled by the ttsLanguage setting in Lavalink config
			const query = `speak:${text.trim()}`;
			const result = await player.search({ query }, { id: 'dashboard-tts' });

			if (!result || !result.tracks || result.tracks.length === 0) {
				throw fastify.httpErrors.badRequest('TTS generation failed - no audio track created');
			}

			const track = result.tracks[0];

			// Add requester information for dashboard tracking
			track.requester = {
				id: user.userId,
				username: user.username,
				discriminator: user.discriminator || '0',
				avatar: user.avatar
			};

			await player.queue.add(track);

			if (!player.playing && !player.paused) {
				await player.play();
			}

			// Emit queue update
			if (webServer) {
				webServer.emitQueueUpdateForGuild(guildId);
			}

			return {
				success: true,
				message: `TTS added to queue: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
				text: text,
				textLength: text.length,
				track: {
					title: track.info.title,
					author: track.info.author,
					duration: track.info.duration
				},
				autoJoined: !player || !player.connected // Indicate if auto-join happened
			};
		} catch (error: any) {
			console.error('TTS Error:', error);
			throw fastify.httpErrors.internalServerError(`TTS failed: ${error.message || 'Unknown error'}`);
		}
	});

	// FloweryTTS - Get available voices
	fastify.get('/tts/flowery/voices', async () => {
		try {
			const voicesData = await FloweryTTS.getVoices();
			return {
				success: true,
				...voicesData
			};
		} catch (error: any) {
			console.error('Error fetching FloweryTTS voices:', error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch voices: ${error.message}`);
		}
	});

	// FloweryTTS - Get popular voices
	fastify.get('/tts/flowery/voices/popular', async () => {
		try {
			const popularVoices = await FloweryTTS.getPopularVoices();
			return {
				success: true,
				voices: popularVoices,
				count: popularVoices.length
			};
		} catch (error: any) {
			console.error('Error fetching popular FloweryTTS voices:', error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch popular voices: ${error.message}`);
		}
	});

	// FloweryTTS - Get filtered voices with advanced options
	fastify.get('/tts/flowery/voices/filtered', async (request) => {
		const query = request.query as any;

		try {
			const filter: any = {};

			// Parse query parameters
			if (query.languages) {
				filter.languages = Array.isArray(query.languages) ? query.languages : [query.languages];
			}
			if (query.genders) {
				filter.genders = Array.isArray(query.genders) ? query.genders : [query.genders];
			}
			if (query.sources) {
				filter.sources = Array.isArray(query.sources) ? query.sources : [query.sources];
			}
			if (query.search) {
				filter.search = query.search;
			}
			if (query.limit) {
				filter.limit = parseInt(query.limit);
			}
			if (query.sortBy) {
				filter.sortBy = query.sortBy;
			}
			if (query.sortOrder) {
				filter.sortOrder = query.sortOrder;
			}

			const voices = await FloweryTTS.getFilteredVoices(filter);
			return {
				success: true,
				voices,
				count: voices.length,
				filter
			};
		} catch (error: any) {
			console.error('Error fetching filtered FloweryTTS voices:', error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch filtered voices: ${error.message}`);
		}
	});

	// FloweryTTS - Get voice categories
	fastify.get('/tts/flowery/voices/categories', async () => {
		try {
			const categories = FloweryTTS.getVoiceCategories();
			return {
				success: true,
				categories
			};
		} catch (error: any) {
			console.error('Error fetching FloweryTTS voice categories:', error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch voice categories: ${error.message}`);
		}
	});



	// FloweryTTS - Get voices by language
	fastify.get('/tts/flowery/voices/language/:languageCode', async (request) => {
		const { languageCode } = request.params as { languageCode: string };

		try {
			const voices = await FloweryTTS.getVoicesByLanguage(languageCode);
			return {
				success: true,
				voices,
				count: voices.length,
				language: languageCode
			};
		} catch (error: any) {
			console.error(`Error fetching FloweryTTS voices for language ${languageCode}:`, error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch voices for language: ${error.message}`);
		}
	});

	// FloweryTTS - Get Czech voices
	fastify.get('/tts/flowery/voices/czech', async () => {
		try {
			const czechVoices = await FloweryTTS.getCzechVoices();
			return {
				success: true,
				voices: czechVoices,
				count: czechVoices.length,
				language: 'Czech'
			};
		} catch (error: any) {
			console.error('Error fetching Czech FloweryTTS voices:', error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch Czech voices: ${error.message}`);
		}
	});

	// FloweryTTS - Get English voices
	fastify.get('/tts/flowery/voices/english', async () => {
		try {
			const englishVoices = await FloweryTTS.getEnglishVoices();
			return {
				success: true,
				voices: englishVoices,
				count: englishVoices.length,
				language: 'English'
			};
		} catch (error: any) {
			console.error('Error fetching English FloweryTTS voices:', error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch English voices: ${error.message}`);
		}
	});

	// FloweryTTS - Get Japanese voices
	fastify.get('/tts/flowery/voices/japanese', async () => {
		try {
			const japaneseVoices = await FloweryTTS.getJapaneseVoices();
			return {
				success: true,
				voices: japaneseVoices,
				count: japaneseVoices.length,
				language: 'Japanese'
			};
		} catch (error: any) {
			console.error('Error fetching Japanese FloweryTTS voices:', error);
			throw fastify.httpErrors.internalServerError(`Failed to fetch Japanese voices: ${error.message}`);
		}
	});

	// FloweryTTS - Generate TTS with auto-join
	fastify.post('/guilds/:guildId/tts/flowery', {
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
		const { text, voice, speed, translate, silence, audio_format } = request.body as {
			text: string;
			voice?: string;
			speed?: number;
			translate?: boolean;
			silence?: number;
			audio_format?: string;
		};
		const user = request.user as any;

		const guild = client.guilds.cache.get(guildId);
		if (!guild) {
			throw fastify.httpErrors.notFound('Guild not found');
		}

		// Validate input
		if (!text || text.trim().length === 0) {
			throw fastify.httpErrors.badRequest('Text is required for TTS');
		}

		if (text.length > FloweryTTS.getCharacterLimit()) {
			throw fastify.httpErrors.badRequest(`Text must be ${FloweryTTS.getCharacterLimit()} characters or less`);
		}

		// Find the user in the guild
		const member = guild.members.cache.get(user.userId);
		if (!member) {
			throw fastify.httpErrors.notFound('You are not a member of this guild');
		}

		let player = client.manager.getPlayer(guildId);
		let autoJoined = false;

		// Auto-join logic: If no player or not connected, try to join user's voice channel
		if (!player || !player.connected) {
			// Check if user is in a voice channel
			if (!member.voice.channel) {
				throw fastify.httpErrors.badRequest('You must be in a voice channel to use TTS');
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

				console.log(`🤖 Auto-created player for guild ${guildId} via FloweryTTS dashboard`);
				autoJoined = true;
			}

			// Connect to the voice channel
			if (!player.connected) {
				await player.connect();
				console.log(`🔗 Auto-connected to voice channel ${voiceChannel.name} via FloweryTTS dashboard`);
				autoJoined = true;
			}

			// If bot is in a different voice channel, move to user's channel
			if (player.voiceChannelId !== voiceChannel.id) {
				await player.disconnect();
				player.voiceChannelId = voiceChannel.id;
				await player.connect();
				console.log(`🔄 Moved bot to user's voice channel ${voiceChannel.name} via FloweryTTS dashboard`);
				autoJoined = true;
			}
		}

		try {
			// Generate TTS using FloweryTTS
			const ttsResult = await FloweryTTS.generateTTS({
				text: text.trim(),
				voice,
				speed,
				translate,
				silence,
				audio_format: audio_format as any || 'mp3'
			});

			if (!ttsResult.success || !ttsResult.audioBuffer) {
				throw fastify.httpErrors.badRequest(`FloweryTTS generation failed: ${ttsResult.error || 'Unknown error'}`);
			}

			// Create a temporary audio stream
			const audioStreamManager = AudioStreamManager.getInstance();
			await audioStreamManager.initialize(); // Ensure server is running

			const streamUrl = audioStreamManager.createStreamFromTTS(ttsResult, audio_format as string || 'mp3');
			if (!streamUrl) {
				throw fastify.httpErrors.internalServerError('Failed to create audio stream');
			}

			// Search for the audio using Lavalink (this creates a track object)
			const result = await player.search({ query: streamUrl }, { id: 'flowery-tts-dashboard' });

			if (!result || !result.tracks || result.tracks.length === 0) {
				throw fastify.httpErrors.badRequest('Failed to create audio track from FloweryTTS');
			}

			const track = result.tracks[0];

			// Customize track info for better display
			track.info.title = `TTS: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
			track.info.author = `FloweryTTS${voice ? ` (${voice})` : ''}`;
			track.info.duration = ttsResult.duration || 30000; // Fallback duration

			// Add requester information for dashboard tracking
			track.requester = {
				id: user.userId,
				username: user.username,
				discriminator: user.discriminator || '0',
				avatar: user.avatar
			};

			await player.queue.add(track);

			if (!player.playing && !player.paused) {
				await player.play();
			}

			// Emit queue update
			if (webServer) {
				webServer.emitQueueUpdateForGuild(guildId);
			}

			return {
				success: true,
				message: `FloweryTTS added to queue: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
				text: text,
				textLength: text.length,
				voice: ttsResult.voiceUsed,
				speed: speed || 1.0,
				translate: translate || false,
				track: {
					title: track.info.title,
					author: track.info.author,
					duration: track.info.duration
				},
				autoJoined
			};
		} catch (error: any) {
			console.error('FloweryTTS Error:', error);
			throw fastify.httpErrors.internalServerError(`FloweryTTS failed: ${error.message || 'Unknown error'}`);
		}
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

	// Get queue with full track data for playlist creation
	fastify.get('/guilds/:guildId/queue/full', async (request) => {
		const { guildId } = request.params as { guildId: string };
		const player = client.manager.getPlayer(guildId);

		if (!player) {
			throw fastify.httpErrors.notFound('Player not found');
		}

		return {
			current: player.queue.current ? {
				encoded: player.queue.current.encoded,
				info: player.queue.current.info,
				pluginInfo: player.queue.current.pluginInfo,
				userData: player.queue.current.userData
			} : null,
			tracks: player.queue.tracks.map((track) => ({
				encoded: track.encoded,
				info: track.info,
				pluginInfo: track.pluginInfo,
				userData: track.userData
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
		const { query, source } = request.body as { query: string; source?: string };
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

		// Map dashboard source names to search engine formats
		const sourceMap: Record<string, string> = {
			'youtubemusic': 'ytmsearch',
			'spotify': 'spsearch',
			'youtube': 'ytsearch',
			'soundcloud': 'scsearch'
		};

		const searchSource = sourceMap[source || 'youtubemusic'] || 'ytmsearch';
		const searchQuery = `${searchSource}:${query}`;
		const result = await player.search({ query: searchQuery }, { id: 'dashboard-force' });
		if (!result || !result.tracks.length) {
			throw fastify.httpErrors.badRequest('No tracks found');
		}

		const track = result.tracks[0];

		// Add requester information for dashboard tracking
		track.requester = {
			id: user.userId,
			username: user.username,
			discriminator: user.discriminator || '0',
			avatar: user.avatar
		};

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

				// Add requester information for dashboard tracking
				track.requester = {
					id: user.userId,
					username: user.username,
					discriminator: user.discriminator || '0',
					avatar: user.avatar
				};

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

		// Emit queue update
		if (webServer) {
			webServer.emitQueueUpdateForGuild(guildId);
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
		const { query, source } = request.body as { query: string; source?: string };

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

			// Search for the track with specified source
			// Map dashboard source names to search engine formats
			const sourceMap: Record<string, string> = {
				'youtubemusic': 'ytmsearch',
				'spotify': 'spsearch',
				'youtube': 'ytsearch',
				'soundcloud': 'scsearch'
			};

			const searchSource = sourceMap[source || 'youtubemusic'] || 'ytmsearch';
			const searchQuery = `${searchSource}:${query}`;
			const searchResult = await client.manager.search(searchQuery, { id: 'dashboard' });
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
