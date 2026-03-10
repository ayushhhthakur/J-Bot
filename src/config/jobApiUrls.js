/**
 * Job API URLs Configuration
 * Add or modify job source URLs here
 * Organized by category for easy management
 */

// =============================================================================
// REMOTE & INTERNATIONAL JOB BOARDS
// =============================================================================

const REMOTE_JOB_APIS = {
    arbeitnow: 'https://www.arbeitnow.com/api/job-board-api',
    remoteOk: 'https://remoteok.com/api',
    jobIcy: 'https://jobicy.com/api/v2/remote-jobs',
    remotive: 'https://remotive.com/api/remote-jobs',
    theMuse: 'https://www.themuse.com/api/public/jobs?page=1&descending=true&level=Entry%20Level&level=Internship&category=Software%20Engineering&category=Data%20Science&category=IT',
    wellfound: 'https://api.wellfound.com/jobs?location=India&role=Software%20Engineer',
};

// =============================================================================
// REDDIT JOB SUBREDDITS
// =============================================================================

const REDDIT_APIS = {
    jobSubreddits: 'https://www.reddit.com/r/forhire+devopsjobs+jobsinindia+indiajobs+cscareerquestionsIndia.json?limit=100',
};

// =============================================================================
// INDIA-SPECIFIC JOB PORTALS
// =============================================================================

const INDIA_JOB_PORTALS = {
    adzunaIndia: (appId, appKey) => 
        `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=50&what=azure%20cloud%20devops%20security&where=india&max_days_old=30`,
    
    findJobIn: 'https://findjob.in/api/jobs?category=it-software&location=india&limit=50',
    
    naukriFreshers: 'https://www.naukri.com/jobapi/v3/search?noOfResults=50&experience=0-2&location=India&keywords=fresher%20graduate',
    
    monsterIndiaFreshers: 'https://www.monsterindia.com/ms-api/jobsearch?query=fresher&location=India&rows=50&experience=0-2',
    
    shineFresherJobs: 'https://www.shine.com/job-search-api/fresher-jobs-in-india?experience=0-1&limit=50',
    
    indeedIndiaFreshers: 'https://in.indeed.com/api/jobs?q=fresher+OR+graduate&l=India&start=0&limit=50&fromage=30',
    
    glassdoorIndiaEntryLevel: 'https://www.glassdoor.co.in/api/job-listing?location=India&experience=0-2&jobType=fulltime&fromAge=30',
    
    founditGraduateJobs: 'https://www.foundit.in/api/srp/results?query=fresher%20graduate&location=India&experience=0-2&sort=date',
};

// =============================================================================
// TECH COMPANY CAREER PAGES
// =============================================================================

const TECH_COMPANY_CAREERS = {
    // Major Tech Companies (Using scrapers)
    google: 'https://www.google.com/about/careers/applications/jobs/results?location=India',
    microsoft: 'https://apply.careers.microsoft.com/careers?domain=microsoft.com&start=0&location=india&pid=1970393556769483&sort_by=match',
    amazon: 'https://www.amazon.jobs/en/search.json?offset=0&result_limit=50&country=IND&sort=relevant',
    oracle: 'https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitionsLOV?onlyData=true&expand=all&finder=findReqs;siteNumber=CX,Location=IN&limit=50',
    adobe: 'https://careers.adobe.com/us/en/search-results?location=India',
    ibm: 'https://www.ibm.com/employment/api/search?location=India&country=IN',
};

// =============================================================================
// INDIAN IT SERVICES COMPANIES
// =============================================================================

const INDIAN_IT_COMPANIES = {
    paytm: 'https://paytm.ripplehire.com/candidate/?token=Jrn4GUz6HCYtOdlkVCzo&lang=en&source=CAREERSITE#list/acc=Paytm',
    wipro: 'https://careers.wipro.com/careers-home/jobs?location=India&page=1',
    accenture: 'https://www.accenture.com/api/sitecore/SearchApi/JobSearch?location=India&pageSize=50',
    tcs: 'https://ibegin.tcs.com/iBegin/jobs/search',
    infosys: 'https://career.infosys.com/jobservice/getCareersPage',
    hcl: 'https://www.hcltech.com/careers/job-search?location=India',
    techMahindra: 'https://careers.techmahindra.com/api/jobs?location=India',
    cognizant: 'https://careers.cognizant.com/api/jobs?location=India&country=IN',
    capgemini: 'https://www.capgemini.com/jobs-api/jobs?location=India',
    freshworks: 'https://freshteam.com/api/job_postings?status=published',
};

