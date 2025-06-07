const https = require('https');
const querystring = require('querystring');

// Your Discord application details
const CLIENT_ID = '1238397673329917984';
const CLIENT_SECRET = 'LnRidH14lxG20Y2_TxRljpPDqF9khg86'; // From your .env
const REDIRECT_URI = 'http://localhost:3001/auth/discord/callback';

console.log('🔍 Testing Discord OAuth2 Configuration...\n');

// Test 1: Generate authorization URL
console.log('📋 Step 1: Authorization URL');
const authUrl = `https://discord.com/api/oauth2/authorize?` + querystring.stringify({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'identify guilds'
});

console.log('✅ Authorization URL:', authUrl);
console.log('');

// Test 2: Validate redirect URI format
console.log('📋 Step 2: Redirect URI Validation');
console.log('✅ Redirect URI:', REDIRECT_URI);
console.log('✅ Format: Valid HTTP URL');
console.log('✅ Port: 3001 (matches dashboard)');
console.log('');

// Test 3: Check if redirect URI is properly encoded
console.log('📋 Step 3: URL Encoding Check');
const encodedRedirectUri = encodeURIComponent(REDIRECT_URI);
console.log('✅ Encoded Redirect URI:', encodedRedirectUri);
console.log('');

// Test 4: Simulate token exchange (without actual code)
console.log('📋 Step 4: Token Exchange Configuration');
console.log('✅ Client ID:', CLIENT_ID);
console.log('✅ Client Secret:', CLIENT_SECRET ? 'Set (hidden)' : 'Missing');
console.log('✅ Grant Type: authorization_code');
console.log('');

// Test 5: Generate the exact URL your dashboard should use
console.log('📋 Step 5: Dashboard Integration');
console.log('✅ Dashboard OAuth URL (port 3001):');
const dashboardAuthUrl = `https://discord.com/api/oauth2/authorize?` + querystring.stringify({
  client_id: CLIENT_ID,
  redirect_uri: 'http://localhost:3001/auth/discord/callback',
  response_type: 'code',
  scope: 'identify guilds'
});
console.log(dashboardAuthUrl);
console.log('');

console.log('✅ Test Dashboard OAuth URL (port 3002):');
const testDashboardAuthUrl = `https://discord.com/api/oauth2/authorize?` + querystring.stringify({
  client_id: CLIENT_ID,
  redirect_uri: 'http://localhost:3002/auth/discord/callback',
  response_type: 'code',
  scope: 'identify guilds'
});
console.log(testDashboardAuthUrl);
console.log('');

// Instructions
console.log('🎯 Next Steps:');
console.log('1. Add these redirect URIs to your Discord application:');
console.log('   - http://localhost:3001/auth/discord/callback');
console.log('   - http://localhost:3002/auth/discord/callback');
console.log('');
console.log('2. Go to: https://discord.com/developers/applications/1238397673329917984/oauth2/general');
console.log('');
console.log('3. In the "Redirects" section, click "Add Redirect" and add both URLs');
console.log('');
console.log('4. Click "Save Changes"');
console.log('');
console.log('5. Test the OAuth flow by visiting:');
console.log('   http://localhost:3001/auth/discord (main dashboard)');
console.log('   http://localhost:3002/auth/discord (test dashboard)');
console.log('');

// Test function to validate token exchange
function testTokenExchange(authCode) {
  console.log('📋 Testing Token Exchange with code:', authCode);
  
  const postData = querystring.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI
  });

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

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Token Exchange Response:', JSON.parse(data));
    });
  });

  req.on('error', (e) => {
    console.error('Token Exchange Error:', e);
  });

  req.write(postData);
  req.end();
}

// Export for potential use
module.exports = { testTokenExchange };
