# Lavalink Startup Script
# This script starts the Lavalink server with optimized JVM settings

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Starting Lavalink Server v4.1.1" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Java is installed
try {
    $javaVersion = java -version 2>&1
    Write-Host "✓ Java found: $($javaVersion[0])" -ForegroundColor Green
} catch {
    Write-Host "✗ Java not found! Please install Java 17 or higher." -ForegroundColor Red
    exit 1
}

# Check if Lavalink.jar exists
if (!(Test-Path ".\Lavalink.jar")) {
    Write-Host "✗ Lavalink.jar not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Lavalink.jar found (84.74 MB)" -ForegroundColor Green

# Check if application.yml exists
if (!(Test-Path ".\application.yml")) {
    Write-Host "✗ application.yml not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ application.yml found" -ForegroundColor Green

# Check if plugins directory exists, create if not
if (!(Test-Path ".\plugins")) {
    Write-Host "! Creating plugins directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path ".\plugins" | Out-Null
}

Write-Host "✓ Plugins directory ready" -ForegroundColor Green
Write-Host ""
Write-Host "Starting Lavalink on http://localhost:2333" -ForegroundColor Cyan
Write-Host "Password: youshallnotpass" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Start Lavalink with optimized JVM settings
java -Xmx2G `
     -Xms1G `
     -XX:+UseG1GC `
     -XX:+UseStringDeduplication `
     -XX:+UnlockExperimentalVMOptions `
     -XX:+UseCompressedOops `
     -jar Lavalink.jar

# If Lavalink exits
Write-Host ""
Write-Host "Lavalink server stopped." -ForegroundColor Yellow
