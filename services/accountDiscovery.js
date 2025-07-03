const { WebcastPushConnection } = require("tiktok-live-connector");
const fs = require('fs');
const path = require('path');

/**
 * Account Discovery & Curation Service
 * Scrapes TikTok profiles and curates accounts based on criteria
 */
class AccountDiscoveryService {
    constructor() {
        this.discoveredAccounts = [];
        this.curationCriteria = {
            minFollowers: 5000,
            maxFollowers: 500000,
            minVideos: 20,
            contentTypes: ['dance', 'music', 'performance'],
            languages: ['id', 'en'],
            requiresLiveIndicators: false,
            requiresScheduleInBio: false
        };
        
        // Bio patterns for schedule detection
        this.schedulePatterns = {
            timePattern: /(\d{1,2})(:|：|점)(\d{2})?\s*[-~]\s*(\d{1,2})(:|：|점)(\d{2})?\s*(PM|AM|pm|am|오후|오전|WIB|WITA|WIT)?/gi,
            dayPattern: /(daily|every day|setiap hari|매일|毎日|mon-fri|weekdays|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|senin|selasa|rabu|kamis|jumat|sabtu|minggu)/gi,
            liveKeywords: /(live|streaming|stream|show|broadcast|온라인|직방|라이브|siaran langsung|pertunjukan)/gi,
            timezonePattern: /(GMT|UTC|EST|PST|WIB|WITA|WIT|JST|KST|CST)/gi
        };
        
        // Content classification patterns
        this.contentPatterns = {
            dance: /(dance|dancing|dancer|choreography|tari|menari|penari|joget|goyang|댄스|댄서|踊り|ダンス)/gi,
            music: /(music|singing|singer|song|vocal|musik|penyanyi|lagu|음악|가수|노래|歌|音楽)/gi,
            performance: /(performance|show|entertainment|pertunjukan|hiburan|공연|엔터테인먼트|パフォーマンス)/gi,
            gaming: /(gaming|gamer|game|play|main game|게임|게이머|ゲーム)/gi,
            lifestyle: /(lifestyle|daily|vlog|life|kehidupan|sehari-hari|일상|라이프|生活)/gi,
            beauty: /(beauty|makeup|skincare|fashion|cantik|kecantikan|뷰티|메이크업|美容)/gi
        };
        
        this.log('AccountDiscoveryService initialized');
    }

    /**
     * Search accounts by keyword
     */
    async searchAccountsByKeyword(keywords, options = {}) {
        this.log(`🔍 Starting keyword search for: ${keywords.join(', ')}`);
        
        const results = [];
        const searchOptions = {
            count: options.count || 50,
            filters: options.filters || {},
            ...options
        };

        for (const keyword of keywords) {
            try {
                this.log(`Searching for keyword: "${keyword}"`);
                
                // Simulate TikTok search - in real implementation, use TikTok API
                const searchResults = await this.simulateKeywordSearch(keyword, searchOptions);
                
                // Filter and enrich results
                const filteredResults = this.filterSearchResults(searchResults, searchOptions.filters);
                const enrichedResults = await this.enrichAccountData(filteredResults);
                
                results.push(...enrichedResults);
                
                this.log(`Found ${enrichedResults.length} accounts for "${keyword}"`);
                
                // Rate limiting - wait between searches
                await this.delay(2000);
                
            } catch (error) {
                this.log(`Error searching for "${keyword}": ${error.message}`, 'error');
            }
        }

        // Remove duplicates
        const uniqueResults = this.deduplicateAccounts(results);
        this.log(`Total unique accounts found: ${uniqueResults.length}`);
        
        return uniqueResults;
    }

