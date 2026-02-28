/**
 * J-Bot - Intelligent Job Alert Bot for Telegram
 * 
 * Azure Function that automatically searches for entry-level Azure/Cloud/Security jobs
 * in India from multiple sources and sends intelligent Telegram notifications.
 * 
 * @module jobChecker
 * @description Timer-triggered function (runs daily at 10:00 AM IST) that:
 *   - Fetches jobs from 11 sources (Arbeitnow, RemoteOK, JobIcy, Reddit, Remotive, Indeed, FindJob.in, LinkedIn, GitHub, Wellfound, Glassdoor)
 *   - Filters for pure technical roles only (no support/sales)
 *   - Targets entry-level positions with 0-2 years of experience
 *   - Accepts Remote, On-site, and Hybrid job types
 *   - Focuses on India locations (Bangalore, Pune, Gurgaon, Delhi NCR, Hyderabad, Jaipur, Noida)
 *   - Targets companies: Paytm, Wipro, Qualcomm, Stripe, Razorpay, Chevron & 100+ more
 *   - Prevents duplicates using Azure Table Storage
 *   - Sends formatted alerts to Telegram (max 6 per run)
 *   - Sends "No matches" notification when no jobs found
 * 
 * @author J-Bot Contributors
 * @license MIT
 * @version 1.1.0
 */

const { app } = require('@azure/functions');
const axios = require('axios');
const { TableClient } = require('@azure/data-tables');
const crypto = require('crypto');

