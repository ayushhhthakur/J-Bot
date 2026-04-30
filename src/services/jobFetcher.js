/**
 * Job fetcher service
 * Handles fetching jobs from multiple APIs with error handling
 */

const axios = require('axios');
const { JOB_SOURCES } = require('./jobSources');
const cheerio = require('cheerio');

/**
 * Generic HTML scraper fallback — tries to extract job links/titles from arbitrary pages.
 * Returns an array of job-like objects or [] on failure.
 */
function htmlScrapeGeneric(html, baseUrl = '', sourceName = 'Unknown') {
    try {
        const $ = cheerio.load(html);
        const anchors = [];

        $('a[href]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = ($(el).text() || '').trim();
            // heuristics: href contains job/careers/apply/opening/position/vacancy or anchor text is long enough
            if (/\b(job|jobs|careers|apply|opening|position|vacancy)\b/i.test(href) || /\b(job|careers|apply|opening|position|vacancy)\b/i.test(text) || text.length > 20) {
                anchors.push({ href, text });
            }
        });

        // Resolve and dedupe
        const seen = new Set();
        const jobs = [];
        for (const a of anchors) {
            let resolved = a.href;
            try { resolved = new URL(a.href, baseUrl).toString(); } catch (e) { /* leave as-is */ }
            if (!resolved || seen.has(resolved)) continue;
            seen.add(resolved);
            const title = a.text || resolved.split('/').pop().replace(/[-_]/g, ' ') || 'Job posting';
            jobs.push({
                title: title.trim(),
                company_name: sourceName,
                location: 'India',
                description: '',
                url: resolved,
                slug: (resolved.split('/').pop() || `scraped_${Date.now()}`),
                job_type: 'Full-time',
                salary: null,
                date: null,
                source: sourceName,
                tags: []
            });
            if (jobs.length >= 50) break;
        }
        return jobs;
    } catch (err) {
        return [];
    }
}

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
            
            // Handle URL as function (including async), string, or precomputed data
            let url = source.url;
            let jobs = [];
            
            if (typeof url === 'function') {
                // Execute function (handles both sync and async)
                url = await url();

                // Null guard — skip sources that return null (e.g. no API key)
                if (!url) {
                    context.log(`⏭️ Skipping ${source.name} (no API key configured)`);
                    continue;
                }
                
                // If the function returns job data directly (from scraper), use it
                if (Array.isArray(url)) {
                    jobs = source.parser(url);
                    context.log(`✅ Fetched ${jobs.length} jobs from ${source.name}`);
                    allJobs.push(...jobs.map(job => ({ ...job, source: job.source || source.name })));
                    continue;
                }
            }
            
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
            jobs = source.parser(response.data);

            // If parser returned nothing and the response is HTML, attempt a generic HTML scrape
            if ((!Array.isArray(jobs) || jobs.length === 0) && typeof response.data === 'string') {
                try {
                    const baseUrl = response.request && response.request.res && response.request.res.responseUrl ?
                        response.request.res.responseUrl : url;
                    const scraped = htmlScrapeGeneric(response.data, baseUrl, source.name);
                    if (Array.isArray(scraped) && scraped.length > 0) {
                        jobs = scraped;
                        context.log(`🧩 HTML-scraped ${scraped.length} jobs from ${source.name}`);
                    }
                } catch (err) {
                    context.warn(`⚠️ HTML scrape failed for ${source.name}: ${err.message}`);
                }
            }
            
            // Add source to each job
            const jobsWithSource = jobs.map(job => ({
                ...job,
                source: job.source || source.name
            }));

            // Detect walk-in interviews and add tags for Delhi/Noida/Gurgaon
            const CITY_KEYWORDS = ['delhi','new delhi','noida','gurgaon','gurugram','gurgoan'];

            function detectWalkInTags(job) {
                try {
                    job.tags = Array.isArray(job.tags) ? job.tags.slice() : (job.tags ? [job.tags] : []);
                    const hay = ((job.title||'') + ' ' + (job.description||'') + ' ' + (job.location||'') + ' ' + (job.url||'')).toLowerCase();
                    
                    // Check for walk-in mentions but exclude negations (no, not, don't, etc)
                    const hasWalkin = /(^|[\s,])walk[- ]?in(s)?(\s|[,.!?]|$)/i.test(hay) || 
                                     /walk[- ]?in interview/i.test(hay) ||
                                     /(^|[\s,])walkins?(\s|[,.!?]|$)/i.test(hay);
                    const hasNegation = /no\s+walk[- ]?in|not.*walk[- ]?in|don't.*walk[- ]?in|without.*walk[- ]?in/i.test(hay);
                    
                    if (!hasWalkin || hasNegation) return job;

                    // Add generic walk-in tag
                    if (!job.tags.includes('walk-in')) job.tags.push('walk-in');

                    // Add city-specific tags
                    for (const c of CITY_KEYWORDS) {
                        if (hay.includes(c)) {
                            const tag = `walk-in-${c.replace(/\s+/g,'-')}`;
                            if (!job.tags.includes(tag)) job.tags.push(tag);
                        }
                    }

                    return job;
                } catch (e) {
                    return job;
                }
            }

            const jobsTagged = jobsWithSource.map(detectWalkInTags);

            context.log(`✅ Fetched ${jobsTagged.length} jobs from ${source.name}`);
            allJobs.push(...jobsTagged);
            
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
