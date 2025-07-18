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
					name: 'category',
					description: 'Voice category to browse',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: '⭐ Popular Voices', value: 'popular' },
						{ name: '🇺🇸 English Voices', value: 'english' },
						{ name: '🇨🇿 Czech Voices', value: 'czech' },
						{ name: '🇯🇵 Japanese Voices', value: 'japanese' },
						{ name: '🇪🇺 European Languages', value: 'european' },
						{ name: '🌏 Asian Languages', value: 'asian' },
						{ name: '🧠 Neural Voices', value: 'neural' },
						{ name: '👩 Female Voices', value: 'female' },
						{ name: '👨 Male Voices', value: 'male' },
						{ name: '🔍 Search Voices', value: 'search' },
						{ name: '📊 Voice Statistics', value: 'stats' }
					]
				},
				{
					name: 'query',
					description: 'Search query or filter (for search category)',
					type: ApplicationCommandOptionType.String,
					required: false,
				},
				{
					name: 'language',
					description: 'Filter by specific language code (e.g., en, cs, ja, de, fr)',
					type: ApplicationCommandOptionType.String,
					required: false,
				},
				{
					name: 'gender',
					description: 'Filter by voice gender',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: 'Female', value: 'female' },
						{ name: 'Male', value: 'male' }
					]
				},

			],
		});
	}

	public async run(client: Lavamusic, ctx: Context, args: string[]): Promise<any> {
		const embed = this.client.embed();

		// Parse arguments
		let category = 'popular';
		let query = '';
		let language = '';
		let gender = '';
		if (ctx.isInteraction) {
			category = ctx.options?.getString('category') || 'popular';
			query = ctx.options?.getString('query') || '';
			language = ctx.options?.getString('language') || '';
			gender = ctx.options?.getString('gender') || '';
		} else {
			if (args.length > 0) {
				const firstArg = args[0].toLowerCase();
				const validCategories = ['english', 'czech', 'japanese', 'european', 'asian', 'neural', 'female', 'male', 'search', 'popular', 'stats'];
				if (validCategories.includes(firstArg)) {
					category = firstArg;
					query = args.slice(1).join(' ');
				} else {
					// Treat as search query
					category = 'search';
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
			switch (category) {
				case 'english':
					return await this.showCategoryVoices(ctx, embed, 'English', { languages: ['en'], language, gender });

				case 'czech':
					return await this.showCategoryVoices(ctx, embed, 'Czech', { languages: ['cs', 'cz'], language, gender });

				case 'japanese':
					return await this.showCategoryVoices(ctx, embed, 'Japanese', { languages: ['ja'], language, gender });

				case 'european':
					return await this.showCategoryVoices(ctx, embed, 'European', { languages: ['de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru'], language, gender });

				case 'asian':
					return await this.showCategoryVoices(ctx, embed, 'Asian', { languages: ['zh', 'ko', 'hi', 'th', 'vi'], language, gender });

				case 'neural':
					return await this.showCategoryVoices(ctx, embed, 'Neural', { search: 'neural', language, gender });

				case 'female':
					return await this.showCategoryVoices(ctx, embed, 'Female', { genders: ['female'], language });

				case 'male':
					return await this.showCategoryVoices(ctx, embed, 'Male', { genders: ['male'], language });

				case 'search':
					return await this.searchVoices(ctx, embed, query, { language, gender });

				case 'stats':
					return await this.showVoiceStats(ctx, embed);

				case 'popular':
				default:
					return await this.showPopularVoices(ctx, embed, { language, gender });
			}

		} catch (error: any) {
			this.client.logger.error('Voices Command Error:', error);

			const errorEmbed = embed
				.setColor(this.client.color.red)
				.setDescription(`❌ Failed to load voices: ${error.message}`)
				.addFields([
					{ name: 'Suggestion', value: 'FloweryTTS service might be temporarily unavailable. Try again later.', inline: false },
					{ name: 'Help', value: 'Use `/voices category:popular` to see recommended voices', inline: false }
				]);

			return await ctx.editMessage({ embeds: [errorEmbed] });
		}
	}

	private async showPopularVoices(ctx: Context, embed: any, filters: { language?: string; gender?: string } = {}): Promise<any> {
		let voices = await FloweryTTS.getPopularVoices();

		// Apply additional filters
		if (filters.language) {
			voices = voices.filter(v => v.language.code.toLowerCase().startsWith(filters.language!.toLowerCase()));
		}
		if (filters.gender) {
			voices = voices.filter(v => v.gender.toLowerCase() === filters.gender!.toLowerCase());
		}

		// Group by language for better organization
		const languageGroups: Record<string, typeof voices> = {};
		voices.forEach(voice => {
			const langKey = `${voice.language.name} (${voice.language.code})`;
			if (!languageGroups[langKey]) languageGroups[langKey] = [];
			languageGroups[langKey].push(voice);
		});

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle('⭐ Popular High-Quality TTS Voices')
			.setDescription(`${voices.length} carefully selected voices with excellent quality and natural sound`);

		// Show top language groups
		let fieldCount = 0;
		const sortedGroups = Object.entries(languageGroups).sort(([,a], [,b]) => b.length - a.length);

		for (const [langName, langVoices] of sortedGroups) {
			if (fieldCount >= 6) break; // Discord embed limit

			const voiceList = langVoices.slice(0, 6).map(v => {
				const qualityIndicator = v.name.toLowerCase().includes('neural') ? '🧠' :
										v.source.toLowerCase().includes('azure') ? '🔷' : '🎵';
				return `${qualityIndicator} \`${v.id}\` ${v.name} (${v.gender})`;
			}).join('\n');

			const emoji = this.getLanguageEmoji(langVoices[0].language.code);
			resultEmbed.addFields([{
				name: `${emoji} ${langName} (${langVoices.length})`,
				value: voiceList,
				inline: true
			}]);
			fieldCount++;
		}

		resultEmbed.addFields([
			{
				name: '🎯 Quick Usage',
				value: '`/tts text:Hello world voice:en-US-AriaNeural`\n`/voices preview:en-US-AriaNeural` (test voice)',
				inline: false
			},
			{
				name: '🔍 Explore More',
				value: 'Use `/voices category:english` or `/voices category:neural` for specific categories',
				inline: false
			}
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}

	private async showCategoryVoices(ctx: Context, embed: any, categoryName: string, filters: {
		languages?: string[];
		genders?: string[];
		search?: string;
		language?: string;
		gender?: string;
	}): Promise<any> {
		// Build filter object
		const filter: any = { ...filters, sortBy: 'language', limit: 50 };

		// Apply additional filters from user input
		if (filters.language) {
			filter.languages = [filters.language];
		}
		if (filters.gender) {
			filter.genders = [filters.gender];
		}

		const voices = await FloweryTTS.getFilteredVoices(filter);

		if (voices.length === 0) {
			const noVoicesEmbed = embed
				.setColor(this.client.color.yellow)
				.setDescription(`⚠️ No ${categoryName.toLowerCase()} voices found with the specified filters`)
				.addFields([
					{ name: 'Try', value: 'Remove some filters or try a different category', inline: false }
				]);
			return await ctx.editMessage({ embeds: [noVoicesEmbed] });
		}

		// Group voices intelligently
		const groups = this.groupVoices(voices, categoryName);

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle(`${this.getCategoryEmoji(categoryName)} ${categoryName} Voices (${voices.length} total)`)
			.setDescription(this.getCategoryDescription(categoryName));

		// Show groups
		let fieldCount = 0;
		for (const [groupName, groupVoices] of Object.entries(groups)) {
			if (fieldCount >= 6) break;

			const voiceList = groupVoices.slice(0, 8).map(v => {
				const qualityIndicator = this.getQualityIndicator(v);
				return `${qualityIndicator} \`${v.id}\` ${v.name}`;
			}).join('\n');

			resultEmbed.addFields([{
				name: `${groupName} (${groupVoices.length})`,
				value: voiceList,
				inline: true
			}]);
			fieldCount++;
		}

		// Add usage examples
		const exampleVoice = voices[0];
		resultEmbed.addFields([
			{
				name: '🎯 Usage Example',
				value: `\`/tts text:Your message voice:${exampleVoice.id}\``,
				inline: false
			},
			{
				name: '🔍 Filter Options',
				value: 'Use `language:` and `gender:` parameters to narrow down results',
				inline: false
			}
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}



	private async searchVoices(ctx: Context, embed: any, query: string, filters: { language?: string; gender?: string } = {}): Promise<any> {
		if (!query) {
			const helpEmbed = embed
				.setColor(this.client.color.yellow)
				.setTitle('🔍 Voice Search Help')
				.setDescription('Please provide a search query to find voices')
				.addFields([
					{ name: 'Search Examples', value: '• `aria` - Find voices with "aria" in name\n• `neural` - Find Neural voices\n• `british` - Find British English voices\n• `female` - Find female voices', inline: false },
					{ name: 'Advanced Search', value: 'Use `language:` and `gender:` filters for precise results', inline: false }
				]);
			return await ctx.editMessage({ embeds: [helpEmbed] });
		}

		// Build search filter
		const searchFilter: any = { search: query, sortBy: 'language', limit: 30 };
		if (filters.language) searchFilter.languages = [filters.language];
		if (filters.gender) searchFilter.genders = [filters.gender];

		const searchResults = await FloweryTTS.getFilteredVoices(searchFilter);

		if (searchResults.length === 0) {
			const noResultsEmbed = embed
				.setColor(this.client.color.yellow)
				.setTitle(`🔍 No Results for "${query}"`)
				.setDescription('No voices found matching your search criteria')
				.addFields([
					{ name: 'Suggestions', value: '• Try a shorter search term\n• Check spelling\n• Remove filters\n• Try `/voices category:popular` for recommended voices', inline: false }
				]);
			return await ctx.editMessage({ embeds: [noResultsEmbed] });
		}

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle(`🔍 Search Results: "${query}"`)
			.setDescription(`Found ${searchResults.length} matching voices`);

		// Group results by language for better organization
		const languageGroups: Record<string, typeof searchResults> = {};
		searchResults.forEach(voice => {
			const langKey = `${voice.language.name} (${voice.language.code})`;
			if (!languageGroups[langKey]) languageGroups[langKey] = [];
			languageGroups[langKey].push(voice);
		});

		// Show top matching groups
		let fieldCount = 0;
		const sortedGroups = Object.entries(languageGroups).sort(([,a], [,b]) => b.length - a.length);

		for (const [langName, voices] of sortedGroups) {
			if (fieldCount >= 6) break;

			const voiceList = voices.slice(0, 5).map(v => {
				const qualityIndicator = this.getQualityIndicator(v);
				return `${qualityIndicator} \`${v.id}\` ${v.name} (${v.gender})`;
			}).join('\n');

			const emoji = this.getLanguageEmoji(voices[0].language.code);
			resultEmbed.addFields([{
				name: `${emoji} ${langName} (${voices.length})`,
				value: voiceList,
				inline: true
			}]);
			fieldCount++;
		}

		// Add usage and tips
		const bestMatch = searchResults[0];
		resultEmbed.addFields([
			{
				name: '🎯 Quick Test',
				value: `\`/voices preview:${bestMatch.id}\` - Test this voice`,
				inline: false
			},
			{
				name: '💡 Pro Tip',
				value: 'Use `/tts` with the voice ID to generate speech with your text',
				inline: false
			}
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}

	private async showVoiceStats(ctx: Context, embed: any): Promise<any> {
		const stats = await FloweryTTS.getVoiceStatistics();

		const resultEmbed = embed
			.setColor(this.client.color.main)
			.setTitle('📊 FloweryTTS Voice Analytics')
			.setDescription('Comprehensive statistics about available TTS voices');

		// Top languages with percentages
		const topLanguagesText = stats.topLanguages
			.slice(0, 8)
			.map(({ language, count, percentage }) => `${language}: ${count} (${percentage}%)`)
			.join('\n');

		// Gender distribution
		const genderStats = Object.entries(stats.byGender)
			.map(([gender, count]) => `${gender}: ${count}`)
			.join('\n');

		// Source distribution (top 5)
		const sourceStats = Object.entries(stats.bySource)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 5)
			.map(([source, count]) => `${source}: ${count}`)
			.join('\n');

		resultEmbed.addFields([
			{ name: '🌍 Total Voices', value: stats.total.toString(), inline: true },
			{ name: '🗣️ Languages', value: Object.keys(stats.byLanguage).length.toString(), inline: true },
			{ name: '🎭 Voice Types', value: Object.keys(stats.byGender).length.toString(), inline: true },
			{ name: '🏆 Top Languages', value: topLanguagesText, inline: true },
			{ name: '👥 Gender Distribution', value: genderStats, inline: true },
			{ name: '🔧 Voice Sources', value: sourceStats, inline: true },
			{
				name: '✨ Quality Features',
				value: '• Neural AI voices for natural speech\n• Multi-language support\n• Speed control (0.5x-10x)\n• Auto-translation capability\n• High-quality audio formats',
				inline: false
			},
			{
				name: '🎯 Quick Start',
				value: 'Use `/voices category:popular` to see recommended voices\nTry `/voices preview:en-US-AriaNeural` to test a voice',
				inline: false
			}
		]);

		return await ctx.editMessage({ embeds: [resultEmbed] });
	}


	// Helper methods for better organization and display

	private groupVoices(voices: any[], categoryName: string): Record<string, any[]> {
		const groups: Record<string, any[]> = {};

		switch (categoryName.toLowerCase()) {
			case 'english':
				// Group by country/region
				voices.forEach(voice => {
					const country = voice.language.code.split('-')[1] || 'US';
					const countryName = this.getCountryName(country);
					if (!groups[countryName]) groups[countryName] = [];
					groups[countryName].push(voice);
				});
				break;

			case 'european':
			case 'asian':
				// Group by language
				voices.forEach(voice => {
					const lang = voice.language.name;
					if (!groups[lang]) groups[lang] = [];
					groups[lang].push(voice);
				});
				break;

			case 'neural':
				// Group by language, prioritize Neural
				voices.forEach(voice => {
					const lang = voice.language.name;
					const isNeural = voice.name.toLowerCase().includes('neural');
					const groupName = isNeural ? `${lang} (Neural)` : lang;
					if (!groups[groupName]) groups[groupName] = [];
					groups[groupName].push(voice);
				});
				break;

			default:
				// Group by gender for gender-based categories, or by language for others
				if (categoryName.toLowerCase() === 'female' || categoryName.toLowerCase() === 'male') {
					voices.forEach(voice => {
						const lang = voice.language.name;
						if (!groups[lang]) groups[lang] = [];
						groups[lang].push(voice);
					});
				} else {
					voices.forEach(voice => {
						const lang = voice.language.name;
						if (!groups[lang]) groups[lang] = [];
						groups[lang].push(voice);
					});
				}
		}

		return groups;
	}

	private getLanguageEmoji(languageCode: string): string {
		const code = languageCode.toLowerCase();
		const emojiMap: Record<string, string> = {
			'en-us': '🇺🇸', 'en-gb': '🇬🇧', 'en-au': '🇦🇺', 'en-ca': '🇨🇦', 'en': '🇺🇸',
			'cs': '🇨🇿', 'cz': '🇨🇿',
			'ja': '🇯🇵',
			'de': '🇩🇪',
			'fr': '🇫🇷',
			'es': '🇪🇸',
			'it': '🇮🇹',
			'pt': '🇵🇹',
			'nl': '🇳🇱',
			'pl': '🇵🇱',
			'ru': '🇷🇺',
			'zh': '🇨🇳',
			'ko': '🇰🇷',
			'hi': '🇮🇳',
			'th': '🇹🇭',
			'vi': '🇻🇳'
		};

		return emojiMap[code] || emojiMap[code.split('-')[0]] || '🌍';
	}

	private getCountryName(countryCode: string): string {
		const countryMap: Record<string, string> = {
			'US': 'United States',
			'GB': 'United Kingdom',
			'AU': 'Australia',
			'CA': 'Canada',
			'IE': 'Ireland',
			'ZA': 'South Africa',
			'IN': 'India'
		};

		return countryMap[countryCode] || countryCode;
	}

	private getCategoryEmoji(categoryName: string): string {
		const emojiMap: Record<string, string> = {
			'popular': '⭐',
			'english': '🇺🇸',
			'czech': '🇨🇿',
			'japanese': '🇯🇵',
			'european': '🇪🇺',
			'asian': '🌏',
			'neural': '🧠',
			'female': '👩',
			'male': '👨'
		};

		return emojiMap[categoryName.toLowerCase()] || '🎵';
	}

	private getCategoryDescription(categoryName: string): string {
		const descriptions: Record<string, string> = {
			'popular': 'Carefully selected high-quality voices with excellent natural sound',
			'english': 'All English language voices from various regions and countries',
			'czech': 'Czech language voices for natural Czech speech synthesis',
			'japanese': 'Japanese language voices with authentic pronunciation',
			'european': 'Voices from European languages including German, French, Spanish, and more',
			'asian': 'Voices from Asian languages including Chinese, Korean, Hindi, and others',
			'neural': 'Advanced AI-powered Neural voices with superior quality and naturalness',
			'female': 'Female voices across all supported languages',
			'male': 'Male voices across all supported languages'
		};

		return descriptions[categoryName.toLowerCase()] || 'Available TTS voices for this category';
	}

	private getQualityIndicator(voice: any): string {
		const name = voice.name.toLowerCase();
		const source = voice.source.toLowerCase();

		if (name.includes('neural')) return '🧠';
		if (name.includes('wavenet')) return '🌊';
		if (source.includes('azure')) return '🔷';
		if (source.includes('google')) return '🔵';
		if (name.includes('standard')) return '🎵';

		return '🎤';
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
