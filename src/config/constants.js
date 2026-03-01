/**
 * Configuration constants for J-Bot
 * All keywords, filters, and settings in one place
 */

// Time window configuration (used only for FIRST run, then switches to incremental)
const TIME_WINDOWS = {
    DAY: 1,
    WEEK: 7,
    MONTH: 30
};

// Azure Table Storage configuration
const TABLE_NAME = 'jobalerts';
const TABLE_META = 'jobmetadata';
const PARTITION_KEY = 'jobs';
const MAX_JOBS_PER_RUN = 50; // Maximum jobs to send in one run
const MAX_SCAN_LIMIT = 500; // Stop scanning after this limit

// Cloud/Infrastructure keywords (your primary target)
const INCLUDE_KEYWORDS = [
    // Azure ecosystem (your primary target)
    'Azure', 'Microsoft Azure', 'Azure DevOps', 'Azure Cloud',
    // Other cloud platforms
    'AWS', 'GCP', 'Google Cloud', 'Multi-cloud', 'Cloud Engineer',
    'Cloud Administrator', 'Cloud Architect', 'Cloud Operations',
    'Cloud Infrastructure', 'Cloud Platform',
    // Security (ops-focused)
    'Security', 'Cybersecurity', 'DevSecOps', 'AppSec', 'InfoSec',
    'SOC', 'VAPT', 'Ethical Hacking', 'Penetration Testing',
    // Infrastructure / DevOps
    'DevOps', 'Kubernetes', 'Docker', 'Terraform', 'Ansible',
    'Infrastructure', 'Site Reliability', 'Platform Engineering',
    // Networking
    'Network Engineer', 'Network Security', 'Network Infrastructure',
];

// Entry-level keywords (0-2 years of experience)
const ENTRY_LEVEL_KEYWORDS = [
    'Intern', 'Internship', 'Junior', 'Entry', 'Fresher', 'Graduate', 
    '0-1 year', '0 year', '1 year', '1-2 year', '1-2 years', '0-2 year', '0-2 years',
    'Entry Level', 'Entry-Level'
];

// Exclude senior positions (3+ years)
const EXCLUDE_KEYWORDS = [
    '3+ years', '4+ years', '5+ years', '6+ years', 
    'Senior', 'Lead', 'Manager', 'Architect', 'Principal'
];

// Non-technical role exclusions - MUST NOT contain these
const NON_TECHNICAL_KEYWORDS = [
    // Help desk / L1 support
    'Help Desk', 'Helpdesk', 'L1 Support', 'L2 Support',
    'Desktop Support', 'Service Desk',
    'Customer Support', 'Customer Service', 'Client Support',
    // Sales & Marketing
    'Sales Executive', 'Business Development', 'BDM', 'BDE',
    'Account Manager', 'Relationship Manager', 'Customer Success',
    'Pre-Sales', 'Presales', 'Social Media',
    // Admin / non-tech
    'Data Entry', 'Back Office', 'Content Creator', 'Community Manager',
    // HR
    'Recruiter', 'HR Executive', 'Human Resources',
    // Non-technical testing
    'Manual Testing',
    // Coding/DSA-heavy roles to avoid
    'Software Developer', 'Software Engineer', 'Backend Developer',
    'Frontend Developer', 'Full Stack Developer', 'Programmer',
    'Mobile Developer', 'Android Developer', 'iOS Developer',
    'Machine Learning Engineer', 'Data Scientist', 'AI Engineer',
    'Buchhalter', 'Controller',
];

// Pure technical role indicators - MUST contain at least one
const PURE_TECHNICAL_KEYWORDS = [
    // Cloud-specific roles
    'Cloud Engineer', 'Cloud Administrator', 'Cloud Architect', 'Cloud Consultant',
    'Cloud Operations', 'Cloud Support Engineer', 'Cloud Analyst',
    'Solutions Architect', 'Infrastructure Engineer', 'Infrastructure Analyst',
    // Azure-specific
    'Azure Engineer', 'Azure Administrator', 'Azure Architect', 'Azure Consultant',
    // DevOps / Platform / SRE
    'DevOps Engineer', 'DevOps Analyst', 'Platform Engineer',
    'Site Reliability Engineer', 'Systems Engineer', 'Systems Administrator',
    'Network Administrator', 'Network Engineer',
    // Security roles
    'Security Engineer', 'Security Analyst', 'Cybersecurity Engineer', 'DevSecOps Engineer',
    'SOC Analyst', 'Vulnerability Analyst', 'Security Operations',
    'Penetration Tester', 'InfoSec', 'AppSec',
    // Indian fresher titles
    'Graduate Engineer Trainee', 'Associate Engineer', 'Trainee Engineer',
    'Technology Analyst', 'Cloud Associate', 'Infrastructure Associate',
];

