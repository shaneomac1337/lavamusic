#!/bin/sh
# Docker entrypoint script for LavaMusic

set -e

echo "🎵 Starting LavaMusic..."

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client if needed
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start the application
echo "🚀 Starting bot..."
exec "$@"
