/**
 * Job fetcher service
 * Handles fetching jobs from multiple APIs with error handling
 */

const axios = require('axios');
const { JOB_SOURCES } = require('./jobSources');

/**
 * Fetch jobs from all configured sources
 * @param {Object} context - Azure Functions context for logging
 * @returns {Promise<Array>} - Array of all fetched jobs
 */
async function fetchJobsFromAllSources(context) {
    const allJobs = [];
    
    for (const source of JOB_SOURCES) {
        try {
            context.log(`📡 Fetching jobs from ${source.name}...`);
            
            // Handle URL as function or string
            const url = typeof source.url === 'function' ? source.url() : source.url;
            
            // Build headers
            const defaultHeaders = { 'User-Agent': 'JobAlertBot/1.0' };
            const customHeaders = source.headers ? 
                (typeof source.headers === 'function' ? source.headers() : source.headers) : {};
            const headers = { ...defaultHeaders, ...customHeaders };
            
            // Fetch with timeout
            const response = await axios.get(url, {
                timeout: 15000,
                headers
            });

            // Parse jobs using source-specific parser
            const jobs = source.parser(response.data);
            
            // Add source to each job
            const jobsWithSource = jobs.map(job => ({
                ...job,
                source: job.source || source.name
            }));
            
            context.log(`✅ Fetched ${jobsWithSource.length} jobs from ${source.name}`);
            allJobs.push(...jobsWithSource);
            
        } catch (error) {
            context.warn(`⚠️ Failed to fetch from ${source.name}: ${error.message}`);
            // Continue with other sources
        }
    }
    
    context.log(`📊 Total jobs fetched from all sources: ${allJobs.length}`);
    return allJobs;
}

/**
 * Fetch jobs with incremental filtering
 * Only returns jobs posted after lastRunTimestamp
 * @param {Object} context - Azure Functions context
 * @param {Date|string|null} lastRunTimestamp - Last successful run timestamp
 * @param {number} fallbackDays - Days to look back if no lastRunTimestamp (first run)
 * @returns {Promise<Array>} - Array of jobs
 */
async function fetchJobsIncremental(context, lastRunTimestamp, fallbackDays) {
    const allJobs = await fetchJobsFromAllSources(context);
    
    if (!lastRunTimestamp) {
        // First run - use fallback time window
        context.log(`⚠️ No last run timestamp found. Using fallback: ${fallbackDays} days`);
        const { isWithinTimeWindow } = require('../models/job');
        return allJobs.filter(job => isWithinTimeWindow(job.date, fallbackDays));
    }
    
    // Incremental mode - only jobs newer than last run
    const { isJobNewerThan } = require('../models/job');
    const newJobs = allJobs.filter(job => isJobNewerThan(job.date, lastRunTimestamp));
    
    context.log(`🔄 Incremental scan: ${newJobs.length} of ${allJobs.length} jobs are new (posted after ${new Date(lastRunTimestamp).toISOString()})`);
    
    return newJobs;
}

module.exports = {
    fetchJobsFromAllSources,
    fetchJobsIncremental
};
