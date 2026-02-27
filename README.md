# J-Bot - Intelligent Job Alert Bot 🤖

An Azure Function-based Telegram bot that automatically searches for entry-level Azure/Cloud/Security jobs in India from multiple sources and sends intelligent notifications.

## 🎯 Features

### **Multi-Source Job Aggregation**
- Fetches from **7+ job sources**:
  - Arbeitnow
  - RemoteOK
  - JobIcy
  - Reddit (r/forhire, r/devopsjobs, r/jobsinindia, r/indiajobs, r/cscareerquestionsIndia)
  - Remotive
  - Adzuna India
  - LinkedIn Jobs (RSS)

### **Intelligent Filtering**
- ✅ **Pure Technical Roles Only** - Excludes support/sales/non-technical positions
- ✅ **Entry-Level Focus** - Filters for Intern, Junior, Fresher, Graduate positions
- ✅ **India Locations** - Bangalore, Pune, Gurgaon, Delhi NCR, Hyderabad, Jaipur, Noida
- ✅ **Fresher-Friendly Companies** - 80+ companies known to hire freshers
- ✅ **Keyword Matching** - Azure, Cloud, Security, Cybersecurity, DevSecOps
- ✅ **Experience Exclusion** - Automatically excludes Senior, Lead, Manager, 3+ years roles

### **Smart Notifications**
- 📱 Sends formatted Telegram messages with:
  - Job Title & Company
  - Location & Source
  - Role Category (verified technical)
  - Experience Requirements
  - Skills Detected
  - Salary Information
  - Direct Apply Link
- 🎯 Sends up to 6 best matches per trigger
- 🔔 Startup notification when bot begins searching
- 🚫 Duplicate prevention using Azure Table Storage

## 🏗️ Architecture

- **Runtime**: Azure Functions (Node.js 18+)
- **Trigger**: Timer (Every 30 minutes)
- **Storage**: Azure Table Storage (duplicate detection)
- **Notifications**: Telegram Bot API
- **Model**: Node.js v4 Programming Model

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- Azure Functions Core Tools v4
- Azure Storage Account (or Azurite for local dev)
- Telegram Bot Token

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/j-bot.git
   cd j-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure local settings**
   
   Create `local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "WEBSITE_NODE_DEFAULT_VERSION": "~20",
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "TELEGRAM_BOT_TOKEN": "your_telegram_bot_token_here",
       "TELEGRAM_CHAT_ID": "your-chat-id-here"
     }
   }
   ```

4. **Get Telegram credentials**
   - Create bot: Talk to [@BotFather](https://t.me/botfather)
   - Get chat ID: Talk to [@userinfobot](https://t.me/userinfobot)

5. **Start Azurite (for local testing)**
   ```bash
   azurite
   ```

6. **Run locally**
   ```bash
   npm start
   ```

## 📦 Deployment

### Deploy to Azure

1. **Create Azure Function App**
   ```bash
   az functionapp create \
     --resource-group J-Bot \
     --consumption-plan-location centralindia \
     --runtime node \
     --runtime-version 18 \
     --functions-version 4 \
     --name j-bot \
     --storage-account <storage-account-name>
   ```

2. **Configure Application Settings**
   ```bash
   az functionapp config appsettings set \
     --name j-bot \
     --resource-group J-Bot \
     --settings \
     TELEGRAM_BOT_TOKEN="your-bot-token" \
     TELEGRAM_CHAT_ID="your-chat-id" \
     WEBSITE_NODE_DEFAULT_VERSION="~20"
   ```

3. **Deploy using GitHub Actions**
   - Push to `main` branch
   - GitHub Actions will automatically deploy
   - Ensure `AZURE_CREDENTIALS` secret is configured in repository settings

## 🔧 Configuration

### Job Filter Configuration

Edit in `src/functions/jobChecker.js`:

```javascript
// Keywords to include
const INCLUDE_KEYWORDS = ['Azure', 'Cloud', 'Security', 'Cybersecurity', 'DevSecOps'];

// Entry-level indicators
const ENTRY_LEVEL_KEYWORDS = ['Intern', 'Internship', 'Junior', 'Entry', 'Fresher', 'Graduate', '0-1 year', '0 year'];

// Locations in India
const PREFERRED_CITIES = ['Bangalore', 'Bengaluru', 'Pune', 'Gurgaon', 'Gurugram', 'Delhi', 'NCR', 'Hyderabad', 'Jaipur', 'Noida'];

// Maximum jobs per trigger
const MAX_JOBS = 6;
```

### Schedule Configuration

Change timer trigger in `src/functions/jobChecker.js`:

```javascript
app.timer('jobChecker', {
    schedule: '0 */30 * * * *', // Every 30 minutes
    handler: async (myTimer, context) => {
        // ...
    }
});
```

Cron expression format:
- `0 */30 * * * *` - Every 30 minutes
- `0 0 */2 * * *` - Every 2 hours
- `0 0 9 * * *` - Every day at 9 AM

## 📊 Technical Details

### Job Filtering Pipeline

1. **Location Check** - Must be in India/preferred cities
2. **Company Check** - Must be from fresher-friendly companies (or Reddit post)
3. **Experience Exclusion** - No 3+/5+ years, Senior, Lead, Manager
4. **Non-Technical Exclusion** - No support/sales/operations roles
5. **Pure Technical Validation** - Must contain technical role keywords
6. **Required Keywords** - Must have Azure/Cloud/Security keywords
7. **Entry-Level Validation** - Must indicate fresher/entry-level

### Message Format

```
🔥 Job Title (Bold)

🏢 Company: Company Name
📍 Location: City, India
📊 Source: Job Board
💼 Job Type: Full-time
⚙️ Role Category: Software Engineer ✅ (Pure Technical)

👨‍💼 Experience: Entry Level / Fresher
🛠️ Skills: Azure, Python, Docker, Kubernetes
💰 Salary: ₹5-8 LPA or Not disclosed

🧠 Why matched: Azure keyword detected
🔗 Apply: [Direct Link]
```

## 📁 Project Structure

```
J-Bot/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD
├── src/
│   └── functions/
│       └── jobChecker.js       # Main bot logic
├── host.json                   # Azure Functions host config
├── package.json                # Dependencies
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Job data provided by Arbeitnow, RemoteOK, JobIcy, Remotive, Adzuna, Reddit communities
- Built with Azure Functions and Telegram Bot API

## ⚠️ Disclaimer

This bot aggregates publicly available job postings. Always verify job details directly with the employer before applying.

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Made with ❤️ for job seekers in India
