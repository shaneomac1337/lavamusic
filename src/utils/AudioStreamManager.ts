import { createServer, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { FloweryTTS, FloweryTTSResult } from './FloweryTTS';

interface AudioStream {
	id: string;
	buffer: Buffer;
	mimeType: string;
	createdAt: number;
	accessed: number;
}

export class AudioStreamManager {
	private static instance: AudioStreamManager;
	private streams: Map<string, AudioStream> = new Map();
	private server: any = null;
	private port: number = 0;
	private baseUrl: string = '';
	private cleanupInterval: NodeJS.Timeout | null = null;
	
	// Stream TTL: 5 minutes
	private static readonly STREAM_TTL = 5 * 60 * 1000;
	// Cleanup interval: 1 minute
	private static readonly CLEANUP_INTERVAL = 60 * 1000;

	private constructor() {
		this.startCleanupTimer();
	}

	public static getInstance(): AudioStreamManager {
		if (!AudioStreamManager.instance) {
			AudioStreamManager.instance = new AudioStreamManager();
		}
		return AudioStreamManager.instance;
	}

	/**
	 * Initialize the audio stream server
	 */
	public async initialize(port?: number): Promise<void> {
		if (this.server) {
			return; // Already initialized
		}

		this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
			this.handleRequest(req, res);
		});

		return new Promise((resolve, reject) => {
			this.server.listen(port || 0, '127.0.0.1', () => {
				const address = this.server.address() as AddressInfo;
				this.port = address.port;
				this.baseUrl = `http://127.0.0.1:${this.port}`;
				console.log(`Audio stream server started on ${this.baseUrl}`);
				resolve();
			});

			this.server.on('error', (error: Error) => {
				console.error('Audio stream server error:', error);
				reject(error);
			});
		});
	}

	/**
	 * Handle HTTP requests for audio streams
	 */
	private handleRequest(req: IncomingMessage, res: ServerResponse): void {
		const url = req.url;
		
		if (!url || !url.startsWith('/stream/')) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('Not Found');
			return;
		}

		const streamId = url.substring('/stream/'.length);
		const stream = this.streams.get(streamId);

		if (!stream) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('Stream not found or expired');
			return;
		}

		// Update access time
		stream.accessed = Date.now();

		// Set appropriate headers
		res.writeHead(200, {
			'Content-Type': stream.mimeType,
			'Content-Length': stream.buffer.length,
			'Cache-Control': 'no-cache',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET',
			'Access-Control-Allow-Headers': 'Content-Type',
		});

		res.end(stream.buffer);
	}

	/**
	 * Create a temporary audio stream from FloweryTTS result
	 */
	public createStreamFromTTS(ttsResult: FloweryTTSResult, audioFormat: string = 'mp3'): string | null {
		if (!ttsResult.success || !ttsResult.audioBuffer) {
			return null;
		}

		const streamId = this.generateStreamId();
		const mimeType = this.getMimeType(audioFormat);

		const stream: AudioStream = {
			id: streamId,
			buffer: ttsResult.audioBuffer,
			mimeType,
			createdAt: Date.now(),
			accessed: Date.now()
		};

		this.streams.set(streamId, stream);
		
		const streamUrl = `${this.baseUrl}/stream/${streamId}`;
		console.log(`Created audio stream: ${streamUrl}`);
		
		return streamUrl;
	}

	/**
	 * Create a temporary audio stream from buffer
	 */
	public createStreamFromBuffer(buffer: Buffer, mimeType: string = 'audio/mpeg'): string | null {
		if (!buffer || buffer.length === 0) {
			return null;
		}

		const streamId = this.generateStreamId();

		const stream: AudioStream = {
			id: streamId,
			buffer,
			mimeType,
			createdAt: Date.now(),
			accessed: Date.now()
		};

		this.streams.set(streamId, stream);
		
		const streamUrl = `${this.baseUrl}/stream/${streamId}`;
		console.log(`Created audio stream: ${streamUrl}`);
		
		return streamUrl;
	}

	/**
	 * Remove a specific stream
	 */
	public removeStream(streamId: string): boolean {
		return this.streams.delete(streamId);
	}

	/**
	 * Get stream info
	 */
	public getStreamInfo(streamId: string): AudioStream | null {
		return this.streams.get(streamId) || null;
	}

	/**
	 * Get server info
	 */
	public getServerInfo(): { port: number; baseUrl: string; streamCount: number } {
		return {
			port: this.port,
			baseUrl: this.baseUrl,
			streamCount: this.streams.size
		};
	}

	/**
	 * Generate a unique stream ID
	 */
	private generateStreamId(): string {
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2);
		return `${timestamp}-${random}`;
	}

	/**
	 * Get MIME type for audio format
	 */
	private getMimeType(format: string): string {
		const mimeTypes: Record<string, string> = {
			'mp3': 'audio/mpeg',
			'ogg_opus': 'audio/ogg; codecs=opus',
			'ogg_vorbis': 'audio/ogg; codecs=vorbis',
			'aac': 'audio/aac',
			'wav': 'audio/wav',
			'flac': 'audio/flac'
		};

		return mimeTypes[format] || 'audio/mpeg';
	}

	/**
	 * Start cleanup timer to remove expired streams
	 */
	private startCleanupTimer(): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpiredStreams();
		}, AudioStreamManager.CLEANUP_INTERVAL);
	}

	/**
	 * Clean up expired streams
	 */
	private cleanupExpiredStreams(): void {
		const now = Date.now();
		let removedCount = 0;

		for (const [streamId, stream] of this.streams.entries()) {
			// Remove streams that haven't been accessed for TTL duration
			if (now - stream.accessed > AudioStreamManager.STREAM_TTL) {
				this.streams.delete(streamId);
				removedCount++;
			}
		}

		if (removedCount > 0) {
			console.log(`Cleaned up ${removedCount} expired audio streams. Active streams: ${this.streams.size}`);
		}
	}

	/**
	 * Shutdown the audio stream manager
	 */
	public async shutdown(): Promise<void> {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		if (this.server) {
			return new Promise((resolve) => {
				this.server.close(() => {
					console.log('Audio stream server stopped');
					resolve();
				});
			});
		}
	}

	/**
	 * Get statistics about the stream manager
	 */
	public getStats(): {
		activeStreams: number;
		totalStreamsCreated: number;
		serverRunning: boolean;
		port: number;
	} {
		return {
			activeStreams: this.streams.size,
			totalStreamsCreated: this.streams.size, // This could be enhanced to track total
			serverRunning: !!this.server,
			port: this.port
		};
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
