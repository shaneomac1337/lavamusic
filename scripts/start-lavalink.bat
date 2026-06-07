@echo off
echo Starting Lavalink Server v4.2.2...
echo.
echo Configuration:
echo - Port: 2333
echo - Password: youshallnotpass
echo - Plugins: LavaSrc, LavaSearch
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0..\Lavalink"
java -jar Lavalink.jar

pause
