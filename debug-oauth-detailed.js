const https = require('https');
const querystring = require('querystring');
const url = require('url');

// Your Discord application details
const CLIENT_ID = '1238397673329917984';
const CLIENT_SECRET = 'LnRidH14lxG20Y2_TxRljpPDqF9khg86';
const REDIRECT_URI = 'http://localhost:3001/auth/discord/callback';

console.log('🔍 Detailed OAuth2 Debug Test...\n');

// Function to test token exchange with a real authorization code
async function testTokenExchangeWithCode(authCode) {
  console.log('📋 Testing Token Exchange with Authorization Code:', authCode);
  console.log('');

  const postData = querystring.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI
  });

  console.log('📤 Request Details:');
  console.log('URL: https://discord.com/api/oauth2/token');
  console.log('Method: POST');
  console.log('Content-Type: application/x-www-form-urlencoded');
  console.log('Body:', postData);
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
        console.log('📥 Discord Response:');
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        console.log('Body:', data);
        console.log('');

        try {
          const parsed = JSON.parse(data);
          
          if (res.statusCode === 200 && parsed.access_token) {
            console.log('✅ Token Exchange Successful!');
            console.log('Access Token:', parsed.access_token.substring(0, 20) + '...');
            console.log('Token Type:', parsed.token_type);
            console.log('Scope:', parsed.scope);
            console.log('');
            
            // Test user info retrieval
            testUserInfo(parsed.access_token);
          } else {
            console.log('❌ Token Exchange Failed:');
            console.log('Error:', parsed.error || 'Unknown error');
            console.log('Description:', parsed.error_description || 'No description');
          }
        } catch (e) {
          console.log('❌ Failed to parse response:', e.message);
          console.log('Raw response:', data);
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

// Function to test user info retrieval
async function testUserInfo(accessToken) {
  console.log('📋 Testing User Info Retrieval...');
  
  const options = {
    hostname: 'discord.com',
    port: 443,
    path: '/api/users/@me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('📥 User Info Response:');
        console.log('Status Code:', res.statusCode);
        console.log('Body:', data);
        console.log('');

        try {
          const userData = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log('✅ User Info Retrieved Successfully!');
            console.log('User ID:', userData.id);
            console.log('Username:', userData.username);
            console.log('');
            
            // Test guilds retrieval
            testUserGuilds(accessToken);
          } else {
            console.log('❌ User Info Failed:', userData);
          }
        } catch (e) {
          console.log('❌ Failed to parse user info:', e.message);
        }
        
        resolve(data);
      });
    });

    req.on('error', (e) => {
      console.error('❌ User Info Error:', e);
      reject(e);
    });

    req.end();
  });
}

// Function to test user guilds retrieval
async function testUserGuilds(accessToken) {
  console.log('📋 Testing User Guilds Retrieval...');
  
  const options = {
    hostname: 'discord.com',
    port: 443,
    path: '/api/users/@me/guilds',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('📥 User Guilds Response:');
        console.log('Status Code:', res.statusCode);
        console.log('Body:', data.substring(0, 500) + (data.length > 500 ? '...' : ''));
        console.log('');

        try {
          const guildsData = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log('✅ User Guilds Retrieved Successfully!');
            console.log('Guild Count:', guildsData.length);
            console.log('');
            
            // Check authorization
            checkAuthorization(guildsData);
          } else {
            console.log('❌ User Guilds Failed:', guildsData);
          }
        } catch (e) {
          console.log('❌ Failed to parse guilds:', e.message);
        }
        
        resolve(data);
      });
    });

    req.on('error', (e) => {
      console.error('❌ User Guilds Error:', e);
      reject(e);
    });

    req.end();
  });
}

// Function to check authorization
function checkAuthorization(guildsData) {
  console.log('📋 Checking Authorization...');
  
  const OWNER_IDS = ["123456789012345678"]; // From your .env
  
  // This would need the actual user ID from the user info response
  // For now, just check guild permissions
  const adminGuilds = guildsData.filter(guild => 
    (guild.permissions & 0x8) === 0x8 // Administrator permission
  );
  
  console.log('Admin Guilds:', adminGuilds.length);
  console.log('');
  
  if (adminGuilds.length > 0) {
    console.log('✅ User has admin permissions in at least one guild');
  } else {
    console.log('❌ User has no admin permissions in any guild');
    console.log('💡 Make sure your Discord user has Administrator permissions in a server with your bot');
  }
}

// Main function
function main() {
  console.log('🎯 Instructions:');
  console.log('1. Go to this URL in your browser:');
  console.log('   https://discord.com/api/oauth2/authorize?client_id=1238397673329917984&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fdiscord%2Fcallback&response_type=code&scope=identify%20guilds');
  console.log('');
  console.log('2. After authorization, you\'ll be redirected to a URL like:');
  console.log('   http://localhost:3001/auth/discord/callback?code=AUTHORIZATION_CODE');
  console.log('');
  console.log('3. Copy the authorization code from the URL and run:');
  console.log('   node debug-oauth-detailed.js YOUR_AUTHORIZATION_CODE');
  console.log('');
  
  const authCode = process.argv[2];
  if (authCode) {
    testTokenExchangeWithCode(authCode);
  } else {
    console.log('❌ No authorization code provided');
    console.log('Usage: node debug-oauth-detailed.js YOUR_AUTHORIZATION_CODE');
  }
}

main();
