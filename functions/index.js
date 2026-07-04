const { initializeApp } = require("firebase-admin/app");

initializeApp();

// ── v1 Functions (preserved) ──────────────────────────────────────────────────
const { verifyTenantKeys }            = require("./src/verifyTenantKeys");
const { encryptAndSaveTenantKeys }    = require("./src/encryptAndSaveTenantKeys");
const { crawlAndGeneratePrompt }      = require("./src/crawlAndGeneratePrompt");
const { dispatchLeadBatchToTaskQueue} = require("./src/dispatchLeadBatchToTaskQueue");
const { processLeadTask }             = require("./src/processLeadTask");
const { aiWebhookReceiver }           = require("./src/aiWebhookReceiver");
const { onLeadPhaseChange }           = require("./src/onLeadPhaseChange");

// ── v2 Functions (new) ────────────────────────────────────────────────────────
const { filterGarbageRecords }        = require("./src/filterGarbageRecords");
const { ingestWebhookLeads }          = require("./src/ingestWebhookLeads");
const { autoCommitStagingBatch }      = require("./src/autoCommitStagingBatch");
const { dispatchLeadCycle }           = require("./src/dispatchLeadCycle");
const { processApiCallback }          = require("./src/processApiCallback");
const { convertLeadToOpportunity }    = require("./src/convertLeadToOpportunity");

// ── v1 exports (preserved) ────────────────────────────────────────────────────
exports.verifyTenantKeys            = verifyTenantKeys;
exports.encryptAndSaveTenantKeys    = encryptAndSaveTenantKeys;
exports.crawlAndGeneratePrompt      = crawlAndGeneratePrompt;
exports.dispatchLeadBatchToTaskQueue= dispatchLeadBatchToTaskQueue;
exports.processLeadTask             = processLeadTask;
exports.aiWebhookReceiver           = aiWebhookReceiver;
exports.onLeadPhaseChange           = onLeadPhaseChange;

// ── v2 exports (new) ──────────────────────────────────────────────────────────
exports.filterGarbageRecords        = filterGarbageRecords;
exports.ingestWebhookLeads          = ingestWebhookLeads;
exports.autoCommitStagingBatch      = autoCommitStagingBatch;
exports.dispatchLeadCycle           = dispatchLeadCycle;
exports.processApiCallback          = processApiCallback;
exports.convertLeadToOpportunity    = convertLeadToOpportunity;
