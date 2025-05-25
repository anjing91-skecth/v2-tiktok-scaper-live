// Test script untuk debug gift event data dari TikTok Live API
const { WebcastPushConnection } = require("tiktok-live-connector");

// Username untuk test
const username = "glow_babies1";

// Create connection instance
const tiktokConnection = new WebcastPushConnection(username);

// Connection state
let connected = false;
let giftCounter = 0;

// Set untuk menyimpan kombinasi msgId+groupId yang sudah diproses
const processedGifts = new Set();

// Log messages dengan timestamp
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Debug info untuk gift event
function logGiftData(data) {
  giftCounter++;
  
  console.log("\n========== GIFT EVENT #" + giftCounter + " ==========");
  console.log("Gift ID:", data.giftId);
  console.log("Gift Name:", data.giftName);
  console.log("Diamond Count:", data.diamondCount);
  console.log("Description:", data.describe);
  console.log("Repeats:", data.repeatCount);
  console.log("Repeat End:", data.repeatEnd);
  
  console.log("\nGIFTER INFO:");
  console.log("User ID:", data.userId);
  console.log("Unique ID:", data.uniqueId);
  console.log("Nickname:", data.nickname);
  
  console.log("\nTIMESTAMP INFO:");
  console.log("Raw timestamp:", data.timestamp);
  console.log("Formatted time:", data.timestamp ? new Date(data.timestamp).toLocaleString() : "N/A");
  
  console.log("\nRAW DATA DUMP:");
  console.log(JSON.stringify(data, null, 2));
  console.log("======================================\n");
}

// Connect
log(`Attempting to connect to ${username}'s TikTok LIVE stream...`);

tiktokConnection.connect()
  .then(state => {
    connected = true;
    log(`✅ Connected to ${username}'s TikTok LIVE stream!`);
    console.log("Room Info:", {
      roomId: state.roomId,
      title: state.title,
      viewerCount: state.viewerCount,
      totalLikes: state.likeCount,
      createTime: new Date(state.create_time * 1000).toLocaleString()
    });
    
    // Register event listeners
    
    // Gift event
    tiktokConnection.on('gift', (data) => {
      // Cek duplikasi gift berdasarkan msgId+groupId
      const uniqueGiftKey = `${data.msgId || ''}_${data.groupId || ''}`;
      if (processedGifts.has(uniqueGiftKey)) {
        log(`⚠️ Duplikat gift terdeteksi (msgId/groupId: ${uniqueGiftKey}), diabaikan.`);
        return;
      }
      processedGifts.add(uniqueGiftKey);
      log(`🎁 Gift received: ${data.uniqueId} sent ${data.giftName} x${data.repeatCount || 1} (${data.diamondCount} diamonds)`);
      logGiftData(data);
    });
    
    // Room user update
    tiktokConnection.on('roomUser', (data) => {
      log(`👥 Viewers update: ${data.viewerCount}`);
    });
    
    // Like event
    tiktokConnection.on('like', (data) => {
      log(`❤️ ${data.uniqueId} sent ${data.likeCount} likes`);
    });
    
    // Chat message
    tiktokConnection.on('chat', (data) => {
      log(`💬 ${data.uniqueId}: ${data.comment}`);
    });
    
    // Connection ended
    tiktokConnection.on('disconnected', () => {
      connected = false;
      log(`❌ Disconnected from ${username}'s live stream`);
    });
    
  })
  .catch(err => {
    log(`❌ Failed to connect to ${username}'s live stream: ${err.message}`);
  });

// Report connection status periodically
setInterval(() => {
  if (connected) {
    log(`Still connected to ${username}'s live. Waiting for gifts...`);
  } else {
    log(`Not connected to ${username}'s live.`);
  }
}, 60000); // Report every minute

log(`💡 Waiting for events from ${username}'s live stream...`);
log(`💡 Press Ctrl+C to exit`);
