/**
 * ENDPOINT TESTER — Run this locally before deploying
 * 
 * Usage:  node test-endpoints.js
 * 
 * Tests every career page endpoint and tells you:
 *   ✅ WORKS  — returns JSON with jobs
 *   ⚠️  HTML   — returns HTML (JS-rendered, needs browser)
 *   ❌ FAILED  — blocked / wrong URL / needs auth
 * 
 * At the end prints a summary of which sources will actually work.
 */

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = {
    'User-Agent': UA,
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'en-US,en;q=0.9',
};

const results = { works: [], html: [], failed: [] };

async function testGet(name, url, params = {}, extraHeaders = {}) {
    try {
        const r = await axios.get(url, {
            params,
            timeout: 12000,
            headers: { ...HEADERS, ...extraHeaders }
        });
        return analyzeResponse(name, url, r);
    } catch (e) {
        const code = e.response?.status || e.code || 'ERR';
        console.log(`  ❌ ${name.padEnd(30)} ${code} — ${e.message.slice(0, 60)}`);
        results.failed.push({ name, url, reason: `${code}: ${e.message.slice(0, 60)}` });
    }
}

async function testPost(name, url, body, extraHeaders = {}) {
    try {
        const r = await axios.post(url, body, {
            timeout: 12000,
            headers: { ...HEADERS, 'Content-Type': 'application/json', ...extraHeaders }
        });
        return analyzeResponse(name, url, r);
    } catch (e) {
        const code = e.response?.status || e.code || 'ERR';
        console.log(`  ❌ ${name.padEnd(30)} ${code} — ${e.message.slice(0, 60)}`);
        results.failed.push({ name, url, reason: `${code}: ${e.message.slice(0, 60)}` });
    }
}

function analyzeResponse(name, url, r) {
    const ct = r.headers['content-type'] || '';
    const isJson = ct.includes('json') || typeof r.data === 'object';

    if (isJson && typeof r.data === 'object') {
        const d = r.data;
        let jobCount = 0;
        let jobKey = '';

        // Try to find job array
        for (const k of ['content', 'jobs', 'jobPostings', 'results', 'data', 'items', 'jobDetails', 'opportunities']) {
            if (d[k] && Array.isArray(d[k])) {
                jobCount = d[k].length;
                jobKey = k;
                break;
            }
        }
        if (Array.isArray(d)) { jobCount = d.length; jobKey = 'root array'; }

        const totalKey = ['totalResults', 'total', 'count', 'numberOfElements'].find(k => d[k] !== undefined);
        const total = totalKey ? d[totalKey] : '?';

        if (jobCount > 0) {
            console.log(`  ✅ ${name.padEnd(30)} ${r.status} JSON — ${jobCount} jobs in [${jobKey}], total=${total}`);
            results.works.push({ name, url, jobCount, jobKey });
        } else {
            console.log(`  ⚠️  ${name.padEnd(30)} ${r.status} JSON — 0 jobs (empty response) keys=${Object.keys(d).slice(0,5).join(',')}`);
            results.failed.push({ name, url, reason: `JSON but 0 jobs, keys: ${Object.keys(d).slice(0,5).join(',')}` });
        }
    } else {
        const html = typeof r.data === 'string' ? r.data : '';
        const hasJobKeywords = /job-title|jobTitle|job_listing|career-item|position-title/i.test(html);
        console.log(`  ⚠️  ${name.padEnd(30)} ${r.status} HTML — len=${html.length} ${hasJobKeywords ? '(has job markers)' : '(no job markers — JS-rendered)'}`);
        results.html.push({ name, url, hasJobKeywords });
    }
}

