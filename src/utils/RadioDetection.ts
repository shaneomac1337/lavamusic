import type { Player, Track } from 'lavalink-client';
import type { Lavamusic } from '../structures/index';

interface RadioStation {
	id: string;
	name: string;
	apiUrl: string;
	streamUrls: string[];
	apiFormat: 'radia_cz' | 'actve_net' | 'custom'; // For different API formats
	color?: string; // For UI theming
	country?: string; // For organization
}

interface RadioSongInfo {
	title: string;
	artist: string;
	album?: string | null;
	artwork?: string | null;
	startTime?: string | null;
	endTime?: string | null;
	station: string;
}

export class RadioDetectionService {
	private client: Lavamusic;
	private radioStations: Map<string, RadioStation>;
	private activeRadioPlayers: Map<string, { stationId: string; interval: NodeJS.Timeout; lastSongId?: string }>;
	private static allIntervals: Set<NodeJS.Timeout> = new Set(); // Track all intervals globally

	constructor(client: Lavamusic) {
		this.client = client;
		this.radioStations = new Map();
		this.activeRadioPlayers = new Map();

		// Initialize radio stations
		this.initializeRadioStations();

		console.log(`🎵 RadioDetectionService initialized. Total global intervals: ${RadioDetectionService.allIntervals.size}`);

		// Add debug method to global scope for easy access
		(global as any).debugRadio = () => this.getDebugInfo();
		(global as any).clearRadio = () => this.forceStopAll();
	}

	private initializeRadioStations(): void {
		// Add Hitradio FM Plus
		this.radioStations.set('hitradio-fm-plus', {
			id: 'hitradio-fm-plus',
			name: 'Hitradio FM Plus',
			apiUrl: 'https://radia.cz/api/v1/radio/hitradio-fm-plus/songs/now.json',
			streamUrls: [
				'https://ice.radia.cz/fmplus128.aac',
				'fmplus128.aac',
				'fmplus',
				'hitradio fm plus'
			],
			apiFormat: 'radia_cz',
			color: '#ef4444',
			country: 'CZ'
		});

		// Add Radio Blaník
		this.radioStations.set('radio-blanik', {
			id: 'radio-blanik',
			name: 'Radio Blaník',
			apiUrl: 'https://radia.cz/api/v1/radio/radio-blanik/songs/now.json',
			streamUrls: [
				'https://ice2.radia.cz/blanikfm128.mp3',
				'blanikfm128.mp3',
				'blanikfm',
				'blanik',
				'radio blaník'
			],
			apiFormat: 'radia_cz',
			color: '#3b82f6',
			country: 'CZ'
		});

		// Add Rock Radio Šumava
		this.radioStations.set('rock-radio-sumava', {
			id: 'rock-radio-sumava',
			name: 'Rock Radio Šumava',
			apiUrl: 'https://radia.cz/api/v1/radio/rock-radio/songs/now.json',
			streamUrls: [
				'http://ice.abradio.cz:8000/sumava128.mp3',
				'sumava128.mp3',
				'sumava128',
				'sumava',
				'rock radio šumava',
				'rock radio sumava'
			],
			apiFormat: 'radia_cz',
			color: '#7c3aed',
			country: 'CZ'
		});

		// Add Radio Golem (no API - stream metadata only)
		this.radioStations.set('radio-golem', {
			id: 'radio-golem',
			name: 'Radio Golem',
			apiUrl: '', // No API available
			streamUrls: [
				'https://stream.sepia.sk:8000/rvhudba320.mp3',
				'rvhudba320.mp3',
				'rvhudba320',
				'rvhudba',
				'radio golem',
				'golem'
			],
			apiFormat: 'custom', // Custom format for stream metadata
			color: '#059669',
			country: 'SK'
		});

		// Add Evropa 2
		this.radioStations.set('evropa2', {
			id: 'evropa2',
			name: 'Evropa 2',
			apiUrl: 'https://rds.actve.net/v1/metadata/channel/evropa2',
			streamUrls: [
				'https://29103.live.streamtheworld.com/EVROPA2.mp3',
				'EVROPA2.mp3',
				'evropa2.mp3',
				'evropa2',
				'evropa 2'
			],
			apiFormat: 'actve_net', // actve.net API format
			color: '#f59e0b',
			country: 'CZ'
		});

		// Add Fajn Radio
		this.radioStations.set('fajn-radio', {
			id: 'fajn-radio',
			name: 'Fajn Radio',
			apiUrl: 'https://radia.cz/api/v1/radio/fajn-radio/songs/now.json',
			streamUrls: [
				'https://ice.abradio.cz/fajn128.mp3',
				'fajn128.mp3',
				'fajn128',
				'fajn',
				'fajn radio'
			],
			apiFormat: 'radia_cz',
			color: '#10b981', // Green color
			country: 'CZ'
		});

		// Add Radio Beat
		this.radioStations.set('radio-beat', {
			id: 'radio-beat',
			name: 'Radio Beat',
			apiUrl: 'https://radia.cz/api/v1/radio/radio-beat/songs/now.json',
			streamUrls: [
				'https://icecast2.play.cz/beat128aac',
				'beat128aac',
				'beat128',
				'beat',
				'radio beat'
			],
			apiFormat: 'radia_cz',
			color: '#8b5cf6', // Purple color
			country: 'CZ'
		});

		// Add Kiss Proton
		this.radioStations.set('kiss-proton', {
			id: 'kiss-proton',
			name: 'Kiss Proton',
			apiUrl: 'https://radia.cz/api/v1/radio/radio-kiss/songs/now.json',
			streamUrls: [
				'https://icecast1.play.cz/kissproton128.mp3',
				'kissproton128.mp3',
				'kissproton128',
				'kissproton',
				'kiss proton',
				'kiss',
				'proton'
			],
			apiFormat: 'radia_cz',
			color: '#ec4899', // Pink color
			country: 'CZ'
		});

		// More radio stations can be added here
	}

