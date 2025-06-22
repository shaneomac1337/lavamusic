import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import type { Lavamusic } from '../../structures/index';
import { env } from '../../env';

interface AuthOptions extends FastifyPluginOptions {
	client: Lavamusic;
}

// Helper function to construct redirect URI consistently
function getRedirectUri(request: FastifyRequest): string {
	if (env.DASHBOARD_BASE_URL) {
		// Use configured base URL for production (e.g., https://music.komplexaci.cz)
		return `${env.DASHBOARD_BASE_URL}/auth/discord/callback`;
	} else {
		// Fallback to request-based construction for local development
		const isLocalhost = request.hostname === 'localhost' || request.hostname === '127.0.0.1';
		if (isLocalhost) {
			return `${request.protocol}://${request.hostname}:${env.DASHBOARD_PORT}/auth/discord/callback`;
		} else {
			// Production without explicit base URL - assume standard ports
			return `${request.protocol}://${request.hostname}/auth/discord/callback`;
		}
	}
}

export async function authRoutes(fastify: FastifyInstance, options: AuthOptions) {
	const { client } = options;

	// Discord OAuth2 login
	fastify.get('/discord', async (request, reply) => {
		const clientId = env.CLIENT_ID;

		// Construct redirect URI - handle reverse proxy scenarios
		const redirectUri = getRedirectUri(request);

		const scope = 'identify guilds';
		const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

		console.log(`OAuth redirect URI: ${redirectUri}`);
		reply.redirect(discordAuthUrl);
	});

	// Discord OAuth2 callback
	fastify.get('/discord/callback', async (request, reply) => {
		const { code } = request.query as { code: string };
		
		if (!code) {
			throw fastify.httpErrors.badRequest('Authorization code is required');
		}

		try {
			// Construct the same redirect URI as used in the authorization request
			const redirectUri = getRedirectUri(request);

			// Exchange code for access token
			const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					client_id: env.CLIENT_ID,
					client_secret: env.CLIENT_SECRET || '',
					grant_type: 'authorization_code',
					code,
					redirect_uri: redirectUri,
				}),
			});

			const tokenData = await tokenResponse.json();

			if (!tokenResponse.ok) {
				client.logger.error('Discord token exchange failed:', {
					status: tokenResponse.status,
					statusText: tokenResponse.statusText,
					error: tokenData
				});
				throw new Error(`Failed to exchange code for token: ${tokenData.error || tokenResponse.statusText}`);
			}

			// Get user information
			const userResponse = await fetch('https://discord.com/api/users/@me', {
				headers: {
					Authorization: `Bearer ${tokenData.access_token}`,
				},
			});

			const userData = await userResponse.json();

			// Get user guilds
			const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
				headers: {
					Authorization: `Bearer ${tokenData.access_token}`,
				},
			});

			const guildsData = await guildsResponse.json();

			// Allow all authenticated Discord users to access the dashboard
			// Note: Previously restricted to bot owners and server admins only
			const isAuthorized = true; // Allow all logged-in users

			// Create JWT token
			const token = fastify.jwt.sign({
				userId: userData.id,
				username: userData.username,
				discriminator: userData.discriminator,
				avatar: userData.avatar,
				guilds: guildsData.filter((guild: any) =>
					client.guilds.cache.has(guild.id) // Include all mutual guilds (bot is present)
					// Removed admin permission requirement - all users can access
				),
			}, { expiresIn: '7d' });

			// Set cookie and redirect
			console.log('Setting JWT token cookie for user:', userData.username);
			const isProduction = !!(env.DASHBOARD_BASE_URL && env.DASHBOARD_BASE_URL.startsWith('https://'));
			reply.setCookie('token', token, {
				httpOnly: true,
				secure: isProduction, // Use secure cookies for HTTPS in production
				sameSite: 'lax',
				path: '/', // Ensure cookie is available for all paths
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});

			console.log('Redirecting to dashboard');
			reply.redirect('/dashboard');
		} catch (error) {
			client.logger.error('Discord OAuth error:', error);
			throw fastify.httpErrors.internalServerError('Authentication failed');
		}
	});

	// Logout
	fastify.post('/logout', async (request, reply) => {
		reply.clearCookie('token');
		return { success: true };
	});

	// Get current user
	fastify.get('/me', {
		preHandler: async (request, reply) => {
			try {
				await request.jwtVerify();
			} catch (err) {
				throw fastify.httpErrors.unauthorized('Invalid token');
			}
		}
	}, async (request) => {
		return request.user;
	});

	// Refresh token
	fastify.post('/refresh', {
		preHandler: async (request, reply) => {
			try {
				await request.jwtVerify();
			} catch (err) {
				throw fastify.httpErrors.unauthorized('Invalid token');
			}
		}
	}, async (request, reply) => {
		const user = request.user as any;
		
		// Create new token
		const newToken = fastify.jwt.sign({
			userId: user.userId,
			username: user.username,
			discriminator: user.discriminator,
			avatar: user.avatar,
			guilds: user.guilds,
		}, { expiresIn: '7d' });

		reply.setCookie('token', newToken, {
			httpOnly: true,
			secure: request.protocol === 'https',
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		return { success: true };
	});
}

function isUserAuthorized(userId: string, userGuilds: any[], client: Lavamusic): boolean {
	// Check if user is bot owner
	if (env.OWNER_IDS && env.OWNER_IDS.includes(userId)) {
		return true;
	}

	// Check if user has admin permissions in any mutual guild
	const mutualGuilds = userGuilds.filter(guild => 
		client.guilds.cache.has(guild.id)
	);

	return mutualGuilds.some(guild => 
		(guild.permissions & 0x8) === 0x8 // Administrator permission
	);
}
