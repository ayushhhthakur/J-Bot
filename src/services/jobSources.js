/**
 * Job source definitions and parsers
 * All API endpoints and data transformation logic
 * 
 * TO ADD NEW JOB SOURCES:
 * 1. Add URL to: src/config/jobApiUrls.js
 * 2. See: src/config/README-JobSources.md for instructions
 */

const scraper = require('./webScraper');
const { createSimpleJobSource, urls } = require('../config/jobSourceHelper');

const JOB_SOURCES = [
    {
        name: 'Arbeitnow',
        url: urls.REMOTE_JOB_APIS.arbeitnow,  // URL from config file
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
        url: urls.REMOTE_JOB_APIS.remoteOk,  // URL from config file
        parser: (data) => {
            const jobs = Array.isArray(data) ? data.slice(1) : [];
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
        url: urls.REMOTE_JOB_APIS.jobIcy,  // URL from config file
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
        url: urls.REDDIT_APIS.jobSubreddits,  // URL from config file
        parser: (data) => {
            const posts = data?.data?.children || [];

            const HIRING_PATTERNS = [
                /^\[hiring\]/i,
                /^hiring:/i,
                /we are hiring/i,
                /we'?re hiring/i,
                /join our team/i,
                /looking to hire/i,
                /open position/i,
                /job opening/i,
                /\breferral\b/i,
            ];

            const FOR_HIRE_PATTERNS = [
                /^\[for hire\]/i,
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

                    if (flair.includes('for hire') || flair.includes('available')) return false;
                    if (FOR_HIRE_PATTERNS.some(p => p.test(title) || p.test(text.slice(0, 300)))) return false;
                    if (HIRING_PATTERNS.some(p => p.test(title))) return true;

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
    },
    {
        name: 'Google Careers India',
        url: async () => await scraper.scrapeGoogleCareers(),
        parser: (data) => {
            // Data is already parsed by scraper
            return Array.isArray(data) ? data : [];
        }
    },
    {
        name: 'Microsoft Careers India',
        url: async () => await scraper.scrapeMicrosoftCareers(),
        parser: (data) => {
            // Data is already parsed by scraper
            return Array.isArray(data) ? data : [];
        }
    },
    {
        name: 'Paytm Careers',
        url: 'https://paytm.ripplehire.com/candidate/?token=Jrn4GUz6HCYtOdlkVCzo&lang=en&source=CAREERSITE#list/acc=Paytm',
        parser: (data) => {
            try {
                // RippleHire platform - may need API endpoint
                const jobs = data?.jobs || data?.data || [];
                return jobs.map(job => ({
                    title: job.title || job.job_title,
                    company_name: 'Paytm',
                    location: job.location || job.office_location || 'India',
                    description: job.description || job.job_description || '',
                    url: job.apply_url || job.url || 'https://paytm.ripplehire.com',
                    slug: job.id || `paytm_${Date.now()}`,
                    job_type: job.job_type || 'Full-time',
                    salary: null,
                    date: job.posted_date || job.created_at || null,
                    source: 'Paytm Careers'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Wipro Careers',
        url: 'https://careers.wipro.com/careers-home/jobs?location=India&page=1',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.searchResult || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'Wipro',
                    location: job.location || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.jobUrl || job.url || `https://careers.wipro.com/job/${job.jobId}`,
                    slug: job.jobId || job.id || `wipro_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || job.createdDate || null,
                    source: 'Wipro Careers'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Accenture India',
        url: async () => await scraper.scrapeAccentureJobs(),
        parser: (data) => {
            // Data is already parsed by scraper
            return Array.isArray(data) ? data : [];
        }
    },
    {
        name: 'TCS Careers',
        url: 'https://ibegin.tcs.com/iBegin/jobs/search',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'Tata Consultancy Services',
                    location: job.location || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.jobUrl || `https://ibegin.tcs.com/iBegin/jobs/${job.id}`,
                    slug: job.id || `tcs_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'TCS Careers'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Infosys Careers',
        url: 'https://career.infosys.com/jobservice/getCareersPage',
        parser: (data) => {
            try {
                const jobs = data?.jobPostings || data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'Infosys',
                    location: job.location || job.jobLocation || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.jobUrl || `https://career.infosys.com/job/${job.id}`,
                    slug: job.id || `infosys_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'Infosys Careers'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'HCL Technologies',
        url: 'https://www.hcltech.com/careers/job-search?location=India',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.results || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'HCL Technologies',
                    location: job.location || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.jobUrl || job.url || `https://www.hcltech.com/careers/job/${job.id}`,
                    slug: job.id || `hcl_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'HCL Technologies'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Tech Mahindra',
        url: 'https://careers.techmahindra.com/api/jobs?location=India',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'Tech Mahindra',
                    location: job.location || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.jobUrl || `https://careers.techmahindra.com/job/${job.id}`,
                    slug: job.id || `techmahindra_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'Tech Mahindra'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Cognizant India',
        url: 'https://careers.cognizant.com/api/jobs?location=India&country=IN',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.data || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'Cognizant',
                    location: job.location || job.city || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.applyUrl || `https://careers.cognizant.com/job/${job.id}`,
                    slug: job.id || `cognizant_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'Cognizant India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Capgemini India',
        url: 'https://www.capgemini.com/jobs-api/jobs?location=India',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.results || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'Capgemini',
                    location: job.location || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.applyUrl || `https://www.capgemini.com/careers/job/${job.id}`,
                    slug: job.id || `capgemini_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'Capgemini India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'IBM India',
        url: 'https://www.ibm.com/employment/api/search?location=India&country=IN',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.results || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'IBM',
                    location: job.location || job.city || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.url || `https://www.ibm.com/careers/job/${job.id}`,
                    slug: job.id || `ibm_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'IBM India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Oracle India',
        url: async () => await scraper.scrapeOracleJobs(),
        parser: (data) => {
            // Data is already parsed by scraper
            return Array.isArray(data) ? data : [];
        }
    },
    {
        name: 'Amazon India',
        url: async () => await scraper.scrapeAmazonJobs(),
        parser: (data) => {
            // Data is already parsed by scraper
            return Array.isArray(data) ? data : [];
        }
    },
    {
        name: 'Adobe India',
        url: 'https://careers.adobe.com/us/en/search-results?location=India',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.eagerLoadRefineSearch?.data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: 'Adobe',
                    location: job.location || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.jobDetailUrl || `https://careers.adobe.com/job/${job.jobId}`,
                    slug: job.jobId || `adobe_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: null,
                    date: job.postedDate || null,
                    source: 'Adobe India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Instahyre',
        url: 'https://www.instahyre.com/api/jobs/?opportunities_type=job&experience_min=0&experience_max=3&location=India&limit=50',
        parser: (data) => {
            try {
                const jobs = data?.opportunities || data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.designation,
                    company_name: job.company_name || job.company?.name || 'Startup',
                    location: job.location || 'India',
                    description: job.description || job.job_description || '',
                    url: job.url || `https://www.instahyre.com/job/${job.id}`,
                    slug: job.id || `instahyre_${Date.now()}`,
                    job_type: job.job_type || 'Full-time',
                    salary: job.salary_range || null,
                    date: job.created_at || job.posted_on || null,
                    source: 'Instahyre'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Cutshort',
        url: 'https://cutshort.io/api/jobs?location=India&experience=0-2&limit=50',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.role,
                    company_name: job.company_name || job.company?.name || 'Startup',
                    location: job.location || 'India',
                    description: job.description || '',
                    url: job.url || `https://cutshort.io/job/${job.id}`,
                    slug: job.id || `cutshort_${Date.now()}`,
                    job_type: job.job_type || 'Full-time',
                    salary: job.salary || null,
                    date: job.created_at || null,
                    source: 'Cutshort'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Hasjob',
        url: 'https://hasjob.co/api/1/feed',
        parser: (data) => {
            try {
                const jobs = data?.posts || [];
                return jobs.map(job => ({
                    title: job.headline,
                    company_name: job.company_name || 'India Startup',
                    location: job.location || 'India',
                    description: job.company_description || job.job_description || '',
                    url: job.url || job.absurl,
                    slug: job.hashid || `hasjob_${Date.now()}`,
                    job_type: job.type || 'Full-time',
                    salary: job.pay_cash_max ? `₹${job.pay_cash_min || 0}-₹${job.pay_cash_max}` : null,
                    date: job.datetime || null,
                    source: 'Hasjob'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'StackOverflow Jobs India',
        url: 'https://stackoverflow.com/jobs/feed?l=India&u=Mi&d=100&r=true',
        parser: (data) => {
            try {
                // RSS feed - might need XML parsing
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title,
                    company_name: job.company || 'Tech Company',
                    location: job.location || 'India',
                    description: job.description || '',
                    url: job.link || job.url,
                    slug: job.id || `stackoverflow_${Date.now()}`,
                    job_type: job.type || 'Full-time',
                    salary: null,
                    date: job.pubDate || job.published || null,
                    source: 'StackOverflow Jobs'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Internshala',
        url: 'https://internshala.com/api/internships?locations=India&experience=0-1',
        parser: (data) => {
            try {
                const jobs = data?.internships || data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.profile,
                    company_name: job.company_name || job.company || 'India Company',
                    location: job.location || job.location_names?.[0] || 'India',
                    description: job.job_description || job.description || '',
                    url: job.url || `https://internshala.com/internship/detail/${job.id}`,
                    slug: job.id || `internshala_${Date.now()}`,
                    job_type: job.job_type || 'Internship/Entry-level',
                    salary: job.stipend?.salary || null,
                    date: job.posted_on || job.start_date || null,
                    source: 'Internshala'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'LetsIntern',
        url: 'https://www.letsintern.com/api/internships?location=India&type=job,internship',
        parser: (data) => {
            try {
                const jobs = data?.internships || data?.data || [];
                return jobs.map(job => ({
                    title: job.title || job.position,
                    company_name: job.company || job.company_name || 'Startup',
                    location: job.location || 'India',
                    description: job.description || '',
                    url: job.url || `https://www.letsintern.com/internships/${job.id}`,
                    slug: job.id || `letsintern_${Date.now()}`,
                    job_type: job.type || 'Internship',
                    salary: job.stipend || null,
                    date: job.posted_date || job.created_at || null,
                    source: 'LetsIntern'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Unstop (Dare2Compete)',
        url: 'https://unstop.com/api/public/opportunity?type=job&opportunity-type=Fresher%20Job&location=India&page=1&per_page=50',
        parser: (data) => {
            try {
                const jobs = data?.data?.opportunities || data?.opportunities || [];
                return jobs.map(job => ({
                    title: job.title,
                    company_name: job.organisation?.name || job.company || 'India Company',
                    location: job.location || 'India',
                    description: job.description || job.short_description || '',
                    url: job.public_url || `https://unstop.com/o/${job.id}`,
                    slug: job.id || `unstop_${Date.now()}`,
                    job_type: job.type || 'Fresher Job',
                    salary: job.stipend || null,
                    date: job.start_timestamp || job.created_at || null,
                    source: 'Unstop'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'GeeksforGeeks Jobs',
        url: 'https://www.geeksforgeeks.org/jobs-api/search?experience=0-2&location=India&limit=50',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.data || [];
                return jobs.map(job => ({
                    title: job.title || job.job_title,
                    company_name: job.company_name || job.company || 'Tech Company',
                    location: job.location || 'India',
                    description: job.description || job.job_description || '',
                    url: job.url || `https://www.geeksforgeeks.org/jobs/${job.id}`,
                    slug: job.id || `gfg_${Date.now()}`,
                    job_type: job.job_type || 'Full-time',
                    salary: job.salary || null,
                    date: job.posted_date || null,
                    source: 'GeeksforGeeks Jobs'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'HackerEarth',
        url: 'https://www.hackerearth.com/api/jobs?location=India&experience=0-2&limit=50',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title,
                    company_name: job.company_name || job.company || 'Tech Company',
                    location: job.location || 'India',
                    description: job.description || '',
                    url: job.url || `https://www.hackerearth.com/challenges/hiring/${job.slug}`,
                    slug: job.id || job.slug || `hackerearth_${Date.now()}`,
                    job_type: job.employment_type || 'Full-time',
                    salary: job.salary || null,
                    date: job.start_date || job.created_at || null,
                    source: 'HackerEarth'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Naukri Freshers',
        url: 'https://www.naukri.com/jobapi/v3/search?noOfResults=50&experience=0-2&location=India&keywords=fresher%20graduate',
        parser: (data) => {
            try {
                const jobs = data?.jobDetails || data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: job.companyName || job.company,
                    location: job.placeholders?.[0]?.label || job.location || 'India',
                    description: job.jobDescription || '',
                    url: job.jdURL || `https://www.naukri.com/job-listings-${job.jobId}`,
                    slug: job.jobId || `naukri_${Date.now()}`,
                    job_type: job.type || 'Full-time',
                    salary: job.salary || null,
                    date: job.createdDate || job.footerText || null,
                    source: 'Naukri Freshers'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Monster India Freshers',
        url: 'https://www.monsterindia.com/ms-api/jobsearch?query=fresher&location=India&rows=50&experience=0-2',
        parser: (data) => {
            try {
                const jobs = data?.jobList || [];
                return jobs.map(job => ({
                    title: job.jobTitle || job.title,
                    company_name: job.companyName || job.company,
                    location: job.location || 'India',
                    description: job.jobDescription || job.description || '',
                    url: job.applyUrl || `https://www.monsterindia.com/job/${job.jobId}`,
                    slug: job.jobId || `monster_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: job.salary || null,
                    date: job.postedDate || null,
                    source: 'Monster India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Shine Fresher Jobs',
        url: 'https://www.shine.com/job-search-api/fresher-jobs-in-india?experience=0-1&limit=50',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: job.company || job.companyName,
                    location: job.location || 'India',
                    description: job.description || job.jobDescription || '',
                    url: job.url || `https://www.shine.com/jobs/${job.id}`,
                    slug: job.id || `shine_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: job.salary || null,
                    date: job.postedDate || null,
                    source: 'Shine Fresher Jobs'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Indeed India Freshers',
        url: 'https://in.indeed.com/api/jobs?q=fresher+OR+graduate&l=India&start=0&limit=50&fromage=30',
        parser: (data) => {
            try {
                const jobs = data?.results || [];
                return jobs.map(job => ({
                    title: job.title || job.jobtitle,
                    company_name: job.company,
                    location: job.formattedLocation || job.location || 'India',
                    description: job.snippet || job.description || '',
                    url: `https://in.indeed.com/viewjob?jk=${job.jobkey}`,
                    slug: job.jobkey || `indeed_${Date.now()}`,
                    job_type: job.jobtype || 'Full-time',
                    salary: job.salary || null,
                    date: job.date || job.formattedRelativeTime || null,
                    source: 'Indeed India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'LinkedIn Jobs Entry Level',
        url: 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=entry%20level%20OR%20fresher&location=India&f_E=1,2&start=0&count=50',
        parser: (data) => {
            try {
                // LinkedIn might require HTML parsing
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title,
                    company_name: job.companyName || job.company,
                    location: job.location,
                    description: job.description || '',
                    url: job.url || `https://www.linkedin.com/jobs/view/${job.jobId}`,
                    slug: job.jobId || `linkedin_${Date.now()}`,
                    job_type: job.employmentType || 'Entry Level',
                    salary: null,
                    date: job.listedAt || job.originalListedAt || null,
                    source: 'LinkedIn Jobs'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Glassdoor India Entry Level',
        url: 'https://www.glassdoor.co.in/api/job-listing?location=India&experience=0-2&jobType=fulltime&fromAge=30',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.jobListings || [];
                return jobs.map(job => ({
                    title: job.jobTitle || job.title,
                    company_name: job.employerName || job.company,
                    location: job.location || 'India',
                    description: job.jobDescription || job.description || '',
                    url: job.jobUrl || `https://www.glassdoor.co.in/job/${job.jobId}`,
                    slug: job.jobId || `glassdoor_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: job.salary || job.salaryText || null,
                    date: job.discoverDate || null,
                    source: 'Glassdoor India'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Skillenza',
        url: 'https://skillenza.com/api/jobs?location=India&experience_min=0&experience_max=2',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title,
                    company_name: job.company_name || 'Tech Company',
                    location: job.location || 'India',
                    description: job.description || '',
                    url: job.url || `https://skillenza.com/jobs/${job.id}`,
                    slug: job.id || `skillenza_${Date.now()}`,
                    job_type: job.job_type || 'Full-time',
                    salary: job.salary || null,
                    date: job.created_at || null,
                    source: 'Skillenza'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'Foundit (Monster) Graduate Jobs',
        url: 'https://www.foundit.in/api/srp/results?query=fresher%20graduate&location=India&experience=0-2&sort=date',
        parser: (data) => {
            try {
                const jobs = data?.jobs || data?.docs || [];
                return jobs.map(job => ({
                    title: job.title || job.jobTitle,
                    company_name: job.companyName || job.company,
                    location: job.location || 'India',
                    description: job.snippet || job.description || '',
                    url: job.url || `https://www.foundit.in/job/${job.id}`,
                    slug: job.id || job.uniq_id || `foundit_${Date.now()}`,
                    job_type: job.jobType || 'Full-time',
                    salary: job.salary || null,
                    date: job.postDate || null,
                    source: 'Foundit (Monster)'
                }));
            } catch (error) {
                return [];
            }
        }
    },
    {
        name: 'FreshersWorld',
        url: 'https://www.freshersworld.com/api/jobs?location=India&experience=fresher',
        parser: (data) => {
            try {
                const jobs = data?.jobs || [];
                return jobs.map(job => ({
                    title: job.title || job.job_title,
                    company_name: job.company_name || job.company,
                    location: job.location || job.job_location || 'India',
                    description: job.description || job.job_description || '',
                    url: job.url || `https://www.freshersworld.com/jobs/${job.id}`,
                    slug: job.id || `freshersworld_${Date.now()}`,
                    job_type: job.job_type || 'Full-time',
                    salary: job.salary || null,
                    date: job.posted_date || null,
                    source: 'FreshersWorld'
                }));
            } catch (error) {
                return [];
            }
        }
    }
];

module.exports = { JOB_SOURCES };