    /**
     * Simulate keyword search (replace with real TikTok API call)
     */
    async simulateKeywordSearch(keyword, options) {
        // This is a simulation - in real implementation, integrate with TikTok API
        const simulatedAccounts = [
            {
                uniqueId: `dance_${keyword}_1`,
                nickname: `${keyword} Dancer 1`,
                signature: `🔴 LIVE: 8PM-12AM daily ✨ ${keyword} & Music 🎵 Jakarta, Indonesia 🇮🇩`,
                stats: {
                    followerCount: Math.floor(Math.random() * 100000) + 10000,
                    followingCount: Math.floor(Math.random() * 1000) + 100,
                    heartCount: Math.floor(Math.random() * 1000000) + 50000,
                    videoCount: Math.floor(Math.random() * 200) + 50
                },
                verified: Math.random() > 0.8,
                privateAccount: false,
                avatarThumb: `https://example.com/avatar_${keyword}_1.jpg`,
                discoverySource: 'keyword',
                discoveryQuery: keyword,
                discoveredAt: new Date()
            },
            {
                uniqueId: `${keyword}_performer_2`,
                nickname: `${keyword} Show 2`,
                signature: `Jadwal live: Senin-Jumat 20:00 WIB 🎪 ${keyword} Queen 👸 Follow for ${keyword} content!`,
                stats: {
                    followerCount: Math.floor(Math.random() * 200000) + 5000,
                    followingCount: Math.floor(Math.random() * 500) + 50,
                    heartCount: Math.floor(Math.random() * 2000000) + 100000,
                    videoCount: Math.floor(Math.random() * 300) + 30
                },
                verified: Math.random() > 0.9,
                privateAccount: false,
                avatarThumb: `https://example.com/avatar_${keyword}_2.jpg`,
                discoverySource: 'keyword',
                discoveryQuery: keyword,
                discoveredAt: new Date()
            }
        ];

        return simulatedAccounts;
    }

    /**
     * Filter search results based on basic criteria
     */
    filterSearchResults(accounts, filters) {
        const criteria = { ...this.curationCriteria, ...filters };
        
        return accounts.filter(account => {
            // Basic follower count check
            if (account.stats.followerCount < criteria.minFollowers) return false;
            if (account.stats.followerCount > criteria.maxFollowers) return false;
            
            // Video count check
            if (account.stats.videoCount < criteria.minVideos) return false;
            
            // Skip private accounts
            if (account.privateAccount) return false;
            
            return true;
        });
    }

    /**
     * Enrich account data with bio analysis and scoring
     */
    async enrichAccountData(accounts) {
        const enrichedAccounts = [];
        
        for (const account of accounts) {
            try {
                // Analyze bio for schedule and content type
                const bioAnalysis = this.analyzeBio(account.signature);
                
                // Calculate account score
                const scoring = this.calculateAccountScore(account, bioAnalysis);
                
                // Classify content type
                const contentClassification = this.classifyContent(account.signature);
                
                // Assess live streaming potential
                const liveStreamingPotential = this.assessLiveStreamingPotential(account, bioAnalysis);
                
                const enrichedAccount = {
                    ...account,
                    bioAnalysis,
                    scoring,
                    contentClassification,
                    liveStreamingPotential,
                    enrichedAt: new Date()
                };
                
                enrichedAccounts.push(enrichedAccount);
                
            } catch (error) {
                this.log(`Error enriching account ${account.uniqueId}: ${error.message}`, 'error');
                // Include account without enrichment
                enrichedAccounts.push(account);
            }
        }
        
        return enrichedAccounts;
    }

