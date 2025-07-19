// Test script to manually trigger webhook
const fetch = require('node-fetch');

const testPayload = {
    "action": "opened",
    "repository": {
        "name": "lavamusic",
        "full_name": "shaneomac1337/lavamusic",
        "html_url": "https://github.com/shaneomac1337/lavamusic"
    },
    "sender": {
        "login": "shaneomac1337",
        "avatar_url": "https://avatars.githubusercontent.com/u/129691323",
        "html_url": "https://github.com/shaneomac1337"
    },
    "issue": {
        "number": 999,
        "title": "🧪 Test webhook integration",
        "html_url": "https://github.com/shaneomac1337/lavamusic/issues/999",
        "state": "open",
        "user": {
            "login": "shaneomac1337",
            "avatar_url": "https://avatars.githubusercontent.com/u/129691323"
        }
    }
};

async function testWebhook() {
    try {
        const response = await fetch('http://localhost:3001/webhook/github', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-GitHub-Event': 'issues'
            },
            body: JSON.stringify(testPayload)
        });

        const result = await response.text();
        console.log('Response:', response.status, result);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testWebhook();
