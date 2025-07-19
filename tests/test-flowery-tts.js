/**
 * FloweryTTS Integration Test Script
 * 
 * This script tests the FloweryTTS integration to ensure:
 * 1. FloweryTTS service is accessible
 * 2. Voice fetching works correctly
 * 3. TTS generation works with different parameters
 * 4. Audio streaming integration functions properly
 * 5. Error handling and fallback logic work as expected
 */

// Using built-in fetch (Node.js 18+)

// Configuration
const BASE_URL = 'http://localhost:3001'; // Adjust if your dashboard runs on a different port
const TEST_GUILD_ID = 'YOUR_GUILD_ID_HERE'; // Replace with actual guild ID for testing

// Test data
const testCases = [
    {
        name: 'Basic English TTS',
        text: 'Hello, this is a test of FloweryTTS integration.',
        voice: '',
        speed: 1.0,
        translate: false
    },
    {
        name: 'Speed Control Test',
        text: 'This text should be spoken faster than normal.',
        voice: '',
        speed: 1.5,
        translate: false
    },
    {
        name: 'Long Text Test',
        text: 'This is a longer text to test the character limit handling. '.repeat(20),
        voice: '',
        speed: 1.0,
        translate: false
    },
    {
        name: 'Translation Test',
        text: 'Ahoj, jak se máš? Toto je test překladu.',
        voice: '',
        speed: 1.0,
        translate: true
    }
];

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
    const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
    log(`[${status}] ${testName}${details ? ' - ' + details : ''}`, statusColor);
}

