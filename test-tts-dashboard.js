/**
 * Test script for TTS Dashboard Integration
 * This script tests the TTS functionality added to the web dashboard
 */

const fetch = require('node-fetch');

// Configuration
const DASHBOARD_URL = 'http://localhost:3001'; // Adjust port if needed
const TEST_GUILD_ID = 'YOUR_GUILD_ID_HERE'; // Replace with actual guild ID
const TEST_TEXT = 'Hello from the web dashboard! This is a test of the TTS feature.';

async function testTTSEndpoint() {
    console.log('🎤 Testing TTS Dashboard Integration...\n');

    try {
        // Test 1: Valid TTS request
        console.log('Test 1: Valid TTS request');
        console.log(`Text: "${TEST_TEXT}"`);
        console.log(`Length: ${TEST_TEXT.length} characters`);
        
        const response = await fetch(`${DASHBOARD_URL}/api/guilds/${TEST_GUILD_ID}/tts/speak`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Note: In real usage, this would include authentication cookies
            },
            body: JSON.stringify({ text: TEST_TEXT })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ TTS request successful!');
            console.log('Response:', result);
        } else {
            console.log('❌ TTS request failed');
            console.log('Error:', result);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Test 2: Empty text validation
        console.log('Test 2: Empty text validation');
        const emptyResponse = await fetch(`${DASHBOARD_URL}/api/guilds/${TEST_GUILD_ID}/tts/speak`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: '' })
        });

        const emptyResult = await emptyResponse.json();
        
        if (!emptyResponse.ok && emptyResult.message?.includes('required')) {
            console.log('✅ Empty text validation working correctly');
        } else {
            console.log('❌ Empty text validation failed');
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Test 3: Character limit validation
        console.log('Test 3: Character limit validation (>200 chars)');
        const longText = 'A'.repeat(201);
        
        const longResponse = await fetch(`${DASHBOARD_URL}/api/guilds/${TEST_GUILD_ID}/tts/speak`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: longText })
        });

        const longResult = await longResponse.json();
        
        if (!longResponse.ok && longResult.message?.includes('200 characters')) {
            console.log('✅ Character limit validation working correctly');
        } else {
            console.log('❌ Character limit validation failed');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.log('\n📝 Note: Make sure the dashboard server is running and accessible');
        console.log('📝 Note: Replace TEST_GUILD_ID with a valid guild ID');
        console.log('📝 Note: Authentication cookies are required for actual usage');
    }
}

// Test the TTS endpoint
testTTSEndpoint();

console.log(`
🎯 TTS Dashboard Integration Summary:

✨ Features Added:
- 🎤 TTS API endpoint: POST /api/guilds/:guildId/tts/speak
- 📝 Text input with 200 character limit
- 🔢 Real-time character counter
- 🎨 Visual feedback (colors change as limit approaches)
- 🚀 Auto-join voice channel functionality
- ⚡ Keyboard shortcut (Enter to speak, Shift+Enter for new line)
- 🔄 Queue integration (TTS tracks appear in music queue)
- 🛡️ Input validation and error handling

🔧 Technical Details:
- Uses DuncteBot TTS engine (same as Discord command)
- Czech language support (cs-CZ)
- Integrates with existing player system
- Real-time queue updates via Socket.IO
- Responsive design with dark/light mode support

🎵 Usage:
1. Navigate to guild dashboard
2. Scroll to "Text-to-Speech" section
3. Enter text (max 200 characters)
4. Click "Speak" or press Enter
5. TTS will be added to music queue and play

🔒 Security:
- Requires authentication (Discord OAuth2)
- Guild membership validation
- Voice channel permission checks
- Input sanitization and validation
`);
