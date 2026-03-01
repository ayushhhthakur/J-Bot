/**
 * Job filter service
 * Multi-stage filtering logic for job matching
 */

const {
    INCLUDE_KEYWORDS,
    ENTRY_LEVEL_KEYWORDS,
    EXCLUDE_KEYWORDS,
    NON_TECHNICAL_KEYWORDS,
    PURE_TECHNICAL_KEYWORDS,
    INDIA_KEYWORDS,
    PREFERRED_CITIES,
    FRESHER_FRIENDLY_COMPANIES
} = require('../config/constants');

/**
 * Check if text contains any keywords (case-insensitive)
 * Short acronyms use word boundaries to avoid false positives
 * @param {string} text - Text to search in
 * @param {Array} keywords - Keywords to search for
 * @returns {boolean}
 */
function containsKeyword(text, keywords) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        // Use word boundary for short acronyms (<=4 chars)
        if (lowerKeyword.length <= 4) {
            const regex = new RegExp(`\\b${lowerKeyword}\\b`);
            return regex.test(lowerText);
        }
        return lowerText.includes(lowerKeyword);
    });
}

/**
 * Check if job location is in India
 * @param {Object} job - Job object
 * @returns {boolean}
 */
function isIndiaLocation(job) {
    const location = job.location || '';
    
    if (!location) return false;
    
    // Reddit posts need manual check
    if (location.includes('Check post')) return true;
    
    const lowerLocation = location.toLowerCase();
    
    // Exclude foreign countries/cities
    const foreignIndicators = [
        'germany', 'berlin', 'munich', 'frankfurt', 'hamburg', 'dortmund',
        'united states', 'usa', 'u.s.', 'new york', 'san francisco', 'seattle',
        'united kingdom', 'london', 'uk ', ' uk,',
        'canada', 'toronto', 'vancouver',
        'australia', 'sydney', 'melbourne',
        'singapore', 'netherlands', 'france', 'paris',
        'europe', 'european union',
    ];
    if (foreignIndicators.some(f => lowerLocation.includes(f))) return false;
    
    // Check for India keywords
    const isIndia = INDIA_KEYWORDS.some(kw => lowerLocation.includes(kw.toLowerCase()));
    
    // Check for Indian cities
    const isPreferredCity = PREFERRED_CITIES.some(city =>
        lowerLocation.includes(city.toLowerCase())
    );
    
    // Allow "Remote" only if no foreign country detected
    const isRemoteAcceptable = ['remote', 'work from home', 'wfh', 'anywhere'].some(r =>
        lowerLocation.includes(r)
    );
    
    return isIndia || isPreferredCity || isRemoteAcceptable;
}

/**
 * Check if company is known to hire freshers
 * @param {Object} job - Job object
 * @returns {boolean}
 */
function isFresherFriendlyCompany(job) {
    const companyName = job.company_name || '';
    
    if (!companyName) {
        return false;
    }
    
    const lowerCompany = companyName.toLowerCase();
    
    return FRESHER_FRIENDLY_COMPANIES.some(company => 
        lowerCompany.includes(company.toLowerCase())
    );
}

/**
 * Main job filtering function
 * Multi-stage filter: location → technical → keywords → experience
 * @param {Object} job - Job object
 * @returns {Object} - { match: boolean, reason: string, matchedKeyword: string }
 */
function filterJob(job) {
    const title = job.title || '';
    const description = job.description || '';
    const combinedText = `${title} ${description}`;
    
    // Special handling for Reddit posts
    const isRedditPost = job.source && job.source.includes('Reddit');
    
    // Stage 1: Location check (India only)
    if (!isRedditPost) {
        if (!isIndiaLocation(job)) {
            return { match: false, reason: 'Location not in India or preferred cities' };
        }
    } else {
        // Reddit posts must mention India/Indian cities
        const mentionsIndia = containsKeyword(combinedText, INDIA_KEYWORDS) || 
                             containsKeyword(combinedText, PREFERRED_CITIES);
        if (!mentionsIndia) {
            return { match: false, reason: 'Reddit post does not mention India' };
        }
    }
    
    // Stage 2: Exclude senior/high-experience positions
    if (containsKeyword(combinedText, EXCLUDE_KEYWORDS)) {
        return { match: false, reason: 'Excluded due to senior/experience requirement' };
    }
    
    // Stage 3: Exclude non-technical/support roles (CRITICAL)
    if (containsKeyword(combinedText, NON_TECHNICAL_KEYWORDS)) {
        return { match: false, reason: 'Non-technical or support role (excluded)' };
    }
    
    // Stage 4: Must be a pure technical role (CRITICAL)
    const isPureTechnical = containsKeyword(combinedText, PURE_TECHNICAL_KEYWORDS);
    if (!isPureTechnical) {
        return { match: false, reason: 'Not a pure technical role' };
    }
    
    // Stage 5: Must contain required keywords (Azure/Cloud/Security/DevOps)
    const hasRequiredKeyword = containsKeyword(combinedText, INCLUDE_KEYWORDS);
    if (!hasRequiredKeyword) {
        return { match: false, reason: 'Does not contain required keywords' };
    }
    
    // Stage 6: Check experience level (0-2 years)
    const isEntryLevel = containsKeyword(combinedText, ENTRY_LEVEL_KEYWORDS);
    
    // Extract years mentioned
    const yearsMatch = combinedText.match(/(\d+)\s*\+?\s*years?/gi);
    let hasAcceptableExperience = true;
    
    if (yearsMatch) {
        const years = yearsMatch.map(match => parseInt(match.match(/(\d+)/)[1]));
        const maxYears = Math.max(...years);
        
        if (maxYears > 2) {
            hasAcceptableExperience = false;
        }
    }
    
    // Accept if: explicitly entry level OR no experience mentioned OR up to 2 years
    const noExperienceMentioned = !combinedText.match(/\d+\s*\+?\s*years?/i);
    
    if (!isEntryLevel && !noExperienceMentioned && !hasAcceptableExperience) {
        return { match: false, reason: 'Requires more than 2 years experience' };
    }
    
    // Find which keyword matched
    const matchedKeyword = INCLUDE_KEYWORDS.find(keyword => 
        combinedText.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return { match: true, matchedKeyword };
}

module.exports = {
    filterJob,
    containsKeyword,
    isIndiaLocation,
    isFresherFriendlyCompany
};
