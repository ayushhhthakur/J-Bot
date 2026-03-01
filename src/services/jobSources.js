/**
 * Job source definitions and parsers
 * All API endpoints and data transformation logic
 */

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
    }
];

module.exports = { JOB_SOURCES };
