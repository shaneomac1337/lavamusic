#!/bin/sh
# Docker entrypoint script for LavaMusic

set -e

echo "🎵 Starting LavaMusic..."

# Set up database schema
echo "📦 Setting up database..."
npx prisma db push --accept-data-loss --skip-generate

# Generate Prisma client if needed
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start the application
echo "🚀 Starting bot..."
exec "$@"
