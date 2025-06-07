import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Lavamusic } from '../../structures/index';
import path from 'node:path';
import fs from 'node:fs';

interface DashboardOptions extends FastifyPluginOptions {
	client: Lavamusic;
}

export async function dashboardRoutes(fastify: FastifyInstance, options: DashboardOptions) {
	const { client } = options;

	// Serve dashboard HTML
	fastify.get('/', async (request, reply) => {
		const htmlPath = path.join(__dirname, '../public/index.html');

		if (!fs.existsSync(htmlPath)) {
			// Try alternative path for built version
			const altPath = path.join(process.cwd(), 'src/web/public/index.html');
			if (fs.existsSync(altPath)) {
				const html = fs.readFileSync(altPath, 'utf-8');
				return reply.type('text/html').send(html);
			}
			return reply.code(404).send('Dashboard not found. Please ensure HTML files are in the correct location.');
		}

		const html = fs.readFileSync(htmlPath, 'utf-8');
		reply.type('text/html').send(html);
	});

	// Temporary test route to bypass Discord OAuth
	fastify.get('/test-auth', async (request, reply) => {
		// Create a test token
		const testToken = fastify.jwt.sign({
			userId: '123456789012345678',
			username: 'TestUser',
			discriminator: '0001',
			avatar: null,
			guilds: [],
		}, { expiresIn: '1h' });

		reply.setCookie('token', testToken, {
			httpOnly: true,
			secure: false,
			sameSite: 'lax',
			path: '/', // Ensure cookie is available for all paths
			maxAge: 60 * 60 * 1000, // 1 hour
		});

		reply.redirect('/dashboard');
	});

	fastify.get('/dashboard', {
		preHandler: async (request, reply) => {
			try {
				console.log('Dashboard access - All cookies:', request.cookies);
				const token = request.cookies.token;
				console.log('Dashboard access - Token present:', !!token);
				if (!token) {
					console.log('No token found, redirecting to auth');
					return reply.redirect('/auth/discord');
				}

				const decoded = fastify.jwt.verify(token) as any;
				console.log('Token verified successfully for user:', decoded.username);
				request.user = decoded;
			} catch (err: any) {
				console.log('Token verification failed:', err.message);
				return reply.redirect('/auth/discord');
			}
		}
	}, async (request, reply) => {
		// Try multiple possible paths for the HTML file
		const possiblePaths = [
			path.join(__dirname, '../public/dashboard.html'),
			path.join(process.cwd(), 'src/web/public/dashboard.html'),
			path.join(process.cwd(), 'dist/web/public/dashboard.html'),
		];

		let htmlPath = '';
		for (const testPath of possiblePaths) {
			if (fs.existsSync(testPath)) {
				htmlPath = testPath;
				break;
			}
		}

		if (!htmlPath) {
			console.log('Dashboard HTML not found. Tried paths:', possiblePaths);
			return reply.code(404).send('Dashboard not found');
		}

		const html = fs.readFileSync(htmlPath, 'utf-8');
		reply.type('text/html').send(html);
	});

	fastify.get('/guild/:guildId', {
		preHandler: async (request, reply) => {
			try {
				const token = request.cookies.token;
				if (!token) {
					return reply.redirect('/auth/discord');
				}
				
				const decoded = fastify.jwt.verify(token) as any;
				request.user = decoded;

				// Check if user has access to this guild
				const { guildId } = request.params as { guildId: string };
				const hasAccess = decoded.guilds.some((guild: any) => guild.id === guildId);
				
				if (!hasAccess) {
					return reply.code(403).send('Access denied to this guild');
				}
			} catch (err) {
				return reply.redirect('/auth/discord');
			}
		}
	}, async (request, reply) => {
		// Try multiple possible paths for the HTML file
		const possiblePaths = [
			path.join(__dirname, '../public/guild.html'),
			path.join(process.cwd(), 'src/web/public/guild.html'),
			path.join(process.cwd(), 'dist/web/public/guild.html'),
		];

		let htmlPath = '';
		for (const testPath of possiblePaths) {
			if (fs.existsSync(testPath)) {
				htmlPath = testPath;
				break;
			}
		}

		if (!htmlPath) {
			console.log('Guild HTML not found. Tried paths:', possiblePaths);
			return reply.code(404).send('Guild dashboard not found');
		}

		const html = fs.readFileSync(htmlPath, 'utf-8');
		reply.type('text/html').send(html);
	});

	// API endpoint to get dashboard data
	fastify.get('/api/dashboard-data', {
		preHandler: async (request, reply) => {
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
		const user = request.user as any;
		
		// Get user's accessible guilds with bot data
		const accessibleGuilds = user.guilds.map((guild: any) => {
			const botGuild = client.guilds.cache.get(guild.id);
			const player = client.manager.getPlayer(guild.id);
			
			return {
				id: guild.id,
				name: guild.name,
				icon: guild.icon,
				botPresent: !!botGuild,
				memberCount: botGuild?.memberCount || 0,
				player: player ? {
					connected: player.connected,
					playing: player.playing,
					paused: player.paused,
					queueLength: player.queue.tracks.length,
					currentTrack: player.queue.current ? {
						title: player.queue.current.info.title,
						author: player.queue.current.info.author,
					} : null,
				} : null,
			};
		});

		return {
			user: {
				id: user.userId,
				username: user.username,
				discriminator: user.discriminator,
				avatar: user.avatar,
			},
			guilds: accessibleGuilds,
			botStats: {
				guilds: client.guilds.cache.size,
				users: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
				players: client.manager.players.size,
				uptime: process.uptime(),
				ping: client.ws.ping,
			},
		};
	});
}
