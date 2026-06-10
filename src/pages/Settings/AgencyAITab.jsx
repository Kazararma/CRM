import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { functions } from '../../firebase/config';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function AgencyAITab() {
  const { currentUser } = useAuth();
  
  const [twilioSid,     setTwilioSid]     = useState('');
  const [twilioToken,   setTwilioToken]   = useState('');
  const [twilioWhatsappNumber, setTwilioWhatsappNumber] = useState('');
  const [vapiKey,       setVapiKey]       = useState('');
  const [vapiPhoneNumberId, setVapiPhoneNumberId] = useState('');
  const [blandKey,      setBlandKey]      = useState('');
  
  const [isVerifying,   setIsVerifying]   = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [verifyStatus,  setVerifyStatus]  = useState(null);
  const [saveError,     setSaveError]     = useState(null);
  const [saveSuccess,   setSaveSuccess]   = useState(false);

  // Crawler State
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState('');
  const [crawlError, setCrawlError] = useState(null);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [promptSaveSuccess, setPromptSaveSuccess] = useState(false);
  const handleVerifyKeys = async () => {
    setIsVerifying(true);
    setVerifyStatus(null);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const verifyFn = httpsCallable(functions, 'verifyTenantKeys');
      const result   = await verifyFn({ twilioSid, twilioToken, twilioWhatsappNumber, vapiKey, vapiPhoneNumberId, blandKey });
      setVerifyStatus(result.data);
    } catch (err) {
      setSaveError(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveKeys = async () => {
    if (!verifyStatus || verifyStatus.twilio !== 'ok' || (verifyStatus.vapi !== 'ok' && verifyStatus.bland !== 'ok')) {
      setSaveError('Please verify your keys (Twilio + either Vapi or Bland) before saving.');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      const encryptFn = httpsCallable(functions, 'encryptAndSaveTenantKeys');
      await encryptFn({ twilioSid, twilioToken, twilioWhatsappNumber, vapiKey, vapiPhoneNumberId, blandKey, tenantId: currentUser.uid });
      setSaveSuccess(true);
      // Optional: Clear form or leave it populated
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCrawl = async () => {
    if (!crawlUrl) return;
    setIsCrawling(true);
    setCrawlError(null);
    setMasterPrompt('');
    setPromptSaveSuccess(false);
    
    try {
      const crawlFn = httpsCallable(functions, 'crawlAndGeneratePrompt');
      const result = await crawlFn({ url: crawlUrl });
      setMasterPrompt(result.data.systemPrompt);
    } catch (err) {
      setCrawlError(err.message);
    } finally {
      setIsCrawling(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!masterPrompt) return;
    setIsSavingPrompt(true);
    setPromptSaveSuccess(false);
    
    // In a real scenario, you'd save to tenantSettings document using Firestore directly or via a Function
    // For now we simulate success or build a quick function if needed, but the prompt says 
    // "persist the returned AI prompt into the tenantSettings Firestore document."
    // Let's implement that directly using Firestore since we have super_admin access via rules.
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase/config');
      await setDoc(doc(db, 'tenantSettings', currentUser.uid), {
        masterAiPrompt: masterPrompt
      }, { merge: true });
      setPromptSaveSuccess(true);
    } catch (err) {
      setCrawlError(err.message);
    } finally {
      setIsSavingPrompt(false);
    }
  };


  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Agency AI & Telephony</h2>
        <p className="text-sm text-slate-500 mt-1">Configure credentials for AI voice features and outbound messaging.</p>
      </div>

      <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
        {/* Twilio Config */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2">Twilio Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Account SID</label>
              <input
                type="text"
                value={twilioSid}
                onChange={(e) => setTwilioSid(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="AC..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Auth Token</label>
              <input
                type="password"
                value={twilioToken}
                onChange={(e) => setTwilioToken(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">WhatsApp Number</label>
              <input
                type="text"
                value={twilioWhatsappNumber}
                onChange={(e) => setTwilioWhatsappNumber(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="+14155238886"
              />
            </div>
          </div>
        </div>

        {/* Voice AI Config */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2 mt-6">Voice AI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Vapi / Retell Private API Key</label>
              <input
                type="password"
                value={vapiKey}
                onChange={(e) => setVapiKey(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="••••••••••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Vapi Phone Number ID</label>
              <input
                type="text"
                value={vapiPhoneNumberId}
                onChange={(e) => setVapiPhoneNumberId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="Unique ID from Vapi Dashboard"
              />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2 mt-6">Bland AI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bland AI API Key</label>
              <input
                type="password"
                value={blandKey}
                onChange={(e) => setBlandKey(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="sk-..."
              />
            </div>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleVerifyKeys}
              disabled={isVerifying || !twilioSid || !twilioToken || !twilioWhatsappNumber || (!vapiKey && !blandKey)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {isVerifying ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Verify Keys
            </button>
            <button
              onClick={handleSaveKeys}
              disabled={isSaving || !verifyStatus || verifyStatus.twilio !== 'ok' || (verifyStatus.vapi !== 'ok' && verifyStatus.bland !== 'ok')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Save Encrypted Keys
            </button>
          </div>

          {verifyStatus && (
            <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 w-16">Twilio:</span>
                {verifyStatus.twilio === 'ok' ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 size={16}/> Connected</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-red-600"><XCircle size={16}/> Invalid Credentials</span>
                )}
              </div>
              {vapiKey && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 w-16">Vapi:</span>
                  {verifyStatus.vapi === 'ok' ? (
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 size={16}/> Connected</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600"><XCircle size={16}/> Invalid API Key</span>
                  )}
                </div>
              )}
              {blandKey && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 w-16">Bland:</span>
                  {verifyStatus.bland === 'ok' ? (
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 size={16}/> Connected</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600"><XCircle size={16}/> Invalid API Key</span>
                  )}
                </div>
              )}
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
              {saveError}
            </div>
          )}
          
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 size={18} />
              Keys encrypted and saved securely!
            </div>
          )}
        </div>
      </div>

      {/* Auto-Onboarding Crawler Section */}
      <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6 mt-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2">Auto-Onboarding Crawler</h3>
          <p className="text-sm text-gray-500 mb-4">Enter a business URL to automatically scrape context and generate a Master AI System Prompt.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Business URL</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="url"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  className="flex-1 min-w-0 block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <button
              onClick={handleCrawl}
              disabled={isCrawling || !crawlUrl}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCrawling ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Scrape & Generate
            </button>

            {crawlError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                {crawlError}
              </div>
            )}

            {masterPrompt && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Master AI System Prompt</label>
                <textarea
                  value={masterPrompt}
                  onChange={(e) => setMasterPrompt(e.target.value)}
                  rows={10}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border font-mono text-xs"
                />
                
                <div className="mt-4 flex items-center gap-4">
                  <button
                    onClick={handleSavePrompt}
                    disabled={isSavingPrompt}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingPrompt ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    Save Master Prompt
                  </button>

                  {promptSaveSuccess && (
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                      <CheckCircle2 size={16} /> Saved to Firestore!
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
