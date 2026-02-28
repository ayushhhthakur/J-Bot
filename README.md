# J-Bot - Intelligent Job Alert Bot 🤖

Azure Function-based Telegram bot that searches for entry-level Azure/Cloud/Security jobs in India from 11 sources and sends smart notifications daily.

## 🎯 Features

- **11 Job Sources**: Arbeitnow, RemoteOK, JobIcy, Reddit (6 subreddits), Remotive, Adzuna India, JSearch (LinkedIn/Indeed/Glassdoor), The Muse, FindJob.in, Wellfound, Freshteam
- **Smart Filtering**: Pure technical roles only, 0-2 years experience, India locations
- **Relevance Scoring**: Jobs ranked by keywords, company reputation, recency, salary transparency
- **Telegram Alerts**: Clean, concise job notifications with all essential info
- **Duplicate Prevention**: Azure Table Storage + in-memory deduplication
- **Time Windows**: Configurable (1 day / 7 days / 30 days)
- **Cost Efficient**: Runs daily at 10 AM IST (free tier)

## 🏗️ Tech Stack

- Azure Functions (Node.js 20+ / v4 Programming Model)
- Azure Table Storage (duplicate tracking)
- Telegram Bot API
- Timer Trigger (Daily at 10:00 AM IST)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Azure Functions Core Tools v4
- Telegram Bot (get token from [@BotFather](https://t.me/botfather))
- Telegram Chat ID (get from [@userinfobot](https://t.me/userinfobot))

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/j-bot.git
   cd j-bot
   npm install
   ```

2. **Configure settings**
   
   Create `local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "TELEGRAM_BOT_TOKEN": "your_bot_token",
       "TELEGRAM_CHAT_ID": "your_chat_id",
       "JOB_WINDOW": "MONTH"
     }
   }
   ```

### ⚡ Running Locally (IMPORTANT)

**Your Azure Function requires Azure Storage even locally.**

Timer triggers need storage for:
- Schedule locking
- Execution tracking  
- Duplicate detection

#### Option 1: Azurite (Recommended)

**Install Azurite globally**
```bash
npm install -g azurite
```

**Start Azurite** (keep running in separate terminal)
```bash
azurite
```

You should see:
```
Azurite Blob service is listening on 127.0.0.1:10000
Azurite Queue service is listening on 127.0.0.1:10001
Azurite Table service is listening on 127.0.0.1:10002
```

**Then run your function**
```bash
npm start
```

#### Option 2: Use Azure Storage Account

Update `local.settings.json`:
```json
"AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=your-key;EndpointSuffix=core.windows.net"
```

### 🔍 Troubleshooting

**Error: "connect ECONNREFUSED 127.0.0.1:10000"**
- **Cause**: Azurite is not running
- **Fix**: Start Azurite in a separate terminal (`azurite`)

**Function crashes on startup**
- Check Azurite is running on port 10000
- Verify `local.settings.json` has correct `AzureWebJobsStorage`

## 📦 Deployment to Azure

1. **Create Function App**
   ```bash
   az functionapp create \
     --resource-group J-Bot \
     --consumption-plan-location centralindia \
     --runtime node \
     --runtime-version 20 \
     --functions-version 4 \
     --name j-bot \
     --storage-account <storage-account>
   ```

2. **Configure Environment Variables**
   ```bash
   az functionapp config appsettings set \
     --name j-bot \
     --resource-group J-Bot \
     --settings \
     TELEGRAM_BOT_TOKEN="your-token" \
     TELEGRAM_CHAT_ID="your-chat-id" \
     JOB_WINDOW="MONTH"
   ```

3. **Deploy**
   ```bash
   func azure functionapp publish j-bot
   ```

## ⚙️ Configuration

### Time Window

Set in `local.settings.json`:
```json
"JOB_WINDOW": "DAY"    // Options: DAY (1 day), WEEK (7 days), MONTH (30 days)
```

### API Keys (Optional)

For more job sources:
```json
"ADZUNA_APP_ID": "your_id",
"ADZUNA_APP_KEY": "your_key",
"RAPIDAPI_KEY": "your_key"
```

Bot works without these - 7 sources are free, 4 require API keys.

### Modify Filters

Edit `src/functions/jobChecker.js`:
- `INCLUDE_KEYWORDS` - Job keywords to match
- `PREFERRED_CITIES` - India locations
- `FRESHER_FRIENDLY_COMPANIES` - Target companies

### Change Schedule

```javascript
schedule: '0 0 10 * * *'  // Daily at 10 AM (default)
schedule: '0 */30 * * * *'  // Every 30 minutes
schedule: '0 0 */2 * * *'  // Every 2 hours
```

## 🏆 How It Works

### Job Filtering Pipeline

1. **Location** - India cities only
2. **Experience** - Excludes 3+ years, Senior, Lead  
3. **Role Type** - Pure technical only (no support/sales)
4. **Keywords** - Must have Azure/Cloud/Security terms
5. **Entry Level** - 0-2 years experience
6. **Scoring** - Ranks by relevance (0-150 points)
7. **Selection** - Sends all matching jobs

### Relevance Scoring

**Score Factors:**
- Azure (+30) | Cloud (+20) | Security (+20) | DevSecOps (+25)
- Fresher/Intern (+20) | Entry Level (+15)
- Known companies (+15)
- Recent posts: Today (+20), ≤3 days (+10)
- Salary disclosed (+10)
- Preferred cities (+5-8)

**Rating:**
- ⭐⭐⭐⭐⭐ Excellent (100+)
- ⭐⭐⭐⭐ Great (80-99)
- ⭐⭐⭐ Good (60-79)
- ⭐⭐ Fair (40-59)
- ⭐ Basic (<40)

### Telegram Message Format

```
🔥 [Job Title]

🏢 [Company]
📍 [Location]
💼 [Job Type] | [Experience]
💰 [Salary]

⭐⭐⭐⭐⭐ Excellent Match
🔗 [Apply Link]
```

## 📁 Project Structure

```
J-Bot/
├── src/
│   └── functions/
│       └── jobChecker.js      # Main bot
├── host.json                  # Function config
├── local.settings.json        # Local env vars
├── package.json               # Dependencies
└── README.md                  # Documentation
```

## 📝 License

MIT License - Feel free to use and modify

## 🙏 Credits

Job data from: Arbeitnow, RemoteOK, JobIcy, Remotive, Adzuna, JSearch, The Muse, FindJob.in, Wellfound, Freshteam, Reddit communities

Built with: Azure Functions, Telegram Bot API, Node.js

---

**Made for job seekers in India** 🇮🇳
