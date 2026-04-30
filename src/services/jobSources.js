/**
 * Clean job source registry
 * Only keeps live or reliably parseable sources.
 */

const { urls } = require('../config/jobSourceHelper');

const JOB_SOURCES = [
    {
        name: 'Arbeitnow',
        url: urls.REMOTE_JOB_APIS.arbeitnow,
        parser: (data) => {
            const jobs = data?.data || [];
            return jobs.map(job => ({
                title: job.title || 'No Title',
                company_name: job.company_name || 'Not specified',
                location: job.location || 'Remote',
                description: job.description || '',
                url: job.url || '',
                slug: job.slug || job.id || `arbeitnow_${Date.now()}`,
                job_type: job.job_type || 'Full-time',
                date: job.created_at || job.date || null,
                source: 'Arbeitnow'
            }));
        }
    },
    {
        name: 'RemoteOK',
        url: urls.REMOTE_JOB_APIS.remoteOk,
        parser: (data) => {
            const jobs = Array.isArray(data) ? data.slice(1) : [];
            return jobs.map(job => ({
                title: job.position || 'No Title',
                company_name: job.company || 'Not specified',
                location: job.location || 'Remote',
                description: job.description || '',
                url: job.url || `https://remoteok.com/remote-jobs/${job.id}`,
                slug: job.id || job.slug || `remoteok_${Date.now()}`,
                job_type: job.type || 'Full-time',
                date: job.date || job.epoch || null,
                source: 'RemoteOK',
                tags: job.tags || []
            }));
        }
    },
    {
        name: 'JobIcy',
        url: urls.REMOTE_JOB_APIS.jobIcy,
        parser: (data) => {
            const jobs = data?.jobs || [];
            return jobs.map(job => ({
                title: job.jobTitle || 'No Title',
                company_name: job.companyName || 'Not specified',
                location: job.jobGeo || 'Remote',
                description: job.jobExcerpt || '',
                url: job.url || '',
                slug: job.id || `jobicy_${Date.now()}`,
                job_type: job.jobType || 'Full-time',
                date: job.jobPosted || job.pubDate || null,
                source: 'JobIcy'
            }));
        }
    },
    {
        name: 'Remotive',
        url: urls.REMOTE_JOB_APIS.remotive,
        parser: (data) => {
            const jobs = data?.jobs || [];
            return jobs.map(job => ({
                title: job.title || 'No Title',
                company_name: job.company_name || 'Not specified',
                location: job.candidate_required_location || 'Remote',
                description: job.description || '',
                url: job.url || '',
                slug: job.id || `remotive_${Date.now()}`,
                job_type: job.job_type || 'Full-time',
                date: job.publication_date || job.created_at || null,
                source: 'Remotive',
                tags: job.tags || []
            }));
        }
    },
    {
        name: 'Adzuna India',
        url: () => {
            const appId = process.env.ADZUNA_APP_ID || 'test';
            const appKey = process.env.ADZUNA_APP_KEY || 'test';
            return `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=50&what=azure%20cloud%20devops%20security&where=india&max_days_old=30`;
        },
        parser: (data) => {
            const jobs = data?.results || [];
            return jobs.map(job => ({
                title: job.title || 'No Title',
                company_name: job.company?.display_name || 'Not specified',
                location: job.location?.display_name || 'India',
                description: job.description || '',
                url: job.redirect_url || job.url || '',
                slug: job.id || `adzuna_${Date.now()}`,
                job_type: job.contract_time || 'Full-time',
                salary: job.salary_max ? `₹${job.salary_min || 0}-₹${job.salary_max}` : null,
                date: job.created || null,
                source: 'Adzuna India'
            }));
        }
    },
    {
        name: 'JSearch (RapidAPI)',
        url: 'https://jsearch.p.rapidapi.com/search?query=azure%20cloud%20devops%20security%20india&page=1&num_pages=1&date_posted=month',
        parser: (data) => {
            const jobs = data?.data || [];
            return jobs.map(job => ({
                title: job.job_title || 'No Title',
                company_name: job.employer_name || 'Not specified',
                location: job.job_city ? `${job.job_city}, ${job.job_country}` : (job.job_country || 'India'),
                description: job.job_description || '',
                url: job.job_apply_link || job.job_google_link || '',
                slug: job.job_id || `jsearch_${Date.now()}`,
                job_type: job.job_employment_type || 'Full-time',
                salary: job.job_max_salary ? `${job.job_min_salary || 0}-${job.job_max_salary}` : null,
                date: job.job_posted_at_datetime_utc || job.job_posted_at_timestamp || null,
                source: `JSearch (${job.job_publisher || 'Multi-platform'})`
            }));
        },
        headers: () => ({
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        })
    },
    {
        name: 'Adobe India',
        url: 'https://careers.adobe.com/us/en/search-results?location=India',
        parser: () => []
    },
    {
        name: 'GeeksforGeeks Jobs',
        url: 'https://www.geeksforgeeks.org/jobs-api/search?experience=0-2&location=India&limit=50',
        parser: () => []
    },
    {
        name: 'LinkedIn Jobs Entry Level',
        url: 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=entry%20level%20OR%20fresher&location=India&f_E=1,2&start=0&count=50',
        parser: () => []
    }
];

module.exports = { JOB_SOURCES };
