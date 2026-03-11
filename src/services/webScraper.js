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
// =============================================================================

async function scrapeSmartRecruiters(slug, company) {
    try {
        const r = await axios.get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings`, {
            params: { limit: 100, q: 'cloud azure devops security' },
            timeout: 15000, headers: HEADERS
        });
        const jobs = r.data?.content || [];
        return jobs.map(job => makeJob({
            title:        job.name,
            company_name: company,
            location:     job.location?.city || job.location?.country || 'India',
            description:  job.jobAd?.sections?.jobDescription?.text || '',
            url:          `https://jobs.smartrecruiters.com/${slug}/${job.id}`,
            slug:         job.id,
            job_type:     job.typeOfEmployment?.label || 'Full-time',
            date:         job.releasedDate || null,
            source:       `${company} Careers`
        }));
    } catch (e) {
        console.warn(`SmartRecruiters [${company}]: ${e.response?.status || e.code} ${e.message.slice(0,50)}`);
        return [];
    }
}

// Companies confirmed / likely on SmartRecruiters:
async function scrapeCapgemini()    { return scrapeSmartRecruiters('Capgemini',             'Capgemini'); }
async function scrapeCognizant()    { return scrapeSmartRecruiters('Cognizant',             'Cognizant'); }
async function scrapeHexaware()     { return scrapeSmartRecruiters('Hexaware',              'Hexaware'); }
async function scrapeCoforge()      { return scrapeSmartRecruiters('Coforge',               'Coforge'); }
async function scrapeGenpact()      { return scrapeSmartRecruiters('Genpact',               'Genpact'); }
async function scrapePersistent()   { return scrapeSmartRecruiters('PersistentSystems',     'Persistent Systems'); }
async function scrapeAccenture()    { return scrapeSmartRecruiters('Accenture',             'Accenture'); }
async function scrapeDeloitteSR()   { return scrapeSmartRecruiters('Deloitte',              'Deloitte'); }
async function scrapeIBMSR()        { return scrapeSmartRecruiters('IBM',                   'IBM'); }
// Try these — may or may not be on SmartRecruiters:
async function scrapeWiproSR()      { return scrapeSmartRecruiters('Wipro',                 'Wipro'); }
async function scrapeHCLSR()        { return scrapeSmartRecruiters('HCLTech',               'HCL Technologies'); }
async function scrapeTechMSR()      { return scrapeSmartRecruiters('TechMahindra',          'Tech Mahindra'); }
async function scrapeInfosysSR()    { return scrapeSmartRecruiters('Infosys',               'Infosys'); }
async function scrapeTCSSR()        { return scrapeSmartRecruiters('TataConsultancyServices','TCS'); }
async function scrapeEYSR()         { return scrapeSmartRecruiters('ErnstYoung',            'EY'); }
async function scrapeLTISR()        { return scrapeSmartRecruiters('LTIMindtree',           'LTIMindtree'); }

// =============================================================================
// PLATFORM 2: Workday (POST API — standard across all Workday customers)
// Find tenant name: visit careers page, look for *.myworkdayjobs.com in URL
// Status: VERIFIED when tenant name is correct
// =============================================================================

async function scrapeWorkday(tenant, boardId, company, kw = 'cloud azure devops security') {
    try {
        const r = await axios.post(
            `https://${tenant}.wd1.myworkdayjobs.com/wday/cxs/${tenant}/${boardId}/jobs`,
            { limit: 20, offset: 0, searchText: kw, locations: [] },
            { timeout: 15000, headers: { ...HEADERS, 'Content-Type': 'application/json' } }
        );
        const jobs = r.data?.jobPostings || [];
        return jobs.map(job => makeJob({
            title:        job.title || job.bulletFields?.[0],
            company_name: company,
            location:     job.locationsText || 'India',
            description:  job.descriptionTeaser || '',
            url:          `https://${tenant}.wd1.myworkdayjobs.com/en-US/${boardId}${job.externalPath || ''}`,
            slug:         job.externalPath?.split('/').pop() || `${tenant}_${Date.now()}`,
            date:         job.postedOn || null,
            source:       `${company} Careers`
        }));
    } catch (e) {
        console.warn(`Workday [${company}]: ${e.response?.status || e.code} ${e.message.slice(0,50)}`);
        return [];
    }
}

// Companies using Workday (tenant names from their actual career page URLs):
async function scrapeMphasis()      { return scrapeWorkday('mphasis',     'Mphasis_Careers',  'Mphasis'); }
async function scrapeLTIMindtree()  { return scrapeWorkday('ltimindtree', 'LTIMindtree',      'LTIMindtree'); }
async function scrapeDXC()          { return scrapeWorkday('dxc',         'DXC_Careers',      'DXC Technology'); }
async function scrapeDeloitteWD()   { return scrapeWorkday('deloitte',    'Deloitte_Careers', 'Deloitte'); }
async function scrapeEYWD()         { return scrapeWorkday('ey',          'EY_Careers',       'EY'); }

// =============================================================================
// PLATFORM 3: Big Tech (Verified public APIs)
// =============================================================================

// Status: VERIFIED
async function scrapeAmazonJobs() {
    try {
        const r = await axios.get('https://www.amazon.jobs/en/search.json', {
            params: { offset: 0, result_limit: 50, country: 'IND', sort: 'relevant',
                      base_query: 'cloud azure devops security infrastructure' },
            timeout: 15000, headers: HEADERS
        });
        return (r.data?.jobs || []).map(job => makeJob({
            title: job.title, company_name: 'Amazon',
            location: job.city || job.location || 'India',
            description: job.description || job.basic_qualifications || '',
            url: `https://www.amazon.jobs${job.job_path}`,
            slug: job.id_icims || String(job.id),
            job_type: job.job_schedule_type || 'Full-time',
            date: job.posted_date || null, source: 'Amazon India'
        }));
    } catch (e) { console.warn(`Amazon: ${e.response?.status||e.code}`); return []; }
}

