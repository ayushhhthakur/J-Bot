/**
 * J-Bot - Intelligent Job Alert Bot for Telegram
 * 
 * Azure Function that automatically searches for entry-level Azure/Cloud/Security jobs
 * in India from multiple sources and sends intelligent Telegram notifications.
 * 
 * @module jobChecker
 * @description Timer-triggered function (runs every 30 minutes) that:
 *   - Fetches jobs from 7+ sources (Arbeitnow, RemoteOK, JobIcy, Reddit, Remotive, Adzuna, LinkedIn)
 *   - Filters for pure technical roles only (no support/sales)
 *   - Targets entry-level positions with 0-2 years of experience
 *   - Accepts Remote, On-site, and Hybrid job types
 *   - Focuses on India locations (Bangalore, Pune, Gurgaon, Delhi NCR, Hyderabad, Jaipur, Noida)
 *   - Prevents duplicates using Azure Table Storage
 *   - Sends formatted alerts to Telegram (max 6 per run)
 * 
 * @author J-Bot Contributors
 * @license MIT
 * @version 1.0.0
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
        parser: (data) => data.data || []
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
                source: 'JobIcy'
            }));
        }
    },
    {
        name: 'Reddit Jobs',
        url: 'https://www.reddit.com/r/forhire+cscareerquestions+devopsjobs+jobsinindia+indiajobs+cscareerquestionsIndia.json?limit=100',
        parser: (data) => {
            const posts = data?.data?.children || [];
            return posts
                .filter(post => {
                    const title = post.data.title.toLowerCase();
                    const text = post.data.selftext?.toLowerCase() || '';
                    // Look for hiring posts, referrals, freshers
                    return (title.includes('[hiring]') || title.includes('hiring') || 
                            title.includes('referral') || title.includes('fresher') ||
                            title.includes('intern') || title.includes('entry level') ||
                            text.includes('hiring') || text.includes('referral'));
                })
                .map(post => ({
                    title: post.data.title.replace(/\[hiring\]/gi, '').trim(),
                    company_name: 'Via Reddit',
                    location: 'Check post for details',
                    description: post.data.selftext || post.data.title,
                    url: `https://reddit.com${post.data.permalink}`,
                    slug: post.data.id,
                    job_type: post.data.link_flair_text || 'See post',
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
                source: 'Remotive'
            }));
        }
    },
    {
        name: 'Adzuna India',
        url: 'https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=test&app_key=test&results_per_page=50&what=cloud%20OR%20azure%20OR%20devops%20OR%20security',
        parser: (data) => {
            const jobs = data.results || [];
            return jobs.map(job => ({
                title: job.title,
                company_name: job.company?.display_name || 'Not specified',
                location: job.location?.display_name || 'India',
                description: job.description || '',
                url: job.redirect_url,
                slug: job.id,
                salary: job.salary_max ? `₹${Math.round(job.salary_min || 0)} - ₹${Math.round(job.salary_max)}` : null,
                source: 'Adzuna India'
            }));
        }
    },
    {
        name: 'LinkedIn Jobs (RSS)',
        url: 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=azure%20cloud%20security%20fresher%20intern&location=India&f_E=1,2&start=0',
        parser: (data) => {
            // LinkedIn returns HTML, we'll parse job cards
            // This is a simplified parser - in production you'd use a proper HTML parser
            try {
                const jobs = [];
                // Return empty for now as LinkedIn requires more complex parsing
                // This placeholder shows it's available for future enhancement
                return jobs;
            } catch (error) {
                return [];
            }
        }
    }
];
const TABLE_NAME = 'jobalerts';
const PARTITION_KEY = 'jobs';
const MAX_JOBS = 6;

// Keyword filters
const INCLUDE_KEYWORDS = ['Azure', 'Cloud', 'Security', 'Cybersecurity', 'DevSecOps'];

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
    // Support roles
    'Support', 'Help Desk', 'Helpdesk', 'IT Support', 'Technical Support', 'Tech Support',
    'Desktop Support', 'Service Desk', 'Customer Support', 'Customer Service',
    'Client Support', 'User Support', 'Application Support', 'L1 Support', 'L2 Support',
    // Sales & Marketing
    'Sales', 'Business Development', 'BDM', 'BDE', 'Account Manager', 'Sales Executive',
    'Relationship Manager', 'Customer Success', 'Pre-Sales', 'Presales',
    // Operations & Admin
    'Operations', 'Coordinator', 'Data Entry', 'Back Office',
    'Team Leader', 'Supervisor', 'Executive',
    // Testing (unless technical)
    'Manual Testing', 'QA Tester', 'Test Engineer',
    // Non-tech specific
    'Recruiter', 'HR', 'Human Resources', 'Trainer', 'Consultant',
    'Analyst' // Too generic, often non-technical
];

// Pure technical role indicators - MUST contain at least one
const PURE_TECHNICAL_KEYWORDS = [
    // Development & Engineering
    'Developer', 'Engineer', 'Software Engineer', 'Software Developer', 'Programmer',
    'DevOps Engineer', 'Cloud Engineer', 'Backend', 'Frontend', 'Full Stack', 'Full-Stack',
    // Security specific
    'Security Engineer', 'Security Analyst', 'Cybersecurity Engineer', 'DevSecOps Engineer',
    'Penetration Tester', 'Security Researcher', 'InfoSec', 'AppSec',
        // Testing (unless technical)
    'Manual Testing', 'QA Tester', 'Test Engineer',
    // Infrastructure & Cloud
    'Cloud Architect', 'Solutions Architect', 'Administrator', 'Associate', 'Infrastructure Engineer', 'SRE',
    'Site Reliability Engineer', 'Platform Engineer', 'Systems Engineer',
    // Data & ML
    'Data Engineer', 'ML Engineer', 'Machine Learning Engineer', 'Data Scientist',
    // Specific tech roles
    'Automation Engineer', 'Build Engineer', 'Release Engineer', 'Integration Engineer'
];

// Location filters - India only
const INDIA_KEYWORDS = ['India', 'Bharat'];
const PREFERRED_CITIES = [
    'Bangalore', 'Bengaluru',
    'Pune',
    'Gurgaon', 'Gurugram',
    'Delhi', 'NCR', 'Delhi NCR', 'New Delhi',
    'Hyderabad',
    'Jaipur',
    'Noida'
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
    'Zoho', 'Freshworks', 'PayTM', 'PhonePe', 'Razorpay', 'Zomato', 'Swiggy', 'Flipkart', 'Ola',
    'MakeMyTrip', 'BookMyShow', 'Nykaa', 'CRED', 'Udaan', 'Meesho',
    // E-commerce & Retail
    'Walmart', 'Target', 'Myntra', 'Shopify',
    // Financial Services
    'JP Morgan', 'Goldman Sachs', 'Morgan Stanley', 'Barclays', 'HSBC', 'Mastercard', 'Visa',
    'American Express', 'Deutsche Bank',
    // Product Companies
    'Salesforce', 'ServiceNow', 'Workday', 'Intuit', 'PayPal', 'Stripe', 'Square',
    // Telecom
    'Jio', 'Reliance Jio', 'Airtel', 'Vodafone', 'Nokia'
];

/**
 * Check if text contains any of the keywords (case-insensitive)
 */