	public isRadioStream(track: Track): string | null {
		const uri = track.info.uri?.toLowerCase() || '';
		const title = track.info.title?.toLowerCase() || '';

		console.log(`Checking if track is radio stream:`, {
			uri,
			title,
			author: track.info.author
		});

		for (const [stationId, station] of this.radioStations) {
			console.log(`Checking station ${stationId}:`, station.streamUrls);

			// Check if URI matches any of the station's stream URLs
			for (const streamUrl of station.streamUrls) {
				if (uri.includes(streamUrl.toLowerCase())) {
					console.log(`✅ Radio stream detected: ${stationId} (matched URI: ${streamUrl})`);
					return stationId;
				}
			}

			// Check if title matches station name
			if (title.includes(station.name.toLowerCase())) {
				console.log(`✅ Radio stream detected: ${stationId} (matched title: ${station.name})`);
				return stationId;
			}
		}

		console.log(`❌ No radio stream detected for track`);
		return null;
	}

	public async startRadioDetection(player: Player, track: Track): Promise<void> {
		const stationId = this.isRadioStream(track);
		if (!stationId) return;

		console.log(`Starting radio detection for ${stationId} on guild ${player.guildId}`);

		// Stop any existing detection for this player
		this.stopRadioDetection(player.guildId);

		// Start periodic song detection with faster updates
		const interval = setInterval(async () => {
			console.log(`⏰ Interval triggered for ${stationId} (guild: ${player.guildId}). Total global intervals: ${RadioDetectionService.allIntervals.size}`);

			// Verify the player is still active and playing the same radio station
			const currentStationId = this.getActiveRadioStation(player.guildId);
			if (currentStationId !== stationId) {
				console.log(`⚠️ Station mismatch detected! Expected: ${stationId}, Current: ${currentStationId}. Stopping interval.`);
				RadioDetectionService.allIntervals.delete(interval);
				clearInterval(interval);
				return;
			}

			// Verify the player still exists and is playing
			if (!player || !player.queue.current) {
				console.log(`⚠️ Player no longer active for guild ${player.guildId}. Stopping radio detection.`);
				RadioDetectionService.allIntervals.delete(interval);
				this.stopRadioDetection(player.guildId);
				return;
			}

			await this.updateRadioSongInfo(player, stationId);
		}, 10000); // Update every 10 seconds for faster detection

		// Track this interval globally
		RadioDetectionService.allIntervals.add(interval);
		console.log(`➕ Added interval for ${stationId}. Total global intervals: ${RadioDetectionService.allIntervals.size}`);

		// Store the active detection
		this.activeRadioPlayers.set(player.guildId, { stationId, interval, lastSongId: undefined });

		console.log(`✅ Radio detection started for ${stationId} on guild ${player.guildId}. Active stations:`,
			Array.from(this.activeRadioPlayers.entries()).map(([guildId, radio]) => `${guildId}:${radio.stationId}`));

		// Log debug info immediately
		console.log(`🔍 DEBUG INFO:`, this.getDebugInfo());

		// Update immediately when radio starts
		await this.updateRadioSongInfo(player, stationId);

		// Schedule aggressive quick checks for faster initial detection
		const quickChecks = [2000, 5000, 8000, 15000]; // Check at 2s, 5s, 8s, 15s
		quickChecks.forEach(delay => {
			setTimeout(async () => {
				// Only do quick check if this radio session is still active
				if (this.getActiveRadioStation(player.guildId) === stationId) {
					await this.updateRadioSongInfo(player, stationId);
				}
			}, delay);
		});
	}

