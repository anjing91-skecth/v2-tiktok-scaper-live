// Test script for TikTok-Live-Connector API
const { WebcastPushConnection } = require("tiktok-live-connector");

// Replace with the username you want to test
const username = "nova_deluna";

// Create a connection instance
const connection = new WebcastPushConnection(username);

// Connect to the TikTok live stream
connection.connect()
  .then((state) => {
    console.log(`[Connected] Successfully connected to ${username}'s live stream.`);
    console.log(`[Metadata]`, state);
  })
  .catch((error) => {
    console.error(`[Error] Failed to connect to ${username}'s live stream:`, error);
  });


