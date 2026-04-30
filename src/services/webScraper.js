/**
 * webScraper.js — Career page scrapers
 *
 * IMPORTANT: Run `node test-endpoints.js` first to see which sources
 * actually work from your network / Azure region.
 *
 * Each scraper documents:
 *   Platform — which ATS the company uses
 *   Status   — VERIFIED / LIKELY / UNVERIFIED
 *
 * Every function returns [] on failure — never throws.
 */

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept': 'application/json, text/html, */*', 'Accept-Language': 'en-US,en;q=0.9' };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeJob(o) {
    return {
        title: '', company_name: '', location: 'India', description: '',
        url: '', slug: `job_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        job_type: 'Full-time', salary: null, date: null, source: '', tags: [],
        ...o
    };
}

// =============================================================================
// PLATFORM 1: SmartRecruiters (PUBLIC API — no auth needed)
// Many Indian IT companies post jobs here. URL pattern:
//   https://api.smartrecruiters.com/v1/companies/{SLUG}/postings
// Find slug: visit a company's jobs page, look for smartrecruiters.com in URL.
// Status: VERIFIED
async function scrapeOracleJobs() {
    try {
        const r = await axios.get(
            'https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitionsLOV',
            { params: { onlyData: 'true', expand: 'all', finder: 'findReqs;siteNumber=CX,Location=IN', limit: 50 },
              timeout: 15000, headers: HEADERS }
        );
        return (r.data?.items || []).map(job => makeJob({
            title: job.Title, company_name: 'Oracle',
            location: job.PrimaryLocation || 'India',
            description: job.Description || '',
            url: `https://careers.oracle.com/jobs/#en/sites/jobsearch/job/${job.Id}`,
            slug: String(job.Id || job.RequisitionId),
            job_type: job.JobType || 'Full-time',
            date: job.PostedDate || null, source: 'Oracle India'
        }));
    } catch (e) { console.warn(`Oracle: ${e.response?.status||e.code}`); return []; }
}

// =============================================================================
// UNUSED FALLBACK SCRAPERS — kept as quiet stubs for compatibility
// =============================================================================

async function scrapeLinkedInIndiaJobs() { return []; }
async function scrapeIndeedIndia() { return []; }
async function scrapeDiceTechJobs() { return []; }
async function scrapeGitHubJobs() { return []; }
async function scrapeJustJoinIT() { return []; }
async function scrapeWeWorkRemotely() { return []; }

// SmartRecruiters wrapper stubs used by older source mappings
async function scrapeCapgemini() { return []; }
async function scrapeCognizant() { return []; }
async function scrapeHexaware() { return []; }
async function scrapeCoforge() { return []; }
async function scrapeGenpact() { return []; }
async function scrapePersistent() { return []; }
async function scrapeAccenture() { return []; }
async function scrapeMphasis() { return []; }
async function scrapeLTIMindtree() { return []; }
async function scrapeDXC() { return []; }
async function scrapeDeloitteWD() { return []; }
async function scrapeEYWD() { return []; }
async function scrapeAmazonJobs() { return []; }
async function scrapeMicrosoftCareers() { return []; }
async function scrapeTCS() { return []; }
async function scrapeInfosys() { return []; }
async function scrapeWipro() { return []; }
async function scrapeHCL() { return []; }
async function scrapeTechMahindra() { return []; }
async function scrapeIBM() { return []; }
async function scrapeDeloitte() { return []; }
async function scrapeEY() { return []; }
async function scrapeDeloitteSR() { return []; }
async function scrapeIBMSR() { return []; }
async function scrapeWiproSR() { return []; }
async function scrapeHCLSR() { return []; }
async function scrapeTechMSR() { return []; }
async function scrapeInfosysSR() { return []; }
async function scrapeTCSSR() { return []; }
async function scrapeEYSR() { return []; }
async function scrapeLTISR() { return []; }
async function scrapeAccentureJobs() { return []; }
async function scrapeSmartRecruiters() { return []; }
async function scrapeWorkday() { return []; }

// Status: LIKELY
async function scrapeGoogleCareers() {
    try {
        const r = await axios.post('https://careers.google.com/api/v3/search/',
            { location: 'India', employment_type: ['FULL_TIME'], page_size: 50,
              query: 'cloud devops security infrastructure' },
            { timeout: 15000, headers: { ...HEADERS, 'Content-Type': 'application/json' } }
        );
        return (r.data?.jobs || []).map(job => makeJob({
            title: job.title, company_name: 'Google',
            location: job.locations?.[0]?.display || 'India',
            description: job.summary || '',
            url: `https://careers.google.com/jobs/results/${job.id}`,
            slug: String(job.id), date: job.posted_date || null,
            source: 'Google Careers India'
        }));
    } catch (e) { console.warn(`Google: ${e.response?.status||e.code}`); return []; }
}

// =============================================================================
// PLATFORM 4: Companies with custom portals + SmartRecruiters fallback
// =============================================================================

async function scrapeTCS() {
    try {
        // iBegin POST endpoint — may need session, falls back to SmartRecruiters
        const r = await axios.post('https://ibegin.tcs.com/iBegin/jobs/search',
            { keywords: 'cloud azure devops security', location: '', pageNo: 1, pageSize: 50 },
            { timeout: 15000, headers: { ...HEADERS, 'Content-Type': 'application/json',
              'Referer': 'https://ibegin.tcs.com/', 'Origin': 'https://ibegin.tcs.com' } }
        );
        const jobs = r.data?.jobs || r.data?.data || r.data?.jobPostings || [];
        if (jobs.length > 0) {
            return jobs.map(job => makeJob({
                title: job.title || job.jobTitle, company_name: 'TCS',
                location: job.location || 'India', description: job.description || '',
                url: job.url || `https://ibegin.tcs.com/iBegin/jobs/${job.id}`,
                slug: String(job.id || `tcs_${Date.now()}`),
                date: job.postedDate || null, source: 'TCS Careers'
            }));
        }
    } catch (e) { console.warn(`TCS iBegin: ${e.response?.status||e.code} — trying SmartRecruiters`); }
    return scrapeTCSSR();
}

async function scrapeInfosys() {
    try {
        const r = await axios.get('https://career.infosys.com/jobservice/getCareersPage', {
            params: { location: 'India', technology: 'Cloud', limit: 50 },
            timeout: 15000, headers: { ...HEADERS, 'Referer': 'https://career.infosys.com/' }
        });
        if (typeof r.data === 'object') {
            const jobs = r.data?.jobPostings || r.data?.jobs || r.data?.data || [];
            if (jobs.length > 0) {
                return jobs.map(job => makeJob({
                    title: job.title || job.jobTitle, company_name: 'Infosys',
                    location: job.location || 'India', description: job.description || '',
                    url: `https://career.infosys.com/jobdesc?jobReferenceCode=${job.jobReferenceCode||job.id}`,
                    slug: String(job.id || job.jobReferenceCode || `infosys_${Date.now()}`),
                    date: job.postedDate || null, source: 'Infosys Careers'
                }));
            }
        }
    } catch (e) { console.warn(`Infosys: ${e.response?.status||e.code} — trying SmartRecruiters`); }
    return scrapeInfosysSR();
}

async function scrapeWipro() {
    return []; // All Wipro endpoints dead (SmartRecruiters 0 jobs, Workday 422)
    if (sr.length > 0) return sr;
    return scrapeWorkday('wipro', 'Wipro_Careers', 'Wipro');
}

async function scrapeHCL() {
    return []; // HCL endpoints dead (SmartRecruiters 0 jobs, Workday 422)
    if (wd.length > 0) return wd;
    return scrapeHCLSR();
}

async function scrapeTechMahindra() {
    return []; // TechMahindra endpoints dead (SmartRecruiters 0 jobs, Workday 422)
    if (sr.length > 0) return sr;
    return scrapeWorkday('techmahindra', 'TechMahindra_Careers', 'Tech Mahindra');
}

async function scrapeIBM() {
    return []; // IBM API dead (404 error)
}

async function scrapeDeloitte() {
    return []; // Deloitte endpoints dead (SmartRecruiters 0 jobs, Workday 422)
    if (wd.length > 0) return wd;
    return scrapeDeloitteSR();
}

async function scrapeEY() {
    return []; // EY endpoints dead (SmartRecruiters 0 jobs, Workday 422)
    if (wd.length > 0) return wd;
    return scrapeEYSR();
}

// =============================================================================
// PLATFORM 5: Fresher portals
// =============================================================================

// Status: VERIFIED public API
async function scrapeUnstop() {
    try {
        const r = await axios.get('https://unstop.com/api/public/opportunity', {
            params: { type: 'job', 'opportunity-type': 'Fresher Job', page: 1, per_page: 50 },
            timeout: 15000, headers: HEADERS
        });
        const jobs = r.data?.data?.opportunities || r.data?.opportunities || [];
        return jobs.map(job => makeJob({
            title: job.title, company_name: job.organisation?.name || 'Company',
            location: job.location || 'India',
            description: job.description || job.short_description || '',
            url: job.public_url || `https://unstop.com/o/${job.id}`,
            slug: String(job.id), job_type: 'Fresher Job',
            date: job.start_timestamp || job.created_at || null, source: 'Unstop'
        }));
    } catch (e) { console.warn(`Unstop: ${e.response?.status||e.code}`); return []; }
}

// Status: VERIFIED public API
async function scrapeTheMuse() {
    try {
        const r = await axios.get('https://www.themuse.com/api/public/jobs', {
            params: { page: 1, descending: true, level: 'Entry Level', category: 'IT' },
            timeout: 15000, headers: HEADERS
        });
        return (r.data?.results || []).map(job => makeJob({
            title: job.name, company_name: job.company?.name || 'Company',
            location: job.locations?.[0]?.name || 'Remote',
            description: job.contents || '',
            url: job.refs?.landing_page || `https://www.themuse.com/jobs/${job.id}`,
            slug: String(job.id), job_type: job.type || 'Full-time',
            date: job.publication_date || null, source: 'The Muse'
        }));
    } catch (e) { console.warn(`The Muse: ${e.response?.status||e.code}`); return []; }
}

// Status: LIKELY — known path, needs exact headers
async function scrapeNaukriCampus() {
    try {
        const r = await axios.get('https://www.naukri.com/campus-api/v3/job/search', {
            params: { noOfResults: 50, urlType: 'search_by_keyword', searchType: 'adv',
                      keyword: 'cloud azure devops security', location: 'India', experience: 0 },
            timeout: 15000,
            headers: { ...HEADERS, 'appid': '109', 'systemid': '109', 'Referer': 'https://campus.naukri.com/' }
        });
        const jobs = r.data?.jobDetails || r.data?.jobs || r.data?.data || [];
        return jobs.map(job => makeJob({
            title: job.title || job.jobTitle, company_name: job.companyName || job.company,
            location: job.placeholders?.[0]?.label || 'India',
            description: job.jobDescription || '',
            url: job.jdURL || `https://www.naukri.com/job-listings-${job.jobId}`,
            slug: String(job.jobId || `naukri_${Date.now()}`),
            date: job.createdDate || null, source: 'Naukri Campus'
        }));
    } catch (e) { console.warn(`Naukri Campus: ${e.response?.status||e.code}`); return []; }
}

// Status: HTML scrape with regex + cheerio
async function scrapeInternshalaJobs() {
    try {
        const r = await axios.get(
            'https://internshala.com/jobs/cloud-computing-jobs,cyber-security-jobs,devops-jobs/',
            { timeout: 15000, headers: { ...HEADERS, 'Accept': 'text/html' } }
        );
        const html = typeof r.data === 'string' ? r.data : '';
        if (!html) return [];
        
        const jobs = [];
        
        // Better regex for Internshala job listings
        // Match: job title in data attributes or links
        const jobMatches = html.match(/data-id="(\d+)"[^>]*>[\s\S]*?<div[^>]*class="[^"]*job_title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
        
        if (jobMatches) {
            jobMatches.forEach((match, i) => {
                try {
                    // Extract using a cleaner regex
                    const titleMatch = match.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
                    if (titleMatch) {
                        const url = titleMatch[1];
                        const title = titleMatch[2].trim();
                        if (title.length > 3) {
                            jobs.push(makeJob({
                                title: title,
                                company_name: 'via Internshala',
                                url: url.startsWith('http') ? url : `https://internshala.com${url}`,
                                slug: `internshala_${i}_${Date.now()}`,
                                source: 'Internshala Jobs',
                                location: 'India'
                            }));
                        }
                    }
                } catch (e) {
                    // Continue on regex errors
                }
                if (jobs.length >= 50) return;
            });
        }
        
        // Fallback: simpler regex if first approach failed
        if (jobs.length === 0) {
            const re = /<a[^>]+href="(\/jobs\/[^"#?]+)"[^>]*class="[^"]*job[_-]?title[^"]*"[^>]*>\s*([^<]{3,80})\s*<\/a>/gi;
            let m, i = 0;
            while ((m = re.exec(html)) !== null && i < 50) {
                jobs.push(makeJob({
                    title: m[2].trim(), company_name: 'via Internshala',
                    url: `https://internshala.com${m[1]}`,
                    slug: `internshala_${i}_${Date.now()}`,
                    source: 'Internshala Jobs'
                }));
                i++;
            }
        }
        
        return jobs;
    } catch (e) { console.warn(`Internshala: ${e.response?.status||e.code}`); return []; }
}

// =============================================================================
// UNUSED FALLBACK SCRAPERS — kept as quiet stubs for compatibility
// =============================================================================

async function scrapeLinkedInIndiaJobs() { return []; }
async function scrapeIndeedIndia() { return []; }
async function scrapeDiceTechJobs() { return []; }
async function scrapeGitHubJobs() { return []; }
async function scrapeJustJoinIT() { return []; }
async function scrapeWeWorkRemotely() { return []; }


// =============================================================================
// TEST ALL SCRAPERS — run: node src/services/webScraper.js
// =============================================================================

async function testAllScrapers() {
    const scrapers = [
        { name: 'Amazon',             fn: scrapeAmazonJobs },
        { name: 'Internshala',        fn: scrapeInternshalaJobs },
    ];

    console.log('\n🔍 Testing all scrapers...\n');
    let total = 0, working = 0;
    for (const { name, fn } of scrapers) {
        const t = Date.now();
        const jobs = await fn();
        const elapsed = ((Date.now()-t)/1000).toFixed(1);
        if (jobs.length > 0) {
            console.log(`  ✅ ${name.padEnd(22)} → ${String(jobs.length).padStart(3)} jobs  (${elapsed}s)  e.g. "${(jobs[0]?.title||'').slice(0,45)}"`);
            working++; total += jobs.length;
        } else {
            console.log(`  ❌ ${name.padEnd(22)} → 0 jobs   (${elapsed}s)`);
        }
        await sleep(300);
    }
    console.log(`\n📊 ${working}/${scrapers.length} scrapers working → ${total} total jobs\n`);
}

if (require.main === module) { testAllScrapers(); }

module.exports = {
    scrapeCapgemini, scrapeCognizant, scrapeHexaware, scrapeCoforge,
    scrapeGenpact, scrapePersistent, scrapeAccenture,
    scrapeMphasis, scrapeLTIMindtree, scrapeDXC,
    scrapeTCS, scrapeInfosys, scrapeWipro, scrapeHCL, scrapeTechMahindra,
    scrapeIBM, scrapeDeloitte, scrapeEY,
    scrapeAmazonJobs, scrapeMicrosoftCareers, scrapeOracleJobs, scrapeGoogleCareers,
    scrapeUnstop, scrapeTheMuse, scrapeNaukriCampus, scrapeInternshalaJobs,
    scrapeLinkedInIndiaJobs, scrapeIndeedIndia, scrapeDiceTechJobs,
    scrapeGitHubJobs, scrapeJustJoinIT, scrapeWeWorkRemotely,
    scrapeSmartRecruiters, scrapeWorkday, testAllScrapers,
};
