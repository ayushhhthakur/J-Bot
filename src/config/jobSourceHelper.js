/**
 * Job Source Manager - Easy way to add new job sources
 * 
 * HOW TO ADD A NEW JOB SOURCE:
 * =============================
 * 
 * 1. Add the API URL to src/config/jobApiUrls.js in the appropriate category
 * 
 * 2. If it's a simple JSON API, use the quick helper below
 * 
 * 3. If it needs custom parsing, add it to src/services/jobSources.js
 * 
 */

const urls = require('../config/jobApiUrls');

/**
 * Quick Job Source Creator
 * Use this template to quickly add a new source without writing a full parser
 * 
 * @param {string} name - Display name for the job source
 * @param {string} url - API URL or function returning URL
 * @param {Object} config - Configuration for parsing
 * @returns {Object} - Job source object
 */
function createSimpleJobSource(name, url, config = {}) {
    return {
        name: name,
        url: url,
        parser: (data) => {
            try {
                // Extract jobs array from response
                const jobsPath = config.jobsPath || ['jobs', 'data', 'results', 'items'];
                let jobs = data;
                
                // Try to find jobs array
                for (const path of jobsPath) {
                    if (data && data[path]) {
                        jobs = data[path];
                        break;
                    }
                }
                
                if (!Array.isArray(jobs)) {
                    jobs = [];
                }

                // Map to standard format
                return jobs.map(job => ({
                    title: job[config.titleField || 'title'] || 
                           job.job_title || 
                           job.jobTitle || 
                           'No Title',
                    
                    company_name: job[config.companyField || 'company_name'] || 
                                  job.company || 
                                  job.companyName || 
                                  job.employer?.name ||
                                  'Not specified',
                    
                    location: job[config.locationField || 'location'] || 
                              job.job_location || 
                              job.city || 
                              'India',
                    
                    description: job[config.descriptionField || 'description'] || 
                                job.job_description || 
                                job.summary || 
                                '',
                    
                    url: job[config.urlField || 'url'] || 
                         job.job_url || 
                         job.apply_url || 
                         `${config.baseUrl || ''}/${job.id || job.slug}`,
                    
                    slug: job.id || job.slug || job.job_id || `${name.toLowerCase().replace(/\s/g, '_')}_${Date.now()}`,
                    
                    job_type: job[config.jobTypeField || 'job_type'] || 
                              job.employment_type || 
                              'Full-time',
                    
                    salary: job.salary || job.salary_range || null,
                    
                    date: job[config.dateField || 'posted_date'] || 
                          job.date || 
                          job.created_at || 
                          job.posted_on || 
                          null,
                    
                    source: config.sourceName || name
                }));
            } catch (error) {
                console.error(`Error parsing ${name}:`, error.message);
                return [];
            }
        },
        headers: config.headers || undefined
    };
}

/**
 * QUICK ADD TEMPLATES
 * Copy and modify these examples to add new sources quickly
 */

// Example 1: Simple JSON API
const EXAMPLE_SIMPLE_API = createSimpleJobSource(
    'Example Job Board',
    'https://api.example.com/jobs?location=India',
    {
        jobsPath: ['jobs'],          // Where to find jobs array in response
        titleField: 'title',          // Field name for title
        companyField: 'company',      // Field name for company
        locationField: 'location',    // Field name for location
        urlField: 'apply_url',        // Field name for job URL
        dateField: 'posted_date',     // Field name for date
        baseUrl: 'https://example.com/job', // Base URL if job URL is relative
    }
);

// Example 2: API with custom headers
const EXAMPLE_API_WITH_AUTH = createSimpleJobSource(
    'Example Protected API',
    'https://api.example.com/protected/jobs',
    {
        jobsPath: ['data', 'jobs'],
        headers: {
            'Authorization': `Bearer ${process.env.EXAMPLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    }
);

// Example 3: API with dynamic URL
const EXAMPLE_DYNAMIC_URL = createSimpleJobSource(
    'Example Dynamic API',
    () => {
        const apiKey = process.env.EXAMPLE_KEY || 'demo';
        return `https://api.example.com/jobs?key=${apiKey}&location=India`;
    },
    {
        jobsPath: ['results']
    }
);

/**
 * Export helper functions
 */
module.exports = {
    createSimpleJobSource,
    
    // URL configurations
    urls,
    
    // Quick access to all URL categories
    REMOTE_APIS: urls.REMOTE_JOB_APIS,
    INDIA_PORTALS: urls.INDIA_JOB_PORTALS,
    TECH_COMPANIES: urls.TECH_COMPANY_CAREERS,
    STARTUPS: urls.STARTUP_PLATFORMS,
    INTERNSHIPS: urls.INTERNSHIP_PLATFORMS,
    
    // Example templates (remove in production or use for testing)
    EXAMPLES: {
        EXAMPLE_SIMPLE_API,
        EXAMPLE_API_WITH_AUTH,
        EXAMPLE_DYNAMIC_URL
    }
};
