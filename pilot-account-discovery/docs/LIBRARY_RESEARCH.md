# TikTok Scraping Libraries & Alternatives Research

## Problem dengan Live Feed Approach
- Hanya mendapat stream yang sedang trending/featured
- Tidak bisa search keyword spesifik (misal "dance", "dance agency")
- Terbatas pada algoritma TikTok untuk menampilkan content
- Kurang kontrol untuk target spesifik (dance groups/agencies)

## Library & Tools yang Bisa Digunakan

### 1. **TikTok-Api (Unofficial Python Library)**
```python
pip install TikTokApi
```
**Pros:**
- API-like access to TikTok data
- Search functionality with keywords
- No browser automation needed
- Can get user data, videos, trending content

**Cons:**
- Python-based (perlu wrapper untuk Node.js)
- Frequent breaking changes
- May require session management

### 2. **tiktok-scraper (Node.js)**
```bash
npm install tiktok-scraper
```
**Pros:**
- Native Node.js library
- Search hashtags and users
- Get user profiles and videos
- No browser needed

**Cons:**
- May have rate limiting
- Unofficial API calls
- Limited live stream support

### 3. **Playwright + Stealth Plugin**
```bash
npm install playwright playwright-stealth
```
**Pros:**
- Better stealth than Puppeteer
- Harder to detect as bot
- Cross-browser support
- Advanced automation features

**Cons:**
- Still web scraping
- Login requirement still exists

### 4. **TikTok Research API (Official)**
**Pros:**
- Official TikTok API
- Reliable and stable
- No blocking/banning issues
- Comprehensive data access

**Cons:**
- Requires approval from TikTok
- Academic/research use only
- May not include live streams
- Complex approval process

### 5. **Social Media APIs & Services**

#### a) **RapidAPI TikTok Services**
- Multiple TikTok API providers
- Search, user data, trending content
- Pay-per-use model

#### b) **Apify TikTok Scrapers**
- Cloud-based scraping service
- TikTok hashtag scraper
- TikTok profile scraper
- Handles anti-bot measures

#### c) **ScrapFly**
- Anti-bot bypass service
- TikTok scraping capabilities
- Rotating proxies and headers

### 6. **Custom Mobile App API Reverse Engineering**
**Approach:** Analyze TikTok mobile app API calls
**Pros:**
- Direct API access
- More stable than web scraping
- Better performance

**Cons:**
- Complex implementation
- Requires reverse engineering
- May violate ToS
- Needs constant updates

### 7. **Hybrid Browser + API Approach**
**Concept:** Combine multiple methods
- Use browser for initial session
- Extract API endpoints and tokens
- Switch to direct API calls
- Fallback to browser when needed

## Recommended Implementation Strategy

### Phase 1: Test Multiple Libraries
Let me create test implementations for the most promising options:

1. **tiktok-scraper (Node.js)** - Test search functionality
2. **Playwright + Stealth** - Better bot detection avoidance
3. **RapidAPI integration** - Test paid API services
4. **Custom API approach** - Reverse engineer mobile endpoints

### Phase 2: Compare Results
- Search capability for dance/agency keywords
- Data quality and completeness
- Reliability and success rates
- Cost vs benefit analysis

### Phase 3: Hybrid Solution
- Primary: Best performing library/API
- Secondary: Live feed discovery (current working method)
- Fallback: Manual curation system
- Monitoring: Track success rates and adapt

## Specific Focus: Dance/Agency Discovery

### Target Search Terms
- "dance group"
- "dance agency" 
- "girl group"
- "boy group"
- "kpop dance"
- "dance cover"
- "dance studio"
- "choreography"

### Quality Indicators
- Multiple performers in video
- Professional setup/lighting
- OBS overlay usage
- Studio environment
- Coordinated performances
- Agency branding

## Next Steps: Library Testing

Let me implement and test several of these approaches to find the best solution for targeted dance/agency discovery.
