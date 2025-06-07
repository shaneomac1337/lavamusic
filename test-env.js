// Test environment variable loading
const path = require('path');
const { config } = require('dotenv');

// Load .env file
config({
  path: path.join(__dirname, '.env'),
});

console.log('🔍 Testing Environment Variables...\n');

console.log('📋 Discord OAuth2 Configuration:');
console.log('✅ CLIENT_ID:', process.env.CLIENT_ID || 'Missing');
console.log('✅ CLIENT_SECRET:', process.env.CLIENT_SECRET ? 'Set (hidden)' : 'Missing');
console.log('✅ DASHBOARD_PORT:', process.env.DASHBOARD_PORT || 'Missing');
console.log('✅ DASHBOARD_SECRET:', process.env.DASHBOARD_SECRET ? 'Set (hidden)' : 'Missing');
console.log('✅ WEB_DASHBOARD:', process.env.WEB_DASHBOARD || 'Missing');
console.log('');

console.log('📋 Bot Configuration:');
console.log('✅ TOKEN:', process.env.TOKEN ? 'Set (hidden)' : 'Missing');
console.log('✅ OWNER_IDS:', process.env.OWNER_IDS || 'Missing');
console.log('');

// Test if the built env module works
try {
  const { env } = require('./dist/env.js');
  console.log('📋 Built Environment Module:');
  console.log('✅ CLIENT_ID:', env.CLIENT_ID || 'Missing');
  console.log('✅ CLIENT_SECRET:', env.CLIENT_SECRET || 'Missing');
  console.log('✅ DASHBOARD_PORT:', env.DASHBOARD_PORT || 'Missing');
  console.log('✅ WEB_DASHBOARD:', env.WEB_DASHBOARD || 'Missing');
  console.log('');
  
  if (env.CLIENT_SECRET) {
    console.log('🎉 SUCCESS: CLIENT_SECRET is now properly loaded in the built version!');
  } else {
    console.log('❌ ERROR: CLIENT_SECRET is still missing in the built version');
  }
} catch (error) {
  console.log('❌ Error loading built env module:', error.message);
}

console.log('\n🎯 Next Steps:');
console.log('1. If CLIENT_SECRET is properly loaded, restart your bot to apply the fix');
console.log('2. Try the OAuth flow again: http://localhost:3001/auth/discord');
console.log('3. Check the server logs for any authentication errors');
