import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../env';
import type { Lavamusic } from '../structures/index';
import { dashboardRoutes } from './routes/dashboard';
import { apiRoutes } from './routes/api';
import { authRoutes } from './routes/auth';

export class WebServer {
	private app: FastifyInstance;
	private io: Server;
	private client: Lavamusic;

	constructor(client: Lavamusic) {
		this.client = client;
		this.app = fastify({
			logger: {
				level: 'info',
			},
		});
		this.setupMiddleware();
		this.setupRoutes();
	}

	private async setupMiddleware(): Promise<void> {
		// Security middleware
		await this.app.register(helmet, {
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
					scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdn.socket.io'],
					scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
					imgSrc: ["'self'", 'data:', 'https:'],
					connectSrc: ["'self'", 'ws:', 'wss:'],
				},
			},
		});

		// CORS
		await this.app.register(cors, {
			origin: true,
			credentials: true,
		});

		// Cookie support
		await this.app.register(cookie);

		// JWT - Auto-generate secret if not provided
		const jwtSecret = env.DASHBOARD_SECRET || require('crypto').randomBytes(64).toString('hex');
		if (!env.DASHBOARD_SECRET) {
			console.log('⚠️  Auto-generated DASHBOARD_SECRET. For production, set a permanent secret in .env');
			console.log(`DASHBOARD_SECRET="${jwtSecret}"`);
		}

		await this.app.register(jwt, {
			secret: jwtSecret,
		});

		// Sensible defaults
		await this.app.register(sensible);

		// Static files
		const publicPath = path.join(__dirname, 'public');
		const altPublicPath = path.join(process.cwd(), 'src/web/public');
		const staticRoot = fs.existsSync(publicPath) ? publicPath : altPublicPath;

		await this.app.register(require('@fastify/static'), {
			root: staticRoot,
			prefix: '/public/',
		});
	}

	private async setupRoutes(): Promise<void> {
		// API routes
		await this.app.register(apiRoutes, { prefix: '/api', client: this.client });
		
		// Auth routes
		await this.app.register(authRoutes, { prefix: '/auth', client: this.client });
		
		// Dashboard routes
		await this.app.register(dashboardRoutes, { prefix: '/', client: this.client });

		// Health check
		this.app.get('/health', async () => {
			return {
				status: 'ok',
				timestamp: new Date().toISOString(),
				guilds: this.client.guilds.cache.size,
				uptime: process.uptime(),
			};
		});
	}

	private setupSocketIO(): void {
		this.io = new Server(this.app.server, {
			cors: {
				origin: "*",
				methods: ["GET", "POST"]
			}
		});

		this.io.on('connection', (socket) => {
			this.client.logger.info(`Dashboard client connected: ${socket.id}`);

			// Join guild-specific rooms
			socket.on('join-guild', (guildId: string) => {
				socket.join(`guild:${guildId}`);
			});

			// Leave guild rooms
			socket.on('leave-guild', (guildId: string) => {
				socket.leave(`guild:${guildId}`);
			});

			socket.on('disconnect', () => {
				this.client.logger.info(`Dashboard client disconnected: ${socket.id}`);
			});
		});

		// Emit real-time updates
		this.setupRealtimeEvents();
	}

	private setupRealtimeEvents(): void {
		// Player events
		this.client.manager.on('trackStart', (player, track) => {
			this.io.to(`guild:${player.guildId}`).emit('trackStart', {
				guildId: player.guildId,
				track: {
					title: track.info.title,
					author: track.info.author,
					duration: track.info.duration,
					uri: track.info.uri,
					thumbnail: track.info.artworkUrl,
				},
			});
		});

		this.client.manager.on('trackEnd', (player) => {
			this.io.to(`guild:${player.guildId}`).emit('trackEnd', {
				guildId: player.guildId,
			});
		});

		this.client.manager.on('queueEnd', (player) => {
			this.io.to(`guild:${player.guildId}`).emit('queueEnd', {
				guildId: player.guildId,
			});
		});

		// Player state changes
		this.client.manager.on('playerUpdate', (player) => {
			this.io.to(`guild:${player.guildId}`).emit('playerUpdate', {
				guildId: player.guildId,
				position: player.position,
				paused: player.paused,
				volume: player.volume,
				connected: player.connected,
			});
		});
	}

	public async start(): Promise<void> {
		try {
			const port = env.DASHBOARD_PORT || 3001;
			await this.app.listen({ port, host: '0.0.0.0' });
			this.setupSocketIO();
			this.client.logger.success(`Web dashboard started on port ${port}`);
		} catch (error) {
			this.client.logger.error('Failed to start web dashboard:', error);
			throw error;
		}
	}

	public async stop(): Promise<void> {
		try {
			await this.app.close();
			this.client.logger.info('Web dashboard stopped');
		} catch (error) {
			this.client.logger.error('Error stopping web dashboard:', error);
		}
	}

	public getIO(): Server {
		return this.io;
	}

	public getApp(): FastifyInstance {
		return this.app;
	}
}
