/**
 * Web scraper service for career pages that don't provide APIs
 * Uses lightweight HTML parsing with Cheerio
 */

const axios = require('axios');

/**
 * Generic scraper for job listings
 * @param {string} url - URL to scrape
 * @param {Object} config - Scraping configuration
 * @returns {Promise<Array>} - Array of job objects
 */
async function scrapeJobPage(url, config) {
    try {
        const response = await axios.get(url, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                ...config.headers
            }
        });

        // If response is JSON, return it
        if (typeof response.data === 'object') {
            return response.data;
        }

        // For HTML responses, we'd need cheerio
        // For now, return empty array for HTML pages
        console.warn('HTML scraping requires cheerio - returning empty results');
        return [];

    } catch (error) {
        console.error(`Scraping failed for ${url}:`, error.message);
        return [];
    }
}

/**
 * Scrape Google Careers
 */
async function scrapeGoogleCareers() {
    try {
        // Google uses an internal API
        const response = await axios.post('https://careers.google.com/api/v3/search/', {
            location: 'India',
            company: 'Google',
            employment_type: ['FULL_TIME', 'PART_TIME'],
            page_size: 50
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const jobs = response.data?.jobs || [];
        return jobs.map(job => ({
            title: job.title,
            company_name: 'Google',
            location: job.locations?.[0]?.display || 'India',
            description: job.summary || job.responsibilities || '',
            url: `https://careers.google.com/jobs/results/${job.id}`,
            slug: job.id,
            job_type: job.employment_type || 'Full-time',
            salary: null,
            date: job.posted_date || job.created || null,
            source: 'Google Careers India'
        }));
    } catch (error) {
        console.error('Google scraping failed:', error.message);
        return [];
    }
}

/**
 * Scrape Microsoft Careers
 */
async function scrapeMicrosoftCareers() {
    try {
        // Microsoft careers API endpoint
        const response = await axios.get('https://gcsservices.careers.microsoft.com/search/api/v1/search', {
            params: {
                l: 'en_us',
                pg: 1,
                pgSz: 50,
                o: 'Recent',
                flt: 'true'
            },
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const jobs = response.data?.operationResult?.result?.jobs || [];
        
        // Filter for India locations
        const indiaJobs = jobs.filter(job => 
            job.country?.toLowerCase() === 'india' || 
            job.location?.toLowerCase().includes('india')
        );

        return indiaJobs.map(job => ({
            title: job.title,
            company_name: 'Microsoft',
            location: job.location || job.city || 'India',
            description: job.description || job.descriptionTeaser || '',
            url: `https://careers.microsoft.com/us/en/job/${job.jobId}`,
            slug: job.jobId,
            job_type: job.workSiteFlexibility || 'Full-time',
            salary: null,
            date: job.postingDate || null,
            source: 'Microsoft Careers India'
        }));
    } catch (error) {
        console.error('Microsoft scraping failed:', error.message);
        return [];
    }
}

/**
 * Scrape Amazon Jobs
 */
async function scrapeAmazonJobs() {
    try {
        const response = await axios.get('https://www.amazon.jobs/en/search.json', {
            params: {
                offset: 0,
                result_limit: 50,
                country: 'IND',
                sort: 'relevant'
            },
            timeout: 15000
        });

        const jobs = response.data?.jobs || [];
        return jobs.map(job => ({
            title: job.title,
            company_name: 'Amazon',
            location: job.city || job.location || 'India',
            description: job.description || job.basic_qualifications || '',
            url: `https://www.amazon.jobs${job.job_path}`,
            slug: job.id_icims || job.id,
            job_type: job.job_schedule_type || 'Full-time',
            salary: null,
            date: job.posted_date || null,
            source: 'Amazon India'
        }));
    } catch (error) {
        console.error('Amazon scraping failed:', error.message);
        return [];
    }
}

/**
 * Scrape Accenture Jobs
 */
async function scrapeAccentureJobs() {
    try {
        const response = await axios.post('https://www.accenture.com/api/sitecore/CareersSearchApi/FindCareers', {
            Keywords: '',
            Location: 'India',
            PageNumber: 1,
            PageSize: 50,
            Language: 'en'
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const jobs = response.data?.Results || response.data?.jobs || [];
        return jobs.map(job => ({
            title: job.Title || job.title,
            company_name: 'Accenture',
            location: job.Location || 'India',
            description: job.Description || '',
            url: job.ApplyUrl || `https://www.accenture.com/careers/jobdetails?id=${job.Id}`,
            slug: job.Id || job.id,
            job_type: job.EmploymentType || 'Full-time',
            salary: null,
            date: job.PostedDate || null,
            source: 'Accenture India'
        }));
    } catch (error) {
        console.error('Accenture scraping failed:', error.message);
        return [];
    }
}

/**
 * Scrape Oracle Careers
 */
async function scrapeOracleJobs() {
    try {
        const response = await axios.get('https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitionsLOV', {
            params: {
                onlyData: true,
                expand: 'all',
                finder: 'findReqs;siteNumber=CX,Location=IN',
                limit: 50
            },
            timeout: 15000
        });

        const jobs = response.data?.items || [];
        return jobs.map(job => ({
            title: job.Title,
            company_name: 'Oracle',
            location: job.PrimaryLocation || 'India',
            description: job.Description || '',
            url: `https://careers.oracle.com/jobs/#en/sites/jobsearch/job/${job.Id}`,
            slug: job.Id || job.RequisitionId,
            job_type: job.JobType || 'Full-time',
            salary: null,
            date: job.PostedDate || null,
            source: 'Oracle India'
        }));
    } catch (error) {
        console.error('Oracle scraping failed:', error.message);
        return [];
    }
}

module.exports = {
    scrapeJobPage,
    scrapeGoogleCareers,
    scrapeMicrosoftCareers,
    scrapeAmazonJobs,
    scrapeAccentureJobs,
    scrapeOracleJobs
};
