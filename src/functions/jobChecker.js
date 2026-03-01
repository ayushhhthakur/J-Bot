/**
 * J-Bot - Intelligent Job Alert Bot for Telegram
 * 
 * Azure Function that automatically searches for entry-level Azure/Cloud/Security jobs
 * in India from multiple sources and sends intelligent Telegram notifications.
 * 
 * @module jobChecker
 * @description Timer-triggered function (runs daily at 10:00 AM IST) that:
 *   - Fetches jobs from 11 sources with INCREMENTAL SCANNING (only new jobs since last run)
 *   - Filters for pure technical roles only (no support/sales)
 *   - Targets entry-level positions with 0-2 years of experience
 *   - Focuses on India locations (Bangalore, Pune, Gurgaon, Delhi NCR, Hyderabad, etc.)
 *   - Prevents duplicates using Azure Table Storage
 *   - Sends formatted alerts to Telegram (all matched jobs, sorted by relevance)
 * 
 * @author J-Bot Contributors
 * @license MIT
 * @version 2.0.0 - Refactored with modular architecture and incremental scanning
 */

const { app } = require('@azure/functions');

// Import modular services
const { TIME_WINDOWS, MAX_SCAN_LIMIT } = require('../config/constants');
const { generateStableId } = require('../models/job');
const { fetchJobsIncremental } = require('../services/jobFetcher');
const { filterJob } = require('../services/jobFilter');
const { scoreJob } = require('../services/jobScorer');
const { 
    sendSearchStarted, 
    sendSearchComplete, 
    sendNoJobsFound, 
    sendJobAlert 
} = require('../services/telegramService');
const {
    initializeTableClients,
    ensureTablesExist,
    isJobProcessed,
    markJobAsProcessed,
    getLastRunMetadata,
    updateMetadata
} = require('../storage/tableStorage');

/**
 * Get configured time window from environment (used for first run only)
 * @returns {number} - Number of days
 */
function getTimeWindow() {
    const windowConfig = process.env.JOB_WINDOW || 'MONTH';
    return TIME_WINDOWS[windowConfig] || TIME_WINDOWS.MONTH;
}

/**
 * Main job checker handler with INCREMENTAL SCANNING
 * 
 * NEW EFFICIENCY IMPROVEMENT:
 * - First run: Uses configured time window (DAY/WEEK/MONTH)
 * - Subsequent runs: Only fetches jobs posted SINCE last run (no overlap!)
 * - Stores lastRunAt timestamp in metadata table
 * - This eliminates rescanning the same jobs every day
 */
