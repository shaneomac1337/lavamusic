const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'dist', 'commands');

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
        const command = require(file);
        if (command.default && command.default.data) {
            commands.push(command.default.data.toJSON());
            console.log(`✅ Loaded command: ${command.default.data.name}`);
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