// Location filters - India only
const INDIA_KEYWORDS = ['India', 'Bharat', ', IN', '(IN)', 'Indian'];

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

// Fresher-friendly companies (known to hire for Cloud/Security in India)
const FRESHER_FRIENDLY_COMPANIES = [
    // Big Tech
    'Microsoft', 'Google', 'Amazon', 'AWS', 'IBM', 'Oracle', 'SAP', 'Adobe', 'Apple', 'Meta', 'Facebook',
    // Indian IT Giants
    'TCS', 'Tata Consultancy', 'Infosys', 'Wipro', 'HCL', 'Tech Mahindra', 'LTI', 'LTIMindtree', 'Mindtree',
    'Cognizant', 'Mphasis', 'Hexaware', 'Persistent', 'Coforge',
    // Global Consulting
    'Accenture', 'Deloitte', 'Capgemini', 'EY', 'PwC', 'KPMG', 'Genpact', 'DXC Technology',
    // Cloud & DevOps
    'Cloudflare', 'Atlassian', 'HashiCorp', 'Red Hat', 'VMware', 'Nutanix', 'Cisco',
    // Cybersecurity
    'Palo Alto Networks', 'CrowdStrike', 'Fortinet', 'Zscaler', 'McAfee', 'Symantec', 'Check Point',
    'Rapid7', 'Qualys', 'Trend Micro',
    // Indian Tech/Startups
    'Zoho', 'Freshworks', 'PayTM', 'Paytm', 'PhonePe', 'Razorpay', 'Zomato', 'Swiggy', 'Flipkart', 'Ola',
    'MakeMyTrip', 'BookMyShow', 'Nykaa', 'CRED', 'Udaan', 'Meesho', 'Dunzo', 'Urban Company',
    // E-commerce
    'Walmart', 'Target', 'Myntra', 'Shopify', 'Amazon India',
    // Financial Services
    'JP Morgan', 'Goldman Sachs', 'Morgan Stanley', 'Barclays', 'HSBC', 'Mastercard', 'Visa',
    'American Express', 'Deutsche Bank', 'Paytm Payments Bank', 'ICICI Bank', 'HDFC Bank',
    // Product Companies
    'Salesforce', 'ServiceNow', 'Workday', 'Intuit', 'PayPal', 'Stripe', 'Square', 'Qualcomm',
    'Intel', 'AMD', 'NVIDIA', 'Broadcom', 'Texas Instruments',
    // Energy
    'Chevron', 'Shell', 'BP', 'ExxonMobil', 'Schlumberger', 'Halliburton',
    // Telecom
    'Jio', 'Reliance Jio', 'Airtel', 'Vodafone', 'Nokia', 'Ericsson',
    // Consulting
    'Boston Consulting', 'BCG', 'McKinsey', 'Bain', 'Booz Allen'
];

// Skill keywords for extraction
const SKILL_KEYWORDS = [
    'Azure', 'AWS', 'GCP', 'Cloud', 'Docker', 'Kubernetes', 'DevOps',
    'Python', 'Java', 'JavaScript', 'Node.js', 'React', 'Angular',
    'Security', 'Cybersecurity', 'DevSecOps', 'CI/CD', 'Git', 'Linux',
    'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'Redis',
    'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions'
];

module.exports = {
    TIME_WINDOWS,
    TABLE_NAME,
    TABLE_META,
    PARTITION_KEY,
    MAX_JOBS_PER_RUN,
    MAX_SCAN_LIMIT,
    INCLUDE_KEYWORDS,
    ENTRY_LEVEL_KEYWORDS,
    EXCLUDE_KEYWORDS,
    NON_TECHNICAL_KEYWORDS,
    PURE_TECHNICAL_KEYWORDS,
    INDIA_KEYWORDS,
    PREFERRED_CITIES,
    FRESHER_FRIENDLY_COMPANIES,
    SKILL_KEYWORDS
};
