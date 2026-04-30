/**
 * Telegram service
 * Handles all Telegram Bot API interactions
 */

const axios = require('axios');
const { extractExperience } = require('../models/job');
const { getRelevanceIndicator } = require('./jobScorer');

/**
 * Send a generic notification to Telegram
 * @param {string} message - Message text (HTML formatted)
 * @param {Object} context - Azure Functions context for logging
 */
async function sendNotification(message, context) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        throw new Error('Telegram credentials not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
    }

    try {
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(telegramUrl, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        }, {
            timeout: 5000
        });
        context.log('✅ Notification sent to Telegram');
    } catch (error) {
        const details = error.response?.data ? ` | ${JSON.stringify(error.response.data)}` : '';
        context.warn(`⚠️ Failed to send notification: ${error.message}${details}`);
    }
}

/**
 * Format date to readable format
 * @param {string|number|Date} date - Date to format
 * @returns {string} - Formatted date and time
 */
function formatJobDate(date) {
    if (!date) return 'Date not specified';
    
    try {
        let dateObj;
        if (typeof date === 'number') {
            dateObj = date < 10000000000 ? new Date(date * 1000) : new Date(date);
        } else {
            dateObj = new Date(date);
        }
        
        if (isNaN(dateObj.getTime())) return 'Date not specified';
        
        // Format: "23 Apr, 2pm" or "23 Apr, 14:30"
        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const formatted = dateObj.toLocaleString('en-IN', options);
        return formatted;
    } catch (e) {
        return 'Date not specified';
    }
}

/**
 * Send job alert to Telegram with enhanced formatting
 * @param {Object} job - Job object with relevanceScore
 * @param {string} matchedKeyword - Keyword that matched this job
 * @param {Object} context - Azure Functions context for logging
 */
async function sendJobAlert(job, matchedKeyword, context) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        throw new Error('Telegram credentials not configured.');
    }

    const experience = extractExperience(job);
    const salary = job.salary || 'Not disclosed';
    const jobType = job.job_type || 'Full-time';
    const score = job.relevanceScore || 0;
    const relevanceIndicator = getRelevanceIndicator(score);
    const hiringDate = formatJobDate(job.date);
    
    // Build apply link with better formatting
    const applyLink = job.url ? `<a href="${job.url}">Apply Here →</a>` : 'Link not available';
    
    // Add tags if present (walk-in, etc)
    const tagsDisplay = (job.tags && job.tags.length > 0) 
        ? `\n🏷️ ${job.tags.join(', ')}`
        : '';
    
    const message = `🔥 <b>${job.title || 'Untitled Position'}</b>

<b>Company Details</b>
🏢 <b>${job.company_name || 'N/A'}</b>
📍 ${job.location || 'Remote'}

<b>Job Details</b>
💼 ${jobType} | ${experience}
💰 ${salary}
📅 Posted: ${hiringDate}

${relevanceIndicator}${tagsDisplay}

<b>Apply Now</b>
${applyLink}`;

    try {
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(telegramUrl, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        }, {
            timeout: 5000
        });
        context.log(`✅ Job alert sent: ${job.title}`);
    } catch (error) {
        const details = error.response?.data ? ` | ${JSON.stringify(error.response.data)}` : '';
        context.error(`❌ Failed to send job alert: ${error.message}${details}`);
        throw error;
    }
}

/**
 * Send search started notification
 * @param {number} days - Days to scan (or 0 for incremental)
 * @param {boolean} isIncremental - Whether using incremental scan
 * @param {Object} context - Azure Functions context
 */
async function sendSearchStarted(days, isIncremental, context) {
    const mode = isIncremental ? 
        '🔄 Incremental scan (since last run)' : 
        `⏰ Scanning past ${days} days`;
    
    const message = `🔍 <b>Job Search Started</b>

${mode}
🎯 Azure/Cloud/Security roles (0-2 years)
📍 India locations only

⏳ Searching 11 sources...`;

    await sendNotification(message, context);
}

/**
 * Send search complete summary
 * @param {number} totalMatched - Total jobs matched
 * @param {number} totalSent - Jobs sent as alerts
 * @param {number} duplicatesSkipped - Duplicates skipped
 * @param {Object} context - Azure Functions context
 */
async function sendSearchComplete(totalMatched, totalSent, duplicatesSkipped, context) {
    const message = `✅ <b>Search Complete</b>

📊 Found: ${totalMatched} jobs
📤 Sent: ${totalSent} alerts
⏭️ Skipped: ${duplicatesSkipped} duplicates`;

    await sendNotification(message, context);
}

/**
 * Send "no jobs found" notification
 * @param {number} totalFetched - Total jobs fetched
 * @param {number} duplicatesSkipped - Duplicates skipped
 * @param {boolean} isIncremental - Whether using incremental scan
 * @param {Object} context - Azure Functions context
 */
async function sendNoJobsFound(totalFetched, duplicatesSkipped, isIncremental, context) {
    const scanInfo = isIncremental ?
        `🔄 Scanned new jobs posted since last run` :
        `📊 Scanned ${totalFetched} jobs`;
    
    const message = `📭 <b>No New Jobs</b>

${scanInfo}
⏭️ Skipped ${duplicatesSkipped} duplicates

⏰ Next check: Tomorrow 10:00 AM IST`;

    await sendNotification(message, context);
}

module.exports = {
    sendNotification,
    sendJobAlert,
    sendSearchStarted,
    sendSearchComplete,
    sendNoJobsFound,
    formatJobDate
};
