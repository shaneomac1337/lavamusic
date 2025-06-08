# Dockerfile for LavaMusic Discord Bot
FROM node:lts-alpine3.22 AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++ openssl openssl-dev

# Clone repository
ARG REPO_URL=https://github.com/shaneomac1337/lavamusic.git
ARG BRANCH=main
RUN git clone --depth 1 --branch ${BRANCH} ${REPO_URL} .

# Install dependencies and build
RUN npm install && npm run build && npx prisma generate

# Production stage
FROM node:lts-alpine3.22

WORKDIR /opt/lavamusic

# Install runtime dependencies
RUN apk add --no-cache openssl curl dumb-init

# Create user
RUN addgroup -g 322 -S lavamusic && adduser -u 322 -S lavamusic -G lavamusic

# Copy application
COPY --from=builder /app/ ./

# Copy local .env file if it exists
COPY .env* ./

# Install production dependencies
RUN npm install --only=production && npm cache clean --force

# Set permissions
RUN chmod +x docker-entrypoint.sh && mkdir -p logs && chown -R lavamusic:lavamusic /opt/lavamusic

USER lavamusic

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

ENV NODE_ENV=production NODE_OPTIONS="--enable-source-maps"

ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh", "node", "dist/index.js"]
