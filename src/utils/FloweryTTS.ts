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
	 * Get popular/recommended voices (English + Czech + Japanese)
	 */
	public static async getPopularVoices(): Promise<FloweryVoice[]> {
		const voicesData = await this.getVoices();

		// Get all English, Czech, and Japanese voices
		const englishVoices = voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase().startsWith('en')
		);

		const czechVoices = voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase().startsWith('cs') ||
			voice.language.code.toLowerCase().startsWith('cz') ||
			voice.language.name.toLowerCase().includes('czech')
		);

		const japaneseVoices = voicesData.voices.filter(voice =>
			voice.language.code.toLowerCase().startsWith('ja') ||
			voice.language.name.toLowerCase().includes('japanese')
		);

		// Combine English, Czech, and Japanese voices
		const combinedVoices = [...englishVoices, ...czechVoices, ...japaneseVoices];

		// Sort by language priority (English first, then Czech, then Japanese) and then by name
		return combinedVoices.sort((a, b) => {
			const aIsEnglish = a.language.code.toLowerCase().startsWith('en');
			const bIsEnglish = b.language.code.toLowerCase().startsWith('en');
			const aIsCzech = a.language.code.toLowerCase().startsWith('cs') || a.language.name.toLowerCase().includes('czech');
			const bIsCzech = b.language.code.toLowerCase().startsWith('cs') || b.language.name.toLowerCase().includes('czech');
			const aIsJapanese = a.language.code.toLowerCase().startsWith('ja') || a.language.name.toLowerCase().includes('japanese');
			const bIsJapanese = b.language.code.toLowerCase().startsWith('ja') || b.language.name.toLowerCase().includes('japanese');

			// Priority order: English > Czech > Japanese > Others
			if (aIsEnglish && !bIsEnglish) return -1;
			if (!aIsEnglish && bIsEnglish) return 1;
			if (aIsCzech && !bIsCzech && !bIsEnglish) return -1;
			if (!aIsCzech && bIsCzech && !aIsEnglish) return 1;
			if (aIsJapanese && !bIsJapanese && !bIsEnglish && !bIsCzech) return -1;
			if (!aIsJapanese && bIsJapanese && !aIsEnglish && !aIsCzech) return 1;

			// Within same language group, sort by name
			return a.name.localeCompare(b.name);
		});
	}

	/**
	 * Find voice by name or ID
	 */
	public static async findVoice(query: string): Promise<FloweryVoice | null> {
		const voicesData = await this.getVoices();
		
		// Try exact ID match first
		let voice = voicesData.voices.find(v => v.id === query);
		if (voice) return voice;
		
		// Try exact name match
		voice = voicesData.voices.find(v => v.name.toLowerCase() === query.toLowerCase());
		if (voice) return voice;
		
		// Try partial name match
		voice = voicesData.voices.find(v => v.name.toLowerCase().includes(query.toLowerCase()));
		return voice || null;
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
