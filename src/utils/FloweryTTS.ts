// Using built-in fetch (Node.js 18+)

export interface FloweryVoice {
	id: string;
	name: string;
	gender: string;
	source: string;
	language: {
		name: string;
		code: string;
	};
}

export interface VoiceFilter {
	languages?: string[];
	genders?: string[];
	sources?: string[];
	search?: string;
	limit?: number;
	sortBy?: 'name' | 'language' | 'gender' | 'source';
	sortOrder?: 'asc' | 'desc';
}

export interface VoiceCategory {
	name: string;
	emoji: string;
	description: string;
	filter: VoiceFilter;
	priority: number;
}

export interface FloweryVoicesResponse {
	count: number;
	default: FloweryVoice;
	voices: FloweryVoice[];
}

export interface FloweryTTSOptions {
	text: string;
	voice?: string;
	translate?: boolean;
	silence?: number;
	audio_format?: 'mp3' | 'ogg_opus' | 'ogg_vorbis' | 'aac' | 'wav' | 'flac';
	speed?: number;
}

export interface FloweryTTSResult {
	success: boolean;
	audioBuffer?: Buffer;
	audioUrl?: string;
	error?: string;
	voiceUsed?: string;
	textLength?: number;
	duration?: number;
}

export class FloweryTTS {
	private static readonly BASE_URL = 'https://api.flowery.pw';
	private static readonly USER_AGENT = 'Lavamusic-Bot/1.0 (Discord Music Bot)';
	private static readonly MAX_TEXT_LENGTH = 2048;
	private static readonly RATE_LIMIT_DELAY = 350; // 3 requests per second = ~333ms, add buffer

	private static lastRequestTime = 0;
	private static voicesCache: FloweryVoicesResponse | null = null;
	private static voicesCacheTime = 0;
	private static readonly VOICES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