function containsKeyword(text, keywords) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Check if job location is in India (preferred cities)
 */
function isIndiaLocation(job) {
    const location = job.location || '';
    
    if (!location) {
        return false;
    }
    
    // Skip check if location needs to be verified from post
    if (location.includes('Check post')) {
        return true; // Will be checked in filterJob instead
    }
    
    const lowerLocation = location.toLowerCase();
    
    // Check if location contains India
    const isIndia = INDIA_KEYWORDS.some(keyword => 
        lowerLocation.includes(keyword.toLowerCase())
    );
    
    // Check if location contains any preferred city
    const isPreferredCity = PREFERRED_CITIES.some(city => 
        lowerLocation.includes(city.toLowerCase())
    );
    
    return isIndia || isPreferredCity;
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
            const response = await axios.get(source.url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'JobAlertBot/1.0'
                }
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
    
    // Special handling for Reddit posts
    const isRedditPost = job.source && job.source.includes('Reddit');
    const postType = isRedditPost ? '\n🎯 <b>Type:</b> Community Post/Referral\n' : '';
    
    const message = `🔥 <b>${job.title || 'Untitled Position'}</b>

🏢 <b>Company:</b> ${job.company_name || 'N/A'}
📍 <b>Location:</b> ${job.location || 'Remote/Not specified'}
📊 <b>Source:</b> ${job.source || 'Job Board'}${postType}
💼 <b>Job Type:</b> ${jobType}
⚙️ <b>Role Category:</b> ${roleType} ✅ (Pure Technical)

👨‍💼 <b>Experience:</b> ${experience}
🛠️ <b>Skills:</b> ${skills}
💰 <b>Salary:</b> ${salary}

🧠 <b>Why matched:</b> ${matchedKeyword} keyword detected
🔗 <b>Apply:</b> ${job.url || 'URL not available'}`;

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
    schedule: '0 */30 * * * *', // Every 30 minutes
    runOnStartup: true, // Run immediately on startup for testing
    handler: async (myTimer, context) => {
        const startTime = new Date();
        context.log('\n' + '='.repeat(50));
        context.log('🚀 Job Alert Bot Started at:', startTime.toISOString());
        context.log('='.repeat(50));

        let tableClient;
        let processedCount = 0;
        let sentCount = 0;
        let errorCount = 0;

        try {
            // Send startup notification to Telegram
            await sendTelegramNotification(
                '🤖 Hey! Function has been initiated.\n\n🔍 <b>Searching across:</b>\n• Arbeitnow\n• RemoteOK\n• JobIcy\n• Reddit (r/forhire, r/devopsjobs, r/jobsinindia)\n• Remotive\n• Adzuna India\n\n🎯 <b>Criteria:</b>\n• 0-2 years experience\n• Remote/Hybrid/On-site jobs\n• India locations\n• Pure technical roles only\n• Azure/Cloud/Security focus\n\n⏳ Looking for jobs & referrals...',
                context
            );

            // Initialize Azure Table Storage
            const storageConnectionString = process.env.AzureWebJobsStorage;
            if (!storageConnectionString) {
                throw new Error('AzureWebJobsStorage connection string not configured');
            }

            tableClient = TableClient.fromConnectionString(storageConnectionString, TABLE_NAME);
            
            // Create table if it doesn't exist
            try {
                await tableClient.createTable();
                context.log('📦 Table created or already exists');
            } catch (error) {
                if (error.statusCode !== 409) { // 409 = already exists
                    context.warn('⚠️ Table creation warning:', error.message);
                }
            }

            // Fetch jobs from API
            const allJobs = await fetchJobs(context);
            context.log(`\n🔍 Filtering ${allJobs.length} jobs...`);

            // Filter and process jobs
            const matchedJobs = [];
            for (const job of allJobs) {
                if (matchedJobs.length >= MAX_JOBS) {
                    break;
                }

                processedCount++;
                const filterResult = filterJob(job);

                if (filterResult.match) {
                    const jobSlug = job.slug || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Check if already processed
                    const alreadyProcessed = await isJobProcessed(tableClient, jobSlug, context);
                    if (alreadyProcessed) {
                        context.log(`⏭️  Skipping duplicate: ${job.title}`);
                        continue;
                    }

                    matchedJobs.push({
                        ...job,
                        slug: jobSlug,
                        matchedKeyword: filterResult.matchedKeyword
                    });
                    context.log(`✅ Match found: ${job.title} at ${job.company_name || 'Unknown'} (${filterResult.matchedKeyword})`);
                }
            }

            context.log(`\n📊 Filtering complete: ${matchedJobs.length} matches from ${processedCount} jobs`);

            // Send alerts for matched jobs
            if (matchedJobs.length > 0) {
                context.log(`\n📤 Sending ${matchedJobs.length} job alerts...`);
                
                for (const job of matchedJobs) {
                    try {
                        await sendTelegramMessage(job, job.matchedKeyword, context);
                        await markJobAsProcessed(tableClient, job, context);
                        sentCount++;
                    } catch (error) {
                        context.error(`❌ Failed to process job ${job.title}: ${error.message}`);
                        errorCount++;
                    }
                }
            } else {
                context.log('\n📭 No new matching jobs found');
            }

            // Summary
            const duration = ((new Date() - startTime) / 1000).toFixed(2);
            context.log('\n' + '='.repeat(50));
            context.log('📈 Execution Summary:');
            context.log(`   • Jobs analyzed: ${processedCount}`);
            context.log(`   • Matches found: ${matchedJobs.length}`);
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