	public stopRadioDetection(guildId: string): void {
		const activeRadio = this.activeRadioPlayers.get(guildId);
		if (activeRadio) {
			console.log(`🛑 Stopping radio detection for guild ${guildId} (station: ${activeRadio.stationId})`);

			// Remove from global tracking
			RadioDetectionService.allIntervals.delete(activeRadio.interval);
			console.log(`➖ Removed interval for ${activeRadio.stationId}. Total global intervals: ${RadioDetectionService.allIntervals.size}`);

			clearInterval(activeRadio.interval);
			this.activeRadioPlayers.delete(guildId);

			console.log(`✅ Radio detection stopped. Remaining active stations:`,
				Array.from(this.activeRadioPlayers.entries()).map(([gId, radio]) => `${gId}:${radio.stationId}`));
		} else {
			console.log(`ℹ️ No active radio detection found for guild ${guildId}`);
		}
	}

	private async updateRadioSongInfo(player: Player, stationId: string): Promise<void> {
		// Add stack trace to see where this is being called from
		console.log(`🔍 updateRadioSongInfo called for ${stationId} (guild: ${player.guildId})`);
		console.log(`🔍 Call stack:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));

		const station = this.radioStations.get(stationId);
		if (!station) {
			console.error(`❌ Station ${stationId} not found in radio stations map`);
			return;
		}

		// Double-check that this guild should be getting updates for this station
		const activeRadio = this.activeRadioPlayers.get(player.guildId);
		if (!activeRadio || activeRadio.stationId !== stationId) {
			console.log(`⚠️ Guild ${player.guildId} is not supposed to be getting updates for ${stationId}. Expected: ${activeRadio?.stationId || 'none'}`);
			console.log(`⚠️ Current active radios:`, Array.from(this.activeRadioPlayers.entries()));
			return;
		}

		// Verify the current track is still a radio stream for this station
		if (player.queue.current) {
			const currentTrackStation = this.isRadioStream(player.queue.current);
			if (currentTrackStation !== stationId) {
				console.log(`⚠️ Current track is not for station ${stationId}, it's for ${currentTrackStation}. Stopping this interval.`);
				this.stopRadioDetection(player.guildId);
				return;
			}
		}

