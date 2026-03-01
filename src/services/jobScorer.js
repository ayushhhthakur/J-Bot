/**
 * Job scoring service
 * Calculate relevance scores for jobs (0-150+ points)
 */

const { getDaysSince } = require('../models/job');
const { isFresherFriendlyCompany } = require('./jobFilter');

/**
 * Calculate relevance score for a job
 * Higher score = more relevant for entry-level candidates
 * 
 * Scoring breakdown:
 * - Keywords (Azure/Cloud/Security): 15-30pts
 * - Fresher indicators: 15-20pts
 * - Known company: 15pts
 * - Recency (1-7 days): 5-20pts
 * - Salary disclosed: 10pts
 * - Location (Bangalore/Pune/Remote): 5-8pts
 * - Full-time: 5pts
 * 
 * @param {Object} job - Job object
 * @returns {number} - Relevance score (0-150+)
 */
function scoreJob(job) {
    let score = 0;
    const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    
    // === Keyword weights (primary relevance) ===
    if (text.includes('azure')) score += 30;
    if (text.includes('cloud')) score += 20;
    if (text.includes('security')) score += 20;
    if (text.includes('devsecops')) score += 25;
    if (text.includes('devops')) score += 15;
    if (text.includes('cybersecurity')) score += 20;
    
    // === Fresher indicators (high value for target audience) ===
    if (text.includes('fresher') || text.includes('intern')) score += 20;
    if (text.includes('0-1') || text.includes('entry level') || text.includes('entry-level')) score += 15;
    if (text.includes('graduate') || text.includes('internship')) score += 15;
    
    // === Known company bonus (higher hire likelihood) ===
    if (isFresherFriendlyCompany(job)) score += 15;
    
    // === Recency bonus (newer = better response rate) ===
    const daysSincePost = getDaysSince(job.date);
    if (daysSincePost <= 1) score += 20;
    else if (daysSincePost <= 3) score += 10;
    else if (daysSincePost <= 7) score += 5;
    
    // === Salary disclosed bonus (transparency indicator) ===
    if (job.salary && job.salary !== 'Not disclosed') score += 10;
    
    // === Location bonus (preferred cities) ===
    const location = (job.location || '').toLowerCase();
    if (location.includes('bangalore') || location.includes('bengaluru')) score += 5;
    if (location.includes('pune') || location.includes('hyderabad')) score += 5;
    if (location.includes('remote')) score += 8;
    
    // === Job type bonus ===
    if (job.job_type && job.job_type.toLowerCase().includes('full-time')) score += 5;
    
    return score;
}

/**
 * Generate relevance indicator based on score
 * @param {number} score - Job relevance score
 * @returns {string} - Star rating with label
 */
function getRelevanceIndicator(score) {
    if (score >= 100) return '⭐⭐⭐⭐⭐ Excellent Match';
    if (score >= 80) return '⭐⭐⭐⭐ Great Match';
    if (score >= 60) return '⭐⭐⭐ Good Match';
    if (score >= 40) return '⭐⭐ Fair Match';
    return '⭐ Basic Match';
}

module.exports = {
    scoreJob,
    getRelevanceIndicator
};
