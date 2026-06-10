const { initializeApp } = require("firebase-admin/app");

initializeApp();

const { verifyTenantKeys } = require("./src/verifyTenantKeys");
const { encryptAndSaveTenantKeys } = require("./src/encryptAndSaveTenantKeys");
const { crawlAndGeneratePrompt } = require("./src/crawlAndGeneratePrompt");
const { dispatchLeadBatchToTaskQueue } = require("./src/dispatchLeadBatchToTaskQueue");
const { processLeadTask } = require("./src/processLeadTask");
const { aiWebhookReceiver } = require("./src/aiWebhookReceiver");
const { onLeadPhaseChange } = require("./src/onLeadPhaseChange");

exports.verifyTenantKeys = verifyTenantKeys;
exports.encryptAndSaveTenantKeys = encryptAndSaveTenantKeys;
exports.crawlAndGeneratePrompt = crawlAndGeneratePrompt;
exports.dispatchLeadBatchToTaskQueue = dispatchLeadBatchToTaskQueue;
exports.processLeadTask = processLeadTask;
exports.aiWebhookReceiver = aiWebhookReceiver;
exports.onLeadPhaseChange = onLeadPhaseChange;
