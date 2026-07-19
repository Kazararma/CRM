# CRM - Firebase Cloud Functions

This directory contains the backend logic and automation scripts for the CRM SaaS platform, deployed as Firebase Cloud Functions.

## 🚀 Key Modules

* **Tenant Key Management:** 
  * `verifyTenantKeys`: Validates Twilio, Vapi, Retell, and Bland AI credentials provided by the tenant.
  * `encryptAndSaveTenantKeys`: Securely encrypts and stores the validated API keys in Firestore.
* **AI & Web Crawling:**
  * `crawlAndGeneratePrompt`: Auto-onboarding feature that scrapes a given business URL and generates a Master AI System Prompt for the tenant.
  * `aiWebhookReceiver`: Handles incoming webhooks from external AI providers (e.g., Twilio, Vapi, Bland).
* **Automated Lead Processing:**
  * `dispatchLeadBatchToTaskQueue`: Batches leads and dispatches them to Firebase Cloud Tasks for background processing.
  * `processLeadTask`: Worker function that processes individual lead tasks from the queue.
  * `onLeadPhaseChange`: Firestore trigger that automatically fires when a lead's phase is updated, allowing for targeted automations.

## 🛠️ Setup & Deployment

1. Make sure you have the Firebase CLI installed and are authenticated.
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Navigate to the `functions` directory and install dependencies:
   ```bash
   cd functions
   npm install
   ```
3. Deploy the functions to your Firebase project:
   ```bash
   firebase deploy --only functions
   ```

*Note: Ensure your Firebase project is on the "Blaze" pay-as-you-go plan, as outbound network requests and Cloud Tasks require it.*
