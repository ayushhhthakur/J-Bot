/**
 * Job model utilities
 * Functions for job data manipulation, ID generation, date parsing, etc.
 */

const crypto = require('crypto');

/**
 * Generate stable hash-based ID for jobs (prevents duplicates)
 * @param {Object} job - Job object
 * @returns {string} - SHA-256 hash
 */
function generateStableId(job) {
    const uniqueString = (job.url || '') + (job.title || '') + (job.company_name || '');
    return crypto.createHash('sha256').update(uniqueString).digest('hex');
}

/**
 * Check if job date is within specified time window
 * @param {string|number|Date} jobDate - Job posting date
 * @param {number} days - Number of days to check within
 * @returns {boolean} - True if within time window
 */
function isWithinTimeWindow(jobDate, days) {
    if (!jobDate) {
        return true; // Include if no date (safer to show)
    }
    
    try {
        let date;
        
        // Handle Unix timestamp (seconds or milliseconds)
        if (typeof jobDate === 'number') {
            date = jobDate < 10000000000 ? new Date(jobDate * 1000) : new Date(jobDate);
        } else {
            date = new Date(jobDate);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return true;
        }
        
        const now = new Date();
        const diffTime = now - date;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        return diffDays <= days && diffDays >= 0;
    } catch (error) {
        return true; // Include on error
    }
}

/**
 * Check if job was posted after a specific timestamp (for incremental scanning)
 * @param {string|number|Date} jobDate - Job posting date
 * @param {string|Date} lastRunTimestamp - Last successful run timestamp
 * @returns {boolean} - True if job is newer than last run
 */
function isJobNewerThan(jobDate, lastRunTimestamp) {
    if (!jobDate) {
        return true; // Include if no date
    }
    
    if (!lastRunTimestamp) {
        return true; // Include if no last run (first run)
    }
    
    try {
        let jobDateObj;
        
        // Parse job date
        if (typeof jobDate === 'number') {
            jobDateObj = jobDate < 10000000000 ? new Date(jobDate * 1000) : new Date(jobDate);
        } else {
            jobDateObj = new Date(jobDate);
        }
        
        // Parse last run timestamp
        const lastRunDate = new Date(lastRunTimestamp);
        
        // Check if both dates are valid
        if (isNaN(jobDateObj.getTime()) || isNaN(lastRunDate.getTime())) {
            return true; // Include if dates are invalid
        }
        
        return jobDateObj > lastRunDate;
    } catch (error) {
        return true; // Include on error
    }
}

/**
 * Calculate days since job was posted
 * @param {string|number|Date} jobDate - Job posting date
 * @returns {number} - Days since posting (Infinity if no date)
 */
function getDaysSince(jobDate) {
    if (!jobDate) {
        return Infinity;
    }
    
    try {
        let date;
        
        if (typeof jobDate === 'number') {
            date = jobDate < 10000000000 ? new Date(jobDate * 1000) : new Date(jobDate);
        } else {
            date = new Date(jobDate);
        }
        
        if (isNaN(date.getTime())) {
            return Infinity;
        }
        
        const now = new Date();
        const diffTime = now - date;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        return Math.max(0, diffDays);
    } catch (error) {
        return Infinity;
    }
}

/**
 * Extract technical role type from job
 * @param {Object} job - Job object
 * @returns {string} - Role type
 */
function extractRoleType(job) {
    const title = (job.title || '').toLowerCase();
    
    const roleTypes = {
        'developer': 'Software Developer',
        'engineer': 'Engineer',
        'devops': 'DevOps Engineer',
        'cloud': 'Cloud Engineer',
        'security': 'Security Engineer',
        'cybersecurity': 'Cybersecurity Professional',
        'devsecops': 'DevSecOps Engineer',
        'backend': 'Backend Developer',
        'frontend': 'Frontend Developer',
        'full stack': 'Full Stack Developer',
        'full-stack': 'Full Stack Developer',
        'sre': 'Site Reliability Engineer',
        'automation': 'Automation Engineer',
        'infrastructure': 'Infrastructure Engineer'
    };
    
    for (const [keyword, roleType] of Object.entries(roleTypes)) {
        if (title.includes(keyword)) {
            return roleType;
        }
    }
    
    return 'Technical Role';
}

/**
 * Extract skills from job description
 * @param {Object} job - Job object
 * @param {Array} skillKeywords - List of skill keywords to search for
 * @returns {string} - Comma-separated skills
 */
function extractSkills(job, skillKeywords) {
    const text = `${job.title} ${job.description}`.toLowerCase();
    const detectedSkills = [];
    
    skillKeywords.forEach(skill => {
        if (text.includes(skill.toLowerCase())) {
            detectedSkills.push(skill);
        }
    });
    
    return detectedSkills.length > 0 ? detectedSkills.slice(0, 5).join(', ') : 'See job description';
}

/**
 * Extract experience requirement from job
 * @param {Object} job - Job object
 * @returns {string} - Experience requirement
 */
function extractExperience(job) {
    const text = `${job.title} ${job.description}`.toLowerCase();
    
    // Check for entry level indicators
    if (text.match(/intern|internship|fresher|graduate|entry.?level|0.?1.?year|0.?year|1.?year|1.?2.?years?|0.?2.?years?/)) {
        return 'Entry Level / Fresher (0-2 years)';
    }
    
    // Extract years mentioned
    const yearsMatch = text.match(/(\d+)\+?\s*years?/);
    if (yearsMatch) {
        const years = parseInt(yearsMatch[1]);
        if (years <= 2) {
            return 'Entry Level / Fresher (0-2 years)';
        }
        return `${years}+ years`;
    }
    
    return 'Not specified';
}

module.exports = {
    generateStableId,
    isWithinTimeWindow,
    isJobNewerThan,
    getDaysSince,
    extractRoleType,
    extractSkills,
    extractExperience
};
