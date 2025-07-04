# TikTok Authentication Setup Guide

## Overview
Since TikTok now requires login to access live streams, we've implemented an authentication system that manages multiple accounts, sessions, and cookies for automated scraping.

## Setup Instructions

### 1. Account Preparation
You'll need to create 2-3 TikTok test accounts for automation:

1. **Create TikTok Accounts:**
   - Go to https://www.tiktok.com/signup
   - Create accounts with different email addresses
   - Use strong, unique passwords
   - Complete any verification steps required

2. **Configure Accounts:**
   - Edit `data/accounts.json` with your real account credentials
   - Replace placeholder values with actual usernames/emails/passwords
   - Ensure account status is set to "active"

### 2. Initial Testing

#### Test Login Requirement (Recommended First)
```bash
cd pilot-account-discovery
npm run test:login-required
```
This will confirm TikTok's current login requirements.

#### Test Authentication System
```bash
npm run test:auth-search
```
This will:
- Test account login process
- Handle CAPTCHA (manual intervention may be required)
- Save session cookies for reuse
- Attempt live stream search

### 3. Manual CAPTCHA Handling
When running with `headless: false`, you may need to:
1. Wait for browser window to open
2. Manually solve any CAPTCHA challenges
3. Wait for login to complete
4. The system will automatically save cookies for future use

### 4. Session Management
The system automatically:
- **Saves cookies** after successful login
- **Reuses sessions** to avoid repeated logins
- **Rotates accounts** to prevent overuse
- **Handles cooldown periods** between account usage
- **Marks problematic accounts** as banned/cooling

### 5. Production Usage

#### Basic Search
```javascript
const engine = new TikTokLiveSearchEngineWithAuth({
    headless: true, // Set to false for debugging
    maxResults: 20,
    searchDelay: 5000
});

await engine.initialize();
const results = await engine.searchLiveStreams('dance');
```

#### With Error Handling
```javascript
try {
    const results = await engine.searchLiveStreams('dance');
    console.log(`Found ${results.length} live streams`);
} catch (error) {
    console.error('Search failed:', error.message);
    // Handle re-authentication or account rotation
}
```

## File Structure
```
pilot-account-discovery/
├── data/
│   ├── accounts.json          # Account credentials (DO NOT COMMIT)
│   └── sessions/              # Saved browser sessions
│       ├── account1_session.json
│       ├── account2_session.json
│       └── ...
├── src/
│   ├── session/
│   │   └── TikTokSessionManager.js
│   ├── discovery/
│   │   ├── TikTokLiveSearchEngine.js         # Original (no auth)
│   │   └── TikTokLiveSearchEngineWithAuth.js # With authentication
│   └── test-authenticated-search.js
└── docs/
    └── TIKTOK_LOGIN_SOLUTIONS.md
```

## Security Considerations

### Account Safety
- **Don't use personal accounts** for automation
- **Use dedicated test accounts** only
- **Monitor account health** regularly
- **Implement reasonable delays** between requests
- **Respect rate limits** to avoid bans

### Data Protection
- **Never commit credentials** to version control
- **Use environment variables** for sensitive data
- **Encrypt session files** if needed
- **Rotate passwords** regularly

### Anti-Detection
- **Vary request timing** (3-10 seconds between requests)
- **Rotate user agents** and browser fingerprints  
- **Use residential proxies** if needed
- **Implement human-like browsing patterns**

## Troubleshooting

### Common Issues

#### "No available accounts"
- Check accounts.json has valid credentials
- Ensure account status is "active"
- Wait for cooldown period to expire

#### "Authentication failed"
- Verify credentials are correct
- Check for CAPTCHA challenges
- Try manual login to test account

#### "Session invalid"
- Cookies may have expired
- Account may be banned/limited
- Clear sessions and re-authenticate

#### "No live streams found"
- Check if authentication is working
- Verify selectors are still valid
- Test with different keywords

### Debug Mode
Run with `headless: false` to see browser actions:
```javascript
const engine = new TikTokLiveSearchEngineWithAuth({
    headless: false,
    timeout: 60000
});
```

### Log Analysis
Monitor console output for:
- Authentication status
- Session validity checks
- Account rotation events
- Error patterns

## Best Practices

### Account Management
- **Start with 2-3 accounts** minimum
- **Monitor usage patterns** to optimize rotation
- **Keep backup accounts** ready
- **Document account status** and issues

### Rate Limiting
- **Minimum 3-5 seconds** between searches
- **Longer delays during peak hours**
- **Account cooldown: 1 hour** between uses
- **Daily limits: 20-50 searches** per account

### Monitoring
- **Track success rates** per account
- **Monitor for blocks/bans**
- **Log all authentication events**
- **Alert on repeated failures**

## Integration with Main System
Once stable, integrate with main server:

```javascript
// In main server.js
const TikTokLiveSearchEngineWithAuth = require('./pilot-account-discovery/src/discovery/TikTokLiveSearchEngineWithAuth');

// Replace existing search calls
const searchEngine = new TikTokLiveSearchEngineWithAuth();
await searchEngine.initialize();
const newAccounts = await searchEngine.searchLiveStreams('dance');
```

## Legal and Ethical Considerations
- **Respect TikTok's Terms of Service**
- **Don't overload their servers**
- **Use data responsibly**
- **Consider data privacy regulations**
- **Monitor for policy changes**

---

**Remember:** This system requires active maintenance and monitoring. TikTok's anti-bot measures evolve constantly, so be prepared to adapt the approach as needed.
