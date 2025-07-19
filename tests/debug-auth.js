const https = require('https');
const querystring = require('querystring');

// Test Discord OAuth2 token exchange
async function testTokenExchange() {
  console.log('🔍 Testing Discord OAuth2 Token Exchange...\n');

  // Your credentials from .env
  const CLIENT_ID = '1238397673329917984';
  const CLIENT_SECRET = 'LnRidH14lxG20Y2_TxRljpPDqF9khg86';
  const REDIRECT_URI = 'http://localhost:3001/auth/discord/callback';

  console.log('📋 Configuration:');
  console.log('✅ Client ID:', CLIENT_ID);
  console.log('✅ Client Secret:', CLIENT_SECRET ? 'Set' : 'Missing');
  console.log('✅ Redirect URI:', REDIRECT_URI);
  console.log('');

  // Test with a dummy code to see the error response
  const testCode = 'dummy_code_for_testing';
  
  console.log('📋 Testing Token Exchange (will fail with dummy code):');
  
  const postData = querystring.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: testCode,
    redirect_uri: REDIRECT_URI
  });

  console.log('✅ POST Data:', postData);
  console.log('');

  const options = {
    hostname: 'discord.com',
    port: 443,
    path: '/api/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('📋 Discord API Response:');
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', res.headers);
        console.log('Body:', data);
        
        try {
          const parsed = JSON.parse(data);
          console.log('Parsed Response:', parsed);
          
          if (parsed.error === 'invalid_grant') {
            console.log('✅ Token exchange endpoint is working (expected error with dummy code)');
          } else if (parsed.error === 'invalid_client') {
            console.log('❌ Invalid client credentials - check CLIENT_ID and CLIENT_SECRET');
          } else {
            console.log('🔍 Unexpected response:', parsed);
          }
        } catch (e) {
          console.log('❌ Failed to parse response:', e.message);
        }
        
        resolve(data);
      });
    });

    req.on('error', (e) => {
      console.error('❌ Request Error:', e);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Test user info endpoint
async function testUserInfo() {
  console.log('\n📋 Testing User Info Endpoint (will fail without token):');
  
  const options = {
    hostname: 'discord.com',
    port: 443,
    path: '/api/users/@me',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer dummy_token'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('User Info Response:', res.statusCode, data);
        resolve(data);
      });
    });

    req.on('error', (e) => {
      console.error('User Info Error:', e);
      reject(e);
    });

    req.end();
  });
}

// Main test function
async function runTests() {
  try {
    await testTokenExchange();
    await testUserInfo();
    
    console.log('\n🎯 Debugging Tips:');
    console.log('1. If you get "invalid_client" error:');
    console.log('   - Check CLIENT_SECRET in .env file');
    console.log('   - Verify CLIENT_ID matches your Discord application');
    console.log('');
    console.log('2. If you get "invalid_grant" error with real code:');
    console.log('   - Code might be expired (codes expire in 10 minutes)');
    console.log('   - Redirect URI might not match exactly');
    console.log('');
    console.log('3. If authentication still fails:');
    console.log('   - Check server logs for detailed error messages');
    console.log('   - Verify environment variables are loaded correctly');
    console.log('');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the tests
runTests();