    /**
     * Analyze bio text for schedule and other information
     */
    analyzeBio(bioText) {
        if (!bioText) {
            return {
                hasSchedule: false,
                hasLiveKeywords: false,
                hasTimezone: false,
                extractedSchedule: null,
                confidence: 0
            };
        }

        const analysis = {
            hasSchedule: false,
            hasLiveKeywords: false,
            hasTimezone: false,
            extractedSchedule: null,
            confidence: 0,
            detectedLanguages: [],
            location: null
        };

        // Check for live keywords
        const liveMatches = bioText.match(this.schedulePatterns.liveKeywords);
        analysis.hasLiveKeywords = !!liveMatches;

        // Check for time patterns
        const timeMatches = bioText.match(this.schedulePatterns.timePattern);
        if (timeMatches) {
            analysis.hasSchedule = true;
            analysis.extractedSchedule = {
                timeText: timeMatches[0],
                startTime: this.normalizeTime(timeMatches[1], timeMatches[6]),
                endTime: timeMatches[4] ? this.normalizeTime(timeMatches[4], timeMatches[6]) : null
            };
        }

        // Check for day patterns
        const dayMatches = bioText.match(this.schedulePatterns.dayPattern);
        if (dayMatches && analysis.extractedSchedule) {
            analysis.extractedSchedule.days = dayMatches;
        }

        // Check for timezone
        const timezoneMatches = bioText.match(this.schedulePatterns.timezonePattern);
        if (timezoneMatches) {
            analysis.hasTimezone = true;
            if (analysis.extractedSchedule) {
                analysis.extractedSchedule.timezone = timezoneMatches[0];
            }
        }

        // Detect language patterns
        if (/[가-힣]/.test(bioText)) analysis.detectedLanguages.push('ko');
        if (/[ひらがなカタカナ漢字]/.test(bioText)) analysis.detectedLanguages.push('ja');
        if (/[一-龯]/.test(bioText)) analysis.detectedLanguages.push('zh');
        if (/[a-zA-Z]/.test(bioText)) analysis.detectedLanguages.push('en');
        if (/(jakarta|bandung|surabaya|indonesia|wib|wita|wit)/i.test(bioText)) {
            analysis.detectedLanguages.push('id');
            analysis.location = 'Indonesia';
        }

        // Calculate confidence score
        let confidence = 0;
        if (analysis.hasLiveKeywords) confidence += 0.3;
        if (analysis.hasSchedule) confidence += 0.4;
        if (analysis.hasTimezone) confidence += 0.2;
        if (analysis.detectedLanguages.length > 0) confidence += 0.1;

        analysis.confidence = Math.min(1.0, confidence);

        return analysis;
    }

    /**
     * Classify content type based on bio and other signals
     */
    classifyContent(bioText) {
        const scores = {};
        let maxScore = 0;
        let primaryCategory = 'other';

        for (const [category, pattern] of Object.entries(this.contentPatterns)) {
            const matches = bioText.match(pattern) || [];
            scores[category] = matches.length;
            
            if (matches.length > maxScore) {
                maxScore = matches.length;
                primaryCategory = category;
            }
        }

        return {
            primaryCategory,
            scores,
            confidence: maxScore > 0 ? Math.min(1.0, maxScore / 3) : 0
        };
    }

    /**
     * Calculate comprehensive account score
     */
    calculateAccountScore(account, bioAnalysis) {
        let score = 0;
        const factors = [];

        // Follower score (0-25 points)
        const followerScore = this.scoreFollowers(account.stats.followerCount);
        score += followerScore;
        factors.push(`Followers: ${followerScore.toFixed(1)} pts`);

        // Engagement score (0-25 points)
        const engagementScore = this.scoreEngagement(account.stats);
        score += engagementScore;
        factors.push(`Engagement: ${engagementScore.toFixed(1)} pts`);

        // Bio quality score (0-20 points)
        const bioScore = this.scoreBio(bioAnalysis);
        score += bioScore;
        factors.push(`Bio: ${bioScore.toFixed(1)} pts`);

        // Live streaming indicators (0-20 points)
        const liveScore = this.scoreLiveIndicators(bioAnalysis);
        score += liveScore;
        factors.push(`Live Potential: ${liveScore.toFixed(1)} pts`);

        // Account quality (0-10 points)
        const qualityScore = this.scoreAccountQuality(account);
        score += qualityScore;
        factors.push(`Quality: ${qualityScore.toFixed(1)} pts`);

        return {
            totalScore: Math.round(score),
            grade: this.assignGrade(score),
            factors,
            recommendation: this.getRecommendation(score)
        };
    }

    scoreFollowers(followerCount) {
        // Sweet spot: 10K-100K followers for live streaming
        if (followerCount < 1000) return 0;
        if (followerCount < 5000) return 5;
        if (followerCount < 10000) return 10;
        if (followerCount < 50000) return 25; // Optimal range
        if (followerCount < 100000) return 20;
        if (followerCount < 500000) return 15;
        return 10; // Too big accounts might not go live often
    }