		try {
			let songInfo: RadioSongInfo | null = null;

			// Check if station has an API
			if (station.apiUrl && station.apiUrl.trim() !== '') {
				console.log(`🔄 Fetching radio song info for ${stationId} from ${station.apiUrl} (guild: ${player.guildId})`);

				const response = await fetch(station.apiUrl, {
					headers: {
						'User-Agent': 'Lavamusic-Bot/1.0'
					}
				});

				if (!response.ok) {
					console.log(`❌ Radio API returned ${response.status} for ${stationId}`);
					return;
				}

				const data = await response.json();
				console.log(`📡 Radio API response for ${stationId}:`, data);

				// Parse based on station API format
				if (station.apiFormat === 'radia_cz') {
					// radia.cz API format
					if (data && data.song && data.interpret && data.active) {
						songInfo = {
							title: data.song,
							artist: data.interpret,
							album: null,
							artwork: data.image || null,
							startTime: data.beginAt || null,
							endTime: data.endAt || null,
							station: station.name
						};
					}
				} else if (station.apiFormat === 'actve_net') {
					// actve.net API format (Evropa 2)
					if (data && data.status === 'ok' && data.title && data.artist) {
						songInfo = {
							title: data.title,
							artist: data.artist,
							album: data.album || null,
							artwork: data.cover || null,
							startTime: data.songStart || null,
							endTime: null, // Not provided in this format
							station: station.name
						};
					}
				}
				// Future API formats can be added here
			} else {
				// Station without API - create basic info
				console.log(`📻 Station ${stationId} has no API - using basic radio info (guild: ${player.guildId})`);
				songInfo = {
					title: 'Live Radio Stream',
					artist: station.name,
					album: null,
					artwork: null,
					startTime: null,
					endTime: null,
					station: station.name
				};
			}

			if (songInfo) {
				// Check if this is a new song
				const activeRadio = this.activeRadioPlayers.get(player.guildId);
				const currentSongId = `${songInfo.artist}-${songInfo.title}`;
				const isNewSong = !activeRadio?.lastSongId || activeRadio.lastSongId !== currentSongId;

				if (isNewSong) {
					console.log(`🎵 New song detected for ${stationId}:`, songInfo);

					// Update last song ID immediately
					if (activeRadio) {
						activeRadio.lastSongId = currentSongId;
					}

					// Update the player's current track info immediately
					this.updatePlayerTrackInfo(player, songInfo);

					// Update bot status immediately
					this.client.utils.updateStatus(this.client);

					// Send announcement to chat immediately
					await this.announceNewSong(player, songInfo);

					// Emit to web dashboard via Socket.IO immediately
					this.emitRadioUpdate(player.guildId, songInfo);

					console.log(`✅ Immediately updated radio song info for ${stationId} (guild: ${player.guildId}):`, songInfo);
				} else {
					// Even if not a new song, still update track info and dashboard (for consistency)
					this.updatePlayerTrackInfo(player, songInfo);
					this.emitRadioUpdate(player.guildId, songInfo);
				}
			} else {
				console.log(`No valid song data found for ${stationId}`);
			}

		} catch (error) {
			console.error(`Error fetching radio song info for ${stationId}:`, error);
		}
	}

	private updatePlayerTrackInfo(player: Player, songInfo: RadioSongInfo): void {
		// Update the current track's info without changing the actual track
		if (player.queue.current) {
			// Store original info in case we need to restore it
			if (!player.get('originalTrackInfo')) {
				player.set('originalTrackInfo', {
					title: player.queue.current.info.title,
					author: player.queue.current.info.author,
					artworkUrl: player.queue.current.info.artworkUrl
				});
			}

			// Update track info with radio song data
			player.queue.current.info.title = songInfo.title;
			player.queue.current.info.author = `${songInfo.artist} • ${songInfo.station}`;
			if (songInfo.artwork) {
				player.queue.current.info.artworkUrl = songInfo.artwork;
			}
		}
	}

	private async announceNewSong(player: Player, songInfo: RadioSongInfo): Promise<void> {
		try {
			const guild = this.client.guilds.cache.get(player.guildId);
			if (!guild) return;

			// Get the configured text channel (prefer setup channel, fallback to player's text channel)
			let textChannelId = player.textChannelId;

			// Check if there's a setup channel configured
			const setup = await this.client.db.getSetup(player.guildId);
			if (setup?.textId) {
				textChannelId = setup.textId;
			}

			if (!textChannelId) return;

			const channel = guild.channels.cache.get(textChannelId);
			if (!channel || !channel.isTextBased()) return;

			// Create embed for the new song announcement
			const embed = this.client
				.embed()
				.setAuthor({
					name: `🎵 Now Playing on ${songInfo.station}`,
					iconURL: this.client.user?.displayAvatarURL({ extension: 'png' }),
				})
				.setColor(0xff6b6b) // Red color for radio
				.setDescription(`**[${songInfo.title}](${songInfo.artwork || 'https://example.com'})**`)
				.addFields([
					{
						name: '🎤 Artist',
						value: songInfo.artist,
						inline: true,
					},
					{
						name: '📻 Station',
						value: songInfo.station,
						inline: true,
					},
				])
				.setTimestamp();

			// Add artwork if available
			if (songInfo.artwork) {
				embed.setThumbnail(songInfo.artwork);
			}

			// Add start/end time if available
			if (songInfo.startTime && songInfo.endTime) {
				const startTime = new Date(songInfo.startTime);
				const endTime = new Date(songInfo.endTime);
				const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

				embed.addFields([
					{
						name: '⏱️ Duration',
						value: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
						inline: true,
					}
				]);
			}

			await channel.send({ embeds: [embed] });
			console.log(`Announced new radio song in guild ${player.guildId}: ${songInfo.artist} - ${songInfo.title}`);

		} catch (error) {
			console.error('Error announcing new radio song:', error);
		}
	}

	private emitRadioUpdate(guildId: string, songInfo: RadioSongInfo): void {
		// Emit to web dashboard if web server is available
		if (this.client.webServer) {
			const io = this.client.webServer.getIO();
			if (io) {
				io.to(`guild:${guildId}`).emit('trackStart', {
					guildId: guildId,
					track: {
						title: songInfo.title,
						author: `${songInfo.artist} • ${songInfo.station}`,
						duration: 0, // Radio streams don't have duration
						uri: '', // Keep original URI
						thumbnail: songInfo.artwork || null,
					},
				});

				console.log(`Emitted radio update to web dashboard for guild ${guildId}:`, songInfo);
			}
		}
	}

	public isRadioActive(guildId: string): boolean {
		return this.activeRadioPlayers.has(guildId);
	}

	public getActiveRadioStation(guildId: string): string | null {
		const activeRadio = this.activeRadioPlayers.get(guildId);
		return activeRadio ? activeRadio.stationId : null;
	}

	public getAllRadioStations(): Map<string, RadioStation> {
		return this.radioStations;
	}

	public getRadioStation(stationId: string): RadioStation | undefined {
		return this.radioStations.get(stationId);
	}

	// Clean up when player is destroyed
	public cleanup(): void {
		console.log(`🧹 Cleaning up all radio detection intervals. Active count: ${this.activeRadioPlayers.size}, Global intervals: ${RadioDetectionService.allIntervals.size}`);

		for (const [guildId, activeRadio] of this.activeRadioPlayers) {
			console.log(`🛑 Clearing interval for guild ${guildId} (station: ${activeRadio.stationId})`);
			RadioDetectionService.allIntervals.delete(activeRadio.interval);
			clearInterval(activeRadio.interval);
		}
		this.activeRadioPlayers.clear();

		// Force clear any remaining global intervals (safety net)
		console.log(`🧹 Force clearing ${RadioDetectionService.allIntervals.size} remaining global intervals`);
		for (const interval of RadioDetectionService.allIntervals) {
			clearInterval(interval);
		}
		RadioDetectionService.allIntervals.clear();

		console.log(`✅ All radio detection intervals cleared. Global count: ${RadioDetectionService.allIntervals.size}`);
	}

	// Debug method to check active radio sessions
	public debugActiveRadios(): void {
		console.log(`🔍 Active radio detection sessions: ${this.activeRadioPlayers.size}`);
		for (const [guildId, activeRadio] of this.activeRadioPlayers) {
			console.log(`  - Guild ${guildId}: ${activeRadio.stationId} (last song: ${activeRadio.lastSongId || 'none'})`);
		}
	}

	// Force cleanup for a specific guild (useful for debugging)
	public forceCleanupGuild(guildId: string): void {
		console.log(`🔧 Force cleaning up radio detection for guild ${guildId}`);
		this.stopRadioDetection(guildId);
	}

	// Quick debug methods for eval command
	public getDebugInfo(): any {
		return {
			activeRadioPlayers: Array.from(this.activeRadioPlayers.entries()).map(([guildId, radio]) => ({
				guildId,
				stationId: radio.stationId,
				lastSongId: radio.lastSongId,
				hasInterval: !!radio.interval
			})),
			globalIntervalsCount: RadioDetectionService.allIntervals.size,
			radioStations: Array.from(this.radioStations.keys())
		};
	}

	public forceStopAll(): number {
		const count = RadioDetectionService.allIntervals.size;
		this.cleanup();
		return count;
	}

	// Force an immediate song check for a specific guild
	public async forceUpdateNow(guildId: string): Promise<void> {
		const activeRadio = this.activeRadioPlayers.get(guildId);
		if (!activeRadio) {
			console.log(`No active radio session for guild ${guildId}`);
			return;
		}

		const player = this.client.manager.players.get(guildId);
		if (!player) {
			console.log(`No player found for guild ${guildId}`);
			return;
		}

		console.log(`🚀 Force updating radio song info for ${activeRadio.stationId} (guild: ${guildId})`);
		await this.updateRadioSongInfo(player, activeRadio.stationId);
	}
}