// Configuration
const JOB_SOURCES = [
    {
        name: 'Arbeitnow',
        url: 'https://www.arbeitnow.com/api/job-board-api',
        parser: (data) => {
            const jobs = data.data || [];
            return jobs.map(job => ({
                ...job,
                date: job.created_at || job.date || null
            }));
        }
    },
    {
        name: 'RemoteOK',
        url: 'https://remoteok.com/api',
        parser: (data) => {
            // RemoteOK returns array directly, first item is metadata
            const jobs = Array.isArray(data) ? data.slice(1) : [];
            // Normalize RemoteOK data format
            return jobs.map(job => ({
                title: job.position,
                company_name: job.company,
                location: job.location || 'Remote',
                description: job.description || '',
                url: job.url || `https://remoteok.com/remote-jobs/${job.id}`,
                slug: job.id || job.slug,
                tags: job.tags || [],
                job_type: job.type || '',
                salary: job.salary_max ? `$${job.salary_min || 0}-$${job.salary_max}` : null,
                date: job.date || job.epoch || null,
                source: 'RemoteOK'
            }));
        }
    },
    {
        name: 'JobIcy',
        url: 'https://jobicy.com/api/v2/remote-jobs',
        parser: (data) => {
            const jobs = data.jobs || [];
            return jobs.map(job => ({
                title: job.jobTitle,
                company_name: job.companyName,
                location: job.jobGeo || 'Remote',
                description: job.jobExcerpt || '',
                url: job.url,
                slug: job.id,
                job_type: job.jobType || '',
                date: job.jobPosted || job.pubDate || null,
                source: 'JobIcy'
            }));
        }
    },
    {
        name: 'Reddit Jobs',
        url: 'https://www.reddit.com/r/forhire+devopsjobs+jobsinindia+indiajobs+cscareerquestionsIndia.json?limit=100',
        parser: (data) => {
            const posts = data?.data?.children || [];

            // Patterns that indicate someone IS hiring (company/recruiter posting)
            const HIRING_PATTERNS = [
                /^\[hiring\]/i,           // [Hiring] prefix — standard on r/forhire
                /^hiring:/i,               // "Hiring: DevOps Engineer"
                /we are hiring/i,
                /we'?re hiring/i,
                /join our team/i,
                /looking to hire/i,
                /open position/i,
                /job opening/i,
                /\breferral\b/i,          // referral posts from employees
            ];

            // Patterns that indicate someone is LOOKING for work — must be rejected
            const FOR_HIRE_PATTERNS = [
                /^\[for hire\]/i,         // [For Hire] prefix
                /^for hire:/i,
                /\bavailable for\b/i,
                /looking for.*internship/i,
                /seeking.*role/i,
                /seeking.*position/i,
                /open to.*opportunity/i,
                /actively looking/i,
                /\bi am looking\b/i,
                /\bI\'m looking\b/i,
            ];

            return posts
                .filter(post => {
                    const title = post.data.title;
                    const text = post.data.selftext || '';
                    const flair = (post.data.link_flair_text || '').toLowerCase();

                    // Reject if flair says "for hire" or "available"
                    if (flair.includes('for hire') || flair.includes('available')) return false;

                    // Reject if title/text matches FOR_HIRE patterns
                    if (FOR_HIRE_PATTERNS.some(p => p.test(title) || p.test(text.slice(0, 300)))) return false;

                    // Accept if title matches HIRING patterns
                    if (HIRING_PATTERNS.some(p => p.test(title))) return true;

                    // Accept if body clearly says they are offering a job
                    const bodyLower = text.slice(0, 500).toLowerCase();
                    if (bodyLower.includes('we are looking for') || 
                        bodyLower.includes('you will be responsible') ||
                        bodyLower.includes('responsibilities include') ||
                        bodyLower.includes('what you will do') ||
                        bodyLower.includes('apply now') ||
                        bodyLower.includes('send your resume') ||
                        bodyLower.includes('dm your resume')) return true;

                    return false;
                })
                .map(post => ({
                    title: post.data.title.replace(/^\[hiring\]/gi, '').trim(),
                    company_name: 'Via Reddit',
                    location: 'Check post for details',
                    description: post.data.selftext || post.data.title,
                    url: `https://reddit.com${post.data.permalink}`,
                    slug: post.data.id,
                    job_type: post.data.link_flair_text || 'See post',
                    date: post.data.created_utc || null,
                    source: `Reddit r/${post.data.subreddit}`
                }));
        }
    },
    {
        name: 'Remotive',
        url: 'https://remotive.com/api/remote-jobs',
        parser: (data) => {
            const jobs = data.jobs || [];
            return jobs.map(job => ({
                title: job.title,
                company_name: job.company_name,
                location: job.candidate_required_location || 'Remote',
                description: job.description || '',
                url: job.url,
                slug: job.id,
                job_type: job.job_type || 'Full-time',
                salary: job.salary || null,
                tags: job.tags || [],
                date: job.publication_date || job.created_at || null,
                source: 'Remotive'
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
            try {
                const jobs = data?.results || [];
                return jobs.map(job => ({
                    title: job.title,
                    company_name: job.company?.display_name || 'Not specified',
                    location: job.location?.display_name || 'India',
                    description: job.description || '',
                    url: job.redirect_url || job.url || '',
                    slug: job.id,
                    job_type: job.contract_time || 'Full-time',
                    salary: job.salary_max ? `₹${job.salary_min || 0}-₹${job.salary_max}` : null,
                    date: job.created || null,
                    source: 'Adzuna India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'JSearch (RapidAPI)',
        url: 'https://jsearch.p.rapidapi.com/search?query=azure%20cloud%20devops%20security%20india&page=1&num_pages=1&date_posted=month',
        parser: (data) => {
            try {
                const jobs = data?.data || [];
                return jobs.map(job => ({
                    title: job.job_title,
                    company_name: job.employer_name || 'Not specified',
                    location: job.job_city ? `${job.job_city}, ${job.job_country}` : (job.job_country || 'India'),
                    description: job.job_description || '',
                    url: job.job_apply_link || job.job_google_link || '',
                    slug: job.job_id,
                    job_type: job.job_employment_type || 'Full-time',
                    salary: job.job_max_salary ? `${job.job_min_salary || 0}-${job.job_max_salary}` : null,
                    date: job.job_posted_at_datetime_utc || job.job_posted_at_timestamp || null,
                    source: `JSearch (${job.job_publisher || 'Multi-platform'})`
                }));
            } catch (error) {
                return [];
            }
        },
        headers: () => ({
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        })
    },
    {
        name: 'The Muse',
        url: 'https://www.themuse.com/api/public/jobs?page=1&descending=true&level=Entry%20Level&level=Internship&category=Software%20Engineering&category=Data%20Science&category=IT',
        parser: (data) => {
            try {
                const jobs = data?.results || [];
                return jobs.map(job => ({
                    title: job.name,
                    company_name: job.company?.name || 'Not specified',
                    location: job.locations?.[0]?.name || 'Remote',
                    description: job.contents || '',
                    url: job.refs?.landing_page || `https://www.themuse.com/jobs/${job.id}`,
                    slug: job.id,
                    job_type: job.type || 'Full-time',
                    salary: null,
                    date: job.publication_date || null,
                    source: 'The Muse'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'FindJob.in',
        url: 'https://findjob.in/api/jobs?category=it-software&location=india&limit=50',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.job_title,
                    company_name: job.company || job.company_name || 'Not specified',
                    location: job.location || 'India',
                    description: job.description || job.job_description || '',
                    url: job.url || job.job_url || `https://findjob.in/job/${job.id}`,
                    slug: job.id || `findjob_${Date.now()}`,
                    job_type: job.job_type || 'Full-time',
                    date: job.posted_date || job.created_at || null,
                    source: 'FindJob.in'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Wellfound (AngelList)',
        url: 'https://api.wellfound.com/jobs?location=India&role=Software%20Engineer',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title,
                    company_name: job.startup?.name || 'Startup',
                    location: job.location_name || 'India',
                    description: job.description || '',
                    url: job.url || `https://wellfound.com/jobs/${job.id}`,
                    slug: job.id,
                    job_type: job.job_type || 'Full-time',
                    salary: job.salary_range || null,
                    date: job.created_at || job.posted_at || null,
                    source: 'Wellfound (AngelList)'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Freshteam (Freshworks)',
        url: 'https://freshteam.com/api/job_postings?status=published',
        parser: (data) => {
            try {
                const jobs = Array.isArray(data) ? data : [];
                return jobs
                    .filter(job => {
                        // Filter for India-based or remote technical roles
                        const location = (job.location || '').toLowerCase();
                        const title = (job.title || '').toLowerCase();
                        return (location.includes('india') || location.includes('remote')) &&
                               (title.includes('engineer') || title.includes('developer') || 
                                title.includes('devops') || title.includes('technical'));
                    })
                    .map(job => ({
                        title: job.title,
                        company_name: job.company_name || 'Freshworks',
                        location: job.location || 'India',
                        description: job.description || job.job_description || '',
                        url: job.job_url || job.hosted_url || '',
                        slug: job.id,
                        job_type: job.job_type || 'Full-time',
                        salary: null,
                        date: job.created_at || job.posted_at || null,
                        source: 'Freshteam (Freshworks)'
                    }));
            } catch (error) {
                return [];
            }
        }
    }
];

// Time window configuration
const TIME_WINDOWS = {
    DAY: 1,
    WEEK: 7,
    MONTH: 30
};

const TABLE_NAME = 'jobalerts';
const TABLE_META = 'jobmetadata';
const PARTITION_KEY = 'jobs';
const MAX_JOBS = 6;
const MAX_SCAN_LIMIT = 500; // Stop scanning after this limit to reduce execution time

// Keyword filters
// What you actually want: Cloud/Infra/Security roles, minimal coding
// 'Cloud' alone is too broad — a "Cloud Sales" role matches. Use specific combos.
const INCLUDE_KEYWORDS = [
    // Azure ecosystem (your primary target)
    'Azure', 'Microsoft Azure', 'Azure DevOps', 'Azure Cloud',
    // Other cloud platforms (valid for cloud engineer roles)
    'AWS', 'GCP', 'Google Cloud', 'Multi-cloud', 'Cloud Engineer',
    'Cloud Administrator', 'Cloud Architect', 'Cloud Operations',
    'Cloud Infrastructure', 'Cloud Platform',
    // Security (ops-focused, not coding-heavy)
    'Security', 'Cybersecurity', 'DevSecOps', 'AppSec', 'InfoSec',
    'SOC', 'VAPT', 'Ethical Hacking', 'Penetration Testing',
    // Infrastructure / DevOps (automation with Python/Shell, not DSA)
    'DevOps', 'Kubernetes', 'Docker', 'Terraform', 'Ansible',
    'Infrastructure', 'Site Reliability', 'Platform Engineering',
    // Networking (relevant for cloud roles)
    'Network Engineer', 'Network Security', 'Network Infrastructure',
];

// Entry-level keywords (accepting 0-2 years of experience)
const ENTRY_LEVEL_KEYWORDS = [
    'Intern', 'Internship', 'Junior', 'Entry', 'Fresher', 'Graduate', 
    '0-1 year', '0 year', '1 year', '1-2 year', '1-2 years', '0-2 year', '0-2 years',
    'Entry Level', 'Entry-Level'
];

// Exclude positions requiring 3+ years or senior roles
const EXCLUDE_KEYWORDS = ['3+ years', '4+ years', '5+ years', '6+ years', 'Senior', 'Lead', 'Manager', 'Architect', 'Principal'];

// Accepted job types (Remote, On-site, Hybrid) - all are accepted
const ACCEPTED_JOB_TYPES = ['Remote', 'Hybrid', 'On-site', 'Onsite', 'On site', 'Office', 'WFH', 'Work from home'];
// Note: We accept all job types (Remote/Hybrid/On-site), this is just for reference

// Non-technical role exclusions - MUST NOT contain these
const NON_TECHNICAL_KEYWORDS = [
    // Help desk / L1 support (not cloud infra)
    'Help Desk', 'Helpdesk', 'L1 Support', 'L2 Support',
    'Desktop Support', 'Service Desk',
    'Customer Support', 'Customer Service', 'Client Support',
    // Sales & Marketing
    'Sales Executive', 'Business Development', 'BDM', 'BDE',
    'Account Manager', 'Relationship Manager', 'Customer Success',
    'Pre-Sales', 'Presales', 'Social Media',
    // Admin / non-tech
    'Data Entry', 'Back Office', 'Content Creator', 'Community Manager',
    // HR / People
    'Recruiter', 'HR Executive', 'Human Resources',
    // Non-technical testing
    'Manual Testing',
    // Coding/DSA-heavy roles you want to avoid
    'Software Developer', 'Software Engineer', 'Backend Developer',
    'Frontend Developer', 'Full Stack Developer', 'Programmer',
    'Mobile Developer', 'Android Developer', 'iOS Developer',
    'Machine Learning Engineer', 'Data Scientist', 'AI Engineer',
    'Buchhalter', 'Controller',   // caught German accounting roles this run
];

// Pure technical role indicators - MUST contain at least one
// Tuned for Cloud/Infra/Security roles where coding is minimal (Python/Shell for automation only)
// Deliberately excludes pure Software Developer/Programmer to avoid DSA-heavy roles
const PURE_TECHNICAL_KEYWORDS = [
    // Cloud-specific roles (your primary target)
    'Cloud Engineer', 'Cloud Administrator', 'Cloud Architect', 'Cloud Consultant',
    'Cloud Operations', 'Cloud Support Engineer', 'Cloud Analyst',
    'Solutions Architect', 'Infrastructure Engineer', 'Infrastructure Analyst',
    // Azure-specific titles
    'Azure Engineer', 'Azure Administrator', 'Azure Architect', 'Azure Consultant',
    // DevOps / Platform / SRE (automation-focused, not DSA)
    'DevOps Engineer', 'DevOps Analyst', 'Platform Engineer',
    'Site Reliability Engineer', 'Systems Engineer', 'Systems Administrator',
    'Network Administrator', 'Network Engineer',
    // Security roles (ops-focused)
    'Security Engineer', 'Security Analyst', 'Cybersecurity Engineer', 'DevSecOps Engineer',
    'SOC Analyst', 'Vulnerability Analyst', 'Security Operations',
    'Penetration Tester', 'InfoSec', 'AppSec',
    // Indian fresher titles for cloud/infra roles
    'Graduate Engineer Trainee', 'Associate Engineer', 'Trainee Engineer',
    'Technology Analyst',   // Infosys fresher title
    'Cloud Associate', 'Infrastructure Associate',
];

// Location filters - India only
const INDIA_KEYWORDS = ['India', 'Bharat', ', IN', '(IN)', 'Indian'];
// DO NOT add 'Remote' here — European jobs also say 'Remote' and will sneak through
// Remote is handled separately in isIndiaLocation only when source is Indian
const PREFERRED_CITIES = [
    'Bangalore', 'Bengaluru',
    'Pune',
    'Gurgaon', 'Gurugram',
    'Delhi', 'NCR', 'Delhi NCR', 'New Delhi',
    'Hyderabad',
    'Jaipur',
    'Noida',
    'Mumbai', 'Bombay',
    'Chennai', 'Madras',
    'Kolkata',
    'Ahmedabad',
    'Coimbatore',
    'Trivandrum', 'Thiruvananthapuram',
    'Kochi', 'Cochin',
    'Indore',
    'Chandigarh',
    'Anywhere in India', 'PAN India', 'Pan India',
];

// Companies known to hire freshers for Cloud/Security roles in India
const FRESHER_FRIENDLY_COMPANIES = [
    // Big Tech
    'Microsoft', 'Google', 'Amazon', 'AWS', 'IBM', 'Oracle', 'SAP', 'Adobe', 'Apple', 'Meta', 'Facebook',
    // Indian IT Giants
    'TCS', 'Tata Consultancy', 'Infosys', 'Wipro', 'HCL', 'Tech Mahindra', 'LTI', 'LTIMindtree', 'Mindtree',
    'Cognizant', 'Mphasis', 'Hexaware', 'Persistent', 'Coforge',
    // Global Consulting/IT
    'Accenture', 'Deloitte', 'Capgemini', 'EY', 'PwC', 'KPMG', 'Genpact', 'DXC Technology',
    // Cloud & DevOps Companies
    'Cloudflare', 'Atlassian', 'HashiCorp', 'Red Hat', 'VMware', 'Nutanix', 'Cisco',
    // Cybersecurity Companies
    'Palo Alto Networks', 'CrowdStrike', 'Fortinet', 'Zscaler', 'McAfee', 'Symantec', 'Check Point',
    'Rapid7', 'Qualys', 'Trend Micro',
    // Indian Tech Companies/Startups
    'Zoho', 'Freshworks', 'PayTM', 'Paytm', 'PhonePe', 'Razorpay', 'Zomato', 'Swiggy', 'Flipkart', 'Ola',
    'MakeMyTrip', 'BookMyShow', 'Nykaa', 'CRED', 'Udaan', 'Meesho', 'Dunzo', 'Urban Company',
    // E-commerce & Retail
    'Walmart', 'Target', 'Myntra', 'Shopify', 'Amazon India',
    // Financial Services
    'JP Morgan', 'Goldman Sachs', 'Morgan Stanley', 'Barclays', 'HSBC', 'Mastercard', 'Visa',
    'American Express', 'Deutsche Bank', 'Paytm Payments Bank', 'ICICI Bank', 'HDFC Bank',
    // Product Companies
    'Salesforce', 'ServiceNow', 'Workday', 'Intuit', 'PayPal', 'Stripe', 'Square', 'Qualcomm',
    'Intel', 'AMD', 'NVIDIA', 'Broadcom', 'Texas Instruments',
    // Energy & Engineering
    'Chevron', 'Shell', 'BP', 'ExxonMobil', 'Schlumberger', 'Halliburton',
    // Telecom
    'Jio', 'Reliance Jio', 'Airtel', 'Vodafone', 'Nokia', 'Ericsson',
    // Consulting & Services
    'Boston Consulting', 'BCG', 'McKinsey', 'Bain', 'Booz Allen'
];

/**
 * Generate stable hash-based ID for jobs (replaces random slugs)
 */
function generateStableId(job) {
    const uniqueString = (job.url || '') + (job.title || '') + (job.company_name || '');
    return crypto.createHash('sha256').update(uniqueString).digest('hex');
}

/**
 * Check if job date is within specified time window
 * @param {string|number|Date} jobDate - Job posting date (ISO string, Unix timestamp, or Date)
 * @param {number} days - Number of days to check within
 * @returns {boolean} - True if within time window
 */
function isWithinTimeWindow(jobDate, days) {
    if (!jobDate) {
        // If no date provided, include it (safer to show than miss)
        return true;
    }
    
    try {
        let date;
        
        // Handle Unix timestamp (in seconds or milliseconds)
        if (typeof jobDate === 'number') {
            // If timestamp is in seconds (< year 2100 in milliseconds)
            date = jobDate < 10000000000 ? new Date(jobDate * 1000) : new Date(jobDate);
        }
        // Handle ISO string or Date object
        else {
            date = new Date(jobDate);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return true; // Include if date is invalid (safer to show)
        }
        
        const now = new Date();
        const diffTime = now - date;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        return diffDays <= days && diffDays >= 0;
    } catch (error) {
        // On any error, include the job (safer to show than miss)
        return true;
    }
}

/**
 * Get configured time window from environment or use default
 * @returns {number} - Number of days for time window
 */
function getTimeWindow() {
    const windowConfig = process.env.JOB_WINDOW || 'MONTH';
    return TIME_WINDOWS[windowConfig] || TIME_WINDOWS.MONTH;
}

/**
 * Check if text contains any of the keywords (case-insensitive).
 * Short acronyms (SOC, SRE, AWS, GCP) use word boundaries to avoid
 * false matches inside other words (e.g. "SOCial", "SREet", "buchhalter").
 */
function containsKeyword(text, keywords) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        // Use word boundary for short acronyms (<=4 chars) to avoid substring false positives
        if (lowerKeyword.length <= 4) {
            const regex = new RegExp(`\\b${lowerKeyword}\\b`);
            return regex.test(lowerText);
        }
        return lowerText.includes(lowerKeyword);
    });
}

/**
 * Check if job location is in India.
 * Handles tricky cases: "Remote" alone passes for Indian sources,
 * but NOT if the location also mentions a non-Indian country.
 */
function isIndiaLocation(job) {
    const location = job.location || '';

    if (!location) return false;

    // Reddit posts need manual check later
    if (location.includes('Check post')) return true;

    const lowerLocation = location.toLowerCase();

    // Immediately reject if a known non-Indian country/city is in the location
    const foreignIndicators = [
        'germany', 'berlin', 'munich', 'frankfurt', 'hamburg', 'dortmund',
        'united states', 'usa', 'u.s.', 'new york', 'san francisco', 'seattle',
        'united kingdom', 'london', 'uk ', ' uk,',
        'canada', 'toronto', 'vancouver',
        'australia', 'sydney', 'melbourne',
        'singapore', 'netherlands', 'france', 'paris',
        'europe', 'european union',
    ];
    if (foreignIndicators.some(f => lowerLocation.includes(f))) return false;

    // Check for India keywords
    const isIndia = INDIA_KEYWORDS.some(kw => lowerLocation.includes(kw.toLowerCase()));

    // Check for Indian cities
    const isPreferredCity = PREFERRED_CITIES.some(city =>
        lowerLocation.includes(city.toLowerCase())
    );

    // Allow "Remote" or "Work from Home" ONLY if no foreign country detected (already checked above)
    const isRemoteAcceptable = ['remote', 'work from home', 'wfh', 'anywhere'].some(r =>
        lowerLocation.includes(r)
    );

    return isIndia || isPreferredCity || isRemoteAcceptable;
}

/**
 * Check if company is known to hire freshers
 */
function isFresherFriendlyCompany(job) {
    const companyName = job.company_name || '';
    
    if (!companyName) {
        return false;
    }
    
    const lowerCompany = companyName.toLowerCase();
    
    return FRESHER_FRIENDLY_COMPANIES.some(company => 
        lowerCompany.includes(company.toLowerCase())
    );
}

/**
 * Calculate days since job was posted
 * @param {string|number|Date} jobDate - Job posting date
 * @returns {number} - Days since posting (or Infinity if no date)
 */
function getDaysSince(jobDate) {
    if (!jobDate) {
        return Infinity; // No date = treat as old
    }
    
    try {
        let date;
        
        // Handle Unix timestamp (in seconds or milliseconds)
        if (typeof jobDate === 'number') {
            date = jobDate < 10000000000 ? new Date(jobDate * 1000) : new Date(jobDate);
        } else {
            date = new Date(jobDate);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return Infinity;
        }
        
        const now = new Date();
        const diffTime = now - date;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        return Math.max(0, diffDays); // Return 0 if future date
    } catch (error) {
        return Infinity;
    }
}

/**
 * Calculate relevance score for a job (0-150+ points)
 * Higher score = more relevant for entry-level candidates
 * 
 * @param {Object} job - Job object
 * @returns {number} - Relevance score
 */
function scoreJob(job) {
    let score = 0;
    const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();

    // Keyword weights (primary relevance indicators)
    if (text.includes('azure')) score += 30;
    if (text.includes('cloud')) score += 20;
    if (text.includes('security')) score += 20;
    if (text.includes('devsecops')) score += 25;
    if (text.includes('devops')) score += 15;
    if (text.includes('cybersecurity')) score += 20;

    // Fresher indicators (high value for target audience)
    if (text.includes('fresher') || text.includes('intern')) score += 20;
    if (text.includes('0-1') || text.includes('entry level') || text.includes('entry-level')) score += 15;
    if (text.includes('graduate') || text.includes('internship')) score += 15;

    // Known company bonus (higher hire likelihood)
    if (isFresherFriendlyCompany(job)) score += 15;

    // Recency bonus (newer jobs = better response rate)
    const daysSincePost = getDaysSince(job.date);
    if (daysSincePost <= 1) score += 20;
    else if (daysSincePost <= 3) score += 10;
    else if (daysSincePost <= 7) score += 5;

    // Salary disclosed bonus (transparency indicator)
    if (job.salary && job.salary !== 'Not disclosed') score += 10;

    // Location bonus (preferred cities get boost)
    const location = (job.location || '').toLowerCase();
    if (location.includes('bangalore') || location.includes('bengaluru')) score += 5;
    if (location.includes('pune') || location.includes('hyderabad')) score += 5;
    if (location.includes('remote')) score += 8;

    // Job type bonus
    if (job.job_type && job.job_type.toLowerCase().includes('full-time')) score += 5;

    return score;
}

/**
 * Intelligent job filtering with detailed matching logic
 */
function filterJob(job) {
    const title = job.title || '';
    const description = job.description || '';
    const combinedText = `${title} ${description}`;
    
    // Special handling for Reddit posts (community referrals/hiring posts)
    const isRedditPost = job.source && job.source.includes('Reddit');

    // For regular job boards, check location and company
    if (!isRedditPost) {
        // Check location first (India only)
        if (!isIndiaLocation(job)) {
            return { match: false, reason: 'Location not in India or preferred cities' };
        }

        // Check if company hires freshers (relaxed - if company name exists but not in list, still allow if other criteria match)
        const isKnownCompany = isFresherFriendlyCompany(job);
        const hasCompanyName = job.company_name && job.company_name.trim() !== '' && job.company_name !== 'Not specified';
        
        // Skip company check if company name is missing or generic
        if (hasCompanyName && !isKnownCompany) {
            // Allow unknown companies but log it for review
            // Skip this check to be more lenient
        }
    } else {
        // For Reddit posts, check if post mentions India/Indian cities
        const mentionsIndia = containsKeyword(combinedText, INDIA_KEYWORDS) || 
                             containsKeyword(combinedText, PREFERRED_CITIES);
        if (!mentionsIndia) {
            return { match: false, reason: 'Reddit post does not mention India' };
        }
    }

    // Check exclusion criteria first (performance optimization)
    if (containsKeyword(combinedText, EXCLUDE_KEYWORDS)) {
        return { match: false, reason: 'Excluded due to senior/experience requirement' };
    }

    // CRITICAL: Exclude non-technical/support roles
    if (containsKeyword(combinedText, NON_TECHNICAL_KEYWORDS)) {
        return { match: false, reason: 'Non-technical or support role (excluded)' };
    }

    // CRITICAL: Must be a pure technical role
    const isPureTechnical = containsKeyword(combinedText, PURE_TECHNICAL_KEYWORDS);
    if (!isPureTechnical) {
        return { match: false, reason: 'Not a pure technical role' };
    }

    // Check if job contains required keywords
    const hasRequiredKeyword = containsKeyword(combinedText, INCLUDE_KEYWORDS);
    if (!hasRequiredKeyword) {
        return { match: false, reason: 'Does not contain required keywords' };
    }

    // Check if job is entry level (0-2 years experience)
    const isEntryLevel = containsKeyword(combinedText, ENTRY_LEVEL_KEYWORDS);
    
    // Check experience years mentioned
    const yearsMatch = combinedText.match(/(\d+)\s*\+?\s*years?/gi);
    let hasAcceptableExperience = true;
    
    if (yearsMatch) {
        // Extract all year mentions and check if any exceed 2 years
        const years = yearsMatch.map(match => parseInt(match.match(/(\d+)/)[1]));
        const maxYears = Math.max(...years);
        
        if (maxYears > 2) {
            hasAcceptableExperience = false;
        }
    }
    
    // Accept if: explicitly entry level OR no experience mentioned OR up to 2 years
    const noExperienceMentioned = !combinedText.match(/\d+\s*\+?\s*years?/i);
    
    if (!isEntryLevel && !noExperienceMentioned && !hasAcceptableExperience) {
        return { match: false, reason: 'Requires more than 2 years experience' };
    }

    // Find which keyword matched
    const matchedKeyword = INCLUDE_KEYWORDS.find(keyword => 
        combinedText.toLowerCase().includes(keyword.toLowerCase())
    );

    return { match: true, matchedKeyword };
}

/**
 * Fetch jobs from multiple APIs with error handling
 */
async function fetchJobs(context) {
    const allJobs = [];
    
    for (const source of JOB_SOURCES) {
        try {
            context.log(`📡 Fetching jobs from ${source.name}...`);
            
            // Handle URL as function or string
            const url = typeof source.url === 'function' ? source.url() : source.url;
            
            // Build headers - merge custom headers with defaults
            const defaultHeaders = { 'User-Agent': 'JobAlertBot/1.0' };
            const customHeaders = source.headers ? (typeof source.headers === 'function' ? source.headers() : source.headers) : {};
            const headers = { ...defaultHeaders, ...customHeaders };
            
            const response = await axios.get(url, {
                timeout: 15000,
                headers
            });

            const jobs = source.parser(response.data);
            
            // Add source to each job if not already set
            const jobsWithSource = jobs.map(job => ({
                ...job,
                source: job.source || source.name
            }));
            
            context.log(`✅ Fetched ${jobsWithSource.length} jobs from ${source.name}`);
            allJobs.push(...jobsWithSource);
            
        } catch (error) {
            context.warn(`⚠️ Failed to fetch from ${source.name}: ${error.message}`);
            // Continue with other sources even if one fails
        }
    }
    
    context.log(`📊 Total jobs fetched from all sources: ${allJobs.length}`);
    return allJobs;
}

/**
 * Check if job already exists in table storage
 */
async function isJobProcessed(tableClient, slug, context) {
    try {
        await tableClient.getEntity(PARTITION_KEY, slug);
        return true; // Job exists
    } catch (error) {
        if (error.statusCode === 404) {
            return false; // Job doesn't exist
        }
        context.warn(`⚠️ Error checking job existence: ${error.message}`);
        return false; // Assume not processed on error
    }
}

/**
 * Store job in table storage to prevent duplicates
 */
async function markJobAsProcessed(tableClient, job, context) {
    try {
        const entity = {
            partitionKey: PARTITION_KEY,
            rowKey: job.slug,
            title: job.title,
            company: job.company_name || 'N/A',
            processedAt: new Date().toISOString(),
            url: job.url || ''
        };
        await tableClient.createEntity(entity);
        context.log(`✅ Marked job as processed: ${job.slug}`);
    } catch (error) {
        context.warn(`⚠️ Error marking job as processed: ${error.message}`);
    }
}

/**
 * Update metadata table with run information
 */
async function updateMetadata(metaTableClient, stats, context) {
    try {
        const entity = {
            partitionKey: 'meta',
            rowKey: 'lastRun',
            lastRunAt: new Date().toISOString(),
            windowUsed: stats.windowUsed,
            totalFetched: stats.totalFetched,
            totalAfterTimeFilter: stats.totalAfterTimeFilter,
            totalMatched: stats.totalMatched,
            duplicatesSkipped: stats.duplicatesSkipped,
            totalSent: stats.totalSent
        };
        
        // Use upsert to update or create
        await metaTableClient.upsertEntity(entity, 'Replace');
        context.log(`✅ Metadata updated successfully`);
    } catch (error) {
        context.warn(`⚠️ Error updating metadata: ${error.message}`);
    }
}

/**
 * Get last run metadata
 */
async function getLastRunMetadata(metaTableClient, context) {
    try {
        const entity = await metaTableClient.getEntity('meta', 'lastRun');
        return entity;
    } catch (error) {
        if (error.statusCode === 404) {
            return null; // No previous run
        }
        context.warn(`⚠️ Error getting metadata: ${error.message}`);
        return null;
    }
}

/**
 * Send a generic notification to Telegram
 */
async function sendTelegramNotification(message, context) {
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
        context.warn(`⚠️ Failed to send notification: ${error.message}`);
        // Don't throw - notification failure shouldn't stop the function
    }
}

/**
 * Extract technical role type from job
 */
function extractRoleType(job) {
    const title = (job.title || '').toLowerCase();
    
    // Map technical keywords to role types
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
 */
function extractSkills(job) {
    const text = `${job.title} ${job.description}`.toLowerCase();
    const detectedSkills = [];
    
    const skillKeywords = [
        'Azure', 'AWS', 'GCP', 'Cloud', 'Docker', 'Kubernetes', 'DevOps',
        'Python', 'Java', 'JavaScript', 'Node.js', 'React', 'Angular',
        'Security', 'Cybersecurity', 'DevSecOps', 'CI/CD', 'Git', 'Linux',
        'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'Redis',
        'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions'
    ];
    
    skillKeywords.forEach(skill => {
        if (text.includes(skill.toLowerCase())) {
            detectedSkills.push(skill);
        }
    });
    
    return detectedSkills.length > 0 ? detectedSkills.slice(0, 5).join(', ') : 'See job description';
}

/**
 * Extract experience requirement from job
 */
function extractExperience(job) {
    const text = `${job.title} ${job.description}`.toLowerCase();
    
    // Check for entry level indicators (0-2 years)
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

/**
 * Send job alert to Telegram with enhanced details
 */
async function sendTelegramMessage(job, matchedKeyword, context) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        throw new Error('Telegram credentials not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
    }

    const skills = extractSkills(job);
    const experience = extractExperience(job);
    const roleType = extractRoleType(job);
    const salary = job.salary || 'Not disclosed';
    const jobType = job.job_type || 'Full-time';
    const score = job.relevanceScore || 0;
    
    // Generate relevance indicator based on score
    let relevanceIndicator = '';
    if (score >= 100) {
        relevanceIndicator = '⭐⭐⭐⭐⭐ Excellent Match';
    } else if (score >= 80) {
        relevanceIndicator = '⭐⭐⭐⭐ Great Match';
    } else if (score >= 60) {
        relevanceIndicator = '⭐⭐⭐ Good Match';
    } else if (score >= 40) {
        relevanceIndicator = '⭐⭐ Fair Match';
    } else {
        relevanceIndicator = '⭐ Basic Match';
    }
    
    // Special handling for Reddit posts
    const isRedditPost = job.source && job.source.includes('Reddit');
    const postType = isRedditPost ? '\n🎯 <b>Type:</b> Community Post/Referral\n' : '';
    
    const message = `🔥 <b>${job.title || 'Untitled Position'}</b>

🏢 ${job.company_name || 'N/A'}
📍 ${job.location || 'Remote'}
💼 ${jobType} | ${experience}
💰 ${salary}

${relevanceIndicator}
🔗 ${job.url || 'URL not available'}`;

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
        context.log(`✅ Telegram message sent for: ${job.title}`);
    } catch (error) {
        context.error(`❌ Failed to send Telegram message: ${error.message}`);
        throw error;
    }
}

/**
 * Main job checker handler
 */
app.timer('jobChecker', {
    schedule: '0 30 4 * * *', // 10:00 AM IST = 4:30 AM UTC
    runOnStartup: false,
    handler: async (myTimer, context) => {
        const startTime = new Date();
        context.log('\n' + '='.repeat(50));
        context.log('🚀 Job Alert Bot Started at:', startTime.toISOString());
        context.log('='.repeat(50));

        let tableClient;
        let metaTableClient;
        let processedCount = 0;
        let sentCount = 0;
        let errorCount = 0;
        let totalFetched = 0;
        let totalAfterTimeFilter = 0;
        let duplicatesSkipped = 0;
        
        // In-memory duplicate prevention for this run
        const seenInThisRun = new Set();

        try {
            // Get time window configuration
            const timeWindowDays = getTimeWindow();
            const windowName = Object.keys(TIME_WINDOWS).find(
                key => TIME_WINDOWS[key] === timeWindowDays
            ) || 'DAY';
            
            context.log(`⏰ Time Window: ${windowName} (${timeWindowDays} days)`);

            // Send startup notification to Telegram
            await sendTelegramNotification(
                `🔍 <b>Job Search Started</b>\n\n⏰ Scanning past ${timeWindowDays} days\n🎯 Azure/Cloud/Security roles (0-2 years)\n📍 India locations only\n\n⏳ Searching 11 sources...`,
                context
            );

            // Initialize Azure Table Storage
            const storageConnectionString = process.env.AzureWebJobsStorage;
            if (!storageConnectionString) {
                throw new Error('AzureWebJobsStorage connection string not configured');
            }

            tableClient = TableClient.fromConnectionString(storageConnectionString, TABLE_NAME);
            metaTableClient = TableClient.fromConnectionString(storageConnectionString, TABLE_META);
            
            // Create tables if they don't exist
            try {
                await tableClient.createTable();
                context.log('📦 Jobs table created or already exists');
            } catch (error) {
                if (error.statusCode !== 409) { // 409 = already exists
                    context.warn('⚠️ Jobs table creation warning:', error.message);
                }
            }
            
            try {
                await metaTableClient.createTable();
                context.log('📦 Metadata table created or already exists');
            } catch (error) {
                if (error.statusCode !== 409) {
                    context.warn('⚠️ Metadata table creation warning:', error.message);
                }
            }

            // Fetch jobs from API
            const allJobs = await fetchJobs(context);
            totalFetched = allJobs.length;
            context.log(`\n📊 Total fetched: ${totalFetched} jobs`);
            
            // Apply time window filtering
            const jobsWithinTimeWindow = allJobs.filter(job => {
                return isWithinTimeWindow(job.date, timeWindowDays);
            });
            totalAfterTimeFilter = jobsWithinTimeWindow.length;
            context.log(`⏳ After time filter (${timeWindowDays}d): ${totalAfterTimeFilter} jobs`);
            
            // Apply MAX_SCAN_LIMIT
            const jobsToProcess = jobsWithinTimeWindow.slice(0, MAX_SCAN_LIMIT);
            if (jobsWithinTimeWindow.length > MAX_SCAN_LIMIT) {
                context.log(`⚠️ Limiting scan to ${MAX_SCAN_LIMIT} jobs (from ${jobsWithinTimeWindow.length})`);
            }
            
            context.log(`\n🔍 Filtering ${jobsToProcess.length} jobs...`);

            // Filter and score jobs - collect ALL matches, not just first 6
            const matchedJobs = [];
            for (const job of jobsToProcess) {
                processedCount++;
                
                // Generate stable hash-based ID
                const jobSlug = generateStableId(job);
                
                // In-memory deduplication for this run
                if (seenInThisRun.has(jobSlug)) {
                    duplicatesSkipped++;
                    continue;
                }
                seenInThisRun.add(jobSlug);
                
                const filterResult = filterJob(job);

                if (filterResult.match) {
                    // Check if already processed in storage
                    const alreadyProcessed = await isJobProcessed(tableClient, jobSlug, context);
                    if (alreadyProcessed) {
                        context.log(`⏭️  Skipping duplicate: ${job.title}`);
                        duplicatesSkipped++;
                        continue;
                    }

                    // Calculate relevance score for this job
                    const score = scoreJob(job);

                    matchedJobs.push({
                        ...job,
                        slug: jobSlug,
                        matchedKeyword: filterResult.matchedKeyword,
                        relevanceScore: score
                    });
                    context.log(`✅ Match found: ${job.title} at ${job.company_name || 'Unknown'} (${filterResult.matchedKeyword}) - Score: ${score}`);
                }
            }

            const totalMatched = matchedJobs.length;
            
            // Sort jobs by relevance score (highest first)
            matchedJobs.sort((a, b) => b.relevanceScore - a.relevanceScore);
            
            // Send all matched jobs (no limit)
            const topJobs = matchedJobs;
            
            context.log(`\n📊 Filtering complete:`);
            context.log(`   • Total fetched: ${totalFetched}`);
            context.log(`   • Within time window: ${totalAfterTimeFilter}`);
            context.log(`   • After job filter: ${totalMatched}`);
            context.log(`   • Duplicates skipped: ${duplicatesSkipped}`);
            context.log(`   • Top scoring jobs: ${topJobs.length}`);
            
            if (topJobs.length > 0) {
                context.log(`\n🏆 All Matched Job Scores:`);
                topJobs.forEach((job, index) => {
                    context.log(`   ${index + 1}. ${job.title} - Score: ${job.relevanceScore}`);
                });
            }

            // Send alerts for all matched jobs
            if (topJobs.length > 0) {
                context.log(`\n📤 Sending ${topJobs.length} job alerts (all matches, sorted by relevance)...`);
                
                for (const job of topJobs) {
                    try {
                        await sendTelegramMessage(job, job.matchedKeyword, context);
                        await markJobAsProcessed(tableClient, job, context);
                        sentCount++;
                    } catch (error) {
                        context.error(`❌ Failed to process job ${job.title}: ${error.message}`);
                        errorCount++;
                    }
                }
                
                // Send summary notification
                await sendTelegramNotification(
                    `✅ <b>Search Complete</b>\n\n📊 Found: ${totalMatched} jobs\n📤 Sent: ${sentCount} alerts\n⏭️ Skipped: ${duplicatesSkipped} duplicates`,
                    context
                );
            } else {
                context.log('\n📭 No new matching jobs found');
                
                // Send "No matches found" notification to Telegram
                await sendTelegramNotification(
                    `📭 <b>No New Jobs</b>\n\n📊 Scanned ${totalFetched} jobs from past ${timeWindowDays} days\n⏭️ Skipped ${duplicatesSkipped} duplicates\n\n⏰ Next check: Tomorrow 10:00 AM IST`,
                    context
                );
            }
            
            // Update metadata table
            const stats = {
                windowUsed: windowName,
                totalFetched,
                totalAfterTimeFilter,
                totalMatched,
                duplicatesSkipped,
                totalSent: sentCount
            };
            await updateMetadata(metaTableClient, stats, context);

            // Summary
            const duration = ((new Date() - startTime) / 1000).toFixed(2);
            context.log('\n' + '='.repeat(50));
            context.log('📈 Execution Summary:');
            context.log(`   • Time window: ${windowName} (${timeWindowDays} days)`);
            context.log(`   • Total fetched: ${totalFetched}`);
            context.log(`   • Within time window: ${totalAfterTimeFilter}`);
            context.log(`   • Jobs analyzed: ${processedCount}`);
            context.log(`   • Matches found: ${totalMatched}`);
            context.log(`   • Duplicates skipped: ${duplicatesSkipped}`);
            context.log(`   • Alerts sent: ${sentCount}`);
            context.log(`   • Errors: ${errorCount}`);
            context.log(`   • Duration: ${duration}s`);
            context.log('✅ Job Alert Bot Completed Successfully');
            context.log('='.repeat(50) + '\n');

        } catch (error) {
            context.error('\n' + '='.repeat(50));
            context.error('❌ CRITICAL ERROR:', error.message);
            context.error('Stack trace:', error.stack);
            context.error('='.repeat(50) + '\n');
            throw error; // Re-throw to mark function execution as failed
        }
    }
});