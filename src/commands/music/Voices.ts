import { ApplicationCommandOptionType } from 'discord.js';
import { Command, type Context, type Lavamusic } from '../../structures/index';
import { FloweryTTS } from '../../utils/FloweryTTS';

export default class Voices extends Command {
	constructor(client: Lavamusic) {
		super(client, {
			name: 'voices',
			description: {
				content: 'List available TTS voices from FloweryTTS',
				examples: [
					'voices',
					'voices english',
					'voices czech',
					'voices search aria'
				],
				usage: 'voices [language|search] [query]',
			},
			category: 'music',
			aliases: ['voice', 'ttsvoices'],
			cooldown: 10,
			args: false,
			vote: false,
			player: {
				voice: false,
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
					name: 'action',
					description: 'What to do with voices',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: '🇺🇸 English Voices', value: 'english' },
						{ name: '🇨🇿 Czech Voices', value: 'czech' },
						{ name: '🇯🇵 Japanese Voices', value: 'japanese' },
						{ name: '🔍 Search Voices', value: 'search' },
						{ name: '⭐ Popular Voices', value: 'popular' },
						{ name: '📊 Voice Stats', value: 'stats' }
					]
				},
				{
					name: 'query',
					description: 'Search query for voice names (when using search action)',
					type: ApplicationCommandOptionType.String,
					required: false,
				}
			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed();

		// Parse arguments
		let action = 'popular'; // Default action
		let query = '';

		if (ctx.isInteraction) {
			action = ctx.options?.getString('action') || 'popular';
			query = ctx.options?.getString('query') || '';
		} else {
			if (args.length > 0) {
				const firstArg = args[0].toLowerCase();
				if (['english', 'czech', 'japanese', 'search', 'popular', 'stats'].includes(firstArg)) {
					action = firstArg;
					query = args.slice(1).join(' ');
				} else {
					// Treat as search query
					action = 'search';
					query = args.join(' ');
				}
			}
		}

		// Send loading message
		const loadingEmbed = embed
			.setColor(this.client.color.main)
			.setDescription('🔄 Loading FloweryTTS voices...');

		await ctx.sendMessage({ embeds: [loadingEmbed] });

		try {
			switch (action) {
				case 'english':
					return await this.showEnglishVoices(ctx, embed);

				case 'czech':
					return await this.showCzechVoices(ctx, embed);

				case 'japanese':
					return await this.showJapaneseVoices(ctx, embed);

				case 'search':
					return await this.searchVoices(ctx, embed, query);

				case 'stats':
					return await this.showVoiceStats(ctx, embed);

				case 'popular':
				default:
					return await this.showPopularVoices(ctx, embed);
			}

		} catch (error: any) {
			this.client.logger.error('Voices Command Error:', error);
			
			const errorEmbed = embed
				.setColor(this.client.color.red)
				.setDescription(`❌ Failed to load voices: ${error.message}`)
				.addFields([
					{ name: 'Suggestion', value: 'FloweryTTS service might be temporarily unavailable. Try again later.', inline: false }
				]);

			return await ctx.editMessage({ embeds: [errorEmbed] });
		}
	}

