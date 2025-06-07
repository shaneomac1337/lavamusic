const fastify = require('fastify')({ logger: true });
const path = require('path');
const fs = require('fs');

// Register plugins
async function setupServer() {
  // CORS
  await fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
  });

  // JWT
  await fastify.register(require('@fastify/jwt'), {
    secret: 'demo-secret-key-for-testing',
  });

  // Cookie support
  await fastify.register(require('@fastify/cookie'));

  // Static files - try multiple paths
  const publicPaths = [
    path.join(__dirname, 'src/web/public'),
    path.join(__dirname, 'dist/web/public'),
    path.join(process.cwd(), 'src/web/public'),
    path.join(process.cwd(), 'dist/web/public')
  ];

  let publicPath = publicPaths[0];
  for (const testPath of publicPaths) {
    if (fs.existsSync(testPath)) {
      publicPath = testPath;
      break;
    }
  }

  console.log(`Using public path: ${publicPath}`);

  await fastify.register(require('@fastify/static'), {
    root: publicPath,
    prefix: '/public/',
  });

  // Mock data
  const mockData = {
    user: {
      id: '123456789012345678',
      username: 'TestUser',
      discriminator: '0001',
      avatar: null,
    },
    guilds: [
      {
        id: '987654321098765432',
        name: 'Test Server 1',
        icon: null,
        botPresent: true,
        memberCount: 150,
        player: {
          connected: true,
          playing: true,
          paused: false,
          queueLength: 3,
          currentTrack: {
            title: 'Test Song',
            author: 'Test Artist',
          },
        },
      },
      {
        id: '876543210987654321',
        name: 'Test Server 2',
        icon: null,
        botPresent: true,
        memberCount: 75,
        player: null,
      },
    ],
    botStats: {
      guilds: 2,
      users: 225,
      players: 1,
      uptime: 3600,
      ping: 45,
    },
  };

  // Helper function to find HTML files
  function findHtmlFile(filename) {
    const htmlPaths = [
      path.join(__dirname, 'src/web/public', filename),
      path.join(__dirname, 'dist/web/public', filename),
      path.join(process.cwd(), 'src/web/public', filename),
      path.join(process.cwd(), 'dist/web/public', filename)
    ];

    for (const testPath of htmlPaths) {
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }
    return null;
  }

  // Routes
  fastify.get('/', async (request, reply) => {
    const htmlPath = findHtmlFile('index.html');
    if (!htmlPath) {
      return reply.code(404).send('Dashboard not found - HTML files missing');
    }
    const html = fs.readFileSync(htmlPath, 'utf-8');
    reply.type('text/html').send(html);
  });

  fastify.get('/dashboard', async (request, reply) => {
    const htmlPath = findHtmlFile('dashboard.html');
    if (!htmlPath) {
      return reply.code(404).send('Dashboard not found - HTML files missing');
    }
    const html = fs.readFileSync(htmlPath, 'utf-8');
    reply.type('text/html').send(html);
  });

  fastify.get('/guild/:guildId', async (request, reply) => {
    const htmlPath = findHtmlFile('guild.html');
    if (!htmlPath) {
      return reply.code(404).send('Guild dashboard not found - HTML files missing');
    }
    const html = fs.readFileSync(htmlPath, 'utf-8');
    reply.type('text/html').send(html);
  });

  // Mock API endpoints
  fastify.get('/api/dashboard-data', async () => {
    return mockData;
  });

  fastify.get('/api/stats', async () => {
    return mockData.botStats;
  });

  fastify.get('/api/guilds', async () => {
    return mockData.guilds;
  });

  fastify.get('/api/guilds/:guildId', async (request) => {
    const { guildId } = request.params;
    const guild = mockData.guilds.find(g => g.id === guildId);
    if (!guild) {
      throw fastify.httpErrors.notFound('Guild not found');
    }
    return {
      ...guild,
      settings: {
        prefix: '!',
        language: 'EnglishUS',
      },
    };
  });

  fastify.get('/api/guilds/:guildId/queue', async (request) => {
    return {
      current: {
        title: 'Current Test Song',
        author: 'Test Artist',
        duration: 180000,
        uri: 'https://example.com/song',
        thumbnail: 'https://via.placeholder.com/64x64',
      },
      tracks: [
        {
          index: 0,
          title: 'Next Song 1',
          author: 'Artist 1',
          duration: 200000,
          uri: 'https://example.com/song1',
          thumbnail: 'https://via.placeholder.com/64x64',
        },
        {
          index: 1,
          title: 'Next Song 2',
          author: 'Artist 2',
          duration: 150000,
          uri: 'https://example.com/song2',
          thumbnail: 'https://via.placeholder.com/64x64',
        },
      ],
    };
  });

  // Mock player controls
  fastify.post('/api/guilds/:guildId/player/play', async (request) => {
    const { query } = request.body;
    console.log(`Mock: Adding track "${query}" to queue`);
    return { success: true, track: { title: query, author: 'Mock Artist' } };
  });

  fastify.post('/api/guilds/:guildId/player/pause', async () => {
    console.log('Mock: Toggling pause/resume');
    return { success: true, paused: Math.random() > 0.5 };
  });

  fastify.post('/api/guilds/:guildId/player/skip', async () => {
    console.log('Mock: Skipping track');
    return { success: true };
  });

  fastify.post('/api/guilds/:guildId/player/stop', async () => {
    console.log('Mock: Stopping player');
    return { success: true };
  });

  fastify.post('/api/guilds/:guildId/player/volume', async (request) => {
    const { volume } = request.body;
    console.log(`Mock: Setting volume to ${volume}%`);
    return { success: true, volume };
  });

  fastify.put('/api/guilds/:guildId/settings', async (request) => {
    const settings = request.body;
    console.log('Mock: Updating guild settings:', settings);
    return { success: true };
  });

  // Mock auth endpoints
  fastify.get('/auth/discord', async (request, reply) => {
    // For demo, just redirect to dashboard with a mock token
    const token = fastify.jwt.sign(mockData.user, { expiresIn: '7d' });
    reply.setCookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    reply.redirect('/dashboard');
  });

  fastify.post('/auth/logout', async (request, reply) => {
    reply.clearCookie('token');
    return { success: true };
  });

  fastify.get('/auth/me', async () => {
    return mockData.user;
  });

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: 'demo',
    };
  });

  // Simple WebSocket setup (optional for demo)
  console.log('Note: Real-time features disabled in demo mode');

  return fastify;
}

// Start server
async function start() {
  try {
    const server = await setupServer();
    await server.listen({ port: 3002, host: '0.0.0.0' });
    console.log('🎵 Lavamusic Dashboard Demo running at http://localhost:3002');
    console.log('📊 Features available:');
    console.log('  - Main dashboard with mock data');
    console.log('  - Guild controls (demo mode)');
    console.log('  - Real-time updates simulation');
    console.log('  - Responsive design');
    console.log('');
    console.log('🔗 Quick links:');
    console.log('  - Home: http://localhost:3002');
    console.log('  - Dashboard: http://localhost:3002/dashboard');
    console.log('  - Guild Demo: http://localhost:3002/guild/987654321098765432');
    console.log('  - Health: http://localhost:3002/health');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
