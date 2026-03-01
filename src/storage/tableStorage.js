/**
 * Azure Table Storage service
 * Handles all Azure Table Storage operations for job tracking and metadata
 */

const { TableClient } = require('@azure/data-tables');
const { TABLE_NAME, TABLE_META, PARTITION_KEY } = require('../config/constants');

/**
 * Initialize Table Storage clients
 * @param {string} connectionString - Azure Storage connection string
 * @returns {Object} - { jobsClient, metaClient }
 */
function initializeTableClients(connectionString) {
    const jobsClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    const metaClient = TableClient.fromConnectionString(connectionString, TABLE_META);
    
    return { jobsClient, metaClient };
}

/**
 * Create tables if they don't exist
 * @param {TableClient} jobsClient - Jobs table client
 * @param {TableClient} metaClient - Metadata table client
 * @param {Object} context - Azure Functions context for logging
 */
async function ensureTablesExist(jobsClient, metaClient, context) {
    try {
        await jobsClient.createTable();
        context.log('📦 Jobs table ready');
    } catch (error) {
        if (error.statusCode !== 409) { // 409 = already exists
            context.warn('⚠️ Jobs table creation warning:', error.message);
        }
    }
    
    try {
        await metaClient.createTable();
        context.log('📦 Metadata table ready');
    } catch (error) {
        if (error.statusCode !== 409) {
            context.warn('⚠️ Metadata table creation warning:', error.message);
        }
    }
}

/**
 * Check if job already exists in storage
 * @param {TableClient} tableClient - Table client
 * @param {string} jobId - Job ID (hash-based)
 * @param {Object} context - Azure Functions context
 * @returns {Promise<boolean>}
 */
async function isJobProcessed(tableClient, jobId, context) {
    try {
        await tableClient.getEntity(PARTITION_KEY, jobId);
        return true; // Job exists
    } catch (error) {
        if (error.statusCode === 404) {
            return false; // Job doesn't exist
        }
        context.warn(`⚠️ Error checking job existence: ${error.message}`);
        return false;
    }
}

/**
 * Store job in table to prevent future duplicates
 * @param {TableClient} tableClient - Table client
 * @param {Object} job - Job object with slug property
 * @param {Object} context - Azure Functions context
 */
async function markJobAsProcessed(tableClient, job, context) {
    try {
        const entity = {
            partitionKey: PARTITION_KEY,
            rowKey: job.slug,
            title: job.title,
            company: job.company_name || 'N/A',
            processedAt: new Date().toISOString(),
            url: job.url || ''
        };
        await tableClient.createEntity(entity);
        context.log(`✅ Marked as processed: ${job.slug.substring(0, 8)}...`);
    } catch (error) {
        context.warn(`⚠️ Error marking job as processed: ${error.message}`);
    }
}

/**
 * Get last run metadata (for incremental scanning)
 * @param {TableClient} metaClient - Metadata table client
 * @param {Object} context - Azure Functions context
 * @returns {Promise<Object|null>} - Metadata entity or null
 */
async function getLastRunMetadata(metaClient, context) {
    try {
        const entity = await metaClient.getEntity('meta', 'lastRun');
        return entity;
    } catch (error) {
        if (error.statusCode === 404) {
            context.log('ℹ️ No previous run metadata found (first run)');
            return null;
        }
        context.warn(`⚠️ Error getting metadata: ${error.message}`);
        return null;
    }
}

/**
 * Update metadata table with run statistics
 * CRITICAL: This updates lastRunAt timestamp for incremental scanning
 * @param {TableClient} metaClient - Metadata table client
 * @param {Object} stats - Run statistics
 * @param {Object} context - Azure Functions context
 */
async function updateMetadata(metaClient, stats, context) {
    try {
        const entity = {
            partitionKey: 'meta',
            rowKey: 'lastRun',
            lastRunAt: new Date().toISOString(), // Used for incremental scanning
            scanMode: stats.scanMode || 'incremental',
            totalFetched: stats.totalFetched || 0,
            totalNew: stats.totalNew || 0,
            totalMatched: stats.totalMatched || 0,
            duplicatesSkipped: stats.duplicatesSkipped || 0,
            totalSent: stats.totalSent || 0,
            executionTimeSeconds: stats.executionTimeSeconds || 0
        };
        
        // Upsert = update or create
        await metaClient.upsertEntity(entity, 'Replace');
        context.log(`✅ Metadata updated (lastRunAt: ${entity.lastRunAt})`);
    } catch (error) {
        context.warn(`⚠️ Error updating metadata: ${error.message}`);
    }
}

module.exports = {
    initializeTableClients,
    ensureTablesExist,
    isJobProcessed,
    markJobAsProcessed,
    getLastRunMetadata,
    updateMetadata
};