	private async showPopularVoices(ctx: Context, embed: any): Promise<any> {
		const voices = await FloweryTTS.getPopularVoices();

		const englishVoices = voices.filter(v => v.language.code.toLowerCase().startsWith('en')).slice(0, 8);
		const czechVoices = voices.filter(v =>
			v.language.code.toLowerCase().startsWith('cs') ||
			v.language.name.toLowerCase().includes('czech')
		).slice(0, 6);
		const japaneseVoices = voices.filter(v =>
			v.language.code.toLowerCase().startsWith('ja') ||
			v.language.name.toLowerCase().includes('japanese')
		).slice(0, 6);

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle('⭐ Popular TTS Voices')
			.setDescription('Most commonly used English, Czech, and Japanese voices for TTS');

		if (englishVoices.length > 0) {
			const englishList = englishVoices.map(v => `\`${v.id}\` - ${v.name} (${v.gender})`).join('\n');
			resultEmbed.addFields([{ name: '🇺🇸 English Voices', value: englishList, inline: false }]);
		}

		if (czechVoices.length > 0) {
			const czechList = czechVoices.map(v => `\`${v.id}\` - ${v.name} (${v.gender})`).join('\n');
			resultEmbed.addFields([{ name: '🇨🇿 Czech Voices', value: czechList, inline: false }]);
		}

		if (japaneseVoices.length > 0) {
			const japaneseList = japaneseVoices.map(v => `\`${v.id}\` - ${v.name} (${v.gender})`).join('\n');
			resultEmbed.addFields([{ name: '🇯🇵 Japanese Voices', value: japaneseList, inline: false }]);
		}

		resultEmbed.addFields([
			{ name: 'Usage', value: '`/tts text:Hello --voice en-US-AriaNeural`', inline: false },
			{ name: 'More Options', value: 'Use `/voices english`, `/voices czech`, or `/voices japanese` for complete lists', inline: false }
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}

	private async showEnglishVoices(ctx: Context, embed: any): Promise<any> {
		const voices = await FloweryTTS.getEnglishVoices();
		
		if (voices.length === 0) {
			const noVoicesEmbed = embed
				.setColor(this.client.color.yellow)
				.setDescription('⚠️ No English voices found');
			return await ctx.editMessage({ embeds: [noVoicesEmbed] });
		}

		// Group by country/variant
		const voiceGroups: Record<string, typeof voices> = {};
		voices.forEach(voice => {
			const country = voice.language.code.split('-')[1] || 'US';
			if (!voiceGroups[country]) voiceGroups[country] = [];
			voiceGroups[country].push(voice);
		});

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle(`🇺🇸 English Voices (${voices.length} total)`)
			.setDescription('Available English TTS voices grouped by region');

		// Show first few groups
		let fieldCount = 0;
		for (const [country, countryVoices] of Object.entries(voiceGroups)) {
			if (fieldCount >= 6) break; // Discord embed field limit
			
			const voiceList = countryVoices.slice(0, 8).map(v => `\`${v.id}\` ${v.name} (${v.gender})`).join('\n');
			const fieldName = `${country === 'US' ? '🇺🇸' : country === 'GB' ? '🇬🇧' : '🌍'} ${country} (${countryVoices.length})`;
			
			resultEmbed.addFields([{ name: fieldName, value: voiceList, inline: true }]);
			fieldCount++;
		}

		resultEmbed.addFields([
			{ name: 'Usage', value: '`/tts text:Hello world --voice en-US-AriaNeural`', inline: false }
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}

	private async showCzechVoices(ctx: Context, embed: any): Promise<any> {
		const voices = await FloweryTTS.getCzechVoices();
		
		if (voices.length === 0) {
			const noVoicesEmbed = embed
				.setColor(this.client.color.yellow)
				.setDescription('⚠️ No Czech voices found');
			return await ctx.editMessage({ embeds: [noVoicesEmbed] });
		}

		// Group by gender
		const maleVoices = voices.filter(v => v.gender.toLowerCase() === 'male');
		const femaleVoices = voices.filter(v => v.gender.toLowerCase() === 'female');

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle(`🇨🇿 Czech Voices (${voices.length} total)`)
			.setDescription('Available Czech TTS voices');

		if (femaleVoices.length > 0) {
			const femaleList = femaleVoices.slice(0, 10).map(v => `\`${v.id}\` ${v.name}`).join('\n');
			resultEmbed.addFields([{ name: `👩 Female Voices (${femaleVoices.length})`, value: femaleList, inline: true }]);
		}

		if (maleVoices.length > 0) {
			const maleList = maleVoices.slice(0, 10).map(v => `\`${v.id}\` ${v.name}`).join('\n');
			resultEmbed.addFields([{ name: `👨 Male Voices (${maleVoices.length})`, value: maleList, inline: true }]);
		}

		resultEmbed.addFields([
			{ name: 'Usage', value: '`/tts text:Ahoj světe --voice cs-CZ-AntoninNeural`', inline: false },
			{ name: 'Translation', value: 'Use `--translate` to auto-translate English text to Czech', inline: false }
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}

	private async showJapaneseVoices(ctx: Context, embed: any): Promise<any> {
		const voices = await FloweryTTS.getJapaneseVoices();

		if (voices.length === 0) {
			const noVoicesEmbed = embed
				.setColor(this.client.color.yellow)
				.setDescription('⚠️ No Japanese voices found');
			return await ctx.editMessage({ embeds: [noVoicesEmbed] });
		}

		// Group by gender
		const maleVoices = voices.filter(v => v.gender.toLowerCase() === 'male');
		const femaleVoices = voices.filter(v => v.gender.toLowerCase() === 'female');

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle(`🇯🇵 Japanese Voices (${voices.length} total)`)
			.setDescription('Available Japanese TTS voices');

		if (femaleVoices.length > 0) {
			const femaleList = femaleVoices.slice(0, 10).map(v => `\`${v.id}\` ${v.name}`).join('\n');
			resultEmbed.addFields([{ name: `👩 Female Voices (${femaleVoices.length})`, value: femaleList, inline: true }]);
		}

		if (maleVoices.length > 0) {
			const maleList = maleVoices.slice(0, 10).map(v => `\`${v.id}\` ${v.name}`).join('\n');
			resultEmbed.addFields([{ name: `👨 Male Voices (${maleVoices.length})`, value: maleList, inline: true }]);
		}

		resultEmbed.addFields([
			{ name: 'Usage', value: '`/tts text:こんにちは世界 --voice ja-JP-NanamiNeural`', inline: false },
			{ name: 'Translation', value: 'Use `--translate` to auto-translate English text to Japanese', inline: false }
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}

	private async searchVoices(ctx: Context, embed: any, query: string): Promise<any> {
		if (!query) {
			const helpEmbed = embed
				.setColor(this.client.color.yellow)
				.setDescription('❓ Please provide a search query\n\n**Examples:**\n`/voices search aria`\n`!voices search neural`');
			return await ctx.editMessage({ embeds: [helpEmbed] });
		}

		const allVoices = await FloweryTTS.getVoices();
		const searchResults = allVoices.voices.filter(voice => 
			voice.name.toLowerCase().includes(query.toLowerCase()) ||
			voice.id.toLowerCase().includes(query.toLowerCase()) ||
			voice.language.name.toLowerCase().includes(query.toLowerCase())
		).slice(0, 20); // Limit results

		if (searchResults.length === 0) {
			const noResultsEmbed = embed
				.setColor(this.client.color.yellow)
				.setDescription(`🔍 No voices found matching "${query}"`);
			return await ctx.editMessage({ embeds: [noResultsEmbed] });
		}

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle(`🔍 Search Results for "${query}"`)
			.setDescription(`Found ${searchResults.length} matching voices`);

		// Group results by language
		const languageGroups: Record<string, typeof searchResults> = {};
		searchResults.forEach(voice => {
			const lang = voice.language.name;
			if (!languageGroups[lang]) languageGroups[lang] = [];
			languageGroups[lang].push(voice);
		});

		let fieldCount = 0;
		for (const [language, voices] of Object.entries(languageGroups)) {
			if (fieldCount >= 6) break;
			
			const voiceList = voices.slice(0, 5).map(v => `\`${v.id}\` ${v.name} (${v.gender})`).join('\n');
			resultEmbed.addFields([{ name: `${language} (${voices.length})`, value: voiceList, inline: true }]);
			fieldCount++;
		}

		resultEmbed.addFields([
			{ name: 'Usage', value: '`/tts text:Your text --voice VOICE_ID`', inline: false }
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}

	private async showVoiceStats(ctx: Context, embed: any): Promise<any> {
		const allVoices = await FloweryTTS.getVoices();
		const englishVoices = await FloweryTTS.getEnglishVoices();
		const czechVoices = await FloweryTTS.getCzechVoices();
		const japaneseVoices = await FloweryTTS.getJapaneseVoices();

		// Count by language
		const languageCounts: Record<string, number> = {};
		allVoices.voices.forEach(voice => {
			const lang = voice.language.name;
			languageCounts[lang] = (languageCounts[lang] || 0) + 1;
		});

		const topLanguages = Object.entries(languageCounts)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 10)
			.map(([lang, count]) => `${lang}: ${count}`)
			.join('\n');

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle('📊 FloweryTTS Voice Statistics')
			.addFields([
				{ name: 'Total Voices', value: allVoices.count.toString(), inline: true },
				{ name: '🇺🇸 English Voices', value: englishVoices.length.toString(), inline: true },
				{ name: '🇨🇿 Czech Voices', value: czechVoices.length.toString(), inline: true },
				{ name: '🇯🇵 Japanese Voices', value: japaneseVoices.length.toString(), inline: true },
				{ name: 'Top Languages', value: topLanguages, inline: false },
				{ name: 'Features', value: '• 850+ voices\n• English, Czech & Japanese priority\n• Speed control (0.5x-10x)\n• Auto-translation\n• High quality audio', inline: false }
			]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
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
