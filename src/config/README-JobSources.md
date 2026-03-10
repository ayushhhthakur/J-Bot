# Job Sources Management Guide

This guide explains how to add new job sources to J-Bot without searching through code.

## Quick Start: Adding a New Job Source

### Option 1: Add a Simple JSON API (Easiest)

**Step 1:** Add the URL to `src/config/jobApiUrls.js`

```javascript
// In the appropriate category, add your URL:
const INDIA_JOB_PORTALS = {
    // ... existing sources
    yourNewSource: 'https://api.yoursite.com/jobs?location=India&limit=50',
};
```

**Step 2:** Add to `src/services/jobSources.js` using the helper

```javascript
const { createSimpleJobSource, urls } = require('../config/jobSourceHelper');

// Add this to the JOB_SOURCES array:
{
    name: 'Your New Job Site',
    url: urls.INDIA_JOB_PORTALS.yourNewSource,
    parser: (data) => {
        try {
            const jobs = data?.jobs || []; // Adjust based on API response
            return jobs.map(job => ({
                title: job.title,
                company_name: job.company,
                location: job.location || 'India',
                description: job.description || '',
                url: job.url,
                slug: job.id || `yournewsite_${Date.now()}`,
                job_type: job.job_type || 'Full-time',
                salary: job.salary || null,
                date: job.posted_date || null,
                source: 'Your New Job Site'
            }));
        } catch (error) {
            return [];
        }
    }
},
```

### Option 2: Use the Quick Template (Even Easier!)

Add to `src/services/jobSources.js`:

```javascript
const { createSimpleJobSource, urls } = require('../config/jobSourceHelper');

// Add this to JOB_SOURCES array:
createSimpleJobSource(
    'Your New Job Site',
    'https://api.yoursite.com/jobs',
    {
        jobsPath: ['jobs'],        // Where jobs are in the JSON response
        titleField: 'title',        // Field name for job title
        companyField: 'company',    // Field name for company
        locationField: 'location',  // Field name for location
        urlField: 'url',            // Field name for job URL
        dateField: 'posted_date',   // Field name for posting date
    }
),
```

## Current Job Sources (44 Total)

### 🌍 Remote & International (6 sources)
- Arbeitnow
- RemoteOK
- JobIcy
- Reddit Jobs
- Remotive
- The Muse

### 🇮🇳 India Job Portals (8 sources)
- Adzuna India
- FindJob.in
- Naukri Freshers
- Monster India
- Shine Fresher Jobs
- Indeed India
- Glassdoor India
- Foundit (Monster)

### 🏢 Major Tech Companies (11 sources)
- Google
- Microsoft
- Amazon
- Oracle
- Adobe
- IBM
- Paytm
- Wipro
- Accenture
- TCS
- Infosys

### 🚀 Startups (6 sources)
- HCL Technologies
- Tech Mahindra
- Cognizant
- Capgemini
- Freshworks
- Wellfound (AngelList)

### 🎓 Internship & Fresher Platforms (8 sources)
- Internshala
- LetsIntern
- Unstop (Dare2Compete)
- FreshersWorld
- Instahyre
- Cutshort
- Hasjob
- Skillenza

### 👨‍💻 Tech Community (3 sources)
- GeeksforGeeks Jobs
- HackerEarth
- StackOverflow Jobs

### 🔑 API Aggregators (2 sources)
- JSearch (RapidAPI)
- LinkedIn Jobs

## File Structure

```
src/
├── config/
│   ├── jobApiUrls.js         ← ADD URLs HERE
│   └── jobSourceHelper.js    ← Helper functions
│
└── services/
    ├── jobSources.js         ← Main configuration
    ├── jobFetcher.js         ← Fetching logic (don't modify)
    └── webScraper.js         ← Web scraping utilities
```

## Examples

### Example 1: Adding a New Portal
```javascript
// 1. Add to jobApiUrls.js
const INDIA_JOB_PORTALS = {
    newPortal: 'https://newportal.com/api/jobs?country=IN',
};

// 2. Add to jobSources.js
{
    name: 'New Portal',
    url: 'https://newportal.com/api/jobs?country=IN',
    parser: (data) => {
        const jobs = data?.jobs || [];
        return jobs.map(job => ({ /* map fields */ }));
    }
}
```

### Example 2: API Requiring Authentication
```javascript
{
    name: 'Protected API',
    url: 'https://api.protected.com/jobs',
    parser: (data) => { /* parser logic */ },
    headers: () => ({
        'Authorization': `Bearer ${process.env.YOUR_API_KEY}`,
        'Content-Type': 'application/json'
    })
}
```

### Example 3: Company with Web Scraping
```javascript
// Add scraper function in webScraper.js, then:
{
    name: 'Company Name',
    url: async () => await scraper.scrapeCompanyJobs(),
    parser: (data) => Array.isArray(data) ? data : []
}
```

## API Response Format

Your parser should return jobs in this format:

```javascript
{
    title: 'Job Title',              // Required
    company_name: 'Company Name',    // Required
    location: 'City, State/Country', // Required
    description: 'Job description',  // Required
    url: 'https://apply-url.com',   // Required
    slug: 'unique-job-id',          // Required
    job_type: 'Full-time',          // Optional
    salary: '₹5-10 LPA',            // Optional
    date: '2026-03-11T00:00:00Z',  // Optional (ISO format)
    source: 'Source Name'           // Required
}
```

## Testing New Sources

After adding a new source, test it:

```powershell
# Start the bot
npm start

# Check logs for your new source:
# ✅ Fetched X jobs from Your New Source
# ⚠️ Failed to fetch from Your New Source: [error]
```

## Troubleshooting

**No jobs returned?**
- Check if the API requires authentication
- Verify the URL is correct
- Check the `jobsPath` matches the API response structure
- Look at the API response in browser/Postman

**API returns errors?**
- Check if API key is required (add to `.env`)
- Verify headers are correct
- Check rate limiting

**Wrong data format?**
- Update field mappings in parser
- Check console logs for actual API response structure

## Need Help?

1. Check `jobSourceHelper.js` for templates
2. Look at existing sources in `jobSources.js` for examples
3. Test API endpoints in browser/Postman first
4. Check console logs for detailed error messages
