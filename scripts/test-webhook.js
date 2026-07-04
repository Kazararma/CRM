const crypto = require('crypto');

// Only works if node-fetch is installed, but since this is Node 18+, fetch is built-in.
// If using older Node, user might need to npm i node-fetch. Assuming Node 18+.

async function testWebhook() {
  const args = process.argv.slice(2);
  const tenantId = args[0];
  const secret = args[1];

  if (!tenantId || !secret) {
    console.error("Usage: node test-webhook.js <YOUR_TENANT_ID> <YOUR_WEBHOOK_SECRET>");
    console.error("You can find your Tenant ID in your Firestore 'users' collection (it's your auth UID).");
    console.error("Generate a Webhook Secret in the CRM Settings -> System Defaults tab.");
    process.exit(1);
  }

  const webhookUrl = 'https://us-central1-softwarecrm-df174.cloudfunctions.net/ingestWebhookLeads';

  const payload = {
    name: 'E2E Test Lead',
    email: 'test' + Date.now() + '@example.com',
    phone: '+15550001111',
    companyName: 'Testing Corp',
    jobRole: 'QA Engineer',
    category: 'hot',
    executionMode: 'automatic', // This will test E2 as well!
    serviceDescription: 'Testing the end-to-end webhook ingestion and autonomous dispatch loop.',
    tenantId: tenantId
  };

  const payloadString = JSON.stringify(payload);
  
  // Create HMAC SHA256 signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  const signature = hmac.digest('hex');

  console.log(`Sending webhook to ${webhookUrl}...`);
  console.log(`Payload:`, payload);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': signature
      },
      body: payloadString
    });

    const data = await response.json();
    console.log('Status Code:', response.status);
    console.log('Response Body:', data);
    
    if (response.status === 200) {
      console.log('✅ Webhook successfully accepted! Check the Leads tab in your CRM.');
      console.log('Since executionMode is "automatic", this should also trigger the autonomous loop in the background!');
    } else {
      console.log('❌ Webhook failed. Check your secret and tenant ID.');
    }
  } catch (error) {
    console.error('Failed to send webhook:', error);
  }
}

testWebhook();