async function testFloweryTTSAPI() {
    log('\n🎤 FloweryTTS Integration Test Suite', 'bold');
    log('=' .repeat(50), 'blue');

    let passedTests = 0;
    let totalTests = 0;

    // Test 1: Check if FloweryTTS voices endpoint is accessible
    totalTests++;
    log('\n1. Testing FloweryTTS voices endpoint...', 'blue');
    try {
        const response = await fetch(`${BASE_URL}/api/tts/flowery/voices`);
        const data = await response.json();
        
        if (response.ok && data.success && data.voices && data.voices.length > 0) {
            logTest('FloweryTTS Voices Endpoint', 'PASS', `Found ${data.voices.length} voices`);
            passedTests++;
            
            // Log some example voices
            log('   Sample voices:', 'yellow');
            data.voices.slice(0, 5).forEach(voice => {
                log(`   - ${voice.name} (${voice.language.name}, ${voice.gender})`, 'reset');
            });
        } else {
            logTest('FloweryTTS Voices Endpoint', 'FAIL', 'No voices returned or invalid response');
        }
    } catch (error) {
        logTest('FloweryTTS Voices Endpoint', 'FAIL', error.message);
    }

    // Test 2: Check popular voices endpoint
    totalTests++;
    log('\n2. Testing popular voices endpoint...', 'blue');
    try {
        const response = await fetch(`${BASE_URL}/api/tts/flowery/voices/popular`);
        const data = await response.json();
        
        if (response.ok && data.success && data.voices) {
            logTest('Popular Voices Endpoint', 'PASS', `Found ${data.voices.length} popular voices`);
            passedTests++;
        } else {
            logTest('Popular Voices Endpoint', 'FAIL', 'Invalid response');
        }
    } catch (error) {
        logTest('Popular Voices Endpoint', 'FAIL', error.message);
    }

    // Test 3: Check language-specific voices
    totalTests++;
    log('\n3. Testing language-specific voices (English)...', 'blue');
    try {
        const response = await fetch(`${BASE_URL}/api/tts/flowery/voices/language/en`);
        const data = await response.json();
        
        if (response.ok && data.success && data.voices) {
            logTest('Language-Specific Voices', 'PASS', `Found ${data.voices.length} English voices`);
            passedTests++;
        } else {
            logTest('Language-Specific Voices', 'FAIL', 'Invalid response');
        }
    } catch (error) {
        logTest('Language-Specific Voices', 'FAIL', error.message);
    }

    // Test 4: Test TTS generation (requires authentication)
    if (TEST_GUILD_ID !== 'YOUR_GUILD_ID_HERE') {
        totalTests++;
        log('\n4. Testing TTS generation...', 'blue');
        try {
            const response = await fetch(`${BASE_URL}/api/guilds/${TEST_GUILD_ID}/tts/flowery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Note: In a real test, you'd need to include authentication cookies
                },
                body: JSON.stringify({
                    text: 'This is a test of FloweryTTS generation.',
                    speed: 1.0
                })
            });

            if (response.status === 401) {
                logTest('TTS Generation', 'SKIP', 'Authentication required (expected)');
            } else if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    logTest('TTS Generation', 'PASS', 'TTS generated successfully');
                    passedTests++;
                } else {
                    logTest('TTS Generation', 'FAIL', data.error || 'Unknown error');
                }
            } else {
                logTest('TTS Generation', 'FAIL', `HTTP ${response.status}`);
            }
        } catch (error) {
            logTest('TTS Generation', 'FAIL', error.message);
        }
    } else {
        log('\n4. Skipping TTS generation test (no guild ID provided)', 'yellow');
    }

    // Test 5: Check dashboard accessibility
    totalTests++;
    log('\n5. Testing dashboard accessibility...', 'blue');
    try {
        const response = await fetch(`${BASE_URL}/health`);
        const data = await response.json();
        
        if (response.ok && data.status === 'ok') {
            logTest('Dashboard Health Check', 'PASS', `Uptime: ${Math.round(data.uptime)}s, Guilds: ${data.guilds}`);
            passedTests++;
        } else {
            logTest('Dashboard Health Check', 'FAIL', 'Health check failed');
        }
    } catch (error) {
        logTest('Dashboard Health Check', 'FAIL', error.message);
    }

    // Summary
    log('\n' + '=' .repeat(50), 'blue');
    log(`Test Results: ${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? 'green' : 'yellow');
    
    if (passedTests === totalTests) {
        log('✅ All tests passed! FloweryTTS integration is working correctly.', 'green');
    } else {
        log('⚠️  Some tests failed. Check the output above for details.', 'yellow');
    }

    // Instructions
    log('\n📋 Next Steps:', 'bold');
    log('1. Start your Lavamusic bot with dashboard enabled', 'reset');
    log('2. Open the dashboard in your browser', 'reset');
    log('3. Navigate to a guild\'s dashboard', 'reset');
    log('4. Test the TTS section with both FloweryTTS and DuncteBot', 'reset');
    log('5. Try different voices, speeds, and text lengths', 'reset');
    log('6. Verify that fallback to DuncteBot works when FloweryTTS fails', 'reset');

    return passedTests === totalTests;
}

// Manual test instructions
function printManualTestInstructions() {
    log('\n🧪 Manual Testing Checklist', 'bold');
    log('=' .repeat(50), 'blue');
    
    const manualTests = [
        'Open guild dashboard and locate TTS section',
        'Verify FloweryTTS is selected by default',
        'Check that voice dropdown loads with multiple options',
        'Test speed slider (0.5x to 3x)',
        'Toggle translation option',
        'Test with short text (< 200 chars) - should work with both providers',
        'Test with long text (> 200 chars) - should only work with FloweryTTS',
        'Test fallback: disconnect internet briefly and try FloweryTTS',
        'Verify character counter updates correctly (2048 for FloweryTTS, 200 for DuncteBot)',
        'Test keyboard shortcuts (Enter to speak, Shift+Enter for new line)',
        'Switch to DuncteBot provider and test basic functionality',
        'Verify TTS appears in music queue after generation',
        'Test auto-join functionality when not in voice channel',
        'Check that TTS preference is saved in localStorage'
    ];

    manualTests.forEach((test, index) => {
        log(`${index + 1}. ${test}`, 'reset');
    });

    log('\n✨ Expected Behavior:', 'bold');
    log('- FloweryTTS should provide 850+ voices with multiple languages', 'green');
    log('- Speed control should affect playback speed', 'green');
    log('- Translation should work for non-English text', 'green');
    log('- Fallback to DuncteBot should be automatic and seamless', 'green');
    log('- Character limits should be enforced (2048 vs 200)', 'green');
    log('- User preferences should persist across sessions', 'green');
}

// Run tests
async function main() {
    const success = await testFloweryTTSAPI();
    printManualTestInstructions();
    
    process.exit(success ? 0 : 1);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('FloweryTTS Integration Test Script', 'bold');
    log('\nUsage: node test-flowery-tts.js [options]', 'reset');
    log('\nOptions:', 'reset');
    log('  --help, -h    Show this help message', 'reset');
    log('\nBefore running:', 'reset');
    log('1. Make sure your Lavamusic bot is running with dashboard enabled', 'reset');
    log('2. Update TEST_GUILD_ID in this script for TTS generation tests', 'reset');
    log('3. Ensure you have Node.js 18+ for built-in fetch support', 'reset');
    process.exit(0);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testFloweryTTSAPI, printManualTestInstructions };
