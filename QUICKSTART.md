# Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
npm install -g azurite
npm install -g azure-functions-core-tools@4
```

### 2. Get Telegram Credentials
- Bot Token: Talk to [@BotFather](https://t.me/botfather) on Telegram
- Chat ID: Talk to [@userinfobot](https://t.me/userinfobot) on Telegram

### 3. Configure
Create `local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "TELEGRAM_BOT_TOKEN": "YOUR_BOT_TOKEN_HERE",
    "TELEGRAM_CHAT_ID": "YOUR_CHAT_ID_HERE",
    "JOB_WINDOW": "MONTH"
  }
}
```

### 4. Run

**Terminal 1 - Start Azurite (Storage Emulator)**
```bash
npm run start:storage
```

**Terminal 2 - Start Function**
```bash
npm start
```

That's it! The bot will run immediately and check for jobs.

## ⚠️ Common Issues

**Error: "ECONNREFUSED 127.0.0.1:10000"**
- Azurite is not running
- Start it with: `npm run start:storage`

**No jobs found**
- Normal! The bot filters heavily for quality
- Change `JOB_WINDOW` to `"MONTH"` for more results

## 🎯 Next Steps

- See [README.md](README.md) for full documentation
- Customize filters in `src/functions/jobChecker.js`
- Deploy to Azure for 24/7 operation
