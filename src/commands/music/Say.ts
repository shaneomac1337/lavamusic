import { type GuildMember } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';
import { FloweryTTS } from '../../utils/FloweryTTS';
import { AudioStreamManager } from '../../utils/AudioStreamManager';

export default class Say extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'say',
			description: {
				content: 'cmd.say.description',
				examples: ['say Hello world!', 'say Welcome to the server'],
				usage: 'say <text>',
			},
			category: 'music',
			aliases: ['quicktts'],
			cooldown: 3,
			args: true,
			vote: false,
			player: {
				voice: true,
				dj: false,
				active: false,
				djPerm: null,
			},
			permissions: {
				dev: false,
				client: ['SendMessages', 'ReadMessageHistory', 'ViewChannel', 'EmbedLinks', 'Connect', 'Speak'],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: 'text',
					description: 'cmd.say.options.text',
					type: 3,
					required: true,
				},
				{
					name: 'provider',
					description: 'TTS provider to use (default: DuncteBot)',
					type: 3,
					required: false,
					choices: [
						{ name: '🤖 DuncteBot (Default)', value: 'duncte' },
						{ name: '🌸 FloweryTTS (Advanced)', value: 'flowery' }
					]
				},
			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed();
		const memberVoiceChannel = (ctx.member as GuildMember).voice?.channel;

		if (!memberVoiceChannel) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('event.message.no_voice_channel', { command: 'say' }))],
			});
		}

		let player = client.manager.getPlayer(ctx.guild!.id);
		if (!player) {
			player = client.manager.createPlayer({
				guildId: ctx.guild!.id,
				voiceChannelId: memberVoiceChannel.id,
				textChannelId: ctx.channel.id,
				selfMute: false,
				selfDeaf: true,
				vcRegion: memberVoiceChannel.rtcRegion!,
			});
		}

		if (!player.connected) await player.connect();

		// Get text and provider from args or slash command
		let text: string;
		let provider = 'duncte'; // Default to DuncteBot for compatibility

		if (ctx.isInteraction) {
			text = ctx.options.get('text')?.value as string;
			provider = ctx.options.get('provider')?.value as string || 'duncte';
		} else {
			// Parse prefix command arguments
			const argString = args.join(' ');
			const providerMatch = argString.match(/--provider\s+(flowery|duncte)/);
			if (providerMatch) {
				provider = providerMatch[1];
				text = argString.replace(/--provider\s+(flowery|duncte)/, '').trim();
			} else {
				text = argString;
			}
		}

		if (!text || text.length === 0) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.no_text'))],
			});
		}

		// Check character limits based on provider
		const maxLength = provider === 'flowery' ? 2048 : 200;
		if (text.length > maxLength) {
			return await ctx.sendMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(
					`Text is too long! Maximum ${maxLength} characters for ${provider === 'flowery' ? 'FloweryTTS' : 'DuncteBot'}.\nYour text: ${text.length} characters`
				)],
			});
		}

		await ctx.sendDeferMessage(ctx.locale('cmd.say.loading'));

		try {
			if (provider === 'flowery') {
				// Use FloweryTTS
				const ttsResult = await FloweryTTS.generateTTS({
					text: text.trim(),
					audio_format: 'mp3'
				});

				if (!ttsResult.success || !ttsResult.audioBuffer) {
					// Fallback to DuncteBot if FloweryTTS fails and text is short enough
					if (text.length <= 200) {
						const query = `speak:${text}`;
						const response = await player.search({ query }, ctx.author);

						if (!response || !response.tracks || response.tracks.length === 0) {
							return await ctx.editMessage({
								embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.tts_failed'))],
							});
						}

						const track = response.tracks[0];
						await player.queue.add(track);

						if (!player.playing && !player.paused) {
							await player.play();
						}

						return await ctx.editMessage({
							embeds: [
								embed
									.setColor(this.client.color.yellow)
									.setDescription(`⚠️ FloweryTTS failed, used DuncteBot fallback\n${ctx.locale('cmd.say.success', { text: text.substring(0, 150) + (text.length > 150 ? '...' : '') })}`)
									.addFields([
										{
											name: ctx.locale('cmd.say.fields.text_length'),
											value: `${text.length} characters`,
											inline: true,
										},
										{
											name: ctx.locale('cmd.say.fields.voice'),
											value: 'DuncteBot (Fallback)',
											inline: true,
										},
									]),
							],
						});
					} else {
						return await ctx.editMessage({
							embeds: [embed.setColor(this.client.color.red).setDescription(`FloweryTTS failed: ${ttsResult.error || 'Unknown error'}`)],
						});
					}
				}

				// Create audio stream for FloweryTTS
				const audioStreamManager = AudioStreamManager.getInstance();
				await audioStreamManager.initialize();

				const streamUrl = audioStreamManager.createStreamFromTTS(ttsResult, 'mp3');
				if (!streamUrl) {
					throw new Error('Failed to create audio stream');
				}

				// Search and add to queue
				const result = await player.search({ query: streamUrl }, ctx.author);
				if (!result || !result.tracks || result.tracks.length === 0) {
					throw new Error('Failed to create audio track');
				}

				const track = result.tracks[0];
				track.info.title = `TTS: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
				track.info.author = 'FloweryTTS';
				track.info.duration = ttsResult.duration || 30000;

				await player.queue.add(track);

				if (!player.playing && !player.paused) {
					await player.play();
				}

				return await ctx.editMessage({
					embeds: [
						embed
							.setColor(this.client.color.main)
							.setDescription(ctx.locale('cmd.say.success', { text: text.substring(0, 150) + (text.length > 150 ? '...' : '') }))
							.addFields([
								{
									name: ctx.locale('cmd.say.fields.text_length'),
									value: `${text.length} characters`,
									inline: true,
								},
								{
									name: ctx.locale('cmd.say.fields.voice'),
									value: '🌸 FloweryTTS',
									inline: true,
								},
							]),
					],
				});

			} else {
				// Use DuncteBot TTS (default)
				const query = `speak:${text}`;
				const response = await player.search({ query }, ctx.author);

				if (!response || !response.tracks || response.tracks.length === 0) {
					return await ctx.editMessage({
						embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.tts_failed'))],
					});
				}

				const track = response.tracks[0];
				await player.queue.add(track);

				if (!player.playing && !player.paused) {
					await player.play();
				}

				return await ctx.editMessage({
					embeds: [
						embed
							.setColor(this.client.color.main)
							.setDescription(ctx.locale('cmd.say.success', { text: text.substring(0, 150) + (text.length > 150 ? '...' : '') }))
							.addFields([
								{
									name: ctx.locale('cmd.say.fields.text_length'),
									value: `${text.length} characters`,
									inline: true,
								},
								{
									name: ctx.locale('cmd.say.fields.voice'),
									value: '🤖 DuncteBot',
									inline: true,
								},
							]),
					],
				});
			}
		} catch (error) {
			this.client.logger.error('TTS Error:', error);
			return await ctx.editMessage({
				embeds: [embed.setColor(this.client.color.red).setDescription(ctx.locale('cmd.say.errors.tts_failed'))],
			});
		}
	}
}