app.timer('jobChecker', {
    schedule: '0 30 4 * * *', // 10:00 AM IST = 4:30 AM UTC
    runOnStartup: false,
    handler: async (myTimer, context) => {
        const startTime = new Date();
        context.log('\n' + '='.repeat(60));
        context.log('🚀 J-Bot Job Alert Started at:', startTime.toISOString());
        context.log('='.repeat(60));

        let stats = {
            totalFetched: 0,
            totalNew: 0,
            totalMatched: 0,
            duplicatesSkipped: 0,
            totalSent: 0,
            scanMode: 'incremental'
        };
        
        const seenInThisRun = new Set();

        try {
            // === STEP 1: Initialize Azure Table Storage ===
            const connectionString = process.env.AzureWebJobsStorage;
            if (!connectionString) {
                throw new Error('AzureWebJobsStorage connection string not configured');
            }

            const { jobsClient, metaClient } = initializeTableClients(connectionString);
            await ensureTablesExist(jobsClient, metaClient, context);

            // === STEP 2: Get last run metadata (for incremental scanning) ===
            const lastRunMeta = await getLastRunMetadata(metaClient, context);
            const lastRunTimestamp = lastRunMeta?.lastRunAt || null;
            const fallbackDays = getTimeWindow();
            
            const isIncremental = !!lastRunTimestamp;
            stats.scanMode = isIncremental ? 'incremental' : `first-run-${fallbackDays}d`;
            
            if (isIncremental) {
                context.log(`🔄 INCREMENTAL MODE: Fetching jobs posted after ${new Date(lastRunTimestamp).toISOString()}`);
            } else {
                context.log(`🆕 FIRST RUN: Using ${fallbackDays}-day time window`);
            }

            // === STEP 3: Send startup notification ===
            await sendSearchStarted(fallbackDays, isIncremental, context);

            // === STEP 4: Fetch jobs (incremental) ===
            const allJobs = await fetchJobsIncremental(context, lastRunTimestamp, fallbackDays);
            stats.totalFetched = allJobs.length;
            stats.totalNew = allJobs.length;
            
            context.log(`\n📊 Fetched ${allJobs.length} ${isIncremental ? 'new' : 'total'} jobs`);

            // === STEP 5: Apply scan limit (performance) ===
            const jobsToProcess = allJobs.slice(0, MAX_SCAN_LIMIT);
            if (allJobs.length > MAX_SCAN_LIMIT) {
                context.log(`⚠️ Limiting scan to ${MAX_SCAN_LIMIT} jobs`);
            }

            // === STEP 6: Filter, score, and deduplicate jobs ===
            context.log(`\n🔍 Filtering ${jobsToProcess.length} jobs...`);
            const matchedJobs = [];

            for (const job of jobsToProcess) {
                // Generate stable ID
                const jobId = generateStableId(job);
                
                // In-memory deduplication
                if (seenInThisRun.has(jobId)) {
                    stats.duplicatesSkipped++;
                    continue;
                }
                seenInThisRun.add(jobId);
                
                // Apply filters
                const filterResult = filterJob(job);
                if (!filterResult.match) {
                    continue;
                }
                
                // Check storage for duplicates
                const alreadyProcessed = await isJobProcessed(jobsClient, jobId, context);
                if (alreadyProcessed) {
                    context.log(`⏭️  Skipping duplicate: ${job.title}`);
                    stats.duplicatesSkipped++;
                    continue;
                }
                
                // Calculate relevance score
                const score = scoreJob(job);
                
                matchedJobs.push({
                    ...job,
                    slug: jobId,
                    matchedKeyword: filterResult.matchedKeyword,
                    relevanceScore: score
                });
                
                context.log(`✅ Match: ${job.title} at ${job.company_name || 'Unknown'} - Score: ${score}`);
            }

            stats.totalMatched = matchedJobs.length;
            
            // === STEP 7: Sort by relevance ===
            matchedJobs.sort((a, b) => b.relevanceScore - a.relevanceScore);
            
            context.log(`\n📊 Filtering complete:`);
            context.log(`   • Total fetched: ${stats.totalFetched}`);
            context.log(`   • After filters: ${stats.totalMatched}`);
            context.log(`   • Duplicates skipped: ${stats.duplicatesSkipped}`);

            // === STEP 8: Send job alerts ===
            if (matchedJobs.length > 0) {
                context.log(`\n📤 Sending ${matchedJobs.length} job alerts (sorted by relevance)...`);
                
                for (const job of matchedJobs) {
                    try {
                        await sendJobAlert(job, job.matchedKeyword, context);
                        await markJobAsProcessed(jobsClient, job, context);
                        stats.totalSent++;
                    } catch (error) {
                        context.error(`❌ Failed to process job ${job.title}: ${error.message}`);
                    }
                }
                
                await sendSearchComplete(stats.totalMatched, stats.totalSent, stats.duplicatesSkipped, context);
            } else {
                context.log('\n📭 No new matching jobs found');
                await sendNoJobsFound(stats.totalFetched, stats.duplicatesSkipped, isIncremental, context);
            }

            // === STEP 9: Update metadata (CRITICAL for incremental scanning) ===
            const duration = ((new Date() - startTime) / 1000).toFixed(2);
            stats.executionTimeSeconds = parseFloat(duration);
            await updateMetadata(metaClient, stats, context);

            // === STEP 10: Summary ===
            context.log('\n' + '='.repeat(60));
            context.log('📈 Execution Summary:');
            context.log(`   • Scan mode: ${stats.scanMode}`);
            context.log(`   • Jobs fetched: ${stats.totalFetched}`);
            context.log(`   • Matches found: ${stats.totalMatched}`);
            context.log(`   • Duplicates skipped: ${stats.duplicatesSkipped}`);
            context.log(`   • Alerts sent: ${stats.totalSent}`);
            context.log(`   • Duration: ${duration}s`);
            context.log('✅ J-Bot Completed Successfully');
            context.log('='.repeat(60) + '\n');

        } catch (error) {
            context.error('\n' + '='.repeat(60));
            context.error('❌ CRITICAL ERROR:', error.message);
            context.error('Stack trace:', error.stack);
            context.error('='.repeat(60) + '\n');
            throw error;
        }
    }
});