// =============================================================================
// STARTUP & FRESHER-FOCUSED PLATFORMS
// =============================================================================

const STARTUP_PLATFORMS = {
    instahyre: 'https://www.instahyre.com/api/jobs/?opportunities_type=job&experience_min=0&experience_max=3&location=India&limit=50',
    cutshort: 'https://cutshort.io/api/jobs?location=India&experience=0-2&limit=50',
    hasjob: 'https://hasjob.co/api/1/feed',
};

// =============================================================================
// INTERNSHIP & CAMPUS PLATFORMS
// =============================================================================

const INTERNSHIP_PLATFORMS = {
    internshala: 'https://internshala.com/api/internships?locations=India&experience=0-1',
    letsIntern: 'https://www.letsintern.com/api/internships?location=India&type=job,internship',
    unstop: 'https://unstop.com/api/public/opportunity?type=job&opportunity-type=Fresher%20Job&location=India&page=1&per_page=50',
    freshersWorld: 'https://www.freshersworld.com/api/jobs?location=India&experience=fresher',
};

// =============================================================================
// TECH COMMUNITY PLATFORMS
// =============================================================================

const TECH_COMMUNITY_PLATFORMS = {
    geeksforgeeks: 'https://www.geeksforgeeks.org/jobs-api/search?experience=0-2&location=India&limit=50',
    hackerearth: 'https://www.hackerearth.com/api/jobs?location=India&experience=0-2&limit=50',
    stackoverflow: 'https://stackoverflow.com/jobs/feed?l=India&u=Mi&d=100&r=true',
    skillenza: 'https://skillenza.com/api/jobs?location=India&experience_min=0&experience_max=2',
};

// =============================================================================
// AGGREGATOR PLATFORMS (Require API Keys)
// =============================================================================

const AGGREGATOR_APIS = {
    jsearch: {
        url: 'https://jsearch.p.rapidapi.com/search?query=azure%20cloud%20devops%20security%20india&page=1&num_pages=1&date_posted=month',
        requiresAuth: true,
        headers: (apiKey) => ({
            'X-RapidAPI-Key': apiKey || process.env.RAPIDAPI_KEY || '',
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        })
    },
    linkedin: {
        url: 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=entry%20level%20OR%20fresher&location=India&f_E=1,2&start=0&count=50',
        requiresAuth: false
    }
};

// =============================================================================
// EXPORT ALL CONFIGURATIONS
// =============================================================================

module.exports = {
    // Individual categories
    REMOTE_JOB_APIS,
    REDDIT_APIS,
    INDIA_JOB_PORTALS,
    TECH_COMPANY_CAREERS,
    INDIAN_IT_COMPANIES,
    STARTUP_PLATFORMS,
    INTERNSHIP_PLATFORMS,
    TECH_COMMUNITY_PLATFORMS,
    AGGREGATOR_APIS,

    // Flattened list of all URLs for easy access
    ALL_URLS: {
        ...REMOTE_JOB_APIS,
        ...REDDIT_APIS,
        ...INDIA_JOB_PORTALS,
        ...TECH_COMPANY_CAREERS,
        ...INDIAN_IT_COMPANIES,
        ...STARTUP_PLATFORMS,
        ...INTERNSHIP_PLATFORMS,
        ...TECH_COMMUNITY_PLATFORMS,
    },

    // Quick reference: Total sources count
    getSourceCount: () => {
        return Object.keys({
            ...REMOTE_JOB_APIS,
            ...REDDIT_APIS,
            ...INDIA_JOB_PORTALS,
            ...TECH_COMPANY_CAREERS,
            ...INDIAN_IT_COMPANIES,
            ...STARTUP_PLATFORMS,
            ...INTERNSHIP_PLATFORMS,
            ...TECH_COMMUNITY_PLATFORMS,
            ...AGGREGATOR_APIS,
        }).length;
    }
};
