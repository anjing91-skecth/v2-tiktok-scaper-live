// Script: get_tiktok_live_metadata.js
// Usage: node get_tiktok_live_metadata.js <username>
// Output: Print metadata (roomId, title, viewer, etc) for a TikTok live (if online)

const { WebcastPushConnection } = require('tiktok-live-connector');
const fs = require('fs');

if (process.argv.length < 3) {
    console.log('Usage: node get_tiktok_live_metadata.js <username>');
    process.exit(1);
}

const username = process.argv[2];
const connection = new WebcastPushConnection(username);

// Catat waktu permintaan metadata
const requestTime = new Date();
const requestTimeStr = requestTime.toISOString();

async function main() {
    try {
        const state = await connection.connect();
        // Metadata TikTok live lengkap (roomInfo, owner, stream_url, cover, share_url, dsb)
        const meta = {
            username,
            requested_at: requestTimeStr, // waktu permintaan metadata
            roomId: state?.roomId,
            title: state?.roomInfo?.title,
            status_code: state?.roomInfo?.status_code,
            viewer: state?.roomInfo?.user_count,
            create_time: state?.roomInfo?.create_time,
            start_time: state?.roomInfo?.start_time,
            owner: state?.owner?.uniqueId,
            nickname: state?.owner?.nickname,
            avatar: state?.owner?.avatarThumb,
            cover: state?.roomInfo?.cover,
            share_url: state?.roomInfo?.share_url,
            stream_url: state?.stream_url,
            stream_id: state?.stream_id,
            stream_url_rtmp: state?.stream_url_rtmp,
            stream_url_flv: state?.stream_url_flv,
            stream_url_hls: state?.stream_url_hls,
            stream_url_rtmp_pull: state?.stream_url_rtmp_pull,
            stream_url_rtmp_push: state?.stream_url_rtmp_push,
            stream_url_hls_pull: state?.stream_url_hls_pull,
            stream_url_flv_pull: state?.stream_url_flv_pull,
            // Dump all roomInfo and owner for completeness
            roomInfo: state?.roomInfo,
            ownerInfo: state?.owner,
        };
        console.log('LIVE METADATA:', JSON.stringify(meta, null, 2));
        // Simpan metadata ke file JSON
        const outFile = `tiktok_live_metadata_${username}_${Date.now()}.json`;
        fs.writeFileSync(outFile, JSON.stringify(meta, null, 2));
        console.log('LIVE METADATA saved to', outFile);
        await connection.disconnect();
    } catch (err) {
        console.error('Not live or error:', err.message || err);
        process.exit(2);
    }
}

main();