	/**
	 * Get available voices from FloweryTTS
	 */
	public static async getVoices(forceRefresh = false): Promise<FloweryVoicesResponse> {
		const now = Date.now();
		
		// Return cached voices if available and not expired
		if (!forceRefresh && this.voicesCache && (now - this.voicesCacheTime) < this.VOICES_CACHE_TTL) {
			return this.voicesCache;
		}

		try {
			await this.enforceRateLimit();

			const response = await fetch(`${this.BASE_URL}/v1/tts/voices`, {
				method: 'GET',
				headers: {
					'User-Agent': this.USER_AGENT,
				},
			});

			if (!response.ok) {
				throw new Error(`FloweryTTS API error: ${response.status} ${response.statusText}`);
			}

			const voicesData = await response.json() as FloweryVoicesResponse;
			
			// Cache the voices
			this.voicesCache = voicesData;
			this.voicesCacheTime = now;

			return voicesData;
		} catch (error) {
			console.error('Error fetching FloweryTTS voices:', error);
			throw new Error(`Failed to fetch voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Generate TTS audio using FloweryTTS
	 */
	public static async generateTTS(options: FloweryTTSOptions): Promise<FloweryTTSResult> {
		try {
			// Validate input
			if (!options.text || options.text.trim().length === 0) {
				return {
					success: false,
					error: 'Text is required for TTS generation'
				};
			}

			// Truncate text if too long
			let text = options.text.trim();
			if (text.length > this.MAX_TEXT_LENGTH) {
				text = text.substring(0, this.MAX_TEXT_LENGTH);
			}

			// Validate speed
			if (options.speed && (options.speed < 0.5 || options.speed > 10)) {
				return {
					success: false,
					error: 'Speed must be between 0.5 and 10'
				};
			}

			// Validate silence
			if (options.silence && (options.silence < 0 || options.silence > 10000)) {
				return {
					success: false,
					error: 'Silence must be between 0 and 10000 milliseconds'
				};
			}

			await this.enforceRateLimit();

			// Build query parameters
			const params = new URLSearchParams({
				text: text,
				audio_format: options.audio_format || 'mp3',
				speed: (options.speed || 1.0).toString(),
				silence: (options.silence || 0).toString(),
				translate: (options.translate || false).toString(),
			});

			if (options.voice) {
				params.append('voice', options.voice);
			}

			const response = await fetch(`${this.BASE_URL}/v1/tts?${params.toString()}`, {
				method: 'GET',
				headers: {
					'User-Agent': this.USER_AGENT,
				},
			});

			if (!response.ok) {
				if (response.status === 429) {
					return {
						success: false,
						error: 'Rate limit exceeded. Please try again in a moment.'
					};
				}
				
				const errorText = await response.text();
				return {
					success: false,
					error: `FloweryTTS API error: ${response.status} ${response.statusText} - ${errorText}`
				};
			}

			// Get audio buffer
			const audioBuffer = Buffer.from(await response.arrayBuffer());

			return {
				success: true,
				audioBuffer,
				voiceUsed: options.voice || 'default',
				textLength: text.length,
				duration: this.estimateAudioDuration(text, options.speed || 1.0)
			};

		} catch (error) {
			console.error('Error generating FloweryTTS audio:', error);
			return {
				success: false,
				error: `TTS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Get voices filtered by language
	 */
	public static async getVoicesByLanguage(languageCode: string): Promise<FloweryVoice[]> {
		const voicesData = await this.getVoices();
		return voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase() === languageCode.toLowerCase()
		);
	}

	/**
	 * Get all Czech voices
	 */
	public static async getCzechVoices(): Promise<FloweryVoice[]> {
		const voicesData = await this.getVoices();
		return voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase().startsWith('cs') ||
			voice.language.code.toLowerCase().startsWith('cz') ||
			voice.language.name.toLowerCase().includes('czech')
		).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get all English voices
	 */
	public static async getEnglishVoices(): Promise<FloweryVoice[]> {
		const voicesData = await this.getVoices();
		return voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase().startsWith('en')
		).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get all Japanese voices
	 */
	public static async getJapaneseVoices(): Promise<FloweryVoice[]> {
		const voicesData = await this.getVoices();
		return voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase().startsWith('ja') ||
			voice.language.name.toLowerCase().includes('japanese')
		).sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get voice categories for better organization
	 */
	public static getVoiceCategories(): VoiceCategory[] {
		return [
			{
				name: 'Popular',
				emoji: '⭐',
				description: 'Most commonly used high-quality voices',
				filter: { languages: ['en', 'cs', 'ja'], limit: 20 },
				priority: 1
			},
			{
				name: 'English',
				emoji: '🇺🇸',
				description: 'All English voices (US, UK, AU, etc.)',
				filter: { languages: ['en'], sortBy: 'name' },
				priority: 2
			},
			{
				name: 'Czech',
				emoji: '🇨🇿',
				description: 'Czech language voices',
				filter: { languages: ['cs', 'cz'], sortBy: 'gender' },
				priority: 3
			},
			{
				name: 'Japanese',
				emoji: '🇯🇵',
				description: 'Japanese language voices',
				filter: { languages: ['ja'], sortBy: 'gender' },
				priority: 4
			},
			{
				name: 'European',
				emoji: '🇪🇺',
				description: 'European languages (German, French, Spanish, etc.)',
				filter: { languages: ['de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru'], sortBy: 'language' },
				priority: 5
			},
			{
				name: 'Asian',
				emoji: '🌏',
				description: 'Asian languages (Chinese, Korean, Hindi, etc.)',
				filter: { languages: ['zh', 'ko', 'hi', 'th', 'vi'], sortBy: 'language' },
				priority: 6
			},
			{
				name: 'Neural',
				emoji: '🧠',
				description: 'High-quality Neural voices',
				filter: { search: 'neural', sortBy: 'language' },
				priority: 7
			},
			{
				name: 'Female',
				emoji: '👩',
				description: 'Female voices across all languages',
				filter: { genders: ['female'], sortBy: 'language' },
				priority: 8
			},
			{
				name: 'Male',
				emoji: '👨',
				description: 'Male voices across all languages',
				filter: { genders: ['male'], sortBy: 'language' },
				priority: 9
			}
		];
	}

	/**
	 * Get voices with advanced filtering
	 */
	public static async getFilteredVoices(filter: VoiceFilter): Promise<FloweryVoice[]> {
		const voicesData = await this.getVoices();
		let filteredVoices = [...voicesData.voices];

		// Filter by languages
		if (filter.languages && filter.languages.length > 0) {
			filteredVoices = filteredVoices.filter(voice => {
				const langCode = voice.language.code.toLowerCase();
				const langName = voice.language.name.toLowerCase();
				return filter.languages!.some(lang =>
					langCode.startsWith(lang.toLowerCase()) ||
					langName.includes(lang.toLowerCase())
				);
			});
		}

		// Filter by genders
		if (filter.genders && filter.genders.length > 0) {
			filteredVoices = filteredVoices.filter(voice =>
				filter.genders!.some(gender =>
					voice.gender.toLowerCase() === gender.toLowerCase()
				)
			);
		}

		// Filter by sources
		if (filter.sources && filter.sources.length > 0) {
			filteredVoices = filteredVoices.filter(voice =>
				filter.sources!.some(source =>
					voice.source.toLowerCase().includes(source.toLowerCase())
				)
			);
		}

		// Filter by search term
		if (filter.search) {
			const searchTerm = filter.search.toLowerCase();
			filteredVoices = filteredVoices.filter(voice =>
				voice.name.toLowerCase().includes(searchTerm) ||
				voice.id.toLowerCase().includes(searchTerm) ||
				voice.language.name.toLowerCase().includes(searchTerm) ||
				voice.source.toLowerCase().includes(searchTerm)
			);
		}

		// Sort voices
		if (filter.sortBy) {
			filteredVoices.sort((a, b) => {
				let aValue: string, bValue: string;

				switch (filter.sortBy) {
					case 'name':
						aValue = a.name;
						bValue = b.name;
						break;
					case 'language':
						aValue = a.language.name;
						bValue = b.language.name;
						break;
					case 'gender':
						aValue = a.gender;
						bValue = b.gender;
						break;
					case 'source':
						aValue = a.source;
						bValue = b.source;
						break;
					default:
						aValue = a.name;
						bValue = b.name;
				}

				const comparison = aValue.localeCompare(bValue);
				return filter.sortOrder === 'desc' ? -comparison : comparison;
			});
		}

		// Apply limit
		if (filter.limit && filter.limit > 0) {
			filteredVoices = filteredVoices.slice(0, filter.limit);
		}

		return filteredVoices;
	}

	/**
	 * Get popular/recommended voices with better selection
	 */
	public static async getPopularVoices(): Promise<FloweryVoice[]> {
		const voicesData = await this.getVoices();

		// Define high-quality voice patterns
		const qualityPatterns = ['neural', 'wavenet', 'standard'];
		const popularLanguages = ['en-US', 'en-GB', 'cs-CZ', 'ja-JP', 'de-DE', 'fr-FR', 'es-ES'];

		// Get voices from popular languages with quality indicators
		const popularVoices = voicesData.voices.filter(voice => {
			const langCode = voice.language.code.toLowerCase();
			const voiceName = voice.name.toLowerCase();
			const voiceId = voice.id.toLowerCase();

			// Check if it's a popular language
			const isPopularLang = popularLanguages.some(lang =>
				langCode.startsWith(lang.toLowerCase().split('-')[0])
			);

			// Check if it's a quality voice
			const isQualityVoice = qualityPatterns.some(pattern =>
				voiceName.includes(pattern) || voiceId.includes(pattern)
			);

			return isPopularLang && (isQualityVoice || voice.source.toLowerCase().includes('azure'));
		});

		// Sort by language priority and quality
		return popularVoices.sort((a, b) => {
			const aLang = a.language.code.toLowerCase();
			const bLang = b.language.code.toLowerCase();

			// Language priority: English > Czech > Japanese > German > French > Spanish
			const langPriority = ['en', 'cs', 'ja', 'de', 'fr', 'es'];
			const aPriority = langPriority.findIndex(lang => aLang.startsWith(lang));
			const bPriority = langPriority.findIndex(lang => bLang.startsWith(lang));

			if (aPriority !== bPriority) {
				return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
			}

			// Within same language, prefer Neural voices
			const aIsNeural = a.name.toLowerCase().includes('neural');
			const bIsNeural = b.name.toLowerCase().includes('neural');
			if (aIsNeural !== bIsNeural) {
				return bIsNeural ? 1 : -1;
			}

			return a.name.localeCompare(b.name);
		}).slice(0, 30); // Limit to top 30
	}

	/**
	 * Advanced voice search with fuzzy matching
	 */
	public static async findVoice(query: string): Promise<FloweryVoice | null> {
		const voicesData = await this.getVoices();
		const searchTerm = query.toLowerCase().trim();

		// Try exact ID match first
		let voice = voicesData.voices.find(v => v.id === query);
		if (voice) return voice;

		// Try exact name match
		voice = voicesData.voices.find(v => v.name.toLowerCase() === searchTerm);
		if (voice) return voice;

		// Try partial name match
		voice = voicesData.voices.find(v => v.name.toLowerCase().includes(searchTerm));
		if (voice) return voice;

		// Try language match
		voice = voicesData.voices.find(v => v.language.name.toLowerCase().includes(searchTerm));
		if (voice) return voice;

		// Try source match
		voice = voicesData.voices.find(v => v.source.toLowerCase().includes(searchTerm));
		return voice || null;
	}

	/**
	 * Get voice recommendations based on text content
	 */
	public static async getRecommendedVoice(text: string, preferredLanguage?: string): Promise<FloweryVoice | null> {
		const voicesData = await this.getVoices();

		// Detect language from text (basic detection)
		const detectedLang = this.detectLanguage(text);
		const targetLang = preferredLanguage || detectedLang;

		// Get voices for the target language
		const languageVoices = voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase().startsWith(targetLang.toLowerCase())
		);

		if (languageVoices.length === 0) {
			// Fallback to English
			const englishVoices = voicesData.voices.filter(voice =>
				voice.language.code.toLowerCase().startsWith('en')
			);
			return englishVoices.find(v => v.name.toLowerCase().includes('neural')) || englishVoices[0] || null;
		}

		// Prefer Neural voices
		const neuralVoices = languageVoices.filter(v => v.name.toLowerCase().includes('neural'));
		if (neuralVoices.length > 0) {
			return neuralVoices[0];
		}

		return languageVoices[0];
	}

	/**
	 * Basic language detection from text
	 */
	private static detectLanguage(text: string): string {
		const cleanText = text.toLowerCase().trim();

		// Czech detection
		if (/[áčďéěíňóřšťúůýž]/.test(cleanText) ||
			/\b(je|to|na|se|za|do|od|po|při|před|mezi|nad|pod|pro|bez|podle|během|kolem|okolo|díky|kvůli|místo|namísto|kromě|včetně|ohledně|vzhledem|týkající|týkající)\b/.test(cleanText)) {
			return 'cs';
		}

		// Japanese detection (hiragana, katakana, kanji)
		if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanText)) {
			return 'ja';
		}

