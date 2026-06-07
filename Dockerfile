# syntax=docker/dockerfile:1
# ============================================
# LavaMusic — Discord music bot
# Multi-stage build from the local build context.
# ============================================

# --------------------------------------------
# STAGE 1: Builder — install deps and compile
# --------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /build

# Build toolchain for native modules + prisma
RUN apk add --no-cache python3 make g++ openssl

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and build (tailwind CSS + tsup) and generate Prisma client
COPY . .
RUN npm run build \
    && npx prisma generate \
    && npm prune --omit=dev

# --------------------------------------------
# STAGE 2: Production — minimal runtime image
# --------------------------------------------
FROM node:24-alpine AS production

WORKDIR /opt/lavamusic

# Runtime-only dependencies
RUN apk add --no-cache openssl curl dumb-init

# Non-root user (uid/gid 322 matches the production deployment)
RUN addgroup -g 322 -S lavamusic \
    && adduser -u 322 -S lavamusic -G lavamusic

# Copy only the artifacts needed to run
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/prisma ./prisma
COPY --from=builder /build/docker ./docker
COPY --from=builder /build/package.json ./
COPY --from=builder /build/locales ./locales
COPY --from=builder /build/src/utils/LavaLogo.txt ./src/utils/LavaLogo.txt
COPY --from=builder /build/src/web/public ./src/web/public

# Strip any CR (defensive: a CRLF entrypoint from a Windows checkout breaks exec)
RUN sed -i 's/\r$//' docker/docker-entrypoint.sh \
    && chmod +x docker/docker-entrypoint.sh \
    && mkdir -p logs \
    && chown -R lavamusic:lavamusic /opt/lavamusic

USER lavamusic

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

ENV NODE_ENV=production NODE_OPTIONS="--enable-source-maps"

ENTRYPOINT ["dumb-init", "--"]
CMD ["docker/docker-entrypoint.sh", "node", "dist/index.js"]