    scoreEngagement(stats) {
        if (stats.videoCount === 0) return 0;
        
        const avgLikes = stats.heartCount / stats.videoCount;
        const engagementRate = avgLikes / stats.followerCount;
        
        // Good engagement rate is 5-15%
        if (engagementRate > 0.15) return 25;
        if (engagementRate > 0.10) return 20;
        if (engagementRate > 0.05) return 15;
        if (engagementRate > 0.02) return 10;
        return 5;
    }

    scoreBio(bioAnalysis) {
        let score = 0;
        if (bioAnalysis.hasSchedule) score += 8;
        if (bioAnalysis.hasLiveKeywords) score += 6;
        if (bioAnalysis.hasTimezone) score += 3;
        if (bioAnalysis.confidence > 0.7) score += 3;
        return Math.min(20, score);
    }

    scoreLiveIndicators(bioAnalysis) {
        let score = 0;
        if (bioAnalysis.hasLiveKeywords) score += 10;
        if (bioAnalysis.hasSchedule) score += 8;
        if (bioAnalysis.extractedSchedule?.timezone) score += 2;
        return Math.min(20, score);
    }

    scoreAccountQuality(account) {
        let score = 0;
        if (account.verified) score += 5;
        if (!account.privateAccount) score += 2;
        if (account.stats.videoCount > 50) score += 2;
        if (account.stats.followerCount > account.stats.followingCount * 10) score += 1;
        return Math.min(10, score);
    }

    assignGrade(score) {
        if (score >= 85) return 'A+';
        if (score >= 75) return 'A';
        if (score >= 65) return 'B+';
        if (score >= 55) return 'B';
        if (score >= 45) return 'C+';
        if (score >= 35) return 'C';
        if (score >= 25) return 'D';
        return 'F';
    }

    getRecommendation(score) {
        if (score >= 80) return 'HIGHLY_RECOMMENDED';
        if (score >= 60) return 'RECOMMENDED';
        if (score >= 40) return 'CONSIDER';
        return 'NOT_RECOMMENDED';
    }

    /**
     * Assess live streaming potential
     */
    assessLiveStreamingPotential(account, bioAnalysis) {
        let score = 0;
        const factors = [];

        if (bioAnalysis.hasLiveKeywords) {
            score += 30;
            factors.push('Bio mentions live streaming');
        }

        if (bioAnalysis.hasSchedule) {
            score += 25;
            factors.push('Schedule found in bio');
        }

        const engagementRate = account.stats.heartCount / (account.stats.videoCount * account.stats.followerCount);
        if (engagementRate > 0.05) {
            score += 20;
            factors.push(`High engagement rate: ${(engagementRate * 100).toFixed(1)}%`);
        }

        if (account.stats.followerCount > 10000 && account.stats.followerCount < 100000) {
            score += 15;
            factors.push('Optimal follower count for live streaming');
        }

        if (account.verified) {
            score += 10;
            factors.push('Verified account');
        }

        return {
            score: Math.min(100, score),
            factors,
            category: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'
        };
    }

    /**
     * Remove duplicate accounts
     */
    deduplicateAccounts(accounts) {
        const uniqueAccounts = new Map();
        
        for (const account of accounts) {
            const key = account.uniqueId.toLowerCase();
            if (!uniqueAccounts.has(key)) {
                uniqueAccounts.set(key, account);
            }
        }
        
        return Array.from(uniqueAccounts.values());
    }