async function run() {
    console.log('\n🔍 Testing all career page endpoints...\n');
    console.log('This may take 1-2 minutes. Each test has a 12s timeout.\n');

    // =========================================================================
    console.log('── Free Public Job Board APIs ──────────────────────────────────');
    await testGet('Arbeitnow',         'https://www.arbeitnow.com/api/job-board-api');
    await testGet('RemoteOK',          'https://remoteok.com/api');
    await testGet('Remotive DevOps',   'https://remotive.com/api/remote-jobs', { category: 'devops-sysadmin', limit: 20 });
    await testGet('Remotive Security', 'https://remotive.com/api/remote-jobs', { category: 'cybersecurity', limit: 20 });
    await testGet('JobIcy',            'https://jobicy.com/api/v2/remote-jobs', { count: 20, industry: 'engineering' });
    await testGet('Reddit India',      'https://www.reddit.com/r/jobsInIndia+cscareerquestionsIndia.json', { limit: 25, sort: 'new' });
    await testGet('Unstop',            'https://unstop.com/api/public/opportunity', { type: 'job', 'opportunity-type': 'Fresher Job', page: 1, per_page: 30 });

    // =========================================================================
    console.log('\n── SmartRecruiters Public API (used by many companies) ─────────');
    // SmartRecruiters exposes a public JSON API for all their customers
    const srCompanies = [
        ['Capgemini',    'Capgemini'],
        ['Cognizant',    'Cognizant'],
        ['HCL Tech',     'HCLTech'],
        ['Wipro',        'Wipro'],
        ['Tech Mahindra','TechMahindra'],
        ['Hexaware',     'Hexaware'],
        ['Mphasis',      'Mphasis'],
        ['LTIMindtree',  'LTIMindtree'],
        ['Infosys',      'Infosys'],
        ['TCS',          'TataConsultancyServices'],
        ['Accenture',    'Accenture'],
        ['IBM',          'IBM'],
        ['Deloitte',     'Deloitte'],
        ['EY',           'ErnstYoung'],
        ['DXC Technology','DXCTechnology'],
        ['Persistent',   'PersistentSystems'],
        ['Coforge',      'Coforge'],
        ['Genpact',      'Genpact'],
    ];
    for (const [name, slug] of srCompanies) {
        await testGet(
            `SR: ${name}`,
            `https://api.smartrecruiters.com/v1/companies/${slug}/postings`,
            { limit: 10, q: 'cloud azure devops security' }
        );
        await new Promise(r => setTimeout(r, 200)); // rate limit
    }

    // =========================================================================
    console.log('\n── Workday POST API ─────────────────────────────────────────────');
    // Workday exposes a standard POST endpoint — tenant name must be exact
    const workdayCompanies = [
        ['Mphasis',     'mphasis',      'Mphasis_Careers'],
        ['LTIMindtree', 'ltimindtree',  'LTIMindtree'],
        ['DXC',         'dxc',          'DXC_Careers'],
        ['Capgemini',   'capgemini',    'Capgemini_Careers'],
        ['Hexaware',    'hexaware',     'Hexaware_Careers'],
        ['Deloitte',    'deloitte',     'Deloitte_Careers'],
        ['EY',          'ey',           'EY_Careers'],
        ['Genpact',     'genpact',      'Genpact_Careers'],
        ['Cognizant',   'cognizant',    'Cognizant_Careers'],
        ['Persistent',  'persistentsystems', 'Persistent_Careers'],
    ];
    for (const [name, tenant, board] of workdayCompanies) {
        await testPost(
            `WD: ${name}`,
            `https://${tenant}.wd1.myworkdayjobs.com/wday/cxs/${tenant}/${board}/jobs`,
            { limit: 20, offset: 0, searchText: 'cloud azure devops', locations: [] }
        );
        await new Promise(r => setTimeout(r, 200));
    }

    // =========================================================================
    console.log('\n── Big Tech (Known APIs) ────────────────────────────────────────');
    await testGet('Amazon India',   'https://www.amazon.jobs/en/search.json', { result_limit: 20, country: 'IND', sort: 'relevant' });
    await testGet('Microsoft',      'https://gcsservices.careers.microsoft.com/search/api/v1/search', { l: 'en_us', pg: 1, pgSz: 20, o: 'Recent', flt: 'true' });
    await testGet('Oracle India',   'https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitionsLOV',
        { onlyData: 'true', expand: 'all', finder: 'findReqs;siteNumber=CX,Location=IN', limit: 20 });
    await testPost('Google Careers','https://careers.google.com/api/v3/search/',
        { location: 'India', employment_type: ['FULL_TIME'], page_size: 20 });

    // =========================================================================
    console.log('\n── India-Specific Portals ───────────────────────────────────────');
    await testGet('Naukri Campus',  'https://www.naukri.com/campus-api/v3/job/search',
        { noOfResults: 20, urlType: 'search_by_keyword', searchType: 'adv', keyword: 'cloud azure devops', location: 'India', experience: 0 },
        { appid: '109', systemid: '109', Referer: 'https://campus.naukri.com/' });
    await testGet('Internshala',    'https://internshala.com/jobs/cloud-computing-jobs,devops-jobs/');
    await testGet('The Muse',       'https://www.themuse.com/api/public/jobs',
        { page: 1, descending: true, level: 'Entry Level', category: 'IT' });

    // =========================================================================
    console.log('\n── Company-Specific APIs ────────────────────────────────────────');
    await testGet('IBM Careers',    'https://careers.ibm.com/api/jobs/search', { keywords: 'cloud azure', location: 'India', limit: 20 });
    await testGet('Infosys',        'https://career.infosys.com/jobservice/getCareersPage', { location: 'India', technology: 'Cloud', limit: 20 });
    await testGet('TCS iBegin',     'https://ibegin.tcs.com/iBegin/jobs/search');
    await testPost('TCS iBegin POST','https://ibegin.tcs.com/iBegin/jobs/search',
        { keywords: 'cloud azure devops security', location: '', pageNo: 1, pageSize: 30 });
    await testGet('Accenture',      'https://www.accenture.com/api/sitecore/CareerSearchAjax/GetJobsByFilter',
        { Keywords: 'cloud azure', Location: 'India', CurrentPage: 1, PageSize: 10 });
    await testGet('HCL API',        'https://www.hcltech.com/careers/api/jobs', { skill: 'cloud', location: 'India' });

    // =========================================================================
    // PRINT SUMMARY
    console.log('\n\n════════════════════════════════════════════════════════════════');
    console.log('📊 RESULTS SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');

    console.log(`\n✅ WORKING (${results.works.length}) — These will return real jobs:`);
    results.works.forEach(r => console.log(`   • ${r.name} → ${r.jobCount} jobs`));

    console.log(`\n⚠️  HTML PAGES (${results.html.length}) — JavaScript-rendered, need browser:`);
    results.html.forEach(r => console.log(`   • ${r.name} ${r.hasJobKeywords ? '(has job markers — regex might work)' : '(fully JS-rendered)'}`));

    console.log(`\n❌ FAILED (${results.failed.length}) — Blocked or wrong URL:`);
    results.failed.forEach(r => console.log(`   • ${r.name} — ${r.reason}`));

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`\n💡 Action plan:`);
    console.log(`   1. Working sources → already good, use them`);
    console.log(`   2. HTML with job markers → try regex extraction`);
    console.log(`   3. Failed with 403/401 → needs auth, skip or use LinkedIn/Naukri instead`);
    console.log(`   4. Failed with 404 → wrong URL, find correct one via browser Network tab`);
    console.log('');
}

run().catch(console.error);
