# 🧪 LavaMusic Tests & Debug Scripts

This folder contains all test files, debug scripts, and development utilities for the LavaMusic project.

## 📋 Test Files

### 🎛️ Dashboard Tests
- **[test-dashboard.js](./test-dashboard.js)** - Dashboard functionality testing
- **[test-tts-dashboard.js](./test-tts-dashboard.js)** - TTS dashboard integration tests

### 🔐 Authentication & OAuth Tests
- **[test-oauth.js](./test-oauth.js)** - OAuth authentication testing
- **[debug-auth.js](./debug-auth.js)** - Authentication debugging utilities
- **[debug-oauth-detailed.js](./debug-oauth-detailed.js)** - Detailed OAuth debugging

### 🎵 TTS & Audio Tests
- **[test-flowery-tts.js](./test-flowery-tts.js)** - FloweryTTS API testing and voice validation
- **[tts-test.html](./tts-test.html)** - HTML test page for TTS functionality

### ⚙️ Environment & Configuration Tests
- **[test-env.js](./test-env.js)** - Environment variables and configuration testing
- **[test-webhook.js](./test-webhook.js)** - Webhook functionality testing

## 🚀 Running Tests

### Prerequisites
```bash
# Make sure you're in the project root
cd /path/to/lavamusic

# Install dependencies
npm install
```

### Individual Test Execution

#### Dashboard Tests
```bash
node tests/test-dashboard.js
node tests/test-tts-dashboard.js
```

#### TTS Tests
```bash
node tests/test-flowery-tts.js
# Open tts-test.html in browser for interactive testing
```

#### Authentication Tests
```bash
node tests/test-oauth.js
node tests/debug-auth.js
node tests/debug-oauth-detailed.js
```

#### Environment Tests
```bash
node tests/test-env.js
node tests/test-webhook.js
```

## 🔧 Debug Scripts

### Authentication Debugging
- **debug-auth.js** - Basic authentication flow debugging
- **debug-oauth-detailed.js** - Comprehensive OAuth flow analysis with detailed logging

### TTS Debugging
- **test-flowery-tts.js** - Voice API testing, voice list validation, and TTS generation testing
- **tts-test.html** - Browser-based TTS testing interface

### Dashboard Debugging
- **test-dashboard.js** - Dashboard route testing and functionality validation
- **test-tts-dashboard.js** - TTS integration testing within dashboard context

## 📊 Test Categories

### ✅ Unit Tests
- Environment configuration validation
- API endpoint testing
- Voice system validation

### 🔗 Integration Tests
- Dashboard-TTS integration
- OAuth authentication flow
- Webhook functionality

### 🌐 Browser Tests
- TTS web interface (tts-test.html)
- Dashboard UI functionality

## 🛠️ Development Workflow

1. **Before Making Changes**: Run relevant tests to ensure current functionality
2. **During Development**: Use debug scripts to troubleshoot issues
3. **After Changes**: Run all related tests to verify functionality
4. **Before Commit**: Run full test suite

## 📝 Adding New Tests

When adding new test files:

1. **Naming Convention**: `test-[feature].js` or `debug-[feature].js`
2. **Documentation**: Add description to this README
3. **Error Handling**: Include proper error handling and logging
4. **Environment**: Ensure tests work in development environment

### Test Template
```javascript
// tests/test-new-feature.js
const { config } = require('../src/config');

async function testNewFeature() {
    try {
        console.log('🧪 Testing new feature...');
        
        // Test implementation here
        
        console.log('✅ New feature test passed');
    } catch (error) {
        console.error('❌ New feature test failed:', error);
        process.exit(1);
    }
}

testNewFeature();
```

## 🔍 Troubleshooting

### Common Issues
1. **Environment Variables**: Check `.env` file and run `test-env.js`
2. **API Connectivity**: Verify network access and API keys
3. **Authentication**: Use debug scripts to trace OAuth flow
4. **TTS Issues**: Test with `test-flowery-tts.js` and check voice availability

### Debug Logging
Most test files include verbose logging. Set `DEBUG=true` environment variable for additional output.

## 📁 Related Folders

- **`../docs/`** - Documentation for features being tested
- **`../src/`** - Source code being tested
- **`../config/`** - Configuration files used by tests
- **`../scripts/`** - Build and deployment scripts
