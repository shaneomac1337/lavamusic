import { ApplicationCommandOptionType } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';
import { FloweryTTS } from '../../utils/FloweryTTS';
import { AudioStreamManager } from '../../utils/AudioStreamManager';

export default class Tts extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'tts',
			description: {
				content: 'Generate text-to-speech using FloweryTTS with advanced options',
				examples: [
					'tts Hello world',
					'tts --voice en-US-AriaNeural --speed 1.2 Hello everyone!',
					'tts --translate --voice cs-CZ-AntoninNeural Ahoj světe',
					'tts --quality flac --voice en-US-AriaNeural High quality audio',
					'tts --provider duncte Simple TTS'
				],
				usage: 'tts [--provider flowery|duncte] [--voice voice_id] [--speed 0.5-3.0] [--quality aac|ogg_opus|flac] [--translate] <text>',
			},
			category: 'music',
			aliases: ['speak', 'flowery'],
			cooldown: 5,
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
				client: ['SendMessages', 'ReadMessageHistory', 'ViewChannel', 'EmbedLinks'],
				user: [],
			},
			slashCommand: true,
			options: [
				{
					name: 'text',
					description: 'Text to convert to speech (max 2048 characters for FloweryTTS)',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
				{
					name: 'provider',
					description: 'TTS provider to use',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: '🌸 FloweryTTS (Advanced)', value: 'flowery' },
						{ name: '🤖 DuncteBot (Simple)', value: 'duncte' }
					]
				},
				{
					name: 'voice',
					description: 'Voice ID to use (FloweryTTS only)',
					type: ApplicationCommandOptionType.String,
					required: false,
				},
				{
					name: 'speed',
					description: 'Speech speed (0.5-3.0, FloweryTTS only)',
					type: ApplicationCommandOptionType.Number,
					required: false,
					min_value: 0.5,
					max_value: 3.0
				},
				{
					name: 'translate',
					description: 'Auto-translate text to voice language (FloweryTTS only)',
					type: ApplicationCommandOptionType.Boolean,
					required: false,
				},
				{
					name: 'quality',
					description: 'Audio quality/format (FloweryTTS only)',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: '🎶 AAC - Good Quality, Small Size (Recommended)', value: 'aac' },
						{ name: '🎧 OGG Opus - High Quality, Efficient', value: 'ogg_opus' },
						{ name: '🏆 FLAC - Lossless, Best Quality', value: 'flac' }
					]
				}
			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed();

		// Parse arguments for prefix commands
		let text = '';
		let provider = 'flowery'; // Default to FloweryTTS
		let voice = '';
		let speed = 1.0;
		let translate = false;
		let quality = 'aac';

		if (ctx.isInteraction) {
			// Slash command - get options directly
			text = ctx.options?.getString('text') || '';
			provider = ctx.options?.getString('provider') || 'flowery';
			voice = ctx.options?.getString('voice') || '';
			speed = ctx.options?.getNumber('speed') || 1.0;
			translate = ctx.options?.getBoolean('translate') || false;
			quality = ctx.options?.getString('quality') || 'aac';
		} else {
			// Prefix command - parse arguments
			const argString = args.join(' ');

			// Parse flags
			const providerMatch = argString.match(/--provider\s+(flowery|duncte)/);
			if (providerMatch) provider = providerMatch[1];

			const voiceMatch = argString.match(/--voice\s+([^\s]+)/);
			if (voiceMatch) voice = voiceMatch[1];

			const speedMatch = argString.match(/--speed\s+([\d.]+)/);
			if (speedMatch) speed = parseFloat(speedMatch[1]);

			const qualityMatch = argString.match(/--quality\s+(aac|ogg_opus|flac)/);
			if (qualityMatch) quality = qualityMatch[1];

			const translateMatch = argString.match(/--translate/);
			if (translateMatch) translate = true;

			// Extract text (remove all flags)
			text = argString
				.replace(/--provider\s+(flowery|duncte)/, '')
				.replace(/--voice\s+[^\s]+/, '')
				.replace(/--speed\s+[\d.]+/, '')
				.replace(/--quality\s+(aac|ogg_opus|flac)/, '')
				.replace(/--translate/, '')
				.trim();
		}

		// Validate input
		if (!text) {
			return await ctx.sendMessage({
				embeds: [
					embed.setColor(this.client.color.red).setDescription(
						'❌ Please provide text to convert to speech.\n\n' +
						'**Examples:**\n' +
						'`/tts text:Hello world`\n' +
						'`!tts --voice en-US-AriaNeural Hello everyone`\n' +
						'`!tts --provider duncte Simple TTS`'
					)
				],
			});
		}

		// Check character limits
		const maxLength = provider === 'flowery' ? 2048 : 200;
		if (text.length > maxLength) {
			return await ctx.sendMessage({
				embeds: [
					embed.setColor(this.client.color.red).setDescription(
						`❌ Text is too long! Maximum ${maxLength} characters for ${provider === 'flowery' ? 'FloweryTTS' : 'DuncteBot'}.\n` +
						`Your text: ${text.length} characters`
					)
				],
			});
		}

		// Validate speed
		if (speed < 0.5 || speed > 3.0) {
			return await ctx.sendMessage({
				embeds: [
					embed.setColor(this.client.color.red).setDescription(
						'❌ Speed must be between 0.5 and 3.0'
					)
				],
			});
		}

		const player = client.manager.getPlayer(ctx.guild!.id);
		if (!player) {
			return await ctx.sendMessage({
				embeds: [
					embed.setColor(this.client.color.red).setDescription(
						'❌ No active player found. Please join a voice channel and try again.'
					)
				],
			});
		}

		// Send initial response
		const loadingEmbed = embed
			.setColor(this.client.color.main)
			.setDescription(`🎤 Generating TTS using ${provider === 'flowery' ? '🌸 FloweryTTS' : '🤖 DuncteBot'}...`)
			.addFields([
				{ name: 'Text', value: text.length > 100 ? text.substring(0, 100) + '...' : text, inline: false },
				{ name: 'Provider', value: provider === 'flowery' ? '🌸 FloweryTTS' : '🤖 DuncteBot', inline: true },
				{ name: 'Length', value: `${text.length}/${maxLength} chars`, inline: true }
			]);

		if (provider === 'flowery') {
			if (voice) loadingEmbed.addFields([{ name: 'Voice', value: voice, inline: true }]);
			if (speed !== 1.0) loadingEmbed.addFields([{ name: 'Speed', value: `${speed}x`, inline: true }]);
			if (quality !== 'aac') loadingEmbed.addFields([{ name: 'Quality', value: quality.toUpperCase(), inline: true }]);
			if (translate) loadingEmbed.addFields([{ name: 'Translation', value: '✅ Enabled', inline: true }]);
		}

		await ctx.sendMessage({ embeds: [loadingEmbed] });

		try {
			if (provider === 'flowery') {
				// Use FloweryTTS
				const ttsResult = await FloweryTTS.generateTTS({
					text: text.trim(),
					voice: voice || undefined,
					speed: speed !== 1.0 ? speed : undefined,
					translate: translate || undefined,
					audio_format: quality as any
				});

				if (!ttsResult.success || !ttsResult.audioBuffer) {
					throw new Error(ttsResult.error || 'FloweryTTS generation failed');
				}

				// Create audio stream
				const audioStreamManager = AudioStreamManager.getInstance();
				await audioStreamManager.initialize();
				
				const streamUrl = audioStreamManager.createStreamFromTTS(ttsResult, quality);
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
				track.info.author = `FloweryTTS${voice ? ` (${voice})` : ''}`;
				track.info.duration = ttsResult.duration || 30000;

				await player.queue.add(track);

				if (!player.playing && !player.paused) {
					await player.play();
				}

				// Success response
				const successEmbed = embed
					.setColor(this.client.color.green)
					.setDescription(`✅ FloweryTTS added to queue!`)
					.addFields([
						{ name: 'Text', value: text.length > 100 ? text.substring(0, 100) + '...' : text, inline: false },
						{ name: 'Voice Used', value: ttsResult.voiceUsed || 'Default', inline: true },
						{ name: 'Speed', value: `${speed}x`, inline: true },
						{ name: 'Quality', value: quality.toUpperCase(), inline: true },
						{ name: 'Length', value: `${text.length} chars`, inline: true }
					]);

				if (translate) {
					successEmbed.addFields([{ name: 'Translation', value: '✅ Applied', inline: true }]);
				}

				return await ctx.editMessage({ embeds: [successEmbed] });

			} else {
				// Use DuncteBot TTS
				const query = `speak:${text}`;
				const response = await player.search({ query }, ctx.author);

				if (!response || !response.tracks || response.tracks.length === 0) {
					throw new Error('DuncteBot TTS generation failed');
				}

				const track = response.tracks[0];
				await player.queue.add(track);

				if (!player.playing && !player.paused) {
					await player.play();
				}

				// Success response
				const successEmbed = embed
					.setColor(this.client.color.green)
					.setDescription(`✅ DuncteBot TTS added to queue!`)
					.addFields([
						{ name: 'Text', value: text.length > 100 ? text.substring(0, 100) + '...' : text, inline: false },
						{ name: 'Voice', value: 'Default TTS Voice', inline: true },
						{ name: 'Length', value: `${text.length} chars`, inline: true }
					]);

				return await ctx.editMessage({ embeds: [successEmbed] });
			}

		} catch (error: any) {
			this.client.logger.error('TTS Command Error:', error);
			
			const errorEmbed = embed
				.setColor(this.client.color.red)
				.setDescription(`❌ TTS generation failed: ${error.message}`)
				.addFields([
					{ name: 'Provider', value: provider === 'flowery' ? '🌸 FloweryTTS' : '🤖 DuncteBot', inline: true },
					{ name: 'Suggestion', value: provider === 'flowery' ? 'Try using `--provider duncte` for shorter text' : 'Try using FloweryTTS for better quality', inline: false }
				]);

			return await ctx.editMessage({ embeds: [errorEmbed] });
		}
	}
}

/**
 * Project: lavamusic
 * Author: Appu
 * Main Contributor: LucasB25
 * Company: Coders
 * Copyright (c) 2024. All rights reserved.
 * This code is the property of Coder and may not be reproduced or
 * modified without permission. For more information, contact us at
 * https://discord.gg/YQsGbTwPBx
 */