		// German detection
		if (/[äöüß]/.test(cleanText) ||
			/\b(der|die|das|und|ist|ein|eine|mit|für|auf|von|zu|im|am|oder|aber|auch|wenn|dann|noch|nur|schon|wie|was|wo|wer|wann|warum)\b/.test(cleanText)) {
			return 'de';
		}

		// French detection
		if (/[àâäéèêëïîôöùûüÿç]/.test(cleanText) ||
			/\b(le|la|les|un|une|des|et|est|de|du|dans|pour|avec|sur|par|ce|cette|ces|qui|que|dont|où|quand|comment|pourquoi)\b/.test(cleanText)) {
			return 'fr';
		}

		// Spanish detection
		if (/[áéíóúñü¿¡]/.test(cleanText) ||
			/\b(el|la|los|las|un|una|y|es|de|en|para|con|por|que|se|no|te|lo|le|da|su|por|son|como|pero|más|todo|bien|sí|muy|aquí|ahora)\b/.test(cleanText)) {
			return 'es';
		}

		// Default to English
		return 'en';
	}

	/**
	 * Get voice statistics and analytics
	 */
	public static async getVoiceStatistics(): Promise<{
		total: number;
		byLanguage: Record<string, number>;
		byGender: Record<string, number>;
		bySource: Record<string, number>;
		topLanguages: Array<{ language: string; count: number; percentage: number }>;
	}> {
		const voicesData = await this.getVoices();

		const byLanguage: Record<string, number> = {};
		const byGender: Record<string, number> = {};
		const bySource: Record<string, number> = {};

		voicesData.voices.forEach(voice => {
			// Count by language
			const lang = voice.language.name;
			byLanguage[lang] = (byLanguage[lang] || 0) + 1;

			// Count by gender
			const gender = voice.gender || 'Unknown';
			byGender[gender] = (byGender[gender] || 0) + 1;

			// Count by source
			const source = voice.source || 'Unknown';
			bySource[source] = (bySource[source] || 0) + 1;
		});

		// Get top languages with percentages
		const topLanguages = Object.entries(byLanguage)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 15)
			.map(([language, count]) => ({
				language,
				count,
				percentage: Math.round((count / voicesData.count) * 100)
			}));

		return {
			total: voicesData.count,
			byLanguage,
			byGender,
			bySource,
			topLanguages
		};
	}

	/**
	 * Enforce rate limiting (3 requests per second)
	 */
	private static async enforceRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;
		
		if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
			const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
			await new Promise(resolve => setTimeout(resolve, delay));
		}
		
		this.lastRequestTime = Date.now();
	}

	/**
	 * Estimate audio duration based on text length and speed
	 */
	private static estimateAudioDuration(text: string, speed: number): number {
		// Rough estimation: ~150 words per minute for normal speech
		// Adjust for speed multiplier
		const wordsPerMinute = 150 * speed;
		const wordCount = text.split(/\s+/).length;
		const durationMinutes = wordCount / wordsPerMinute;
		return Math.round(durationMinutes * 60 * 1000); // Return in milliseconds
	}

	/**
	 * Get supported audio formats
	 */
	public static getSupportedFormats(): string[] {
		return ['mp3', 'ogg_opus', 'ogg_vorbis', 'aac', 'wav', 'flac'];
	}

	/**
	 * Get speed range
	 */
	public static getSpeedRange(): { min: number; max: number; step: number } {
		return { min: 0.5, max: 10, step: 0.1 };
	}

	/**
	 * Get character limit
	 */
	public static getCharacterLimit(): number {
		return this.MAX_TEXT_LENGTH;
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
