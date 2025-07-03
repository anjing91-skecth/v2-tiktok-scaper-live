// Test script for TikTok-Live-Connector API
const { WebcastPushConnection } = require("tiktok-live-connector");

// Replace with the usernames you want to test
const usernames = ["pufflegirls3", "1908_sky_light"];

async function testAccounts(usernames) {
  for (const username of usernames) {
    const connection = new WebcastPushConnection(username);
    try {
      const state = await connection.connect();
      console.log(`\n[Connected] Successfully connected to ${username}'s live stream.`);
      console.log(`[Metadata for ${username}]`, state);
    } catch (error) {
      console.error(`\n[Error] Failed to connect to ${username}'s live stream:`, error.message || error);
    }
  }
}

testAccounts(usernames);


