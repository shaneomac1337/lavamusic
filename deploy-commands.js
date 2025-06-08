const { REST, Routes, ApplicationCommandType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'dist', 'commands');

// Simple fallback descriptions for commands
const commandDescriptions = {
    // Music commands
    'play': 'Play a song from YouTube, Spotify or http',
    'pause': 'Pause the current song',
    'resume': 'Resume the current song',
    'skip': 'Skip the current song',
    'stop': 'Stop the music and clear the queue',
    'queue': 'Show the current queue',
    'nowplaying': 'Show the currently playing song',
    'volume': 'Set the volume of the player',
    'join': 'Join a voice channel',
    'leave': 'Leave the voice channel',
    'loop': 'Loop the current song or queue',
    'shuffle': 'Shuffle the queue',
    'seek': 'Seek to a specific time in the song',
    'lyrics': 'Get lyrics for the currently playing track',
    'grab': 'Send the currently playing song to your DM',
    'search': 'Search for a song',
    'remove': 'Remove a song from the queue',
    'skipto': 'Skip to a specific song in the queue',
    'replay': 'Replay the current track',
    'autoplay': 'Toggle autoplay',
    'clearqueue': 'Clear the queue',
    'fairplay': 'Set the bot to play music fairly',
    'playnext': 'Add a song to play next in the queue',
    'playlocal': 'Play your local audio files',
    'say': 'Quick text to speech conversion',
    'radio': 'Display and play available radio stations',

    // Filter commands
    '8d': 'Toggle 8d filter on/off',
    'bassboost': 'Toggle bassboost filter on/off',
    'karaoke': 'Toggle karaoke filter on/off',
    'lowpass': 'Toggle lowpass filter on/off',
    'nightcore': 'Toggle nightcore filter on/off',
    'pitch': 'Toggle pitch filter on/off',
    'rate': 'Change the rate of the song',
    'reset': 'Reset the active filters',
    'rotation': 'Toggle rotation filter on/off',
    'speed': 'Change the speed of the song',
    'tremolo': 'Toggle tremolo filter on/off',
    'vibrato': 'Toggle vibrato filter on/off',

    // Playlist commands
    'addsong': 'Add a song to a playlist',
    'create': 'Create a playlist',
    'delete': 'Delete a playlist',
    'list': 'Get all playlists for a user',
    'load': 'Load a playlist',
    'removesong': 'Remove a song from a playlist',
    'steal': 'Steal a playlist from another user',

    // Config commands
    '247': 'Set the bot to stay in voice channel',
    'dj': 'Manage DJ mode and associated roles',
    'language': 'Set the language for the bot',
    'prefix': 'Show or set the bot prefix',
    'setup': 'Setup the bot',

    // Info commands
    'about': 'Show information about the bot',
    'botinfo': 'Information about the bot',
    'developer': 'Show information about the bot developer',
    'help': 'Show the help menu',
    'invite': 'Get the bot invite link',
    'lavalink': 'Show current Lavalink stats',
    'ping': 'Show the bot ping'
};

// Function to recursively get all command files
function getCommandFiles(dir) {
    const files = fs.readdirSync(dir);
    let commandFiles = [];

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            commandFiles = commandFiles.concat(getCommandFiles(filePath));
        } else if (file.endsWith('.js')) {
            commandFiles.push(filePath);
        }
    }

    return commandFiles;
}

// Get all command files
const commandFiles = getCommandFiles(foldersPath);

for (const file of commandFiles) {
    try {
        const cmdModule = require(file);
        if (cmdModule.default) {
            // Create a mock client to instantiate the command
            const mockClient = {
                logger: { info: () => {}, error: () => {}, warn: () => {} },
                embed: () => ({ setColor: () => ({}), setDescription: () => ({}) })
            };

            const command = new cmdModule.default(mockClient, path.basename(file));

            // Only process slash commands that aren't dev commands
            if (command.slashCommand && !command.permissions.dev) {
                const description = commandDescriptions[command.name] || command.description.content || 'No description available';

                const data = {
                    name: command.name,
                    description: description,
                    type: ApplicationCommandType.ChatInput,
                    options: command.options || [],
                };

                commands.push(data);
                console.log(`✅ Loaded slash command: ${command.name}`);
            } else if (command.permissions.dev) {
                console.log(`⚠️  Skipped dev command: ${command.name}`);
            } else if (!command.slashCommand) {
                console.log(`⚠️  Skipped non-slash command: ${command.name}`);
            }
        }
    } catch (error) {
        console.log(`❌ Error loading ${file}:`, error.message);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
        console.log('\n📋 Deployed commands:');
        data.forEach(cmd => console.log(`   - /${cmd.name}: ${cmd.description}`));
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
