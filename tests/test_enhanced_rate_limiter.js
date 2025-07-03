const { TikTokLiveConnection } = require('tiktok-live-connector');

// Test the enhanced rate limiter
async function testEnhancedRateLimiter() {
    console.log('Testing Enhanced Rate Limiter...');
    
    // Create our rate limiter (same as in server.js)
    class RateLimiter {
        constructor(maxRequests = 5, timeWindow = 60000) {
            this.maxRequests = maxRequests;
            this.timeWindow = timeWindow;
            this.requests = [];
            this.rateLimitInfo = null;
            this.lastRateLimitCheck = 0;
            this.maxRequestsPerMinute = 8;
            this.maxRequestsPerHour = 50;
            this.requestDelay = 1000;
        }
        
        async checkRateLimits() {
            const now = Date.now();
            if (now - this.lastRateLimitCheck > 300000) { // 5 minutes
                try {
                    const connection = new TikTokLiveConnection('temp_user');
                    
                    if (connection.webClient && connection.webClient.webSigner) {
                        const rateLimitResponse = await connection.webClient.webSigner.webcast.getRateLimits();
                        this.rateLimitInfo = rateLimitResponse.data;
                        this.lastRateLimitCheck = now;
                        
                        console.log('[RATE-LIMIT] EulerStream limits:', {
                            minute: `${this.rateLimitInfo.minute.remaining}/${this.rateLimitInfo.minute.max}`,
                            hour: `${this.rateLimitInfo.hour.remaining}/${this.rateLimitInfo.hour.max}`,
                            day: `${this.rateLimitInfo.day.remaining}/${this.rateLimitInfo.day.max}`
                        });
                        
                        // Update conservative limits based on remaining capacity
                        if (this.rateLimitInfo.minute.remaining < 5) {
                            this.maxRequestsPerMinute = 2;
                        } else if (this.rateLimitInfo.minute.remaining < 8) {
                            this.maxRequestsPerMinute = 5;
                        }
                        
                        if (this.rateLimitInfo.hour.remaining < 10) {
                            this.maxRequestsPerHour = Math.max(5, Math.floor(this.rateLimitInfo.hour.remaining * 0.8));
                        }
                    }
                } catch (error) {
                    console.log('[RATE-LIMIT] Could not check EulerStream limits:', error.message);
                }
            }
        }
        
        async canMakeRequest() {
            const now = Date.now();
            const oneMinuteAgo = now - 60000;
            const oneHourAgo = now - 3600000;
            
            // Check current rate limits from EulerStream
            await this.checkRateLimits();
            
            // Clean old requests
            this.requests = this.requests.filter(time => time > oneHourAgo);
            
            // Check if we're hitting EulerStream limits
            if (this.rateLimitInfo) {
                if (this.rateLimitInfo.hour.remaining <= 0) {
                    const resetTime = new Date(this.rateLimitInfo.hour.reset_at);
                    const waitTime = resetTime.getTime() - now;
                    if (waitTime > 0) {
                        console.log(`[RATE-LIMIT] EulerStream hourly limit reached. Waiting ${Math.ceil(waitTime / 60000)} minutes until reset.`);
                        await this.sleep(waitTime);
                        return this.canMakeRequest();
                    }
                }
                
                if (this.rateLimitInfo.minute.remaining <= 0) {
                    console.log('[RATE-LIMIT] EulerStream minute limit reached. Waiting 60 seconds.');
                    await this.sleep(60000);
                    return this.canMakeRequest();
                }
            }
            
            // Check minute rate limit
            const recentRequests = this.requests.filter(time => time > oneMinuteAgo);
            if (recentRequests.length >= this.maxRequestsPerMinute) {
                const waitTime = (recentRequests[0] + 60000) - now;
                console.log(`[RATE-LIMIT] Waiting ${Math.round(waitTime/1000)}s for minute limit`);
                await this.sleep(waitTime);
                return this.canMakeRequest();
            }
            
            // Check hour rate limit
            if (this.requests.length >= this.maxRequestsPerHour) {
                const waitTime = (this.requests[0] + 3600000) - now;
                console.log(`[RATE-LIMIT] Waiting ${Math.round(waitTime/1000)}s for hour limit`);
                await this.sleep(waitTime);
                return this.canMakeRequest();
            }
            
            // Add delay between requests
            await this.sleep(this.requestDelay);
            
            // Record this request
            this.requests.push(now);
            return true;
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        getStatus() {
            const now = Date.now();
            const recentRequests = this.requests.filter(time => now - time < this.timeWindow);
            const hourlyRequests = this.requests.filter(time => now - time < 3600000);
            
            return {
                requests_made: recentRequests.length,
                max_requests: this.maxRequests,
                time_window_ms: this.timeWindow,
                can_make_request: recentRequests.length < this.maxRequests,
                hourly_requests: hourlyRequests.length,
                max_hourly_requests: this.maxRequestsPerHour,
                eulerstream_limits: this.rateLimitInfo
            };
        }
    }
    
    // Test the rate limiter
    const rateLimiter = new RateLimiter(3, 120000);
    
    // Test 1: Check rate limits
    console.log('\n1. Checking EulerStream rate limits...');
    await rateLimiter.checkRateLimits();
    
    // Test 2: Test making requests
    console.log('\n2. Testing rate-limited requests...');
    const testUsernames = ['glow_babies1', 'officialgeilegisela', 'tv_asahi_news'];
    
    for (let i = 0; i < testUsernames.length; i++) {
        const username = testUsernames[i];
        console.log(`\nTesting ${i + 1}/${testUsernames.length}: ${username}`);
        
        try {
            // Wait for rate limit clearance
            await rateLimiter.canMakeRequest();
            
            // Make the actual request
            const connection = new TikTokLiveConnection(username);
            const startTime = Date.now();
            const isLive = await connection.fetchIsLive();
            const endTime = Date.now();
            
            console.log(`  Result: ${isLive ? 'LIVE' : 'OFFLINE'} (${endTime - startTime}ms)`);
            
            // Show rate limiter status
            const status = rateLimiter.getStatus();
            console.log(`  Status: ${status.requests_made}/${status.max_requests} requests, ${status.hourly_requests} hourly`);
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
    
    // Test 3: Show final status
    console.log('\n3. Final rate limiter status:');
    const finalStatus = rateLimiter.getStatus();
    console.log(finalStatus);
}

// Main test
async function main() {
    console.log('='.repeat(60));
    console.log('Enhanced Rate Limiter Test');
    console.log('='.repeat(60));
    
    await testEnhancedRateLimiter();
    
    console.log('\n='.repeat(60));
    console.log('Test completed!');
    console.log('='.repeat(60));
}

main().catch(console.error);