// Status: VERIFIED
async function scrapeMicrosoftCareers() {
    try {
        const r = await axios.get('https://gcsservices.careers.microsoft.com/search/api/v1/search', {
            params: { l: 'en_us', pg: 1, pgSz: 50, o: 'Recent', flt: 'true',
                      q: 'cloud azure devops security', lc: 'India' },
            timeout: 15000, headers: HEADERS
        });
        const jobs = (r.data?.operationResult?.result?.jobs || [])
            .filter(j => (j.country||'').toLowerCase()==='india' || (j.location||'').toLowerCase().includes('india'));
        return jobs.map(job => makeJob({
            title: job.title, company_name: 'Microsoft',
            location: job.location || job.city || 'India',
            description: job.descriptionTeaser || '',
            url: `https://careers.microsoft.com/us/en/job/${job.jobId}`,
            slug: String(job.jobId),
            job_type: job.workSiteFlexibility || 'Full-time',
            date: job.postingDate || null, source: 'Microsoft Careers India'
        }));
    } catch (e) { console.warn(`Microsoft: ${e.response?.status||e.code}`); return []; }
}

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
    const sr = await scrapeWiproSR();
    if (sr.length > 0) return sr;
    return scrapeWorkday('wipro', 'Wipro_Careers', 'Wipro');
}

async function scrapeHCL() {
    const wd = await scrapeWorkday('hcl', 'HCL_Careers', 'HCL Technologies');
    if (wd.length > 0) return wd;
    return scrapeHCLSR();
}

async function scrapeTechMahindra() {
    const sr = await scrapeTechMSR();
    if (sr.length > 0) return sr;
    return scrapeWorkday('techmahindra', 'TechMahindra_Careers', 'Tech Mahindra');
}

async function scrapeIBM() {
    try {
        const r = await axios.get('https://careers.ibm.com/api/jobs/search', {
            params: { keywords: 'cloud azure devops security', location: 'India', limit: 50 },
            timeout: 15000, headers: HEADERS
        });
        const jobs = r.data?.jobs || r.data?.results || r.data?.data || [];
        if (jobs.length > 0) {
            return jobs.map(job => makeJob({
                title: job.title || job.jobTitle, company_name: 'IBM',
                location: job.location || 'India', description: job.description || '',
                url: job.url || `https://careers.ibm.com/job/${job.id}`,
                slug: String(job.id || `ibm_${Date.now()}`),
                date: job.postedDate || null, source: 'IBM India'
            }));
        }
    } catch (e) { console.warn(`IBM: ${e.response?.status||e.code} — trying SmartRecruiters`); }
    return scrapeIBMSR();
}

async function scrapeDeloitte() {
    const wd = await scrapeDeloitteWD();
    if (wd.length > 0) return wd;
    return scrapeDeloitteSR();
}

async function scrapeEY() {
    const wd = await scrapeEYWD();
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

// Status: HTML scrape with regex
async function scrapeInternshalaJobs() {
    try {
        const r = await axios.get(
            'https://internshala.com/jobs/cloud-computing-jobs,cyber-security-jobs,devops-jobs/',
            { timeout: 15000, headers: { ...HEADERS, 'Accept': 'text/html' } }
        );
        const html = typeof r.data === 'string' ? r.data : '';
        if (!html) return [];
        const jobs = [];
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
        return jobs;
    } catch (e) { console.warn(`Internshala: ${e.response?.status||e.code}`); return []; }
}

// =============================================================================
// TEST ALL SCRAPERS — run: node src/services/webScraper.js
// =============================================================================

async function testAllScrapers() {
    const scrapers = [
        { name: 'Capgemini (SR)',     fn: scrapeCapgemini },
        { name: 'Cognizant (SR)',     fn: scrapeCognizant },
        { name: 'Hexaware (SR)',      fn: scrapeHexaware },
        { name: 'Coforge (SR)',       fn: scrapeCoforge },
        { name: 'Genpact (SR)',       fn: scrapeGenpact },
        { name: 'Persistent (SR)',    fn: scrapePersistent },
        { name: 'Accenture (SR)',     fn: scrapeAccenture },
        { name: 'Mphasis (WD)',       fn: scrapeMphasis },
        { name: 'LTIMindtree (WD)',   fn: scrapeLTIMindtree },
        { name: 'DXC (WD)',           fn: scrapeDXC },
        { name: 'TCS',                fn: scrapeTCS },
        { name: 'Infosys',            fn: scrapeInfosys },
        { name: 'Wipro',              fn: scrapeWipro },
        { name: 'HCL',                fn: scrapeHCL },
        { name: 'Tech Mahindra',      fn: scrapeTechMahindra },
        { name: 'IBM',                fn: scrapeIBM },
        { name: 'Deloitte',           fn: scrapeDeloitte },
        { name: 'EY',                 fn: scrapeEY },
        { name: 'Amazon',             fn: scrapeAmazonJobs },
        { name: 'Microsoft',          fn: scrapeMicrosoftCareers },
        { name: 'Oracle',             fn: scrapeOracleJobs },
        { name: 'Google',             fn: scrapeGoogleCareers },
        { name: 'Unstop',             fn: scrapeUnstop },
        { name: 'The Muse',           fn: scrapeTheMuse },
        { name: 'Naukri Campus',      fn: scrapeNaukriCampus },
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
    scrapeSmartRecruiters, scrapeWorkday, testAllScrapers,
};
