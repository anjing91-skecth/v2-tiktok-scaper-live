// Test WebSocket connection untuk TikTok Live Scraper
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

console.log('🔌 Testing WebSocket connection...\n');

// Event listeners untuk testing
socket.on('connect', () => {
    console.log('✅ WebSocket connected successfully');
    console.log('🔗 Socket ID:', socket.id);
});

socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
});

socket.on('statusUpdate', (data) => {
    console.log('📊 Status Update received:', data);
});

socket.on('accountStatusUpdate', (data) => {
    console.log('👥 Account Status Update received:', {
        online: data.online.length,
        offline: data.offline.length,
        error: data.error.length
    });
});

socket.on('autoCheckerStatus', (data) => {
    console.log('🔄 Auto Checker Status:', data);
});

// Test timeout
setTimeout(() => {
    console.log('\n⏰ Test timeout reached. Disconnecting...');
    socket.disconnect();
    process.exit(0);
}, 15000);

// Error handling
socket.on('connect_error', (error) => {
    console.error('❌ WebSocket connection error:', error.message);
    process.exit(1);
});
