# 🐳 LavaMusic Docker Configuration

This folder contains all Docker-related configuration files for containerized deployment of LavaMusic.

## 📋 Docker Files

### 🏗️ Container Definitions
- **[Dockerfile](./Dockerfile)** - Main application container configuration
- **[docker-entrypoint.sh](./docker-entrypoint.sh)** - Container startup script

### 🔧 Docker Compose Configurations
- **[docker-compose.yml](./docker-compose.yml)** - Complete stack deployment (bot + Lavalink)
- **[docker-compose-lavamusic.yml](./docker-compose-lavamusic.yml)** - LavaMusic bot only
- **[docker-compose-lavalink.yml](./docker-compose-lavalink.yml)** - Lavalink server only

## 🚀 Quick Start

### Complete Stack Deployment
```bash
# Deploy both LavaMusic bot and Lavalink server
docker-compose up -d
```

### Individual Service Deployment

#### LavaMusic Bot Only
```bash
docker-compose -f docker-compose-lavamusic.yml up -d
```

#### Lavalink Server Only
```bash
docker-compose -f docker-compose-lavalink.yml up -d
```

## 📖 Configuration Details

### Main Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

**Purpose**: Creates optimized container for LavaMusic bot application.

### Docker Compose Stack (docker-compose.yml)
```yaml
version: '3.8'
services:
  lavamusic:
    build: .
    ports:
      - "3001:3001"
    depends_on:
      - lavalink
    environment:
      - LAVALINK_HOST=lavalink
  
  lavalink:
    image: ghcr.io/lavalink-devs/lavalink:4
    ports:
      - "2333:2333"
    volumes:
      - ../Lavalink/application.yml:/opt/Lavalink/application.yml
```

**Purpose**: Orchestrates complete LavaMusic deployment with all dependencies.

## 🔧 Environment Configuration

### Required Environment Variables
```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
CLIENT_SECRET=your_discord_client_secret

# Lavalink Configuration
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass

# Database Configuration
DATABASE_URL=your_database_connection_string

# Dashboard Configuration
DASHBOARD_SECRET=your_dashboard_secret_key
```

### Environment Files
Create a `.env` file in the project root with your configuration:
```bash
cp .env.example .env
# Edit .env with your values
```

## 🏗️ Build Process

### Building Images

#### Development Build
```bash
docker build -t lavamusic:dev .
```

#### Production Build
```bash
docker build -t lavamusic:latest --target production .
```

### Multi-Stage Build
The Dockerfile supports multi-stage builds for optimized production images:
- **Development**: Includes dev dependencies and source maps
- **Production**: Optimized with only runtime dependencies

## 🚀 Deployment Options

### Local Development
```bash
# Start with hot reload
docker-compose -f docker-compose-dev.yml up

# View logs
docker-compose logs -f lavamusic
```

### Production Deployment
```bash
# Deploy production stack
docker-compose -f docker-compose.yml up -d

# Scale services
docker-compose up -d --scale lavamusic=2
```

### Cloud Deployment
```bash
# Deploy to cloud provider
docker-compose -f docker-compose-cloud.yml up -d
```

## 📊 Service Management

### Container Operations

#### Start Services
```bash
docker-compose up -d
```

#### Stop Services
```bash
docker-compose down
```

#### Restart Services
```bash
docker-compose restart lavamusic
```

#### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f lavamusic
```

#### Update Services
```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

## 🔍 Monitoring & Debugging

### Health Checks
```bash
# Check container status
docker-compose ps

# Check container health
docker inspect --format='{{.State.Health.Status}}' lavamusic_container
```

### Resource Monitoring
```bash
# Monitor resource usage
docker stats

# View container processes
docker-compose top
```

### Debugging
```bash
# Execute commands in running container
docker-compose exec lavamusic sh

# View container filesystem
docker-compose exec lavamusic ls -la
```

## 🔧 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs for errors
docker-compose logs lavamusic

# Verify environment variables
docker-compose config
```

#### Network Connectivity Issues
```bash
# Check network configuration
docker network ls
docker network inspect lavamusic_default
```

#### Volume Mount Issues
```bash
# Verify volume mounts
docker-compose exec lavamusic ls -la /app
```

#### Database Connection Issues
```bash
# Test database connectivity
docker-compose exec lavamusic npm run test:db
```

## 📁 Volume Management

### Persistent Data
```yaml
volumes:
  - lavamusic_data:/app/data
  - lavamusic_logs:/app/logs
  - ../Lavalink/application.yml:/opt/Lavalink/application.yml:ro
```

### Backup & Restore
```bash
# Backup volumes
docker run --rm -v lavamusic_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data

# Restore volumes
docker run --rm -v lavamusic_data:/data -v $(pwd):/backup alpine tar xzf /backup/backup.tar.gz -C /
```

## 🔒 Security Considerations

### Container Security
1. **Non-root User**: Containers run as non-root user
2. **Read-only Filesystem**: Where possible, use read-only mounts
3. **Secrets Management**: Use Docker secrets for sensitive data
4. **Network Isolation**: Containers communicate through internal networks

### Production Security
```yaml
# Example security configuration
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /var/tmp
```

## 📚 Related Documentation

- **Configuration**: See `../config/` for application configuration
- **Development**: Check `../docs/` for setup guides
- **Testing**: Review `../tests/` for container testing

## 🤝 Contributing

When modifying Docker configurations:

1. **Test Locally**: Ensure changes work in local environment
2. **Multi-Platform**: Consider ARM64 and AMD64 compatibility
3. **Documentation**: Update this README with changes
4. **Security**: Review security implications of changes
