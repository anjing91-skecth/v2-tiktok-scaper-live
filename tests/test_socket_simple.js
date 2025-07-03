// Test sederhana untuk Socket.IO
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('✅ Socket.IO connected:', socket.id);
});

socket.on('statusUpdate', (data) => {
    console.log('📊 Status Update:', data);
});

socket.on('accountStatusUpdate', (data) => {
    console.log('👥 Account Status:', data);
});

setTimeout(() => {
    socket.disconnect();
    process.exit(0);
}, 5000);
