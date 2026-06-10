const { onCall, HttpsError }    = require('firebase-functions/v2/https');
const { getFirestore }          = require('firebase-admin/firestore');
const { CloudTasksClient }      = require('@google-cloud/tasks');

// Format: projects/{PROJECT_ID}/locations/{LOCATION}/queues/{QUEUE_NAME}
// Set this in Firebase Functions config or Secret Manager

exports.dispatchLeadBatchToTaskQueue = onCall(
  {},
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Not authenticated.');

    const QUEUE_PATH = process.env.CLOUD_TASKS_QUEUE_PATH;
    
    const { leadIds, channel, campaignContext, tenantId } = request.data;
    const db      = getFirestore();
    const client  = new CloudTasksClient();

    // Fetch tenant settings (for validation — actual decryption happens in processLeadTask)
    const settingsSnap = await db.collection('tenantSettings').doc(tenantId).get();
    if (!settingsSnap.exists) {
      throw new HttpsError('not-found', 'Tenant settings not found. Configure API keys first.');
    }
    const settings       = settingsSnap.data();
    const masterPrompt   = settings.masterSystemPrompt ?? '';

    let tasksEnqueued = 0;

    for (let i = 0; i < leadIds.length; i++) {
      const taskPayload = {
        leadId:             leadIds[i],
        channel,
        campaignContext,
        tenantId,
        masterSystemPrompt: masterPrompt,
      };

      const task = {
        httpRequest: {
          httpMethod:  'POST',
          url:         process.env.PROCESS_LEAD_TASK_URL,
          // Format: https://{REGION}-{PROJECT}.cloudfunctions.net/processLeadTask
          headers:     { 'Content-Type': 'application/json' },
          body:        Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
          oidcToken: {
            serviceAccountEmail: process.env.TASK_SERVICE_ACCOUNT_EMAIL,
          },
        },
        // Stagger: delay each task by 2 seconds × its index
        scheduleTime: {
          seconds: Math.floor(Date.now() / 1000) + (i * 2),
        },
      };

      await client.createTask({ parent: QUEUE_PATH, task });
      tasksEnqueued++;
    }

    return { tasksEnqueued };
  }
);
