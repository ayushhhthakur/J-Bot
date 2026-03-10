/**
 * QUICK ADD TEMPLATE FOR NEW JOB SOURCES
 * ========================================
 * 
 * Copy one of these templates and paste into src/services/jobSources.js
 * inside the JOB_SOURCES array
 */

// ============================================================================
// TEMPLATE 1: SIMPLE JSON API
// ============================================================================
// Use this when the API returns a straightforward JSON with job listings

{
    name: 'Your Job Board Name',
    url: 'https://api.yoursite.com/jobs?location=India&limit=50',
    parser: (data) => {
        try {
            const jobs = data?.jobs || [];  // Adjust 'jobs' to match API response
            return jobs.map(job => ({
                title: job.title,
                company_name: job.company || job.company_name,
                location: job.location || 'India',
                description: job.description || '',
                url: job.url || job.apply_url,
                slug: job.id || `yoursite_${Date.now()}`,
                job_type: job.job_type || 'Full-time',
                salary: job.salary || null,
                date: job.posted_date || job.created_at || null,
                source: 'Your Job Board Name'
            }));
        } catch (error) {
            return [];
        }
    }
},

// ============================================================================
// TEMPLATE 2: API WITH AUTHENTICATION
// ============================================================================
// Use this when the API requires an API key or bearer token

{
    name: 'Protected Job API',
    url: 'https://api.protected.com/jobs?country=IN',
    parser: (data) => {
        try {
            const jobs = data?.results || [];
            return jobs.map(job => ({
                title: job.title,
                company_name: job.company,
                location: job.location || 'India',
                description: job.description,
                url: job.apply_link,
                slug: job.id,
                job_type: job.type || 'Full-time',
                salary: job.salary,
                date: job.posted_at,
                source: 'Protected Job API'
            }));
        } catch (error) {
            return [];
        }
    },
    headers: () => ({
        'Authorization': `Bearer ${process.env.YOUR_API_KEY}`,
        'Content-Type': 'application/json'
    })
},

// ============================================================================
// TEMPLATE 3: DYNAMIC URL (with parameters from env)
// ============================================================================
// Use this when the URL needs environment variables or computed values

{
    name: 'Dynamic API',
    url: () => {
        const apiKey = process.env.YOUR_API_KEY || 'demo';
        const location = 'India';
        return `https://api.example.com/jobs?key=${apiKey}&location=${location}`;
    },
    parser: (data) => {
        try {
            const jobs = data?.data?.jobs || [];
            return jobs.map(job => ({
                title: job.title,
                company_name: job.company,
                location: job.location || 'India',
                description: job.description,
                url: job.url,
                slug: job.id,
                job_type: job.employment_type,
                salary: job.salary_range,
                date: job.posted_date,
                source: 'Dynamic API'
            }));
        } catch (error) {
            return [];
        }
    }
},

// ============================================================================
// TEMPLATE 4: USING THE HELPER FUNCTION
// ============================================================================
// Use this for the quickest setup with minimal code

createSimpleJobSource(
    'Quick Job Board',
    'https://api.quickjobs.com/listings',
    {
        jobsPath: ['jobs'],           // Where the jobs array is in the response
        titleField: 'title',           // Field name for title
        companyField: 'company',       // Field name for company
        locationField: 'location',     // Field name for location
        urlField: 'apply_url',         // Field name for URL
        dateField: 'posted_date',      // Field name for date
        baseUrl: 'https://quickjobs.com/job'  // Base URL if needed
    }
),

// ============================================================================
// TEMPLATE 5: WEB SCRAPER (for non-API sites)
// ============================================================================
// Use this when you need to scrape HTML instead of calling an API
// First, add the scraper function to src/services/webScraper.js

{
    name: 'Company Careers Page',
    url: async () => await scraper.scrapeCompanyName(),  // Add this function to webScraper.js
    parser: (data) => {
        // Data is already parsed by scraper
        return Array.isArray(data) ? data : [];
    }
},

// ============================================================================
// TEMPLATE 6: COMPLEX NESTED DATA
// ============================================================================
// Use this when the API returns deeply nested JSON

{
    name: 'Complex API',
    url: 'https://api.complex.com/v2/jobs',
    parser: (data) => {
        try {
            // Navigate nested structure
            const jobs = data?.response?.data?.items?.jobs || [];
            
            return jobs.map(job => ({
                title: job.jobDetail?.title || job.title,
                company_name: job.employer?.name || 'Not specified',
                location: job.location?.city || job.location?.country || 'India',
                description: job.details?.description || '',
                url: job.links?.apply || job.url,
                slug: job.id || job.jobId,
                job_type: job.employment?.type || 'Full-time',
                salary: job.compensation?.range || null,
                date: job.metadata?.postedDate || null,
                source: 'Complex API'
            }));
        } catch (error) {
            return [];
        }
    }
},

// ============================================================================
// STEPS TO ADD:
// ============================================================================
// 
// 1. Copy the appropriate template above
// 2. Replace placeholder values with actual API details
// 3. Add the URL to src/config/jobApiUrls.js (optional, for organization)
// 4. Paste into JOB_SOURCES array in src/services/jobSources.js
// 5. Test: npm start
// 6. Check console logs for: "✅ Fetched X jobs from Your Source Name"
// 
// ============================================================================

// FIELD MAPPING REFERENCE:
// ========================
// 
// Required Fields:
// - title: Job title/position name
// - company_name: Company/employer name  
// - location: Job location (city, country, or 'Remote')
// - description: Job description or summary
// - url: Link to apply or view full details
// - slug: Unique identifier for deduplication
// - source: Name of the job source
//
// Optional Fields:
// - job_type: 'Full-time', 'Part-time', 'Internship', etc.
// - salary: Salary range or amount
// - date: Posting date (ISO format preferred)
// - tags: Array of tags/skills
//
// ============================================================================