    /**
     * Generate curation report
     */
    generateCurationReport(accounts, searchKeywords) {
        const now = new Date();
        
        // Categorize accounts by recommendation
        const recommended = accounts.filter(acc => acc.scoring.recommendation === 'HIGHLY_RECOMMENDED' || acc.scoring.recommendation === 'RECOMMENDED');
        const consider = accounts.filter(acc => acc.scoring.recommendation === 'CONSIDER');
        const notRecommended = accounts.filter(acc => acc.scoring.recommendation === 'NOT_RECOMMENDED');
        
        // Categorize by special criteria
        const hasSchedule = accounts.filter(acc => acc.bioAnalysis.hasSchedule);
        const highEngagement = accounts.filter(acc => acc.scoring.totalScore >= 70);
        const highLivePotential = accounts.filter(acc => acc.liveStreamingPotential.category === 'HIGH');

        const report = {
            summary: {
                totalFound: accounts.length,
                recommended: recommended.length,
                consider: consider.length,
                notRecommended: notRecommended.length,
                hasSchedule: hasSchedule.length,
                highEngagement: highEngagement.length,
                highLivePotential: highLivePotential.length
            },
            
            searchInfo: {
                keywords: searchKeywords,
                generatedAt: now.toISOString(),
                criteria: this.curationCriteria
            },
            
            accounts: {
                recommended: recommended.map(this.formatAccountForReport.bind(this)),
                consider: consider.map(this.formatAccountForReport.bind(this)),
                notRecommended: notRecommended.slice(0, 10).map(this.formatAccountForReport.bind(this)) // Limit to 10
            },
            
            insights: this.generateInsights(accounts)
        };

        return report;
    }

    formatAccountForReport(account) {
        return {
            username: account.uniqueId,
            displayName: account.nickname,
            followers: account.stats.followerCount,
            score: account.scoring.totalScore,
            grade: account.scoring.grade,
            recommendation: account.scoring.recommendation,
            bio: account.signature,
            hasSchedule: account.bioAnalysis.hasSchedule,
            schedule: account.bioAnalysis.extractedSchedule,
            contentType: account.contentClassification.primaryCategory,
            liveStreamingPotential: account.liveStreamingPotential.category,
            discoverySource: account.discoverySource,
            discoveryQuery: account.discoveryQuery
        };
    }

    generateInsights(accounts) {
        const insights = {
            averageScore: 0,
            topContentType: null,
            schedulePatterns: {},
            languageDistribution: {},
            followerRanges: {}
        };

        if (accounts.length === 0) return insights;

        // Average score
        insights.averageScore = accounts.reduce((sum, acc) => sum + acc.scoring.totalScore, 0) / accounts.length;

        // Top content type
        const contentTypes = {};
        accounts.forEach(acc => {
            const type = acc.contentClassification.primaryCategory;
            contentTypes[type] = (contentTypes[type] || 0) + 1;
        });
        insights.topContentType = Object.keys(contentTypes).reduce((a, b) => contentTypes[a] > contentTypes[b] ? a : b);

        // Language distribution
        accounts.forEach(acc => {
            acc.bioAnalysis.detectedLanguages.forEach(lang => {
                insights.languageDistribution[lang] = (insights.languageDistribution[lang] || 0) + 1;
            });
        });

        // Follower ranges
        const ranges = ['<10K', '10K-50K', '50K-100K', '100K-500K', '500K+'];
        accounts.forEach(acc => {
            const followers = acc.stats.followerCount;
            let range;
            if (followers < 10000) range = '<10K';
            else if (followers < 50000) range = '10K-50K';
            else if (followers < 100000) range = '50K-100K';
            else if (followers < 500000) range = '100K-500K';
            else range = '500K+';
            
            insights.followerRanges[range] = (insights.followerRanges[range] || 0) + 1;
        });

        return insights;
    }

    /**
     * Save curation report to file
     */
    async saveCurationReport(report, filename) {
        const reportsDir = path.join(__dirname, '../data/curation-reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filePath = path.join(reportsDir, filename || `curation_report_${Date.now()}.json`);
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        
        this.log(`Curation report saved to: ${filePath}`);
        return filePath;
    }

    /**
     * Utility functions
     */
    normalizeTime(hour, ampm) {
        let normalizedHour = parseInt(hour);
        
        if (ampm && ampm.toLowerCase().includes('pm') && normalizedHour !== 12) {
            normalizedHour += 12;
        } else if (ampm && ampm.toLowerCase().includes('am') && normalizedHour === 12) {
            normalizedHour = 0;
        }
        
        return `${normalizedHour.toString().padStart(2, '0')}:00`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [AccountDiscovery] ${timestamp}: ${message}`);
    }
}

module.exports = AccountDiscoveryService;
